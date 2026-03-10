import { afterEach, describe, expect, it, vi } from "vitest";
import { generateDailyFortune } from "../../lib/fortune";
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
    expect(fortune.recommendedActions[0]).toBe(fortune.analysis.hybrid.kuseong?.action);
    expect(fortune.avoidToday[0]).toBe(fortune.analysis.hybrid.kuseong?.caution);
    expect(fortune.headline).toContain(fortune.analysis.hybrid.kuseong?.narrative.headlineAddon ?? "");
    expect(fortune.summary).toContain(fortune.analysis.hybrid.kuseong?.narrative.summaryAddon ?? "");
    expect(fortune.detail).toContain(fortune.analysis.hybrid.kuseong?.narrative.detailAddon ?? "");
    expect(fortune.caution).toContain(fortune.analysis.hybrid.kuseong?.narrative.cautionAddon ?? "");
    expect(Object.values(fortune.analysis.hybrid.kuseong?.categoryAdjustments ?? {}).every((value) => value >= -3 && value <= 3)).toBe(
      true,
    );
    expect(fortune.analysis.hybrid.kuseong?.focusCategories).toHaveLength(2);
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
        headlineAddon: "구성 흐름은 일 쪽을 고르게 밀어 주는 편이오.",
        summaryAddon: "특히 일과 재물 쪽 반응이 두드러지며, 동남 방향 흐름을 타는 편이 맞소.",
        detailAddon: "본명성·월성·일성의 맞물림을 보면 일과 재물에 힘이 실리고, 나머지 분야는 과속보다 조율이 낫소.",
        cautionAddon: "무난한 흐름이라도 회복은 억지로 끌어올리지 마시오.",
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
        summaryAddon: "특히 일과 관계 쪽 반응이 두드러지며, 동남 방향 흐름을 타는 편이 맞소.",
        detailAddon: "본명성·월성·일성의 맞물림을 보면 일과 관계에 힘이 실리고, 나머지 분야는 과속보다 조율이 낫소.",
        cautionAddon: "기세가 붙어도 한 번에 판을 키우지 말고 일부터 순서대로 다루시오.",
      },
    });

    const neutralScores = Object.fromEntries(neutral.categoryScores.map((item) => [item.key, item.score]));
    const adjustedScores = Object.fromEntries(adjusted.categoryScores.map((item) => [item.key, item.score]));

    expect(adjustedScores.work - neutralScores.work).toBe(2);
    expect(adjustedScores.money - neutralScores.money).toBe(-1);
    expect(adjustedScores.relationship - neutralScores.relationship).toBe(1);
    expect(adjustedScores.health - neutralScores.health).toBe(-2);
    expect(adjusted.headline).toContain(adjusted.analysis.hybrid.kuseong?.narrative.headlineAddon ?? "");
    expect(adjusted.summary).toContain(adjusted.analysis.hybrid.kuseong?.narrative.summaryAddon ?? "");
    expect(adjusted.detail).toContain(adjusted.analysis.hybrid.kuseong?.narrative.detailAddon ?? "");
    expect(adjusted.caution).toContain(adjusted.analysis.hybrid.kuseong?.narrative.cautionAddon ?? "");
    expect(adjusted.recommendedActions[0]).toBe(adjusted.analysis.hybrid.kuseong?.action);
    expect(adjusted.avoidToday[0]).toBe(adjusted.analysis.hybrid.kuseong?.caution);
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
    expect(fortune.analysis.hybrid.kuseong?.summary).toContain("양력·음력 후보를 함께 본 구성 참고 기준");
  });
});

afterEach(() => {
  vi.resetModules();
  vi.doUnmock("../../lib/kuseong");
});

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
    natalYearStar: "六白金",
    currentMonthStar: "三碧木",
    currentDayStar: "九紫火",
    natalRelation: "support",
    monthRelation: "same",
    qiMenLuckLabel: "吉",
    direction: "동남",
    action: "일과 관계 쪽은 오늘 먼저 움직여도 좋소.",
    caution: "회복과 무리한 확장은 피하고 정리부터 앞세우시오.",
    summary: "본명성 六白金, 당월성 三碧木, 일성 九紫火이오.",
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
    narrative: {
      headlineAddon: "구성 흐름은 일 쪽을 고르게 밀어 주는 편이오.",
      summaryAddon: "특히 일과 재물 쪽 반응이 두드러지며, 동남 방향 흐름을 타는 편이 맞소.",
      detailAddon: "본명성·월성·일성의 맞물림을 보면 일과 재물에 힘이 실리고, 나머지 분야는 과속보다 조율이 낫소.",
      cautionAddon: "무난한 흐름이라도 회복은 억지로 끌어올리지 마시오.",
    },
  };
}
