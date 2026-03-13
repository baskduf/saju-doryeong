import { prisma } from "./prisma";
import { createShareAccessToken } from "./access-token";
import { logAdminEventSafe } from "./admin-event-log";
import {
  type DailyFortune,
  type FortuneSignalKey,
  shouldRenderSignalCaution,
  type PublicFortuneSignal,
  selectTopFortuneSignals,
  toPublicFortuneSignal,
} from "./fortune";
import { getSeoulDateKey } from "./seoul-time";

export type FortuneShareSignalPayload = PublicFortuneSignal;
export type LegacyFortuneShareInsightPayload = {
  label: string;
  title: string;
  summary: string;
  action: string;
  caution: string;
};

export type FortuneShareSnapshotPayload = {
  displayName: string;
  score: number;
  grade: DailyFortune["grade"];
  headline: string;
  summary: string;
  caution: string;
  certainty: DailyFortune["analysis"]["certainty"];
  uncertaintyMessage: string | null;
  signals: FortuneShareSignalPayload[];
  avoidToday?: string[];
  recommendedActions: string[];
  targetDateKey: string;
};

type LegacyFortuneShareSnapshotPayload = Omit<FortuneShareSnapshotPayload, "signals"> & {
  signals?: unknown;
  featuredInsight?: unknown;
};

function maskDisplayName(name?: string | null): string {
  const trimmed = name?.trim();
  if (!trimmed) {
    return "익명의 손님";
  }

  if (trimmed.length === 1) {
    return trimmed;
  }

  return `${trimmed[0]}${"*".repeat(Math.max(1, trimmed.length - 1))}`;
}

function buildSharePayload(params: {
  profileName?: string | null;
  fortune: DailyFortune;
  date?: Date;
}): FortuneShareSnapshotPayload {
  const targetDateKey = getSeoulDateKey(params.date);

  return {
    displayName: maskDisplayName(params.profileName),
    score: params.fortune.score,
    grade: params.fortune.grade,
    headline: params.fortune.headline,
    summary: params.fortune.summary,
    caution: params.fortune.caution,
    certainty: params.fortune.analysis.certainty,
    uncertaintyMessage: params.fortune.analysis.uncertaintyMessage,
    signals: selectTopFortuneSignals(params.fortune.analysis.signals).map((signal) => toPublicFortuneSignal(signal)),
    avoidToday: params.fortune.avoidToday.slice(0, 3),
    recommendedActions: params.fortune.recommendedActions.slice(0, 3),
    targetDateKey,
  };
}

function isSignalKey(value: unknown): value is FortuneSignalKey {
  return (
    value === "momentum" ||
    value === "friction" ||
    value === "timing" ||
    value === "work" ||
    value === "money" ||
    value === "relationship" ||
    value === "recovery"
  );
}

function isSignalTone(value: unknown): value is FortuneShareSignalPayload["tone"] {
  return value === "push" || value === "steady" || value === "caution" || value === "recover";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isLegacyInsightPayload(value: unknown): value is LegacyFortuneShareInsightPayload {
  return (
    isRecord(value) &&
    typeof value.label === "string" &&
    typeof value.title === "string" &&
    typeof value.summary === "string" &&
    typeof value.action === "string" &&
    typeof value.caution === "string"
  );
}

function isShareSignalPayload(value: unknown): value is FortuneShareSignalPayload {
  return (
    isRecord(value) &&
    isSignalKey(value.key) &&
    typeof value.label === "string" &&
    typeof value.score === "number" &&
    isSignalTone(value.tone) &&
    typeof value.title === "string" &&
    typeof value.summary === "string" &&
    typeof value.action === "string" &&
    typeof value.caution === "string" &&
    Array.isArray(value.reasons) &&
    value.reasons.every((reason) => typeof reason === "string")
  );
}

function inferLegacySignalKey(label: string): FortuneSignalKey {
  if (label.includes("주의")) return "friction";
  if (label.includes("타이밍")) return "timing";
  if (label.includes("재물")) return "money";
  if (label.includes("관계") || label.includes("연애")) return "relationship";
  if (label.includes("건강") || label.includes("회복")) return "recovery";
  if (label.includes("일") || label.includes("업무")) return "work";
  return "momentum";
}

function toneFromGrade(grade: DailyFortune["grade"]): FortuneShareSignalPayload["tone"] {
  if (grade === "주의") return "caution";
  if (grade === "대길") return "push";
  return "steady";
}

function buildFallbackShareSignal(
  payload: Omit<FortuneShareSnapshotPayload, "signals">,
  featuredInsight?: LegacyFortuneShareInsightPayload,
): FortuneShareSignalPayload {
  const key = featuredInsight ? inferLegacySignalKey(featuredInsight.label) : "momentum";
  const tone = toneFromGrade(payload.grade);

  return {
    key,
    label: featuredInsight?.label ?? "오늘의 포인트",
    score: payload.score,
    tone,
    title: featuredInsight?.title ?? "공유용 대표 흐름을 먼저 보시오.",
    summary: featuredInsight?.summary ?? payload.summary,
    action: featuredInsight?.action ?? payload.recommendedActions[0] ?? "지금 할 수 있는 일부터 차분히 움직이시오.",
    caution: featuredInsight?.caution ?? payload.avoidToday?.[0] ?? payload.caution,
    reasons: [payload.headline, payload.caution].filter(Boolean),
  };
}

export function normalizeFortuneSharePayload(value: unknown): FortuneShareSnapshotPayload | null {
  if (!isRecord(value)) {
    return null;
  }

  const payload = value as LegacyFortuneShareSnapshotPayload;
  if (
    typeof payload.displayName !== "string" ||
    typeof payload.score !== "number" ||
    typeof payload.grade !== "string" ||
    typeof payload.headline !== "string" ||
    typeof payload.summary !== "string" ||
    typeof payload.caution !== "string" ||
    (payload.certainty !== "exact" && payload.certainty !== "calendar-unknown") ||
    (payload.uncertaintyMessage !== null &&
      payload.uncertaintyMessage !== undefined &&
      typeof payload.uncertaintyMessage !== "string") ||
    (payload.avoidToday !== undefined && !Array.isArray(payload.avoidToday)) ||
    !Array.isArray(payload.recommendedActions) ||
    typeof payload.targetDateKey !== "string"
  ) {
    return null;
  }

  const normalizedSignals = Array.isArray(payload.signals)
    ? payload.signals.filter(isShareSignalPayload)
    : [];
  const featuredInsight = isLegacyInsightPayload(payload.featuredInsight) ? payload.featuredInsight : undefined;

  return {
    displayName: payload.displayName,
    score: payload.score,
    grade: payload.grade,
    headline: payload.headline,
    summary: payload.summary,
    caution: payload.caution,
    certainty: payload.certainty,
    uncertaintyMessage: payload.uncertaintyMessage ?? null,
    signals:
      normalizedSignals.length > 0
        ? normalizedSignals
        : [buildFallbackShareSignal(
            {
              displayName: payload.displayName,
              score: payload.score,
              grade: payload.grade,
              headline: payload.headline,
              summary: payload.summary,
              caution: payload.caution,
              certainty: payload.certainty,
              uncertaintyMessage: payload.uncertaintyMessage ?? null,
              avoidToday: payload.avoidToday,
              recommendedActions: payload.recommendedActions,
              targetDateKey: payload.targetDateKey,
            },
            featuredInsight,
          )],
    avoidToday: payload.avoidToday,
    recommendedActions: payload.recommendedActions,
    targetDateKey: payload.targetDateKey,
  };
}

export { shouldRenderSignalCaution };

export async function upsertFortuneShareSnapshot(params: {
  userId: string;
  profileName?: string | null;
  fortune: DailyFortune;
  date?: Date;
}): Promise<{ snapshotId: string; targetDateKey: string; token: string }> {
  const payload = buildSharePayload(params);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);

  const snapshot = await prisma.fortuneShareSnapshot.upsert({
    where: {
      userId_targetDateKey: {
        userId: params.userId,
        targetDateKey: payload.targetDateKey,
      },
    },
    update: {
      payload,
      expiresAt,
    },
    create: {
      userId: params.userId,
      targetDateKey: payload.targetDateKey,
      payload,
      expiresAt,
    },
    select: {
      id: true,
      targetDateKey: true,
    },
  });

  void logAdminEventSafe({
    eventType: "share_created",
    status: "success",
    source: "kakao",
    userId: params.userId,
    message: `공유 스냅샷이 생성되었습니다: ${snapshot.id}`,
    metadata: {
      snapshotId: snapshot.id,
      targetDateKey: snapshot.targetDateKey,
    },
  });

  return {
    snapshotId: snapshot.id,
    targetDateKey: snapshot.targetDateKey,
    token: createShareAccessToken(snapshot.id),
  };
}

export async function findFortuneShareSnapshotById(snapshotId: string) {
  return prisma.fortuneShareSnapshot.findUnique({
    where: { id: snapshotId },
    select: {
      id: true,
      payload: true,
      expiresAt: true,
    },
  });
}
