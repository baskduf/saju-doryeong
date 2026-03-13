import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FortuneQuestionAnswer } from "../../lib/fortune-question";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("../../lib/prisma", () => ({
  prisma: {
    fortuneQuestionHistory: {
      create: mocks.create,
      findMany: mocks.findMany,
    },
  },
}));

import {
  findRecentQuestionHistoryByUserId,
  normalizeQuestionHistoryRecord,
  recordFortuneQuestionHistory,
} from "../../lib/fortune-question-history";

function buildAnswer(overrides: Partial<FortuneQuestionAnswer> = {}): FortuneQuestionAnswer {
  return {
    title: "도령의 판단",
    description: "오늘은 서두르기보다 순서를 먼저 세우는 편이 낫소.",
    topic: "work",
    usedLlm: false,
    sources: ["daily", "yukhyo"],
    oracleMeta: {
      primaryHexagram: "건상 곤하",
      changedHexagram: "진상 건하",
      movingLines: [1, 3, 6],
      answerTrend: "positive",
    },
    decisionBasis: {
      topic: "work",
      intent: "outcome",
      relationshipKind: "generic",
      primarySignalKey: "work",
      secondarySignalKey: "friction",
    },
    oracleInfluence: {
      channels: ["direction"],
      summary: "육효는 방향 채널에서만 보조 판단을 하오.",
    },
    conflictResolution: {
      status: "aligned",
      summary: "육효와 기본 신호가 크게 충돌하지 않소.",
      appliedPolicy: "기본 흐름 유지",
    },
    ...overrides,
  };
}

describe("fortune question history", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = "postgres://test.example.com/saju";
    mocks.create.mockReset();
    mocks.findMany.mockReset();
  });

  it("serializes and stores question answers as snapshot payloads", async () => {
    await recordFortuneQuestionHistory({
      userId: "history-user",
      questionText: "오늘 일 시작해도 될까?",
      answer: buildAnswer(),
      date: new Date("2026-03-10T09:00:00+09:00"),
    });

    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "history-user",
        askedDateKey: "2026-03-10",
        questionText: "오늘 일 시작해도 될까?",
        source: "kakao",
        payload: expect.objectContaining({
          title: "도령의 판단",
          description: "오늘은 서두르기보다 순서를 먼저 세우는 편이 낫소.",
        }),
      }),
    });
  });

  it("normalizes valid history rows for the record tab", () => {
    const item = normalizeQuestionHistoryRecord({
      id: "history-1",
      askedDateKey: "2026-03-10",
      questionText: "오늘 연락해도 될까?",
      payload: buildAnswer({
        decisionBasis: {
          topic: "relationship",
          intent: "timing",
          relationshipKind: "romance",
          primarySignalKey: "relationship",
          secondarySignalKey: "timing",
        },
        conflictResolution: {
          status: "reference-priority",
          summary: "참고 흐름으로 보는 편이 낫소.",
          appliedPolicy: "불확실성 우선",
        },
      }),
      source: "kakao",
      createdAt: new Date("2026-03-10T00:15:00Z"),
    });

    expect(item).toEqual(
      expect.objectContaining({
        id: "history-1",
        questionText: "오늘 연락해도 될까?",
        primarySignalKey: "relationship",
        secondarySignalKey: "timing",
        conflictResolutionStatus: "reference-priority",
        conflictResolutionPolicy: "불확실성 우선",
      }),
    );
    expect(item?.createdAtLabel).toBeTruthy();
  });

  it("filters malformed payload rows and keeps the latest ten query contract", async () => {
    mocks.findMany.mockResolvedValue([
      {
        id: "history-new",
        askedDateKey: "2026-03-11",
        questionText: "오늘 계약 이야기 꺼내도 될까?",
        payload: buildAnswer({
          decisionBasis: {
            topic: "money",
            intent: "action",
            relationshipKind: "generic",
            primarySignalKey: "money",
            secondarySignalKey: "timing",
          },
          conflictResolution: {
            status: "question-signal-conflict",
            summary: "기회는 있어도 무리는 금하오.",
            appliedPolicy: "기회는 보되 무리는 금지",
          },
        }),
        source: "kakao",
        createdAt: new Date("2026-03-11T01:00:00Z"),
      },
      {
        id: "history-bad",
        askedDateKey: "2026-03-10",
        questionText: " ",
        payload: { title: "broken" },
        source: "kakao",
        createdAt: new Date("2026-03-10T01:00:00Z"),
      },
    ]);

    const result = await findRecentQuestionHistoryByUserId("history-user");

    expect(mocks.findMany).toHaveBeenCalledWith({
      where: { userId: "history-user" },
      take: 10,
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
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        id: "history-new",
        questionText: "오늘 계약 이야기 꺼내도 될까?",
        conflictResolutionPolicy: "기회는 보되 무리는 금지",
      }),
    );
  });
});
