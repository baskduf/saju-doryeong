import type { Prisma } from "@prisma/client";
import type { FortuneSignalKey } from "./fortune";
import type {
  FortuneQuestionAnswer,
  FortuneQuestionConflictResolution,
} from "./fortune-question";
import { prisma } from "./prisma";
import { formatSeoulDate, getSeoulDateKey } from "./seoul-time";

export type QuestionHistorySource = "kakao" | "web";

type HistorySignalStatus = FortuneQuestionConflictResolution["status"];

type QuestionHistoryRow = {
  id: string;
  askedDateKey: string;
  questionText: string;
  payload: unknown;
  source: string;
  createdAt: Date;
};

export type QuestionHistoryItem = {
  id: string;
  questionText: string;
  title: string;
  description: string;
  askedDateKey: string;
  source: QuestionHistorySource;
  createdAtLabel: string;
  primarySignalKey: FortuneSignalKey;
  secondarySignalKey: FortuneSignalKey;
  conflictResolutionStatus: HistorySignalStatus;
  conflictResolutionPolicy: string | null;
};

function hasQuestionHistoryDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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

function isConflictResolutionStatus(value: unknown): value is HistorySignalStatus {
  return value === "aligned" || value === "question-signal-conflict" || value === "reference-priority";
}

function isQuestionHistorySource(value: unknown): value is QuestionHistorySource {
  return value === "kakao" || value === "web";
}

function serializeQuestionHistoryPayload(answer: FortuneQuestionAnswer): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(answer)) as Prisma.InputJsonValue;
}

export function normalizeQuestionHistoryRecord(row: QuestionHistoryRow): QuestionHistoryItem | null {
  if (!row.questionText.trim() || !isQuestionHistorySource(row.source) || !isRecord(row.payload)) {
    return null;
  }

  const title = typeof row.payload.title === "string" ? row.payload.title.trim() : "";
  const description = typeof row.payload.description === "string" ? row.payload.description.trim() : "";
  const decisionBasis = isRecord(row.payload.decisionBasis) ? row.payload.decisionBasis : null;
  const conflictResolution = isRecord(row.payload.conflictResolution) ? row.payload.conflictResolution : null;

  const primarySignalKey = decisionBasis?.primarySignalKey;
  const secondarySignalKey = decisionBasis?.secondarySignalKey;
  const conflictResolutionStatus = conflictResolution?.status;
  const appliedPolicy = typeof conflictResolution?.appliedPolicy === "string"
    ? conflictResolution.appliedPolicy.trim()
    : "";

  if (
    !title ||
    !description ||
    !isSignalKey(primarySignalKey) ||
    !isSignalKey(secondarySignalKey) ||
    !isConflictResolutionStatus(conflictResolutionStatus)
  ) {
    return null;
  }

  return {
    id: row.id,
    questionText: row.questionText.trim(),
    title,
    description,
    askedDateKey: row.askedDateKey,
    source: row.source,
    createdAtLabel: formatSeoulDate(row.createdAt, {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }),
    primarySignalKey,
    secondarySignalKey,
    conflictResolutionStatus,
    conflictResolutionPolicy:
      conflictResolutionStatus === "aligned" || !appliedPolicy ? null : appliedPolicy,
  };
}

export async function recordFortuneQuestionHistory(params: {
  userId: string;
  questionText: string;
  answer: FortuneQuestionAnswer;
  date?: Date;
  source?: QuestionHistorySource;
}): Promise<void> {
  if (!hasQuestionHistoryDatabase()) {
    return;
  }

  await prisma.fortuneQuestionHistory.create({
    data: {
      userId: params.userId,
      askedDateKey: getSeoulDateKey(params.date),
      questionText: params.questionText.trim(),
      payload: serializeQuestionHistoryPayload(params.answer),
      source: params.source ?? "kakao",
    },
  });
}

export async function recordFortuneQuestionHistorySafe(params: {
  userId: string;
  questionText: string;
  answer: FortuneQuestionAnswer;
  date?: Date;
  source?: QuestionHistorySource;
}): Promise<void> {
  try {
    await recordFortuneQuestionHistory(params);
  } catch (error) {
    console.error("[fortune-question-history] failed to persist question history", error);
  }
}

export async function findRecentQuestionHistoryByUserId(
  userId: string,
  limit = 10,
): Promise<QuestionHistoryItem[]> {
  if (!hasQuestionHistoryDatabase()) {
    return [];
  }

  try {
    const rows = await prisma.fortuneQuestionHistory.findMany({
      where: { userId },
      take: Math.max(1, Math.min(limit, 10)),
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        askedDateKey: true,
        questionText: true,
        payload: true,
        source: true,
        createdAt: true,
      },
    });

    return rows
      .map((row) => normalizeQuestionHistoryRecord(row))
      .filter((item): item is QuestionHistoryItem => Boolean(item));
  } catch (error) {
    console.error("[fortune-question-history] failed to load question history", error);
    return [];
  }
}
