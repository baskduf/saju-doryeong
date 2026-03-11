import type {
  DailyFortune,
  DailyFortuneInsight,
  DailyFortuneInsightKey,
} from "./fortune";
import { getSeoulDateKey } from "./seoul-time";
import {
  buildYukhyoReading,
  type YukhyoOracleMeta,
  type YukhyoReading,
} from "./yukhyo";

type QuestionTopic = "work" | "money" | "relationship" | "health" | "general";
type QuestionIntent = "outcome" | "action" | "timing" | "approach" | "caution";
type QuestionRelationshipKind = "romance" | "social" | "generic";

type QuestionAnalysis = {
  topic: QuestionTopic;
  intent: QuestionIntent;
  relationshipKind: QuestionRelationshipKind;
  primaryInsight: DailyFortuneInsight;
  secondaryInsight: DailyFortuneInsight;
};

type QuestionSignalStrength = "aggressive" | "balanced" | "conservative";
type OracleInfluenceChannel = "direction" | "timing" | "caution";
type ConflictResolutionStatus = "aligned" | "question-signal-conflict" | "reference-priority";

export type FortuneQuestionDecisionBasis = {
  topic: QuestionTopic;
  intent: QuestionIntent;
  relationshipKind: QuestionRelationshipKind;
  primaryInsightKey: DailyFortuneInsightKey;
  secondaryInsightKey: DailyFortuneInsightKey;
};

export type FortuneQuestionOracleInfluence = {
  channels: OracleInfluenceChannel[];
  summary: string;
};

export type FortuneQuestionConflictResolution = {
  status: ConflictResolutionStatus;
  summary: string;
  appliedPolicy: string;
};

export type FortuneQuestionAnswer = {
  title: string;
  description: string;
  topic: QuestionTopic;
  usedLlm: boolean;
  sources: Array<"daily" | "yukhyo">;
  oracleMeta?: YukhyoOracleMeta;
  decisionBasis: FortuneQuestionDecisionBasis;
  oracleInfluence: FortuneQuestionOracleInfluence;
  conflictResolution: FortuneQuestionConflictResolution;
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

const INTENT_KEYWORDS: Array<[QuestionIntent, string[]]> = [
  ["caution", ["조심", "피해야", "위험", "실수", "망칠", "문제", "싸울"]],
  ["timing", ["언제", "지금", "오늘", "오전", "오후", "타이밍", "먼저", "기다릴", "미뤄"]],
  ["approach", ["어떻게", "어떤 태도", "말투", "거리", "조율", "대화", "방식"]],
  ["action", ["할까", "해도", "가도", "보내도", "연락", "고백", "지원", "투자", "시작", "움직일"]],
  ["outcome", ["될까", "어떨까", "괜찮을까", "잘될까", "통할까", "붙을까", "성공"]],
];

const RELATIONSHIP_KIND_KEYWORDS: Record<QuestionRelationshipKind, string[]> = {
  romance: ["연애", "사랑", "썸", "소개팅", "애인", "고백", "재회", "데이트"],
  social: ["친구", "인간관계", "대인관계", "모임", "동료", "상사", "팀", "가족"],
  generic: [],
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

function includesAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword.toLowerCase()));
}

export function isLikelyFortuneQuestion(question: string): boolean {
  const normalized = normalizeQuestion(question).toLowerCase();
  if (!normalized) return false;

  const directSignals = ["?", "어때", "될까", "괜찮", "좋을까", "운세", "봐줘", "알려", "궁금", "조언"];
  if (directSignals.some((signal) => normalized.includes(signal))) {
    return true;
  }

  return (
    (Object.keys(TOPIC_KEYWORDS) as QuestionTopic[]).some((topic) =>
      TOPIC_KEYWORDS[topic].some((keyword) => normalized.includes(keyword.toLowerCase())),
    ) || INTENT_KEYWORDS.some(([, keywords]) => includesAny(normalized, keywords))
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

function inferQuestionIntent(question: string): QuestionIntent {
  const normalized = normalizeQuestion(question).toLowerCase();

  for (const [intent, keywords] of INTENT_KEYWORDS) {
    if (includesAny(normalized, keywords)) {
      return intent;
    }
  }

  return "outcome";
}

function inferRelationshipKind(question: string): QuestionRelationshipKind {
  const normalized = normalizeQuestion(question).toLowerCase();

  if (includesAny(normalized, RELATIONSHIP_KIND_KEYWORDS.romance)) {
    return "romance";
  }
  if (includesAny(normalized, RELATIONSHIP_KIND_KEYWORDS.social)) {
    return "social";
  }

  return "generic";
}

function resolveInsightKeys(params: {
  topic: QuestionTopic;
  intent: QuestionIntent;
  relationshipKind: QuestionRelationshipKind;
}): [DailyFortuneInsightKey, DailyFortuneInsightKey] {
  const { topic, intent, relationshipKind } = params;

  if (topic === "work") {
    if (intent === "outcome") return ["work", "approach"];
    if (intent === "action") return ["work", "timing"];
    if (intent === "timing") return ["timing", "work"];
    if (intent === "approach") return ["approach", "work"];
    return ["risk", "work"];
  }

  if (topic === "money") {
    if (intent === "outcome") return ["money", "risk"];
    if (intent === "action") return ["money", "timing"];
    if (intent === "timing") return ["timing", "money"];
    if (intent === "approach") return ["approach", "money"];
    return ["risk", "money"];
  }

  if (topic === "health") {
    if (intent === "outcome") return ["health", "approach"];
    if (intent === "action") return ["health", "timing"];
    if (intent === "timing") return ["timing", "health"];
    if (intent === "approach") return ["approach", "health"];
    return ["risk", "health"];
  }

  if (topic === "relationship") {
    if (intent === "outcome") return ["relationship", relationshipKind === "romance" ? "timing" : "approach"];
    if (intent === "action") return [relationshipKind === "romance" ? "timing" : "approach", "relationship"];
    if (intent === "timing") return ["timing", "relationship"];
    if (intent === "approach") return ["approach", "relationship"];
    return ["risk", "relationship"];
  }

  if (intent === "outcome") return ["approach", "risk"];
  if (intent === "action") return ["approach", "timing"];
  if (intent === "timing") return ["timing", "approach"];
  if (intent === "approach") return ["approach", "risk"];
  return ["risk", "approach"];
}

function findInsight(fortune: DailyFortune, key: DailyFortuneInsightKey): DailyFortuneInsight {
  return fortune.insights.find((insight) => insight.key === key) ?? fortune.featuredInsight;
}

function buildQuestionAnalysis(question: string, fortune: DailyFortune): QuestionAnalysis {
  const topic = inferQuestionTopic(question);
  const intent = inferQuestionIntent(question);
  const relationshipKind = topic === "relationship" ? inferRelationshipKind(question) : "generic";
  const [primaryKey, secondaryKey] = resolveInsightKeys({
    topic,
    intent,
    relationshipKind,
  });

  return {
    topic,
    intent,
    relationshipKind,
    primaryInsight: findInsight(fortune, primaryKey),
    secondaryInsight: findInsight(fortune, secondaryKey),
  };
}

function buildDecisionBasis(analysis: QuestionAnalysis): FortuneQuestionDecisionBasis {
  return {
    topic: analysis.topic,
    intent: analysis.intent,
    relationshipKind: analysis.relationshipKind,
    primaryInsightKey: analysis.primaryInsight.key,
    secondaryInsightKey: analysis.secondaryInsight.key,
  };
}

function inferBaseSignalStrength(params: {
  analysis: QuestionAnalysis;
  fortune: DailyFortune;
}): QuestionSignalStrength {
  if (
    params.fortune.analysis.certainty === "calendar-unknown" ||
    params.fortune.grade === "주의" ||
    params.analysis.primaryInsight.key === "risk" ||
    params.analysis.topic === "health"
  ) {
    return "conservative";
  }

  if (
    params.fortune.grade === "대길" ||
    params.analysis.primaryInsight.key === "work" ||
    params.analysis.primaryInsight.key === "money" ||
    params.analysis.intent === "action" ||
    params.analysis.intent === "approach" ||
    params.analysis.intent === "outcome" ||
    params.analysis.intent === "timing"
  ) {
    return "aggressive";
  }

  return "balanced";
}

function buildOracleInfluence(params: {
  analysis: QuestionAnalysis;
  oracle: YukhyoReading;
}): FortuneQuestionOracleInfluence {
  const channels = new Set<OracleInfluenceChannel>(["caution"]);

  if (
    params.analysis.intent === "action" ||
    params.analysis.intent === "approach" ||
    params.analysis.intent === "outcome"
  ) {
    channels.add("direction");
  }

  if (params.analysis.intent === "timing" || params.analysis.primaryInsight.key === "timing") {
    channels.add("timing");
  }

  const orderedChannels = ["direction", "timing", "caution"].filter((channel) =>
    channels.has(channel as OracleInfluenceChannel),
  ) as OracleInfluenceChannel[];

  return {
    channels: orderedChannels,
    summary: `육효는 ${orderedChannels.join(", ")} 채널에서 답변을 보강하며 ${params.oracle.answerTrend} 방향의 신호를 보태오.`,
  };
}

function buildConflictResolution(params: {
  analysis: QuestionAnalysis;
  fortune: DailyFortune;
  oracle: YukhyoReading;
}): FortuneQuestionConflictResolution {
  if (params.fortune.analysis.certainty === "calendar-unknown") {
    return {
      status: "reference-priority",
      summary: "달력 기준이 미확정이라 육효와 기본 인사이트의 차이보다 참고용 성격을 먼저 드러내오.",
      appliedPolicy: "불확실성 우선",
    };
  }

  const baseSignal = inferBaseSignalStrength({
    analysis: params.analysis,
    fortune: params.fortune,
  });

  if (params.oracle.answerTrend === "positive" && baseSignal === "conservative") {
    return {
      status: "question-signal-conflict",
      summary: "육효는 가능성을 밀어 주지만 기본 인사이트는 보수적이니 속도를 조절하는 쪽으로 중재하오.",
      appliedPolicy: "가능성은 있으나 속도를 조절",
    };
  }

  if (params.oracle.answerTrend === "negative" && baseSignal === "aggressive") {
    return {
      status: "question-signal-conflict",
      summary: "육효는 제동을 거나 기본 인사이트는 전진 쪽이라 무리를 금지하는 쪽으로 중재하오.",
      appliedPolicy: "기회는 있으나 무리 금지",
    };
  }

  return {
    status: "aligned",
    summary: "육효와 기본 인사이트가 크게 충돌하지 않아 같은 결로 답변을 정리하오.",
    appliedPolicy: "기본 흐름 유지",
  };
}

function buildCacheKey(params: {
  question: string;
  fortune: DailyFortune;
  analysis: QuestionAnalysis;
  oracle: YukhyoReading;
  conflictResolution: FortuneQuestionConflictResolution;
  profileName?: string;
  date: Date;
}): string {
  return JSON.stringify({
    question: normalizeQuestion(params.question),
    profileName: params.profileName ?? null,
    date: getSeoulDateKey(params.date),
    score: params.fortune.score,
    grade: params.fortune.grade,
    topic: params.analysis.topic,
    intent: params.analysis.intent,
    relationshipKind: params.analysis.relationshipKind,
    primaryInsight: params.analysis.primaryInsight.key,
    secondaryInsight: params.analysis.secondaryInsight.key,
    certainty: params.fortune.analysis.certainty,
    referenceMode: params.fortune.analysis.referenceMode,
    uncertaintyMessage: params.fortune.analysis.uncertaintyMessage,
    primaryHexagram: params.oracle.primaryHexagram,
    changedHexagram: params.oracle.changedHexagram,
    movingLines: params.oracle.movingLines,
    answerTrend: params.oracle.answerTrend,
    conflictResolution: params.conflictResolution.status,
    conflictPolicy: params.conflictResolution.appliedPolicy,
    model: resolveModel(),
  });
}

function buildPromptContext(params: {
  question: string;
  fortune: DailyFortune;
  analysis: QuestionAnalysis;
  oracle: YukhyoReading;
  oracleInfluence: FortuneQuestionOracleInfluence;
  conflictResolution: FortuneQuestionConflictResolution;
  profileName?: string;
  date: Date;
}): string {
  const serializeInsight = (role: "primary" | "secondary", insight: DailyFortuneInsight) => ({
    role,
    key: insight.key,
    label: insight.label,
    title: insight.title,
    summary: insight.summary,
    action: insight.action,
    caution: insight.caution,
  });

  return JSON.stringify(
    {
      profileName: params.profileName ?? null,
      question: normalizeQuestion(params.question),
      todayDate: getSeoulDateKey(params.date),
      questionAnalysis: {
        topic: params.analysis.topic,
        intent: params.analysis.intent,
        relationshipKind: params.analysis.relationshipKind,
      },
      overallTone: {
        score: params.fortune.score,
        grade: params.fortune.grade,
        headline: params.fortune.headline,
        certainty: params.fortune.analysis.certainty,
        referenceMode: params.fortune.analysis.referenceMode,
        uncertaintyMessage: params.fortune.analysis.uncertaintyMessage,
      },
      hybridExplanation: params.fortune.analysis.hybridExplanation,
      selectedInsights: [
        serializeInsight("primary", params.analysis.primaryInsight),
        serializeInsight("secondary", params.analysis.secondaryInsight),
      ],
      oracle: {
        primaryHexagram: params.oracle.primaryHexagram,
        changedHexagram: params.oracle.changedHexagram,
        movingLines: params.oracle.movingLines,
        answerTrend: params.oracle.answerTrend,
        summary: params.oracle.summary,
        action: params.oracle.action,
        caution: params.oracle.caution,
        timingHint: params.oracle.timingHint,
      },
      answerMeta: {
        decisionBasis: buildDecisionBasis(params.analysis),
        oracleInfluence: params.oracleInfluence,
        conflictResolution: params.conflictResolution,
      },
      allowedAnswerFrame: {
        mustMentionAction: true,
        mustMentionCaution: true,
        canPreferSecondaryInsight: true,
      },
    },
    null,
    2,
  );
}

function parseQuestionAnswer(
  payload: unknown,
  topic: QuestionTopic,
  meta: Pick<FortuneQuestionAnswer, "decisionBasis" | "oracleInfluence" | "conflictResolution">,
): FortuneQuestionAnswer | null {
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
    sources: ["daily", "yukhyo"],
    decisionBasis: meta.decisionBasis,
    oracleInfluence: meta.oracleInfluence,
    conflictResolution: meta.conflictResolution,
  };
}

function fallbackTitle(topic: QuestionTopic, relationshipKind: QuestionRelationshipKind): string {
  switch (topic) {
    case "work":
      return "도령의 일풀이";
    case "money":
      return "도령의 재물풀이";
    case "relationship":
      return relationshipKind === "romance" ? "도령의 연정풀이" : "도령의 인연풀이";
    case "health":
      return "도령의 기력풀이";
    default:
      return "도령의 운세풀이";
  }
}

function buildFallbackDescription(params: {
  analysis: QuestionAnalysis;
  fortune: DailyFortune;
  oracle: YukhyoReading;
}): string {
  const uncertaintyLead =
    params.fortune.analysis.certainty === "calendar-unknown"
      ? params.fortune.analysis.uncertaintyMessage ?? "달력 기준이 확정되지 않아 참고용 풀이로만 보아야 하오."
      : null;
  const secondarySummary =
    params.analysis.secondaryInsight.key === params.analysis.primaryInsight.key
      ? null
      : `보조로는 ${params.analysis.secondaryInsight.summary}`;
  const oracleTimingLead = `육효 흐름은 ${params.oracle.timingHint} 쪽에서 결이 더 잘 드러나오.`;

  if (params.analysis.intent === "caution") {
    return [
      uncertaintyLead,
      params.oracle.summary,
      params.analysis.primaryInsight.summary,
      params.oracle.caution,
      params.analysis.primaryInsight.caution,
    ]
      .filter((line): line is string => Boolean(line))
      .join(" ");
  }

  if (params.analysis.intent === "timing") {
    return [
      uncertaintyLead,
      oracleTimingLead,
      params.oracle.summary,
      params.analysis.primaryInsight.summary,
      params.analysis.primaryInsight.action,
      params.oracle.caution,
    ]
      .filter((line): line is string => Boolean(line))
      .join(" ");
  }

  if (params.analysis.intent === "approach") {
    return [
      uncertaintyLead,
      params.oracle.summary,
      params.analysis.primaryInsight.summary,
      params.oracle.action,
      params.analysis.primaryInsight.action,
      params.oracle.caution,
    ]
      .filter((line): line is string => Boolean(line))
      .join(" ");
  }

  if (params.analysis.intent === "action") {
    return [
      uncertaintyLead,
      params.oracle.summary,
      params.analysis.primaryInsight.summary,
      `${params.analysis.primaryInsight.action} ${params.oracle.action}`,
      params.oracle.caution,
    ]
      .filter((line): line is string => Boolean(line))
      .join(" ");
  }

  return [
    uncertaintyLead,
    params.oracle.summary,
    params.analysis.primaryInsight.summary,
    secondarySummary,
    params.analysis.primaryInsight.action,
    params.oracle.caution,
  ]
    .filter((line): line is string => Boolean(line))
    .join(" ");
}

function buildFallbackAnswer(params: {
  question: string;
  fortune: DailyFortune;
  analysis: QuestionAnalysis;
  oracle: YukhyoReading;
  oracleInfluence: FortuneQuestionOracleInfluence;
  conflictResolution: FortuneQuestionConflictResolution;
}): FortuneQuestionAnswer {
  return {
    title: fallbackTitle(params.analysis.topic, params.analysis.relationshipKind),
    description: buildFallbackDescription({
      analysis: params.analysis,
      fortune: params.fortune,
      oracle: params.oracle,
    }),
    topic: params.analysis.topic,
    usedLlm: false,
    sources: ["daily", "yukhyo"],
    oracleMeta: {
      primaryHexagram: params.oracle.primaryHexagram,
      changedHexagram: params.oracle.changedHexagram,
      movingLines: params.oracle.movingLines,
      answerTrend: params.oracle.answerTrend,
    },
    decisionBasis: buildDecisionBasis(params.analysis),
    oracleInfluence: params.oracleInfluence,
    conflictResolution: params.conflictResolution,
  };
}

export async function answerFortuneQuestion(params: {
  question: string;
  fortune: DailyFortune;
  userId?: string;
  profileName?: string;
  date?: Date;
}): Promise<FortuneQuestionAnswer> {
  const date = params.date ?? new Date();
  const analysis = buildQuestionAnalysis(params.question, params.fortune);
  const oracle = buildYukhyoReading({
    userId: params.userId,
    question: params.question,
    date,
  });
  const oracleInfluence = buildOracleInfluence({
    analysis,
    oracle,
  });
  const conflictResolution = buildConflictResolution({
    analysis,
    fortune: params.fortune,
    oracle,
  });
  const fallback = buildFallbackAnswer({
    question: params.question,
    fortune: params.fortune,
    analysis,
    oracle,
    oracleInfluence,
    conflictResolution,
  });

  if (!hasOpenAiApiKey()) {
    return fallback;
  }

  pruneCache();
  const cacheKey = buildCacheKey({
    question: params.question,
    fortune: params.fortune,
    analysis,
    oracle,
    conflictResolution,
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
          "You answer Korean daily fortune questions for a Kakao chatbot. Facts are deterministic and must not be changed or invented. The topic, intent, relationshipKind, and selectedInsights are already chosen. You may decide whether to foreground the primary or secondary insight, but you must not introduce any new facts, conclusions, or exact saju details outside selectedInsights and overallTone. Return strict JSON only with keys title and description. title must be under 18 Korean characters. description must be 2 to 4 concise Korean sentences, under 260 characters if possible. Use a concise respectful fortune-teller tone in Korean, a light 도령체. Mention one helpful action and one caution naturally. If certainty is calendar-unknown, clearly say the answer is reference-only and never imply an exact manse or confirmed lunar/solar basis. If referenceMode is solar-lunar-blend, describe it as a common trend across both solar and lunar possibilities. No markdown, no code fences, no emojis.",
        input: buildPromptContext({
          question: params.question,
          fortune: params.fortune,
          analysis,
          oracle,
          oracleInfluence,
          conflictResolution,
          profileName: params.profileName,
          date,
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

    const parsed = parseQuestionAnswer(JSON.parse(cleanModelJson(outputText)), analysis.topic, {
      decisionBasis: buildDecisionBasis(analysis),
      oracleInfluence,
      conflictResolution,
    });
    if (!parsed) {
      return fallback;
    }

    const answer = {
      ...parsed,
      sources: ["daily", "yukhyo"] as Array<"daily" | "yukhyo">,
      oracleMeta: {
        primaryHexagram: oracle.primaryHexagram,
        changedHexagram: oracle.changedHexagram,
        movingLines: oracle.movingLines,
        answerTrend: oracle.answerTrend,
      },
    };

    questionCache.set(cacheKey, {
      expiresAt: Date.now() + QUESTION_CACHE_TTL_MS,
      value: answer,
    });

    return answer;
  } catch {
    return fallback;
  }
}
