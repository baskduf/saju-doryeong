import { prisma } from "./prisma";
import { createShareAccessToken } from "./access-token";
import { type DailyFortune } from "./fortune";
import { getSeoulDateKey } from "./seoul-time";

export type FortuneShareSnapshotPayload = {
  displayName: string;
  score: number;
  grade: DailyFortune["grade"];
  headline: string;
  summary: string;
  caution: string;
  certainty: DailyFortune["analysis"]["certainty"];
  uncertaintyMessage: string | null;
  avoidToday?: string[];
  recommendedActions: string[];
  targetDateKey: string;
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
    avoidToday: params.fortune.avoidToday.slice(0, 3),
    recommendedActions: params.fortune.recommendedActions.slice(0, 3),
    targetDateKey,
  };
}

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
