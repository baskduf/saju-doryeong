import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { generateDailyFortune } from "../../../lib/fortune";
import type { QuestionHistoryItem } from "../../../lib/fortune-question-history";

vi.mock("next/image", () => ({
  default: ({
    priority: _priority,
    ...props
  }: React.ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean }) => React.createElement("img", props),
}));

vi.mock("../../../app/fortune/[id]/FiveElementsChart", () => ({
  FiveElementsChart: () => React.createElement("div", null, "FiveElementsChart"),
}));

vi.mock("../../../app/fortune/[id]/HybridCharts", () => ({
  KuseongChartSection: () => React.createElement("div", null, "KuseongChartSection"),
  YukhyoChartSection: () => React.createElement("div", null, "YukhyoChartSection"),
}));

import { FortuneSections } from "../../../app/fortune/[id]/FortuneSections";

function buildFortune() {
  return generateDailyFortune({
    userId: "fortune-user",
    birthDate: new Date(Date.UTC(1995, 9, 21)),
    birthTime: "14:30",
    calendarType: "solar",
    sajuData: {},
    date: new Date("2026-03-10T09:00:00+09:00"),
  });
}

function buildHistoryItem(overrides: Partial<QuestionHistoryItem> = {}): QuestionHistoryItem {
  return {
    id: "history-1",
    questionText: "오늘 연락해도 괜찮을까?",
    title: "도령의 관계 판단",
    description: "오늘은 말의 강도보다 반응의 흐름을 먼저 보는 편이 좋소.",
    askedDateKey: "2026-03-10",
    source: "kakao",
    createdAtLabel: "03. 10. 09:15",
    primarySignalKey: "relationship",
    secondarySignalKey: "timing",
    conflictResolutionStatus: "aligned",
    conflictResolutionPolicy: null,
    ...overrides,
  };
}

describe("fortune sections record tab", () => {
  it("renders the top-level record tab button", () => {
    const markup = renderToStaticMarkup(
      <FortuneSections
        fortune={buildFortune()}
        userId="fortune-user"
        referenceDate="2026-03-10T09:00:00+09:00"
        questionHistory={[]}
      />,
    );

    expect(markup).toContain("운세");
    expect(markup).toContain("분석");
    expect(markup).toContain("기록");
  });

  it("shows an empty state when no question history exists", () => {
    const markup = renderToStaticMarkup(
      <FortuneSections
        fortune={buildFortune()}
        userId="fortune-user"
        referenceDate="2026-03-10T09:00:00+09:00"
        questionHistory={[]}
        initialTab="history"
      />,
    );

    expect(markup).toContain("질문 기록");
    expect(markup).toContain("아직 기록이 없소");
    expect(markup).toContain("카카오에서 질문을 남기면 답변이 여기에 차곡차곡 쌓이오.");
    expect(markup).not.toContain("카카오에서 남긴 질문과 답변이 여기에 쌓이오.");
  });

  it("renders question history cards with Korean signal labels and policy text only when needed", () => {
    const markup = renderToStaticMarkup(
      <FortuneSections
        fortune={buildFortune()}
        userId="fortune-user"
        referenceDate="2026-03-10T09:00:00+09:00"
        questionHistory={[
          buildHistoryItem({
            id: "history-2",
            questionText: "오늘 계약 이야기를 꺼내도 될까?",
            title: "도령의 계약 판단",
            description: "기회는 있으나 서두르면 꼬일 수 있으니 확인부터 두시오.",
            primarySignalKey: "money",
            secondarySignalKey: "friction",
            conflictResolutionStatus: "question-signal-conflict",
            conflictResolutionPolicy: "기회가 보여도 오늘은 확인과 정리를 먼저 두시오.",
          }),
          buildHistoryItem(),
        ]}
        initialTab="history"
      />,
    );

    expect(markup).toContain("오늘 계약 이야기를 꺼내도 될까?");
    expect(markup).toContain("도령의 계약 판단");
    expect(markup).toContain("재물 흐름");
    expect(markup).toContain("마찰 신호");
    expect(markup).not.toContain("money");
    expect(markup).not.toContain("friction");
    expect(markup).toContain("참고 정책");
    expect(markup).toContain("기회");
    expect(markup).toContain("확인과");
    expect(markup).toContain("정리");
    expect(markup).not.toContain("기본 흐름 우선");
    expect(markup.indexOf("오늘 계약 이야기를 꺼내도 될까?")).toBeLessThan(markup.indexOf("오늘 연락해도 괜찮을까?"));
  });
});
