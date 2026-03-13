import type { PublicFortuneSignal, ReferenceMode } from "./fortune";
import type { CalendarType, ChartCertainty, ElementKey } from "./saju";
import { logAdminEventSafe } from "./admin-event-log";
import { formatStoredDateKey, getSeoulDateKey } from "./seoul-time";

type FortuneNarrativeBase = {
  score: number;
  grade: string;
  headline: string;
  summary: string;
  detail: string;
  caution: string;
  recommendedActions: string[];
  avoidToday: string[];
  analysis: {
    certainty: ChartCertainty;
    uncertaintyMessage: string | null;
    referenceMode: ReferenceMode;
    strengthLevel: "strong" | "balanced" | "weak";
    dominantTenGod: string;
    patternName: string;
    patternSummary: string;
    patternTentative: boolean;
    patternRevealLabel: string;
    yongShin: ElementKey;
    heeShin: ElementKey[];
    giShin: ElementKey;
    guShin: ElementKey[];
    usefulElements: ElementKey[];
    unfavorableElements: ElementKey[];
    todayGanji: string;
    todayRelation: string;
    usedNoonFallback: boolean;
    calendarTypeInput: CalendarType;
    calendarTypeResolved: CalendarType;
    hybrid: {
      sources: Array<{
        key: string;
        label: string;
        scoreDelta: number;
        summary: string;
      }>;
      scoreBreakdown: {
        base: number;
        kuseongDelta: number;
        final: number;
      };
      kuseong?: {
        summary: string;
        direction: string;
        categoryAdjustments: Record<string, number>;
        focusCategories: string[];
        narrativeTone: string;
        narrative: {
          headlineAddon: string;
          summaryAddon: string;
          detailAddon: string;
          cautionAddon: string;
        };
      };
    };
    signals: PublicFortuneSignal[];
  };
};

export type FortuneNarrativeOverride = Pick<
  FortuneNarrativeBase,
  "headline" | "summary" | "detail" | "recommendedActions"
>;

const CACHE_TTL_MS = 1000 * 60 * 60 * 6;
const MAX_CACHE_ENTRIES = 200;
const narrativeCache = new Map<string, { expiresAt: number; value: FortuneNarrativeOverride }>();
const pendingNarrativeRequests = new Map<string, Promise<FortuneNarrativeOverride | null>>();

function hasOpenAiApiKey(): boolean {
  return typeof process.env.OPENAI_API_KEY === "string" && process.env.OPENAI_API_KEY.trim().length > 0;
}

function resolveModel(): string {
  return process.env.OPENAI_FORTUNE_MODEL?.trim() || "gpt-4.1-mini";
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

function normalizeActions(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const normalized = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 3);

  return normalized.length === 3 ? normalized : null;
}

function normalizeFortuneTone(text: string): string {
  return text
    .replace(/하십시오/g, "하시오")
    .replace(/해 주십시오/g, "해 주시오")
    .replace(/해주십시오/g, "해주시오")
    .replace(/입니다\./g, "이오.")
    .replace(/입니다/g, "이오")
    .replace(/됩니다\./g, "되오.")
    .replace(/됩니다/g, "되오")
    .replace(/좋습니다\./g, "좋소.")
    .replace(/좋습니다/g, "좋소")
    .replace(/낫습니다\./g, "낫소.")
    .replace(/낫습니다/g, "낫소")
    .replace(/안전합니다\./g, "안전하오.")
    .replace(/안전합니다/g, "안전하오")
    .replace(/중요합니다\./g, "중요하오.")
    .replace(/중요합니다/g, "중요하오")
    .replace(/필요합니다\./g, "필요하오.")
    .replace(/필요합니다/g, "필요하오")
    .trim();
}

function parseNarrativeOverride(payload: unknown): FortuneNarrativeOverride | null {
  if (!payload || typeof payload !== "object") return null;

  const source = payload as Record<string, unknown>;
  const headline = typeof source.headline === "string" ? normalizeFortuneTone(source.headline) : "";
  const summary = typeof source.summary === "string" ? normalizeFortuneTone(source.summary) : "";
  const detail = typeof source.detail === "string" ? normalizeFortuneTone(source.detail) : "";
  const recommendedActions =
    normalizeActions(source.recommendedActions)?.map((action) => normalizeFortuneTone(action)) ?? null;

  if (!headline || !summary || !detail || !recommendedActions) {
    return null;
  }

  return {
    headline,
    summary,
    detail,
    recommendedActions,
  };
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

function buildPromptContext(params: {
  fortune: FortuneNarrativeBase;
  profileName?: string;
  birthDate: Date;
  birthTime?: string;
  date: Date;
}): string {
  const { fortune } = params;

  return JSON.stringify(
    {
      profileName: params.profileName ?? null,
      todayDate: getSeoulDateKey(params.date),
      birthDate: formatStoredDateKey(params.birthDate),
      birthTime: params.birthTime ?? null,
      score: fortune.score,
      grade: fortune.grade,
      baseNarrative: {
        headline: fortune.headline,
        summary: fortune.summary,
        detail: fortune.detail,
        caution: fortune.caution,
        recommendedActions: fortune.recommendedActions,
        avoidToday: fortune.avoidToday,
      },
      deterministicFacts: {
        todayGanji: fortune.analysis.todayGanji,
        todayRelation: fortune.analysis.todayRelation,
        strengthLevel: fortune.analysis.strengthLevel,
        dominantTenGod: fortune.analysis.dominantTenGod,
        patternName: fortune.analysis.patternName,
        patternSummary: fortune.analysis.patternSummary,
        patternTentative: fortune.analysis.patternTentative,
        patternRevealLabel: fortune.analysis.patternRevealLabel,
        certainty: fortune.analysis.certainty,
        uncertaintyMessage: fortune.analysis.uncertaintyMessage,
        referenceMode: fortune.analysis.referenceMode,
        yongShin: fortune.analysis.yongShin,
        heeShin: fortune.analysis.heeShin,
        giShin: fortune.analysis.giShin,
        guShin: fortune.analysis.guShin,
        usefulElements: fortune.analysis.usefulElements,
        unfavorableElements: fortune.analysis.unfavorableElements,
        calendarTypeInput: fortune.analysis.calendarTypeInput,
        calendarTypeResolved: fortune.analysis.calendarTypeResolved,
        usedNoonFallback: fortune.analysis.usedNoonFallback,
        hybridSources: fortune.analysis.hybrid.sources,
        hybridScoreBreakdown: fortune.analysis.hybrid.scoreBreakdown,
        kuseongSummary: fortune.analysis.hybrid.kuseong?.summary ?? null,
        kuseongDirection: fortune.analysis.hybrid.kuseong?.direction ?? null,
        kuseongCategoryAdjustments: fortune.analysis.hybrid.kuseong?.categoryAdjustments ?? null,
        kuseongFocusCategories: fortune.analysis.hybrid.kuseong?.focusCategories ?? null,
        kuseongNarrativeTone: fortune.analysis.hybrid.kuseong?.narrativeTone ?? null,
        kuseongNarrativeAddons: fortune.analysis.hybrid.kuseong?.narrative ?? null,
        signals: fortune.analysis.signals,
      },
    },
    null,
    2,
  );
}

function buildCacheKey(params: {
  fortune: FortuneNarrativeBase;
  profileName?: string;
  birthDate: Date;
  birthTime?: string;
  date: Date;
}): string {
  return JSON.stringify({
    profileName: params.profileName ?? null,
    birthDate: formatStoredDateKey(params.birthDate),
    birthTime: params.birthTime ?? null,
    todayDate: getSeoulDateKey(params.date),
    score: params.fortune.score,
    grade: params.fortune.grade,
    recommendedActions: params.fortune.recommendedActions,
    avoidToday: params.fortune.avoidToday,
    todayGanji: params.fortune.analysis.todayGanji,
    todayRelation: params.fortune.analysis.todayRelation,
    patternName: params.fortune.analysis.patternName,
    patternTentative: params.fortune.analysis.patternTentative,
    referenceMode: params.fortune.analysis.referenceMode,
    yongShin: params.fortune.analysis.yongShin,
    giShin: params.fortune.analysis.giShin,
    usedNoonFallback: params.fortune.analysis.usedNoonFallback,
    calendarTypeInput: params.fortune.analysis.calendarTypeInput,
    calendarTypeResolved: params.fortune.analysis.calendarTypeResolved,
    certainty: params.fortune.analysis.certainty,
    uncertaintyMessage: params.fortune.analysis.uncertaintyMessage,
    signals: params.fortune.analysis.signals,
    hybridSources: params.fortune.analysis.hybrid.sources,
    hybridScoreBreakdown: params.fortune.analysis.hybrid.scoreBreakdown,
    kuseongSummary: params.fortune.analysis.hybrid.kuseong?.summary ?? null,
    kuseongDirection: params.fortune.analysis.hybrid.kuseong?.direction ?? null,
    kuseongCategoryAdjustments: params.fortune.analysis.hybrid.kuseong?.categoryAdjustments ?? null,
    kuseongFocusCategories: params.fortune.analysis.hybrid.kuseong?.focusCategories ?? null,
    kuseongNarrativeTone: params.fortune.analysis.hybrid.kuseong?.narrativeTone ?? null,
    kuseongNarrativeAddons: params.fortune.analysis.hybrid.kuseong?.narrative ?? null,
    model: resolveModel(),
  });
}

function pruneCache(): void {
  const now = Date.now();
  for (const [key, value] of narrativeCache.entries()) {
    if (value.expiresAt <= now) {
      narrativeCache.delete(key);
    }
  }

  if (narrativeCache.size <= MAX_CACHE_ENTRIES) {
    return;
  }

  const overflow = narrativeCache.size - MAX_CACHE_ENTRIES;
  const keys = [...narrativeCache.keys()].slice(0, overflow);
  keys.forEach((key) => narrativeCache.delete(key));
}

export async function generateFortuneNarrativeOverride(params: {
  fortune: FortuneNarrativeBase;
  profileName?: string;
  birthDate: Date;
  birthTime?: string;
  date: Date;
}): Promise<FortuneNarrativeOverride | null> {
  if (!hasOpenAiApiKey()) {
    void logAdminEventSafe({
      eventType: "openai_fortune_fallback",
      status: "fallback",
      source: "fortune-llm",
      message: "OPENAI_API_KEY가 없어 운세 서술 fallback을 사용했습니다.",
      metadata: {
        reason: "missing_api_key",
      },
    });
    return null;
  }

  pruneCache();
  const cacheKey = buildCacheKey(params);
  const cached = narrativeCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const pendingRequest = pendingNarrativeRequests.get(cacheKey);
  if (pendingRequest) {
    return pendingRequest;
  }

  const requestPromise = (async (): Promise<FortuneNarrativeOverride | null> => {
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
          "You write Korean daily fortune copy for a saju chatbot. Facts are deterministic and must not be changed or invented. Return strict JSON only with keys headline, summary, detail, recommendedActions. headline must be one concise sentence. summary/detail must each be natural Korean prose, concise and concrete. recommendedActions must be an array of exactly 3 short imperative Korean sentences. Keep the intent of the base recommendedActions, do not contradict avoidToday or caution, and do not add risky or exaggerated advice. Use the provided signals to decide what to foreground, and do not force warning-heavy language unless a top signal has tone=caution or the caution text is clearly stronger than the action text. Use a light 도령체 consistently. Do not use 합니다/입니다/하십시오 style. Prefer 하오, 좋소, 이로다, 하시오 naturally and sparingly. Mention uncertainty when birth time is unknown, calendarTypeInput is unknown, or certainty is calendar-unknown. Never imply an exact manse or confirmed lunar/solar basis when certainty is calendar-unknown. If referenceMode is solar-lunar-blend, describe it as a shared trend across both calendar possibilities. Do not change category priorities or score polarity decided by kuseongCategoryAdjustments. You may paraphrase kuseong focus and tone, but must preserve the same focus categories and caution direction. No markdown, no code fences, no emojis.",
          input: buildPromptContext(params),
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[fortune-llm] OpenAI API request failed", response.status, errorText);
        void logAdminEventSafe({
          eventType: "openai_fortune_fallback",
          status: "fallback",
          source: "fortune-llm",
          message: `운세 서술 OpenAI 응답이 실패해 fallback을 사용했습니다. status=${response.status}`,
          metadata: {
            reason: "response_not_ok",
            httpStatus: response.status,
            model: resolveModel(),
          },
        });
        return null;
      }

      const payload = (await response.json()) as Record<string, unknown>;
      const outputText = extractResponseText(payload);
      if (!outputText) {
        console.error("[fortune-llm] empty output_text from OpenAI");
        void logAdminEventSafe({
          eventType: "openai_fortune_fallback",
          status: "fallback",
          source: "fortune-llm",
          message: "운세 서술 OpenAI 응답에 output_text가 없어 fallback을 사용했습니다.",
          metadata: {
            reason: "empty_output_text",
            model: resolveModel(),
          },
        });
        return null;
      }

      const parsed = parseNarrativeOverride(JSON.parse(cleanModelJson(outputText)));
      if (!parsed) {
        console.error("[fortune-llm] invalid narrative payload", outputText);
        void logAdminEventSafe({
          eventType: "openai_fortune_fallback",
          status: "fallback",
          source: "fortune-llm",
          message: "운세 서술 OpenAI 응답 파싱에 실패해 fallback을 사용했습니다.",
          metadata: {
            reason: "invalid_payload",
            model: resolveModel(),
          },
        });
        return null;
      }

      narrativeCache.set(cacheKey, {
        expiresAt: Date.now() + CACHE_TTL_MS,
        value: parsed,
      });

      return parsed;
    } catch (error) {
      console.error("[fortune-llm] unexpected error", error);
      void logAdminEventSafe({
        eventType: "openai_fortune_fallback",
        status: "fallback",
        source: "fortune-llm",
        message: "운세 서술 OpenAI 호출 중 예외가 발생해 fallback을 사용했습니다.",
        metadata: {
          reason: "unexpected_error",
          model: resolveModel(),
        },
      });
      return null;
    } finally {
      pendingNarrativeRequests.delete(cacheKey);
    }
  })();

  pendingNarrativeRequests.set(cacheKey, requestPromise);
  return requestPromise;
}
