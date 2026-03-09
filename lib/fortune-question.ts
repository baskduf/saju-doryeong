import type { DailyFortune } from "./fortune";

type QuestionTopic = "work" | "money" | "relationship" | "health" | "general";

export type FortuneQuestionAnswer = {
  title: string;
  description: string;
  topic: QuestionTopic;
  usedLlm: boolean;
};

const QUESTION_CACHE_TTL_MS = 1000 * 60 * 60 * 6;
const questionCache = new Map<string, { expiresAt: number; value: FortuneQuestionAnswer }>();

const TOPIC_KEYWORDS: Record<QuestionTopic, string[]> = {
  work: ["일", "직장", "회사", "업무", "과제", "공부", "학업", "시험", "면접", "승진", "발표"],
  money: ["돈", "재물", "금전", "지출", "소비", "투자", "계약", "매매", "매출", "수입"],
  relationship: ["연애", "사랑", "썸", "소개팅", "애인", "커플", "인간관계", "사람", "친구", "대인관계"],
  health: ["건강", "몸", "컨디션", "체력", "피곤", "휴식", "병원", "잠", "회복"],
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
}

function normalizeQuestion(question: string): string {
  return question.trim().replace(/\s+/g, " ");
}

export function isLikelyFortuneQuestion(question: string): boolean {
  const normalized = normalizeQuestion(question).toLowerCase();
  if (!normalized) return false;

  const directSignals = ["?", "어때", "될까", "괜찮", "좋을까", "운세", "운", "알려", "봐줘", "궁금"];
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
    date: params.date.toISOString().slice(0, 10),
    score: params.fortune.score,
    grade: params.fortune.grade,
    todayGanji: params.fortune.analysis.todayGanji,
    todayRelation: params.fortune.analysis.todayRelation,
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
      : params.fortune.categoryScores.find((item) => item.key === params.topic || (params.topic === "relationship" && item.key === "relationship"));

  return JSON.stringify(
    {
      profileName: params.profileName ?? null,
      question: normalizeQuestion(params.question),
      topic: params.topic,
      todayDate: params.date.toISOString().slice(0, 10),
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
          strengthLevel: params.fortune.analysis.strengthLevel,
          dominantTenGod: params.fortune.analysis.dominantTenGod,
          patternName: params.fortune.analysis.patternName,
          yongShin: params.fortune.analysis.yongShin,
          giShin: params.fortune.analysis.giShin,
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
      return "오늘의 일과 흐름";
    case "money":
      return "오늘의 재물 흐름";
    case "relationship":
      return "오늘의 관계 흐름";
    case "health":
      return "오늘의 컨디션 흐름";
    default:
      return "오늘의 운세 답변";
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

  const focusAction = params.fortune.recommendedActions[0] ?? "지금 할 일을 짧게 정리해 보시오.";
  const caution = params.fortune.avoidToday[0] ?? params.fortune.caution;

  const description =
    params.topic === "general"
      ? [
          `오늘 전체 흐름은 ${params.fortune.score}점으로 ${params.fortune.grade} 쪽에 가깝습니다.`,
          params.fortune.summary,
          `우선 ${focusAction} 그리고 ${caution}`,
        ].join(" ")
      : [
          `${category.label} 흐름은 ${category.score}점 정도로 보입니다.`,
          category.summary,
          `질문과 관련해선 ${focusAction} 다만 ${caution}`,
        ].join(" ");

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
          "You answer Korean daily fortune questions for a Kakao chatbot. Facts are deterministic and must not be changed or invented. Return strict JSON only with keys title and description. title must be under 18 Korean characters. description must be 2 to 4 concise Korean sentences, under 260 characters if possible. Answer only from the provided fortune facts. Do not give medical, legal, or investment advice. Do not exaggerate. Mention one helpful action and one caution naturally when relevant. No markdown, no code fences, no emojis.",
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
