import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateDailyFortune } from "../../../lib/fortune";

const mocks = vi.hoisted(() => ({
  notFound: vi.fn(),
  verifyFortuneAccessToken: vi.fn(),
  generateDailyFortuneWithNarrative: vi.fn(),
  findRecentQuestionHistoryByUserId: vi.fn(),
}));

vi.mock("next/image", () => ({
  default: ({
    priority: _priority,
    ...props
  }: React.ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean }) => React.createElement("img", props),
}));

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
}));

vi.mock("../../../lib/access-token", () => ({
  verifyFortuneAccessToken: mocks.verifyFortuneAccessToken,
}));

vi.mock("../../../lib/fortune", async () => {
  const actual = await vi.importActual<typeof import("../../../lib/fortune")>("../../../lib/fortune");
  return {
    ...actual,
    generateDailyFortuneWithNarrative: mocks.generateDailyFortuneWithNarrative,
  };
});

vi.mock("../../../lib/fortune-question-history", () => ({
  findRecentQuestionHistoryByUserId: mocks.findRecentQuestionHistoryByUserId,
}));

vi.mock("../../../app/fortune/[id]/FortuneSections", () => ({
  FortuneSections: ({
    questionHistory,
  }: {
    questionHistory: Array<{ id: string; questionText: string }>;
  }) =>
    React.createElement(
      "section",
      null,
      questionHistory.map((item) => React.createElement("p", { key: item.id }, item.questionText)),
    ),
}));

import FortuneDetailPage from "../../../app/fortune/[id]/page";

describe("fortune detail page sample history", () => {
  beforeEach(() => {
    mocks.notFound.mockReset();
    mocks.verifyFortuneAccessToken.mockReset();
    mocks.generateDailyFortuneWithNarrative.mockReset();
    mocks.findRecentQuestionHistoryByUserId.mockReset();
    mocks.verifyFortuneAccessToken.mockReturnValue({ ok: true });
    mocks.generateDailyFortuneWithNarrative.mockImplementation(async (params: {
      userId: string;
      birthDate: Date;
      birthTime?: string;
      calendarType?: "solar" | "lunar" | "unknown";
      sajuData: unknown;
      date?: Date;
      profileName?: string;
    }) =>
      generateDailyFortune({
        userId: params.userId,
        birthDate: params.birthDate,
        birthTime: params.birthTime,
        calendarType: params.calendarType,
        sajuData: params.sajuData,
        date: params.date,
        profileName: params.profileName,
      }),
    );
  });

  it("shows bundled question history for the sample user without loading DB history", async () => {
    const markup = renderToStaticMarkup(
      await FortuneDetailPage({
        params: { id: "sample-user" },
        searchParams: {},
      }),
    );

    expect(markup).toContain("오늘 먼저 연락을 넣어도 괜찮을까?");
    expect(markup).toContain("오늘 계약 이야기를 바로 꺼내도 될까?");
    expect(markup).toContain("오늘 할 일을 강하게 밀어붙여도 될까?");
    expect(mocks.findRecentQuestionHistoryByUserId).not.toHaveBeenCalled();
  });
});
