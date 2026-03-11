import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildKakaoPayload } from "../../../fixtures/kakao";

const profileMocks = vi.hoisted(() => ({
  buildInitialSajuData: vi.fn(),
  findProfileByUserId: vi.fn(),
  getQuestionUsageSummary: vi.fn(),
  hasDatabaseUrl: vi.fn(),
  hasPendingQuestionInput: vi.fn(),
  incrementQuestionUsage: vi.fn(),
  incrementShareReward: vi.fn(),
  isNonEmptyString: vi.fn((value: unknown) => typeof value === "string" && value.trim().length > 0),
  parseRegistrationFields: vi.fn(),
  setPendingQuestionInput: vi.fn(),
  upsertProfile: vi.fn(),
}));

const accessTokenMocks = vi.hoisted(() => ({
  createFortuneAccessToken: vi.fn(),
  createRegisterAccessToken: vi.fn(),
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
  buildInitialSajuData: profileMocks.buildInitialSajuData,
  findProfileByUserId: profileMocks.findProfileByUserId,
  getQuestionUsageSummary: profileMocks.getQuestionUsageSummary,
  hasDatabaseUrl: profileMocks.hasDatabaseUrl,
  hasPendingQuestionInput: profileMocks.hasPendingQuestionInput,
  incrementQuestionUsage: profileMocks.incrementQuestionUsage,
  incrementShareReward: profileMocks.incrementShareReward,
  isNonEmptyString: profileMocks.isNonEmptyString,
  parseRegistrationFields: profileMocks.parseRegistrationFields,
  setPendingQuestionInput: profileMocks.setPendingQuestionInput,
  upsertProfile: profileMocks.upsertProfile,
}));

vi.mock("../../../../lib/access-token", () => ({
  createFortuneAccessToken: accessTokenMocks.createFortuneAccessToken,
  createRegisterAccessToken: accessTokenMocks.createRegisterAccessToken,
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

import { POST } from "../../../../app/api/kakao/route";

function buildProfile(overrides: Record<string, unknown> = {}) {
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
    ...overrides,
  };
}

function buildUsage(overrides: Record<string, unknown> = {}) {
  return {
    count: 1,
    usedCount: 1,
    baseLimit: 5,
    rewardCountToday: 0,
    rewardRemainingToday: 10,
    totalLimitToday: 5,
    remaining: 4,
    isLimited: false,
    ...overrides,
  };
}

function buildFortune() {
  return {
    score: 74,
    grade: "길",
    headline: "실천하면 성과가 쌓이는 날이로다.",
    summary: "순서를 세워 움직이면 흐름이 반듯하게 이어지는 날이오.",
    caution: "서두른 판단은 한 박자 늦추시오.",
    analysis: {
      hybrid: {
        scoreBreakdown: {
          kuseongDelta: 3,
        },
      },
    },
  };
}

async function callRoute(payload: unknown, key = "test-kakao-secret") {
  const request = new NextRequest(`https://test.example.com/api/kakao?key=${key}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return POST(request);
}

async function readCard(response: Response) {
  const body = await response.json();
  const basicCard = body.template.outputs[0].basicCard;

  return {
    status: response.status,
    title: basicCard.title,
    description: basicCard.description,
    buttons: (basicCard.buttons ?? []).map((button: { label: string }) => button.label),
    quickReplies: body.template.quickReplies.map((reply: { label: string }) => reply.label),
  };
}

describe("POST /api/kakao", () => {
  beforeEach(() => {
    profileMocks.hasDatabaseUrl.mockReturnValue(true);
    profileMocks.findProfileByUserId.mockResolvedValue(null);
    profileMocks.hasPendingQuestionInput.mockReturnValue(false);
    profileMocks.getQuestionUsageSummary.mockReturnValue(buildUsage());
    profileMocks.parseRegistrationFields.mockReturnValue({
      ok: true,
      data: {
        name: "홍길동",
        birthDate: new Date(Date.UTC(1995, 9, 21)),
        birthTime: "14:30",
        calendarType: "solar",
      },
    });
    profileMocks.buildInitialSajuData.mockReturnValue({ built: true });
    profileMocks.upsertProfile.mockResolvedValue(buildProfile());
    profileMocks.setPendingQuestionInput.mockResolvedValue(buildProfile());
    profileMocks.incrementQuestionUsage.mockResolvedValue(buildProfile());
    profileMocks.incrementShareReward.mockResolvedValue({
      profile: buildProfile(),
      usage: buildUsage({ rewardCountToday: 1, totalLimitToday: 6, remaining: 5 }),
      rewarded: true,
    });
    accessTokenMocks.createFortuneAccessToken.mockReturnValue("fortune-token");
    accessTokenMocks.createRegisterAccessToken.mockReturnValue("register-token");
    fortuneMocks.generateDailyFortune.mockReturnValue(buildFortune());
    questionMocks.answerFortuneQuestion.mockResolvedValue({
      title: "도령의 일풀이",
      description: "오늘은 순서를 세워 움직이되 서두른 판단은 피하시오.",
      topic: "work",
      usedLlm: false,
      sources: ["daily", "yukhyo"],
      oracleMeta: {
        primaryHexagram: "건상 손하",
        changedHexagram: "진상 건하",
        movingLines: [1, 5, 6],
        answerTrend: "neutral",
      },
      decisionBasis: {
        topic: "work",
        intent: "outcome",
        relationshipKind: "generic",
        primaryInsightKey: "work",
        secondaryInsightKey: "risk",
      },
      oracleInfluence: {
        channels: ["direction", "caution"],
        summary: "육효는 방향과 주의 채널에서 답변을 보강하오.",
      },
      conflictResolution: {
        status: "aligned",
        summary: "육효와 기본 인사이트가 크게 충돌하지 않아 같은 결로 답변을 정리하오.",
        appliedPolicy: "기본 흐름 유지",
      },
    });
    shareMocks.upsertFortuneShareSnapshot.mockResolvedValue({
      snapshotId: "snapshot-1",
      targetDateKey: "2026-03-10",
      token: "share-token",
    });
  });

  it("rejects requests with the wrong shared secret", async () => {
    const response = await callRoute(buildKakaoPayload(), "wrong-secret");
    const card = await readCard(response);

    expect(card.status).toBe(401);
    expect(card.description).toContain("정상적인 카카오 스킬 요청이 아니어서");
  });

  it("returns a guide card when user id is missing", async () => {
    const response = await callRoute(buildKakaoPayload({ userId: null }));
    const card = await readCard(response);

    expect(card.status).toBe(200);
    expect(card.description).toContain("사용자 식별값을 찾지 못했소");
  });

  it("returns 503 when the database is unavailable", async () => {
    profileMocks.hasDatabaseUrl.mockReturnValue(false);

    const response = await callRoute(buildKakaoPayload());
    const card = await readCard(response);

    expect(card.status).toBe(503);
    expect(card.description).toContain("사주 서고가 아직 열리지 않았소");
  });

  it("returns a registration guide for 정보 재등록", async () => {
    profileMocks.findProfileByUserId.mockResolvedValue(buildProfile());
    profileMocks.hasPendingQuestionInput.mockReturnValue(true);

    const response = await callRoute(buildKakaoPayload({ utterance: "정보 재등록" }));
    const card = await readCard(response);

    expect(card.title).toBe("운세도령");
    expect(card.buttons).toContain("사주 정보 등록하기");
    expect(profileMocks.setPendingQuestionInput).toHaveBeenCalledWith(expect.any(Object), false);
  });

  it("stores registration payloads and returns a fortune card", async () => {
    const response = await callRoute(
      buildKakaoPayload({
        params: {
          name: "홍길동",
          birthDate: "1995-10-21",
          birthTime: "14:30",
          calendarType: "양력",
        },
      }),
    );
    const card = await readCard(response);

    expect(profileMocks.upsertProfile).toHaveBeenCalledWith({
      userId: "kakao-user-1",
      name: "홍길동",
      birthDate: new Date(Date.UTC(1995, 9, 21)),
      birthTime: "14:30",
      calendarType: "solar",
      sajuData: { built: true },
    });
    expect(card.title).toBe("운세도령의 오늘 운세");
    expect(card.description).toContain("사주 정보를 새로 기록했으니 바로 오늘의 운세를 펼치겠소.");
    expect(card.buttons).toContain("상세 운세 보러가기");
  });

  it("returns today's fortune for existing profiles", async () => {
    profileMocks.findProfileByUserId.mockResolvedValue(buildProfile());

    const response = await callRoute(buildKakaoPayload({ utterance: "오늘의 운세" }));
    const card = await readCard(response);

    expect(card.title).toBe("운세도령의 오늘 운세");
    expect(card.description).toContain("운세 점수: 74점(길)");
    expect(card.description).toContain("판단 근거: 사주 기본 + 구성 보정(+3)");
    expect(card.buttons).toContain("친구에게 공유하기");
  });

  it("guides unregistered users before question mode", async () => {
    const response = await callRoute(buildKakaoPayload({ utterance: "운세 질문" }));
    const card = await readCard(response);

    expect(card.description).toContain("운세 질문을 받기 전에 먼저 사주 정보를 기록해야 하오.");
  });

  it("enters question mode for registered users with remaining quota", async () => {
    profileMocks.findProfileByUserId.mockResolvedValue(buildProfile());

    const response = await callRoute(buildKakaoPayload({ utterance: "운세 질문" }));
    const card = await readCard(response);

    expect(profileMocks.setPendingQuestionInput).toHaveBeenCalledWith(expect.any(Object), true);
    expect(card.description).toContain("궁금한 일을 한 문장으로 적어 보시오.");
    expect(card.quickReplies).toContain("연애운 질문");
  });

  it("returns the limit card when question quota is exhausted", async () => {
    profileMocks.findProfileByUserId.mockResolvedValue(buildProfile());
    profileMocks.getQuestionUsageSummary.mockReturnValue(
      buildUsage({
        usedCount: 5,
        totalLimitToday: 5,
        remaining: 0,
        rewardRemainingToday: 2,
        isLimited: true,
      }),
    );

    const response = await callRoute(buildKakaoPayload({ utterance: "운세 질문" }));
    const card = await readCard(response);

    expect(profileMocks.setPendingQuestionInput).toHaveBeenCalledWith(expect.any(Object), false);
    expect(card.description).toContain("오늘 질문 5회는 모두 썼소.");
    expect(card.description).toContain("친구에게 공유하기로 질문 2회까지 더 적립할 수 있소.");
  });

  it("answers freeform questions when pending input is active", async () => {
    const updatedProfile = buildProfile({ questionUsageCount: 2 });

    profileMocks.findProfileByUserId.mockResolvedValue(buildProfile());
    profileMocks.hasPendingQuestionInput.mockReturnValue(true);
    profileMocks.incrementQuestionUsage.mockResolvedValue(updatedProfile);
    profileMocks.getQuestionUsageSummary.mockReturnValue(buildUsage({ usedCount: 2, remaining: 3 }));

    const response = await callRoute(buildKakaoPayload({ utterance: "오늘 일은 어떻게 풀릴까?" }));
    const card = await readCard(response);

    expect(profileMocks.setPendingQuestionInput).toHaveBeenCalledWith(expect.any(Object), false);
    expect(profileMocks.incrementQuestionUsage).toHaveBeenCalledWith(expect.any(Object));
    expect(questionMocks.answerFortuneQuestion).toHaveBeenCalled();
    expect(card.title).toBe("도령의 일풀이");
    expect(card.description).toContain("짚은 흐름: 오늘의 일운, 주의 신호");
    expect(card.description).toContain("남은 질문 3회");
    expect(card.description).not.toContain("육효 보강:");
    expect(card.description).not.toContain("판단 조정:");
    expect(card.quickReplies).toContain("재물운 질문");
  });

  it("creates share cards and rewards extra questions", async () => {
    profileMocks.findProfileByUserId.mockResolvedValue(buildProfile());

    const response = await callRoute(buildKakaoPayload({ utterance: "친구에게 공유하기" }));
    const card = await readCard(response);

    expect(profileMocks.incrementShareReward).toHaveBeenCalledWith(expect.any(Object));
    expect(shareMocks.upsertFortuneShareSnapshot).toHaveBeenCalled();
    expect(card.title).toBe("운세도령의 공유 카드");
    expect(card.description).toContain("질문 1개를 추가로 받았소. 오늘 공유 보상 1/10회");
    expect(card.buttons).toContain("공유 링크 보기");
  });

  it("returns the fallback guide for non-reserved utterances outside question mode", async () => {
    profileMocks.findProfileByUserId.mockResolvedValue(buildProfile());

    const response = await callRoute(buildKakaoPayload({ utterance: "그냥 잡담" }));
    const card = await readCard(response);

    expect(card.description).toContain("무슨 일인지 바로 집히지 않는구나.");
  });
});
