import { beforeEach, describe, expect, it, vi } from "vitest";

const profileMocks = vi.hoisted(() => ({
  getQuestionUsageSummary: vi.fn(),
}));

const fortuneMocks = vi.hoisted(() => ({
  generateDailyFortune: vi.fn(),
}));

const questionMocks = vi.hoisted(() => ({
  answerFortuneQuestion: vi.fn(),
}));

const shareMocks = vi.hoisted(() => ({
  upsertFortuneShareSnapshot: vi.fn(),
}));

vi.mock("../../../../lib/profile", () => ({
  BASE_DAILY_QUESTION_LIMIT: 5,
  DAILY_SHARE_REWARD_LIMIT: 10,
  getQuestionUsageSummary: profileMocks.getQuestionUsageSummary,
}));

vi.mock("../../../../lib/fortune", () => ({
  generateDailyFortune: fortuneMocks.generateDailyFortune,
}));

vi.mock("../../../../lib/fortune-question", () => ({
  answerFortuneQuestion: questionMocks.answerFortuneQuestion,
}));

vi.mock("../../../../lib/fortune-share", () => ({
  upsertFortuneShareSnapshot: shareMocks.upsertFortuneShareSnapshot,
}));

vi.mock("../../../../lib/access-token", () => ({
  createFortuneAccessToken: () => "fortune-token",
  createRegisterAccessToken: () => "register-token",
}));

import { createQuestionAnswerCard } from "../../../../app/api/kakao/_internal/presenters";

function buildProfile() {
  return {
    userId: "kakao-user-1",
    name: "홍길동",
    birthDate: new Date(Date.UTC(1995, 9, 21)),
    birthTime: "14:30",
    calendarType: "solar",
    sajuData: {},
    questionUsageDateKey: "2026-03-10",
    questionUsageCount: 1,
    shareRewardDateKey: "2026-03-10",
    shareRewardCount: 0,
    pendingQuestionInput: false,
    pendingQuestionExpiresAt: null,
    createdAt: new Date("2026-03-01T00:00:00Z"),
    updatedAt: new Date("2026-03-10T00:00:00Z"),
  };
}

function buildUsage() {
  return {
    count: 1,
    usedCount: 1,
    baseLimit: 5,
    rewardCountToday: 0,
    rewardRemainingToday: 10,
    totalLimitToday: 5,
    remaining: 4,
    isLimited: false,
  };
}

function buildFortune() {
  return {
    score: 74,
    grade: "길",
    headline: "차분히 밀면 성과가 붙는 날이오.",
    summary: "순서를 세우면 흐름이 반듯하게 이어지오.",
    caution: "서두른 결정은 피하시오.",
    analysis: {
      hybrid: {
        scoreBreakdown: {
          kuseongDelta: 3,
        },
      },
    },
  };
}

function buildAnswer(overrides: Record<string, unknown> = {}) {
  return {
    title: "도령의 답",
    description: "오늘은 순서를 먼저 세우고 움직이면 좋소.",
    topic: "work",
    usedLlm: false,
    sources: ["daily", "yukhyo"],
    oracleMeta: {
      primaryHexagram: "건상 곤하",
      changedHexagram: "진상 건하",
      movingLines: [1, 5, 6],
      answerTrend: "neutral",
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
      summary: "육효는 방향 채널에서 보조 판단을 더하오.",
    },
    conflictResolution: {
      status: "aligned",
      summary: "육효와 기본 신호가 크게 충돌하지 않아 같은 결로 정리하오.",
      appliedPolicy: "기본 흐름 유지",
    },
    ...overrides,
  };
}

describe("kakao presenters", () => {
  beforeEach(() => {
    fortuneMocks.generateDailyFortune.mockReturnValue(buildFortune());
    questionMocks.answerFortuneQuestion.mockResolvedValue(buildAnswer());
    profileMocks.getQuestionUsageSummary.mockReturnValue(buildUsage());
  });

  it("renders concise question answer metadata lines in the kakao card", async () => {
    const card = await createQuestionAnswerCard(buildProfile(), "오늘 일 어떻게 풀릴까?");
    const basicCard = card.template.outputs[0].basicCard;

    expect(basicCard.title).toBe("도령의 답");
    expect(basicCard.description).toContain("오늘은 순서를 먼저 세우고 움직이면 좋소.");
    expect(basicCard.description).toContain("판단 신호: 일과 흐름, 마찰 신호");
    expect(basicCard.description).toContain("남은 질문 4회");
    expect(basicCard.description).not.toContain("육효 보강:");
    expect(basicCard.description).not.toContain("판단 조정:");
    expect(basicCard.description).not.toContain("판단 근거:");
  });

  it("renders conflict summaries when the oracle opposes the base flow", async () => {
    questionMocks.answerFortuneQuestion.mockResolvedValue(
      buildAnswer({
        conflictResolution: {
          status: "question-signal-conflict",
          summary: "육효는 제동을 걸지만 기본 신호는 살아 있어 무리만 금하고 방향은 남기오.",
          appliedPolicy: "기회가 있어도 무리 금지",
        },
      }),
    );

    const card = await createQuestionAnswerCard(buildProfile(), "오늘 일 어떻게 풀릴까?");
    expect(card.template.outputs[0].basicCard.description).toContain("참고: 기회가 있어도 무리 금지");
  });

  it("renders reference summaries when calendar certainty is low", async () => {
    questionMocks.answerFortuneQuestion.mockResolvedValue(
      buildAnswer({
        conflictResolution: {
          status: "reference-priority",
          summary: "달력 기준이 미확정이라 참고 흐름을 먼저 따르오.",
          appliedPolicy: "불확실성 우선",
        },
      }),
    );

    const card = await createQuestionAnswerCard(buildProfile(), "오늘 연락 보내도 될까?");
    expect(card.template.outputs[0].basicCard.description).toContain("참고: 불확실성 우선");
  });

  it("maps signal keys to readable Korean labels", async () => {
    questionMocks.answerFortuneQuestion.mockResolvedValue(
      buildAnswer({
        decisionBasis: {
          topic: "relationship",
          intent: "timing",
          relationshipKind: "romance",
          primarySignalKey: "relationship",
          secondarySignalKey: "timing",
        },
      }),
    );

    const card = await createQuestionAnswerCard(buildProfile(), "오늘 고백해도 좋을까?");
    expect(card.template.outputs[0].basicCard.description).toContain("판단 신호: 관계 흐름, 타이밍 신호");
  });
});
