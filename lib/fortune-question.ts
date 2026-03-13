import { selectTopFortuneSignals } from "./fortune";
import type { DailyFortune, FortuneSignal, FortuneSignalKey } from "./fortune";
import { logAdminEventSafe } from "./admin-event-log";
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
  primarySignal: FortuneSignal;
  secondarySignal: FortuneSignal;
};

type QuestionSignalStrength = "aggressive" | "balanced" | "conservative";
type OracleInfluenceChannel = "direction" | "timing" | "caution";
type ConflictResolutionStatus = "aligned" | "question-signal-conflict" | "reference-priority";

export type FortuneQuestionDecisionBasis = {
  topic: QuestionTopic;
  intent: QuestionIntent;
  relationshipKind: QuestionRelationshipKind;
  primarySignalKey: FortuneSignalKey;
  secondarySignalKey: FortuneSignalKey;
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
  work: ["일", "직장", "회사", "업무", "면접", "시험", "과제", "발표", "취업", "이직"],
  money: ["돈", "재물", "금전", "지출", "계약", "투자", "매매", "매출", "수입", "대출"],
  relationship: ["연애", "사람", "관계", "고백", "연락", "소개팅", "친구", "모임", "썸", "인연"],
  health: ["건강", "몸", "컨디션", "체력", "휴식", "회복", "병원", "운동", "수면"],
  general: [],
};

const INTENT_KEYWORDS: Array<[QuestionIntent, string[]]> = [
  ["caution", ["조심", "주의", "피해야", "위험", "실수", "문제", "불안"]],
  ["timing", ["언제", "지금", "오늘", "내일", "타이밍", "시기", "나중", "곧"]],
  ["approach", ["어떻게", "어떤", "방식", "태도", "말투", "접근", "거리", "조율"]],
  ["action", ["할까", "해도", "가도", "보내도", "고백", "연락", "시작", "움직여", "사도"]],
  ["outcome", ["괜찮을까", "될까", "붙을까", "잘될까", "성공", "통할까", "나을까"]],
];

const RELATIONSHIP_KIND_KEYWORDS: Record<QuestionRelationshipKind, string[]> = {
  romance: ["연애", "고백", "썸", "소개팅", "연인", "호감", "데이트"],
  social: ["친구", "동료", "가족", "사람들", "모임", "인간관계", "지인"],
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

  const directSignals = ["운세", "오늘", "될까", "괜찮을까", "조심", "언제", "흐름", "도와줘"];
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

function resolveSignalKeys(params: {
  topic: QuestionTopic;
  intent: QuestionIntent;
  relationshipKind: QuestionRelationshipKind;
}): [FortuneSignalKey, FortuneSignalKey] {
  const { topic, intent, relationshipKind } = params;

  if (topic === "work") {
    if (intent === "outcome") return ["work", "momentum"];
    if (intent === "action") return ["work", "timing"];
    if (intent === "timing") return ["timing", "work"];
    if (intent === "approach") return ["momentum", "work"];
    return ["friction", "work"];
  }

  if (topic === "money") {
    if (intent === "outcome") return ["money", "friction"];
    if (intent === "action") return ["money", "timing"];
    if (intent === "timing") return ["timing", "money"];
    if (intent === "approach") return ["momentum", "money"];
    return ["friction", "money"];
  }

  if (topic === "health") {
    if (intent === "outcome") return ["recovery", "momentum"];
    if (intent === "action") return ["recovery", "timing"];
    if (intent === "timing") return ["timing", "recovery"];
    if (intent === "approach") return ["recovery", "momentum"];
    return ["friction", "recovery"];
  }

  if (topic === "relationship") {
    if (intent === "outcome") return ["relationship", relationshipKind === "romance" ? "timing" : "momentum"];
    if (intent === "action") return [relationshipKind === "romance" ? "timing" : "momentum", "relationship"];
    if (intent === "timing") return ["timing", "relationship"];
    if (intent === "approach") return ["momentum", "relationship"];
    return ["friction", "relationship"];
  }

  if (intent === "outcome") return ["momentum", "friction"];
  if (intent === "action") return ["momentum", "timing"];
  if (intent === "timing") return ["timing", "momentum"];
  if (intent === "approach") return ["momentum", "work"];
  return ["friction", "momentum"];
}

function fallbackSignal(fortune: DailyFortune): FortuneSignal {
  const topSignals = selectTopFortuneSignals(fortune.analysis.signals);
  return topSignals[0] ?? fortune.analysis.signals[0];
}

function findSignal(fortune: DailyFortune, key: FortuneSignalKey): FortuneSignal {
  return fortune.analysis.signals.find((signal) => signal.key === key) ?? fallbackSignal(fortune);
}

function buildQuestionAnalysis(question: string, fortune: DailyFortune): QuestionAnalysis {
  const topic = inferQuestionTopic(question);
  const intent = inferQuestionIntent(question);
  const relationshipKind = topic === "relationship" ? inferRelationshipKind(question) : "generic";
  const [primaryKey, secondaryKey] = resolveSignalKeys({
    topic,
    intent,
    relationshipKind,
  });

  return {
    topic,
    intent,
    relationshipKind,
    primarySignal: findSignal(fortune, primaryKey),
    secondarySignal: findSignal(fortune, secondaryKey),
  };
}

function buildDecisionBasis(analysis: QuestionAnalysis): FortuneQuestionDecisionBasis {
  return {
    topic: analysis.topic,
    intent: analysis.intent,
    relationshipKind: analysis.relationshipKind,
    primarySignalKey: analysis.primarySignal.key,
    secondarySignalKey: analysis.secondarySignal.key,
  };
}

function inferBaseSignalStrength(params: {
  analysis: QuestionAnalysis;
  fortune: DailyFortune;
}): QuestionSignalStrength {
  if (
    params.fortune.analysis.certainty === "calendar-unknown" ||
    params.fortune.grade === "주의" ||
    params.analysis.topic === "health" ||
    params.analysis.primarySignal.key === "friction" ||
    params.analysis.primarySignal.tone === "caution"
  ) {
    return "conservative";
  }

  if (
    params.fortune.grade === "대길" ||
    params.analysis.primarySignal.tone === "push" ||
    params.analysis.primarySignal.key === "momentum" ||
    params.analysis.primarySignal.key === "work" ||
    params.analysis.primarySignal.key === "money" ||
    params.analysis.intent === "action" ||
    params.analysis.intent === "approach" ||
    params.analysis.intent === "timing"
  ) {
    return "aggressive";
  }

  return "balanced";
}

function shouldUseCautionChannel(analysis: QuestionAnalysis): boolean {
  const selectedSignals = [analysis.primarySignal, analysis.secondarySignal];
  if (analysis.intent === "caution") {
    return true;
  }

  return selectedSignals.some(
    (signal) => signal.key === "friction" || (signal.tone === "caution" && signal.score >= 65),
  );
}

function buildOracleInfluence(params: {
  analysis: QuestionAnalysis;
  oracle: YukhyoReading;
}): FortuneQuestionOracleInfluence {
  const channels = new Set<OracleInfluenceChannel>();

  if (
    params.analysis.intent === "action" ||
    params.analysis.intent === "approach" ||
    params.analysis.intent === "outcome"
  ) {
    channels.add("direction");
  }

  if (
    params.analysis.intent === "timing" ||
    params.analysis.primarySignal.key === "timing" ||
    params.analysis.secondarySignal.key === "timing"
  ) {
    channels.add("timing");
  }

  if (shouldUseCautionChannel(params.analysis)) {
    channels.add("caution");
  }

  const orderedChannels = ["direction", "timing", "caution"].filter((channel) =>
    channels.has(channel as OracleInfluenceChannel),
  ) as OracleInfluenceChannel[];

  const channelLabelMap: Record<OracleInfluenceChannel, string> = {
    direction: "방향",
    timing: "타이밍",
    caution: "주의",
  };

  const summary =
    orderedChannels.length > 0
      ? `육효는 ${orderedChannels.map((channel) => channelLabelMap[channel]).join(", ")} 채널에서 보조 판단을 더하오.`
      : "육효는 배경 흐름만 가볍게 보조하오.";

  return {
    channels: orderedChannels,
    summary,
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
      summary: "달력 기준이 아직 미확정이라 육효보다 참고용 공통 흐름을 먼저 따르오.",
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
      summary: "육효는 열려 있으나 기본 신호는 보수적이라 속도를 낮추는 쪽으로 중재하오.",
      appliedPolicy: "가능성은 보되 속도는 늦춤",
    };
  }

  if (params.oracle.answerTrend === "negative" && baseSignal === "aggressive") {
    return {
      status: "question-signal-conflict",
      summary: "육효는 제동을 걸지만 기본 신호는 살아 있어 무리만 금하고 방향은 남기오.",
      appliedPolicy: "기회가 있어도 무리 금지",
    };
  }

  return {
    status: "aligned",
    summary: "육효와 기본 신호가 크게 충돌하지 않아 같은 결로 정리하오.",
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
    primarySignal: params.analysis.primarySignal.key,
    primarySignalScore: params.analysis.primarySignal.score,
    secondarySignal: params.analysis.secondarySignal.key,
    secondarySignalScore: params.analysis.secondarySignal.score,
    certainty: params.fortune.analysis.certainty,
    referenceMode: params.fortune.analysis.referenceMode,
    uncertaintyMessage: params.fortune.analysis.uncertaintyMessage,
    eventOutlook: params.fortune.analysis.eventOutlook,
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
  const serializeSignal = (role: "primary" | "secondary", signal: FortuneSignal) => ({
    role,
    key: signal.key,
    label: signal.label,
    score: signal.score,
    tone: signal.tone,
    title: signal.title,
    summary: signal.summary,
    action: signal.action,
    caution: signal.caution,
    reasons: signal.reasons,
  });
  const mustMentionCaution = shouldUseCautionChannel(params.analysis);

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
      eventOutlook: params.fortune.analysis.eventOutlook,
      hybridExplanation: params.fortune.analysis.hybridExplanation,
      selectedSignals: [
        serializeSignal("primary", params.analysis.primarySignal),
        serializeSignal("secondary", params.analysis.secondarySignal),
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
        mustMentionCaution,
        canPreferSecondarySignal: true,
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
      return "도령의 일운";
    case "money":
      return "도령의 재물운";
    case "relationship":
      return relationshipKind === "romance" ? "도령의 연애운" : "도령의 인연운";
    case "health":
      return "도령의 기력운";
    default:
      return "도령의 오늘운";
  }
}

function buildFallbackDescription(params: {
  analysis: QuestionAnalysis;
  fortune: DailyFortune;
  oracle: YukhyoReading;
}): string {
  const eventLead = params.fortune.analysis.eventOutlook.lead;
  const eventReason = params.fortune.analysis.eventOutlook.reason;
  const uncertaintyLead =
    params.fortune.analysis.certainty === "calendar-unknown"
      ? params.fortune.analysis.uncertaintyMessage ?? "달력 기준이 아직 미확정이라 참고용 흐름으로만 보시오."
      : null;
  const secondarySummary =
    params.analysis.secondarySignal.key === params.analysis.primarySignal.key
      ? null
      : `보조로는 ${params.analysis.secondarySignal.summary}`;
  const cautionLead = shouldUseCautionChannel(params.analysis)
    ? [params.oracle.caution, params.analysis.primarySignal.caution].join(" ")
    : null;
  const oracleTimingLead = `육효 흐름은 ${params.oracle.timingHint} 쪽에서 반응이 또렷해질 수 있소.`;

  if (params.analysis.intent === "caution") {
    return [
      uncertaintyLead,
      eventLead,
      eventReason,
      params.oracle.summary,
      params.analysis.primarySignal.summary,
      params.oracle.caution,
      params.analysis.primarySignal.caution,
    ]
      .filter((line): line is string => Boolean(line))
      .join(" ");
  }

  if (params.analysis.intent === "timing") {
    return [
      uncertaintyLead,
      eventLead,
      eventReason,
      oracleTimingLead,
      params.oracle.summary,
      params.analysis.primarySignal.summary,
      params.analysis.primarySignal.action,
      cautionLead,
    ]
      .filter((line): line is string => Boolean(line))
      .join(" ");
  }

  if (params.analysis.intent === "approach") {
    return [
      uncertaintyLead,
      eventLead,
      eventReason,
      params.oracle.summary,
      params.analysis.primarySignal.summary,
      params.oracle.action,
      params.analysis.primarySignal.action,
      cautionLead,
    ]
      .filter((line): line is string => Boolean(line))
      .join(" ");
  }

  if (params.analysis.intent === "action") {
    return [
      uncertaintyLead,
      eventLead,
      eventReason,
      params.oracle.summary,
      params.analysis.primarySignal.summary,
      `${params.analysis.primarySignal.action} ${params.oracle.action}`,
      cautionLead,
    ]
      .filter((line): line is string => Boolean(line))
      .join(" ");
  }

  return [
    uncertaintyLead,
    eventLead,
    eventReason,
    params.oracle.summary,
    params.analysis.primarySignal.summary,
    secondarySummary,
    params.analysis.primarySignal.action,
    cautionLead,
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

  const baseLogMetadata = {
    questionTopic: analysis.topic,
    questionIntent: analysis.intent,
    model: resolveModel(),
  };

  if (!hasOpenAiApiKey()) {
    void logAdminEventSafe({
      eventType: "openai_question_fallback",
      status: "fallback",
      source: "fortune-question",
      userId: params.userId,
      questionText: params.question,
      message: "OPENAI_API_KEY가 없어 질문 fallback 응답을 사용했습니다.",
      metadata: {
        ...baseLogMetadata,
        reason: "missing_api_key",
      },
    });
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
          "You answer Korean daily fortune questions for a Kakao chatbot. Facts are deterministic and must not be changed or invented. The topic, intent, relationshipKind, selectedSignals, and eventOutlook are already chosen. You may decide whether to foreground the primary or secondary signal, but you must not introduce any new facts, conclusions, or exact saju details outside selectedSignals, oracle, overallTone, and eventOutlook. Return strict JSON only with keys title and description. title must be under 18 Korean characters. description must be 2 to 4 concise Korean sentences, under 260 characters if possible. Use a concise respectful fortune-teller tone in Korean, a light 도령체. Open with an event-possibility sentence when eventOutlook is strong, but keep it as possibility language such as 수 있소, 기미가 있소, 조짐이 있소. Never use deterministic guarantees such as 반드시, 무조건, 확실히, 100%. Mention one helpful action. Mention caution only when answerMeta.oracleInfluence.channels includes caution or allowedAnswerFrame.mustMentionCaution is true. If certainty is calendar-unknown, clearly say the answer is reference-only and never imply an exact manse or confirmed lunar/solar basis. If referenceMode is solar-lunar-blend, describe it as a common trend across both solar and lunar possibilities. No markdown, no code fences, no emojis.",
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
      void logAdminEventSafe({
        eventType: "openai_question_fallback",
        status: "fallback",
        source: "fortune-question",
        userId: params.userId,
        questionText: params.question,
        message: `질문 OpenAI 응답이 실패해 fallback을 사용했습니다. status=${response.status}`,
        metadata: {
          ...baseLogMetadata,
          reason: "response_not_ok",
          httpStatus: response.status,
        },
      });
      return fallback;
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const outputText = extractResponseText(payload);
    if (!outputText) {
      void logAdminEventSafe({
        eventType: "openai_question_fallback",
        status: "fallback",
        source: "fortune-question",
        userId: params.userId,
        questionText: params.question,
        message: "질문 OpenAI 응답의 output_text가 없어 fallback을 사용했습니다.",
        metadata: {
          ...baseLogMetadata,
          reason: "empty_output_text",
        },
      });
      return fallback;
    }

    const parsed = parseQuestionAnswer(JSON.parse(cleanModelJson(outputText)), analysis.topic, {
      decisionBasis: buildDecisionBasis(analysis),
      oracleInfluence,
      conflictResolution,
    });
    if (!parsed) {
      void logAdminEventSafe({
        eventType: "openai_question_fallback",
        status: "fallback",
        source: "fortune-question",
        userId: params.userId,
        questionText: params.question,
        message: "질문 OpenAI 응답 파싱이 실패해 fallback을 사용했습니다.",
        metadata: {
          ...baseLogMetadata,
          reason: "invalid_payload",
        },
      });
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

    void logAdminEventSafe({
      eventType: "question_answered",
      status: "success",
      source: "fortune-question",
      userId: params.userId,
      questionText: params.question,
      message: "질문 응답을 생성했습니다.",
      metadata: {
        ...baseLogMetadata,
        usedLlm: true,
      },
    });

    return answer;
  } catch {
    void logAdminEventSafe({
      eventType: "openai_question_fallback",
      status: "fallback",
      source: "fortune-question",
      userId: params.userId,
      questionText: params.question,
      message: "질문 OpenAI 호출 중 예외가 발생해 fallback을 사용했습니다.",
      metadata: {
        ...baseLogMetadata,
        reason: "unexpected_error",
      },
    });
    return fallback;
  }
}
