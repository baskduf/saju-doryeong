import { beforeEach, describe, expect, it, vi } from "vitest";

const accessTokenMocks = vi.hoisted(() => ({
  createFortuneAccessToken: vi.fn(),
  createRegisterAccessToken: vi.fn(),
}));

vi.mock("../../../../lib/access-token", () => ({
  createFortuneAccessToken: accessTokenMocks.createFortuneAccessToken,
  createRegisterAccessToken: accessTokenMocks.createRegisterAccessToken,
}));

import {
  buildQuestionUsageLines,
  createFallbackGuideCard,
  createQuestionGuideCard,
  createQuestionLimitCard,
  createRegistrationGuideCard,
  mergeQuickReplies,
} from "../../../../app/api/kakao/_internal/cards";

describe("kakao card builders", () => {
  beforeEach(() => {
    accessTokenMocks.createRegisterAccessToken.mockReturnValue("register-token");
    accessTokenMocks.createFortuneAccessToken.mockReturnValue("fortune-token");
  });

  it("deduplicates quick replies while preserving order", () => {
    const replies = mergeQuickReplies([
      { label: "오늘의 운세", action: "message", messageText: "오늘의 운세" },
      { label: "추가 질문", action: "message", messageText: "추가 질문" },
    ]);

    expect(replies.map((reply) => reply.label)).toEqual([
      "정보 재등록",
      "오늘의 운세",
      "운세 질문",
      "추가 질문",
    ]);
  });

  it("builds question usage lines with optional share hints", () => {
    const withHint = buildQuestionUsageLines(
      {
        count: 2,
        usedCount: 2,
        baseLimit: 3,
        rewardCountToday: 2,
        rewardRemainingToday: 8,
        totalLimitToday: 5,
        remaining: 3,
        isLimited: false,
      },
      { includeShareHint: true },
    );

    const withoutHint = buildQuestionUsageLines(
      {
        count: 0,
        usedCount: 0,
        baseLimit: 3,
        rewardCountToday: 0,
        rewardRemainingToday: 10,
        totalLimitToday: 3,
        remaining: 3,
        isLimited: false,
      },
      { includeShareHint: false },
    );

    expect(withHint).toContain("오늘 공유 적립은 2/10회이오.");
    expect(withHint).toContain("친구에게 공유하기로 질문 8회까지 더 적립할 수 있소.");
    expect(withoutHint.join("\n")).not.toContain("친구에게 공유하기로 질문");
  });

  it("creates question guide cards with merged quick replies", () => {
    const card = createQuestionGuideCard({
      hasProfile: true,
      usage: {
        count: 1,
        usedCount: 1,
        baseLimit: 3,
        rewardCountToday: 0,
        rewardRemainingToday: 10,
        totalLimitToday: 3,
        remaining: 2,
        isLimited: false,
      },
    });

    expect(card.template.outputs[0].basicCard.title).toBe("운세도령");
    expect(card.template.outputs[0].basicCard.description).toContain("궁금한 일을 한 문장으로 적어 보시오.");
    expect(card.template.quickReplies.map((reply) => reply.label)).toEqual([
      "정보 재등록",
      "오늘의 운세",
      "운세 질문",
      "연애운 질문",
      "재물운 질문",
      "직장운 질문",
      "건강운 질문",
    ]);
  });

  it("creates question limit cards for both remaining-share branches", () => {
    const withRewards = createQuestionLimitCard({
      count: 3,
      usedCount: 3,
      baseLimit: 3,
      rewardCountToday: 2,
      rewardRemainingToday: 8,
      totalLimitToday: 5,
      remaining: 0,
      isLimited: true,
    });
    const capped = createQuestionLimitCard({
      count: 13,
      usedCount: 13,
      baseLimit: 3,
      rewardCountToday: 10,
      rewardRemainingToday: 0,
      totalLimitToday: 13,
      remaining: 0,
      isLimited: true,
    });

    expect(withRewards.template.outputs[0].basicCard.description).toContain("친구에게 공유하기로 질문 8회까지 더 적립할 수 있소.");
    expect(withRewards.template.outputs[0].basicCard.buttons?.map((button) => button.label)).toContain("공유링크 만들기");
    expect(capped.template.outputs[0].basicCard.description).toContain("오늘 공유 적립도 10회를 모두 채웠으니 내일 다시 물어보시오.");
  });

  it("creates registration cards with the expected link params", () => {
    const card = createRegistrationGuideCard(undefined, undefined, "user-1");
    const button = card.template.outputs[0].basicCard.buttons?.[0];

    expect(button?.label).toBe("사주 정보 등록하기");
    if (!button || button.action !== "webLink") {
      throw new Error("Expected registration button");
    }

    const url = new URL(button.webLinkUrl);

    expect(url.origin).toBe("https://test.example.com");
    expect(url.pathname).toBe("/register");
    expect(url.searchParams.get("userId")).toBe("user-1");
    expect(url.searchParams.get("token")).toBe("register-token");
    expect(url.searchParams.get("source")).toBe("kakao");
  });

  it("preserves fallback guide copy for both registered and unregistered users", () => {
    const profileCard = createFallbackGuideCard(true);
    const guestCard = createFallbackGuideCard(false);

    expect(profileCard.template.outputs[0].basicCard.description).toContain("무슨 일인지 바로 집히지 않는구나.");
    expect(guestCard.template.outputs[0].basicCard.description).toContain("먼저 사주 정보를 기록해야 하오.");
  });
});
