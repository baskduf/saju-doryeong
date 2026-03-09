import type { CalendarType, ElementKey } from "./saju";

type FortuneNarrativeBase = {
  score: number;
  grade: "대길" | "길" | "평" | "주의";
  headline: string;
  summary: string;
  detail: string;
  caution: string;
  recommendedActions: string[];
  analysis: {
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
    calendarTypeResolved: "solar" | "lunar";
  };
};

export type FortuneNarrativeOverride = Pick<
  FortuneNarrativeBase,
  "headline" | "summary" | "detail" | "caution" | "recommendedActions"
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

function parseNarrativeOverride(payload: unknown): FortuneNarrativeOverride | null {
  if (!payload || typeof payload !== "object") return null;

  const source = payload as Record<string, unknown>;
  const headline = typeof source.headline === "string" ? source.headline.trim() : "";
  const summary = typeof source.summary === "string" ? source.summary.trim() : "";
  const detail = typeof source.detail === "string" ? source.detail.trim() : "";
  const caution = typeof source.caution === "string" ? source.caution.trim() : "";
  const recommendedActions = normalizeActions(source.recommendedActions);

  if (!headline || !summary || !detail || !caution || !recommendedActions) {
    return null;
  }

  return {
    headline,
    summary,
    detail,
    caution,
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
      todayDate: params.date.toISOString().slice(0, 10),
      birthDate: params.birthDate.toISOString().slice(0, 10),
      birthTime: params.birthTime ?? null,
      score: fortune.score,
      grade: fortune.grade,
      baseNarrative: {
        headline: fortune.headline,
        summary: fortune.summary,
        detail: fortune.detail,
        caution: fortune.caution,
        recommendedActions: fortune.recommendedActions,
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
        yongShin: fortune.analysis.yongShin,
        heeShin: fortune.analysis.heeShin,
        giShin: fortune.analysis.giShin,
        guShin: fortune.analysis.guShin,
        usefulElements: fortune.analysis.usefulElements,
        unfavorableElements: fortune.analysis.unfavorableElements,
        calendarTypeInput: fortune.analysis.calendarTypeInput,
        calendarTypeResolved: fortune.analysis.calendarTypeResolved,
        usedNoonFallback: fortune.analysis.usedNoonFallback,
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
    birthDate: params.birthDate.toISOString().slice(0, 10),
    birthTime: params.birthTime ?? null,
    todayDate: params.date.toISOString().slice(0, 10),
    score: params.fortune.score,
    grade: params.fortune.grade,
    todayGanji: params.fortune.analysis.todayGanji,
    todayRelation: params.fortune.analysis.todayRelation,
    patternName: params.fortune.analysis.patternName,
    patternTentative: params.fortune.analysis.patternTentative,
    yongShin: params.fortune.analysis.yongShin,
    giShin: params.fortune.analysis.giShin,
    usedNoonFallback: params.fortune.analysis.usedNoonFallback,
    calendarTypeInput: params.fortune.analysis.calendarTypeInput,
    calendarTypeResolved: params.fortune.analysis.calendarTypeResolved,
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
            "You write Korean daily fortune copy for a saju chatbot. Facts are deterministic and must not be changed or invented. Return strict JSON only with keys headline, summary, detail, caution, recommendedActions. headline must be one concise sentence. summary/detail/caution must each be natural Korean prose, concise and concrete. recommendedActions must be an array of exactly 3 short imperative Korean sentences. Mention uncertainty when birth time is unknown or calendarTypeInput is unknown. No markdown, no code fences, no emojis.",
          input: buildPromptContext(params),
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[fortune-llm] OpenAI API request failed", response.status, errorText);
        return null;
      }

      const payload = (await response.json()) as Record<string, unknown>;
      const outputText = extractResponseText(payload);
      if (!outputText) {
        console.error("[fortune-llm] empty output_text from OpenAI");
        return null;
      }

      const parsed = parseNarrativeOverride(JSON.parse(cleanModelJson(outputText)));
      if (!parsed) {
        console.error("[fortune-llm] invalid narrative payload", outputText);
        return null;
      }

      narrativeCache.set(cacheKey, {
        expiresAt: Date.now() + CACHE_TTL_MS,
        value: parsed,
      });

      return parsed;
    } catch (error) {
      console.error("[fortune-llm] unexpected error", error);
      return null;
    } finally {
      pendingNarrativeRequests.delete(cacheKey);
    }
  })();

  pendingNarrativeRequests.set(cacheKey, requestPromise);
  return requestPromise;
}
