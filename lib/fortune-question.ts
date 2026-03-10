import type { DailyFortune } from "./fortune";
import { getSeoulDateKey } from "./seoul-time";

type QuestionTopic = "work" | "money" | "relationship" | "health" | "general";

export type FortuneQuestionAnswer = {
  title: string;
  description: string;
  topic: QuestionTopic;
  usedLlm: boolean;
};

const QUESTION_CACHE_TTL_MS = 1000 * 60 * 60 * 6;
const MAX_CACHE_ENTRIES = 200;
const questionCache = new Map<string, { expiresAt: number; value: FortuneQuestionAnswer }>();

const TOPIC_KEYWORDS: Record<QuestionTopic, string[]> = {
  work: ["일", "직장", "회사", "업무", "과제", "공부", "학업", "시험", "면접", "승진", "발표"],
  money: ["돈", "재물", "금전", "지출", "소비", "투자", "계약", "매매", "매출", "수입"],
  relationship: ["연애", "사랑", "썸", "소개팅", "애인", "커플", "인간관계", "모임", "친구", "대인관계"],
  health: ["건강", "몸", "컨디션", "체력", "운동", "휴식", "병원", "잠", "회복"],
  general: [],
};

function hasOpenAiApiKey(): boolean {
  return typeof process.env.OPENAI_API_KEY === "string" && process.env.OPENAI_API_KEY.trim().length > 0;
}

function resolveModel(): string {
  return process.env.OPENAI_QUESTION_MODEL?.trim() || process.env.OPENAI_FORTUNE_MODEL?.trim() || "gpt-4.1-mini";
}

function cleanModelJson(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("```")) {
    return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  }
  const jsonStart = trimmed.indexOf("{");
  const jsonEnd = trimmed.lastIndexOf("}");
  if (jsonStart >= 0 && jsonEnd > jsonStart) {
    return trimmed.slice(jsonStart, jsonEnd + 1);
  }
  return trimmed;
}

function extractResponseText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const source = payload as Record<string, unknown>;
  if (typeof source.output_text === "string" && source.output_text.trim()) {
    return source.output_text.trim();
  }

  const output = Array.isArray(source.output) ? source.output : [];
  const textParts = output.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const content = Array.isArray((item as Record<string, unknown>).content)
      ? ((item as Record<string, unknown>).content as unknown[])
      : [];
    return content
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;
        const text = (entry as Record<string, unknown>).text;
        return typeof text === "string" ? text : null;
      })
      .filter((entry): entry is string => Boolean(entry));
  });

  return textParts.join("\n").trim();
}

function pruneCache(): void {
  const now = Date.now();
  for (const [key, value] of questionCache.entries()) {
    if (value.expiresAt <= now) {
      questionCache.delete(key);
    }
  }

  if (questionCache.size <= MAX_CACHE_ENTRIES) {
    return;
  }

  const overflow = questionCache.size - MAX_CACHE_ENTRIES;
  const keys = [...questionCache.keys()].slice(0, overflow);
  keys.forEach((key) => questionCache.delete(key));
}

function normalizeQuestion(question: string): string {
  return question.trim().replace(/\s+/g, " ");
}

export function isLikelyFortuneQuestion(question: string): boolean {
  const normalized = normalizeQuestion(question).toLowerCase();
  if (!normalized) return false;

  const directSignals = ["?", "어때", "될까", "괜찮", "좋을까", "운세", "봐줘", "알려", "궁금", "조언"];
  if (directSignals.some((signal) => normalized.includes(signal))) {
    return true;
  }

  return (Object.keys(TOPIC_KEYWORDS) as QuestionTopic[]).some((topic) =>
    TOPIC_KEYWORDS[topic].some((keyword) => normalized.includes(keyword.toLowerCase())),
  );
}

function inferQuestionTopic(question: string): QuestionTopic {
  const normalized = normalizeQuestion(question).toLowerCase();
  const orderedTopics: QuestionTopic[] = ["relationship", "money", "work", "health"];

  for (const topic of orderedTopics) {
    if (TOPIC_KEYWORDS[topic].some((keyword) => normalized.includes(keyword.toLowerCase()))) {
      return topic;
    }
  }

  return "general";
}

function buildCacheKey(params: {
  question: string;
  fortune: DailyFortune;
  profileName?: string;
  date: Date;
}): string {
  return JSON.stringify({
    question: normalizeQuestion(params.question),
    profileName: params.profileName ?? null,
    date: getSeoulDateKey(params.date),
    score: params.fortune.score,
    grade: params.fortune.grade,
    todayGanji: params.fortune.analysis.todayGanji,
    todayRelation: params.fortune.analysis.todayRelation,
    directiveDelta: params.fortune.analysis.directiveDelta,
    yongShin: params.fortune.analysis.yongShin,
    giShin: params.fortune.analysis.giShin,
    referenceMode: params.fortune.analysis.referenceMode,
    relationStrengthSummary: params.fortune.analysis.relationStrengthSummary,
    relationStrengthAction: params.fortune.analysis.relationStrengthAction,
    certainty: params.fortune.analysis.certainty,
    uncertaintyMessage: params.fortune.analysis.uncertaintyMessage,
    todayBranchImpact: params.fortune.analysis.todayBranchImpact,
    todayBranchSummary: params.fortune.analysis.todayBranchSummary,
    todayBranchInteractions: params.fortune.analysis.todayBranchInteractions.map((interaction) => ({
      pillar: interaction.pillar,
      type: interaction.type,
      weight: interaction.weight,
    })),
    model: resolveModel(),
  });
}

function buildPromptContext(params: {
  question: string;
  fortune: DailyFortune;
  profileName?: string;
  date: Date;
  topic: QuestionTopic;
}): string {
  const category =
    params.topic === "general"
      ? null
      : params.fortune.categoryScores.find(
          (item) => item.key === params.topic || (params.topic === "relationship" && item.key === "relationship"),
        );

  return JSON.stringify(
    {
      profileName: params.profileName ?? null,
      question: normalizeQuestion(params.question),
      topic: params.topic,
      todayDate: getSeoulDateKey(params.date),
      fortune: {
        score: params.fortune.score,
        grade: params.fortune.grade,
        headline: params.fortune.headline,
        summary: params.fortune.summary,
        detail: params.fortune.detail,
        caution: params.fortune.caution,
        recommendedActions: params.fortune.recommendedActions,
        avoidToday: params.fortune.avoidToday,
        keywords: params.fortune.keywords,
        category,
        analysis: {
          todayGanji: params.fortune.analysis.todayGanji,
          todayRelation: params.fortune.analysis.todayRelation,
          certainty: params.fortune.analysis.certainty,
          uncertaintyMessage: params.fortune.analysis.uncertaintyMessage,
          referenceMode: params.fortune.analysis.referenceMode,
          directiveDelta: params.fortune.analysis.directiveDelta,
          directiveSummary: params.fortune.analysis.directiveSummary,
          relationStrengthSummary: params.fortune.analysis.relationStrengthSummary,
          relationStrengthDetail: params.fortune.analysis.relationStrengthDetail,
          relationStrengthCaution: params.fortune.analysis.relationStrengthCaution,
          relationStrengthAction: params.fortune.analysis.relationStrengthAction,
          relationStrengthAvoid: params.fortune.analysis.relationStrengthAvoid,
          todayBranchImpact: params.fortune.analysis.todayBranchImpact,
          todayBranchSummary: params.fortune.analysis.todayBranchSummary,
          todayBranchInteractions: params.fortune.analysis.todayBranchInteractions,
          strengthLevel: params.fortune.analysis.strengthLevel,
          dominantTenGod: params.fortune.analysis.dominantTenGod,
          patternName: params.fortune.analysis.patternName,
          yongShin: params.fortune.analysis.yongShin,
          heeShin: params.fortune.analysis.heeShin,
          giShin: params.fortune.analysis.giShin,
          guShin: params.fortune.analysis.guShin,
          yongShinReason: params.fortune.analysis.yongShinReason,
          giShinReason: params.fortune.analysis.giShinReason,
          usefulElements: params.fortune.analysis.usefulElements,
          unfavorableElements: params.fortune.analysis.unfavorableElements,
        },
      },
    },
    null,
    2,
  );
}

function parseQuestionAnswer(payload: unknown, topic: QuestionTopic): FortuneQuestionAnswer | null {
  if (!payload || typeof payload !== "object") return null;
  const source = payload as Record<string, unknown>;
  const title = typeof source.title === "string" ? source.title.trim() : "";
  const description = typeof source.description === "string" ? source.description.trim() : "";

  if (!title || !description) {
    return null;
  }

  return {
    title,
    description,
    topic,
    usedLlm: true,
  };
}

function fallbackTitle(topic: QuestionTopic): string {
  switch (topic) {
    case "work":
      return "도령의 일풀이";
    case "money":
      return "도령의 재물풀이";
    case "relationship":
      return "도령의 인연풀이";
    case "health":
      return "도령의 기력풀이";
    default:
      return "도령의 운세풀이";
  }
}

function buildFallbackAnswer(params: {
  question: string;
  fortune: DailyFortune;
  topic: QuestionTopic;
}): FortuneQuestionAnswer {
  const category =
    params.topic === "general"
      ? params.fortune.categoryScores[0]
      : params.fortune.categoryScores.find((item) => item.key === params.topic) ?? params.fortune.categoryScores[0];

  const focusAction = params.fortune.recommendedActions[0] ?? "지금 할 수 있는 일을 차분히 정리해 보시오.";
  const caution = params.fortune.avoidToday[0] ?? params.fortune.caution;
  const branchSummary =
    params.fortune.analysis.todayBranchInteractions.length > 0 &&
    !params.fortune.summary.includes(params.fortune.analysis.todayBranchSummary)
      ? params.fortune.analysis.todayBranchSummary
      : null;
  const directiveLine =
    params.fortune.analysis.directiveDelta >= 3
      ? "오늘은 용신 쪽이 받쳐 주니, 가볍게 움직여도 흐름을 세우기 좋소."
      : params.fortune.analysis.directiveDelta <= -3
        ? "오늘은 기신이 올라오니, 무리하게 밀기보다 보수적으로 흐름을 다루는 편이 낫소."
        : null;
  const relationLine = params.fortune.analysis.relationStrengthSummary;
  const relationAction = params.fortune.analysis.relationStrengthAction;
  const relationCaution = params.fortune.analysis.relationStrengthCaution;
  const uncertaintyLead =
    params.fortune.analysis.certainty === "calendar-unknown"
      ? params.fortune.analysis.uncertaintyMessage ?? "달력 기준이 확정되지 않아 참고용 풀이로만 보아야 하오."
      : null;

  const description =
    params.topic === "general"
      ? [
          uncertaintyLead,
          `오늘 전체 흐름은 ${params.fortune.score}점인 ${params.fortune.grade} 쪽에 가깝소.`,
          params.fortune.summary,
          relationLine,
          branchSummary,
          directiveLine,
          `우선 ${relationAction ?? focusAction} 쪽으로 움직이고, ${relationCaution ?? caution}`,
        ]
          .filter((line): line is string => Boolean(line))
          .join(" ")
      : [
          uncertaintyLead,
          `${category.label} 흐름은 ${category.score}점 정도로 읽히오.`,
          category.summary,
          relationLine,
          branchSummary,
          directiveLine,
          `이 일에는 ${relationAction ?? focusAction} 쪽이 맞겠으나, ${relationCaution ?? caution}`,
        ]
          .filter((line): line is string => Boolean(line))
          .join(" ");

  return {
    title: fallbackTitle(params.topic),
    description,
    topic: params.topic,
    usedLlm: false,
  };
}

export async function answerFortuneQuestion(params: {
  question: string;
  fortune: DailyFortune;
  profileName?: string;
  date?: Date;
}): Promise<FortuneQuestionAnswer> {
  const date = params.date ?? new Date();
  const topic = inferQuestionTopic(params.question);
  const fallback = buildFallbackAnswer({
    question: params.question,
    fortune: params.fortune,
    topic,
  });

  if (!hasOpenAiApiKey()) {
    return fallback;
  }

  pruneCache();
  const cacheKey = buildCacheKey({
    question: params.question,
    fortune: params.fortune,
    profileName: params.profileName,
    date,
  });

  const cached = questionCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
        body: JSON.stringify({
          model: resolveModel(),
          store: false,
          instructions:
          "You answer Korean daily fortune questions for a Kakao chatbot. Facts are deterministic and must not be changed or invented. Return strict JSON only with keys title and description. title must be under 18 Korean characters. description must be 2 to 4 concise Korean sentences, under 260 characters if possible. Answer only from the provided fortune facts. Use a concise respectful fortune-teller tone in Korean, a light 도령체. Prefer endings like 하오, 좋겠소, 이로구나 naturally and sparingly. Never use plain modern customer-service tone. Do not give medical, legal, or investment advice. Do not exaggerate. Mention one helpful action and one caution naturally when relevant. If certainty is calendar-unknown, clearly say the answer is reference-only and never imply an exact manse or confirmed lunar/solar basis. If referenceMode is solar-lunar-blend, explain it as a common trend across both solar and lunar possibilities. No markdown, no code fences, no emojis.",
        input: buildPromptContext({
          question: params.question,
          fortune: params.fortune,
          profileName: params.profileName,
          date,
          topic,
        }),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(4500),
    });

    if (!response.ok) {
      return fallback;
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const outputText = extractResponseText(payload);
    if (!outputText) {
      return fallback;
    }

    const parsed = parseQuestionAnswer(JSON.parse(cleanModelJson(outputText)), topic);
    if (!parsed) {
      return fallback;
    }

    questionCache.set(cacheKey, {
      expiresAt: Date.now() + QUESTION_CACHE_TTL_MS,
      value: parsed,
    });

    return parsed;
  } catch {
    return fallback;
  }
}
