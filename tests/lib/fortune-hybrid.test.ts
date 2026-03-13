import { afterEach, describe, expect, it, vi } from "vitest";
import { generateDailyFortune, selectTopFortuneSignals } from "../../lib/fortune";
import { buildRecommendedActionList } from "../../lib/fortune-guidance";
import type { KuseongDetail } from "../../lib/kuseong";

function expectedGrade(score: number): "대길" | "길" | "평" | "주의" {
  if (score >= 80) return "대길";
  if (score >= 60) return "길";
  if (score >= 40) return "평";
  return "주의";
}

describe("daily fortune hybrid analysis", () => {
  it("applies kuseong delta and exposes source breakdown", () => {
    const fortune = generateDailyFortune({
      userId: "hybrid-user",
      birthDate: new Date(Date.UTC(1995, 9, 21)),
      birthTime: "14:30",
      calendarType: "solar",
      sajuData: {},
      date: new Date("2026-03-10T09:00:00+09:00"),
    });

    expect(fortune.analysis.hybrid.sources.map((source) => source.key)).toEqual(["saju", "kuseong"]);
    expect(fortune.analysis.hybrid.scoreBreakdown.final).toBe(fortune.score);
    expect(
      fortune.analysis.hybrid.scoreBreakdown.base + fortune.analysis.hybrid.scoreBreakdown.kuseongDelta,
    ).toBe(fortune.score);
    expect(fortune.grade).toBe(expectedGrade(fortune.score));
    expect(fortune.analysis.hybrid.kuseong?.summary).toContain("본명성");
    expect(fortune.luckyHints.direction).toBe(fortune.analysis.hybrid.kuseong?.direction);
    expect(fortune.recommendedActions).toEqual(expectedRecommendedActions(fortune));
    expect(fortune.avoidToday[0]).toBe(expectedAvoidTodayLead(fortune));
    expect(fortune.headline).toContain(fortune.analysis.hybrid.kuseong?.narrative.headlineAddon ?? "");
    expect(fortune.summary).toContain(fortune.analysis.hybrid.kuseong?.narrative.summaryAddon ?? "");
    expect(fortune.detail).toContain(fortune.analysis.hybrid.kuseong?.narrative.detailAddon ?? "");
    expect(fortune.analysis.hybrid.kuseong?.narrative.cautionAddon.length).toBeGreaterThan(0);
    expect(fortune.analysis.signals.some((signal) => signal.sources.includes("kuseong"))).toBe(true);
    expect(fortune.analysis.evidence.facts.some((fact) => fact.source === "kuseong")).toBe(true);
    expect(
      fortune.analysis.evidence.signalContributions.some((contribution) => contribution.source === "kuseong"),
    ).toBe(true);
    expect(
      Object.values(fortune.analysis.hybrid.kuseong?.categoryAdjustments ?? {}).every(
        (value) => value >= -3 && value <= 3,
      ),
    ).toBe(true);
    expect(fortune.analysis.hybrid.kuseong?.focusCategories).toHaveLength(2);
    expect(fortune.analysis.hybridExplanation.baseSystem).toBe("saju");
    expect(fortune.analysis.hybridExplanation.supportSystems).toEqual(["kuseong"]);
    expect(fortune.analysis.hybridExplanation.questionSystem).toBeNull();
    expect(fortune.analysis.hybridExplanation.confidenceMode).toBe("exact");
    expect(fortune.analysis.hybridExplanation.contributions.kuseong).toContain("일일 보정");
  });

  it("applies category-specific kuseong adjustments instead of a uniform delta", async () => {
    const neutral = await generateFortuneWithMockedKuseong({
      scoreDelta: 2,
      categoryAdjustments: {
        work: 0,
        money: 0,
        relationship: 0,
        health: 0,
      },
      focusCategories: ["work", "money"],
      narrativeTone: "steady",
      narrative: {
        headlineAddon: "구성 흐름이 일을 고르게 받쳐 주는 날이오.",
        summaryAddon: "특히 일과 재물 쪽 반응이 단정하니 동남 방향 흐름도 참고하시오.",
        detailAddon: "본명성과 월성, 일성의 맞물림을 보면 일과 재물 쪽 힘이 먼저 열리고 나머지 분야는 과속보다 조율이 낫소.",
        cautionAddon: "무난한 흐름이라도 회복과 무리는 따로 살피시오.",
      },
    });
    const adjusted = await generateFortuneWithMockedKuseong({
      scoreDelta: 2,
      categoryAdjustments: {
        work: 2,
        money: -1,
        relationship: 1,
        health: -2,
      },
      focusCategories: ["work", "relationship"],
      narrativeTone: "push",
      narrative: {
        headlineAddon: "구성 흐름까지 받쳐 주니 일 쪽은 한 걸음 먼저 내도 괜찮소.",
        summaryAddon: "특히 일과 관계 쪽 반응이 단단하니 동남 방향 흐름도 참고하시오.",
        detailAddon: "본명성과 월성, 일성의 맞물림을 보면 일과 관계에 힘이 먼저 열리고 나머지 분야는 과속보다 조율이 낫소.",
        cautionAddon: "기세가 붙어도 범위를 넓히지 말고 일의 순서를 세우시오.",
      },
    });

    const neutralScores = Object.fromEntries(neutral.categoryScores.map((item) => [item.key, item.score]));
    const adjustedScores = Object.fromEntries(adjusted.categoryScores.map((item) => [item.key, item.score]));

    expect(adjustedScores.work - neutralScores.work).toBe(2);
    expect(adjustedScores.money - neutralScores.money).toBe(-1);
    expect(adjustedScores.relationship - neutralScores.relationship).toBe(1);
    expect(adjustedScores.health - neutralScores.health).toBe(-2);
    expect(adjusted.recommendedActions).toEqual(expectedRecommendedActions(adjusted));
    expect(adjusted.avoidToday[0]).toBe(expectedAvoidTodayLead(adjusted));
    expect(neutral.analysis.signals.find((signal) => signal.key === "relationship")?.sources).not.toContain("kuseong");
    expect(adjusted.analysis.signals.find((signal) => signal.key === "relationship")?.sources).toContain("kuseong");
    expect(
      adjusted.analysis.evidence.facts.some((fact) => fact.id === "kuseong-relationship" && fact.source === "kuseong"),
    ).toBe(true);
    expect(
      adjusted.analysis.evidence.signalContributions.some(
        (contribution) =>
          contribution.signalKey === "relationship" &&
          contribution.source === "kuseong" &&
          contribution.scoreDelta > 0,
      ),
    ).toBe(true);
    expect(neutral.analysis.hybridExplanation.conflicts).toEqual([]);
    expect(adjusted.analysis.hybridExplanation.conflicts[0]?.type).toBe("tone-conflict");
    expect(adjusted.analysis.hybridExplanation.conflicts[0]?.systems).toEqual(["saju", "kuseong"]);
  });

  it("keeps unknown-calendar fortunes in reference mode for both saju and kuseong", () => {
    const fortune = generateDailyFortune({
      userId: "hybrid-unknown-user",
      birthDate: new Date(Date.UTC(1994, 0, 25)),
      birthTime: "08:10",
      calendarType: "unknown",
      sajuData: {},
      date: new Date("2026-03-10T09:00:00+09:00"),
    });

    expect(fortune.analysis.certainty).toBe("calendar-unknown");
    expect(fortune.analysis.hybrid.sources.map((source) => source.key)).toEqual(["saju", "kuseong"]);
    expect(fortune.analysis.hybrid.kuseong?.referenceMode).toBe("solar-lunar-blend");
    expect(fortune.analysis.hybrid.kuseong?.summary).toContain("양력");
    expect(fortune.analysis.hybridExplanation.confidenceMode).toBe("reference");
    expect(fortune.analysis.hybridExplanation.conflicts).toEqual([]);
  });

  it("does not inject health-only kuseong rest cautions when health is not the weakest category", async () => {
    const fortune = await generateFortuneWithMockedKuseong({
      scoreDelta: -2,
      categoryAdjustments: {
        work: -3,
        money: 1,
        relationship: 2,
        health: 0,
      },
      focusCategories: ["relationship", "money"],
      narrativeTone: "recover",
      narrative: {
        headlineAddon: "구성 흐름은 일과 쪽 과속을 멈추고 약한 분야 조율을 먼저 택하라 하오.",
        summaryAddon: "특히 관계와 재물 쪽 반응이 두드러지며 동남 방향 흐름을 차분히 타는 편이 맞소.",
        detailAddon: "본명성과 월성, 일성의 맞물림을 보면 관계와 재물에 힘이 실리고 일과 쪽은 과속보다 조율이 낫소.",
        cautionAddon: "일과 쪽 과속과 무리한 확장은 줄이고, 약한 분야 조율부터 앞세우시오.",
      },
    });

    expect(fortune.avoidToday.some((line) => line.includes("쉬어 가시오"))).toBe(false);
  });
});

afterEach(() => {
  vi.resetModules();
  vi.doUnmock("../../lib/kuseong");
});

function expectedRecommendedActions(fortune: ReturnType<typeof generateDailyFortune>): string[] {
  const topSignals = selectTopFortuneSignals(fortune.analysis.signals);
  const healthScore = fortune.categoryScores.find((item) => item.key === "health")?.score ?? 0;

  return buildRecommendedActionList({
    topSignals,
    signals: fortune.analysis.signals,
    eventKind: fortune.analysis.eventOutlook.kind,
    healthScore,
  });
}

function expectedAvoidTodayLead(fortune: ReturnType<typeof generateDailyFortune>): string {
  return fortune.analysis.signals.find((signal) => signal.key === "friction")?.caution ?? fortune.caution;
}

async function generateFortuneWithMockedKuseong(overrides: Partial<KuseongDetail>) {
  vi.resetModules();
  vi.doMock("../../lib/kuseong", async () => {
    const actual = await vi.importActual<typeof import("../../lib/kuseong")>("../../lib/kuseong");
    return {
      ...actual,
      buildKuseongDetail: () => ({
        ...baseMockKuseongDetail(),
        ...overrides,
      }),
    };
  });

  const { generateDailyFortune: generateMockedDailyFortune } = await import("../../lib/fortune");

  return generateMockedDailyFortune({
    userId: "hybrid-mock-user",
    birthDate: new Date(Date.UTC(1995, 9, 21)),
    birthTime: "14:30",
    calendarType: "solar",
    sajuData: {},
    date: new Date("2026-03-10T09:00:00+09:00"),
  });
}

function baseMockKuseongDetail(): KuseongDetail {
  return {
    natalYearStar: "오황토성",
    currentMonthStar: "팔백토성",
    currentDayStar: "육백금성",
    natalRelation: "support",
    monthRelation: "same",
    qiMenLuckLabel: "보통",
    direction: "동남",
    action: "일과 관계 쪽은 오늘 먼저 움직여도 좋소.",
    caution: "회복과 무리한 확장은 분리해서 보시오.",
    summary: "본명성 오황토성, 월성 팔백토성, 일성 육백금성의 결이 이어지는 날이오.",
    scoreDelta: 2,
    referenceMode: "exact",
    breakdown: {
      natalRelationScore: 1,
      monthRelationScore: 1,
      qiMenLuckScore: 0,
    },
    categoryAdjustments: {
      work: 0,
      money: 0,
      relationship: 0,
      health: 0,
    },
    focusCategories: ["work", "money"],
    narrativeTone: "steady",
    stars: {
      natalYear: [
        {
          label: "본명성",
          number: "5",
          position: "中",
          positionLabel: "중앙",
        },
      ],
      currentMonth: {
        label: "월성",
        number: "8",
        position: "艮",
        positionLabel: "동북",
        gate: "생문",
      },
      currentDay: {
        label: "일성",
        number: "6",
        position: "乾",
        positionLabel: "서북",
        gate: "개문",
      },
    },
    narrative: {
      headlineAddon: "구성 흐름이 일을 고르게 받쳐 주는 날이오.",
      summaryAddon: "특히 일과 재물 쪽 반응이 단정하니 동남 방향 흐름도 참고하시오.",
      detailAddon: "본명성과 월성, 일성의 맞물림을 보면 일과 재물 쪽 힘이 먼저 열리고 나머지 분야는 과속보다 조율이 낫소.",
      cautionAddon: "무난한 흐름이라도 회복과 무리는 따로 살피시오.",
    },
  };
}
