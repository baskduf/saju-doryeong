import { describe, expect, it } from "vitest";
import { buildKuseongDetail } from "../../lib/kuseong";

describe("buildKuseongDetail", () => {
  it("builds fixed-day natal and current star details", () => {
    const detail = buildKuseongDetail({
      birthDate: new Date(Date.UTC(1995, 9, 21)),
      birthTime: "14:30",
      calendarType: "solar",
      date: new Date("2026-03-10T09:00:00+09:00"),
    });

    expect(detail.natalYearStar.length).toBeGreaterThan(0);
    expect(detail.currentMonthStar.length).toBeGreaterThan(0);
    expect(detail.currentDayStar.length).toBeGreaterThan(0);
    expect(detail.direction.length).toBeGreaterThan(0);
    expect(detail.action.length).toBeGreaterThan(0);
    expect(detail.caution.length).toBeGreaterThan(0);
    expect(detail.summary).toContain("본명성");
    expect(detail.scoreDelta).toBeGreaterThanOrEqual(-5);
    expect(detail.scoreDelta).toBeLessThanOrEqual(5);
    expect(Object.values(detail.categoryAdjustments).every((value) => value >= -3 && value <= 3)).toBe(true);
    expect(detail.focusCategories).toHaveLength(2);
    expect(new Set(detail.focusCategories).size).toBe(detail.focusCategories.length);
    expect(["push", "steady", "cautious", "recover"]).toContain(detail.narrativeTone);
    expect(detail.narrative.headlineAddon.length).toBeGreaterThan(0);
    expect(detail.narrative.summaryAddon.length).toBeGreaterThan(0);
    expect(detail.narrative.detailAddon.length).toBeGreaterThan(0);
    expect(detail.narrative.cautionAddon.length).toBeGreaterThan(0);
    expect(detail.stars.natalYear.length).toBeGreaterThan(0);
    expect(detail.stars.currentMonth.position.length).toBeGreaterThan(0);
    expect(detail.stars.currentDay.position.length).toBeGreaterThan(0);
    expect(detail.stars.currentDay.gate.length).toBeGreaterThan(0);
    expect(detail.breakdown.natalRelationScore + detail.breakdown.monthRelationScore + detail.breakdown.qiMenLuckScore).toBe(
      detail.scoreDelta,
    );
    expect(detail.referenceMode).toBe("exact");
  });

  it("stays deterministic for the same input", () => {
    const params = {
      birthDate: new Date(Date.UTC(1995, 9, 21)),
      birthTime: "14:30",
      calendarType: "solar" as const,
      date: new Date("2026-03-10T09:00:00+09:00"),
    };

    const first = buildKuseongDetail(params);
    const second = buildKuseongDetail(params);

    expect(first).toEqual(second);
  });

  it("changes focus categories when the day star context changes", () => {
    const focusSet = new Set(
      [10, 11, 12, 13, 14, 15, 16].map((day) =>
        buildKuseongDetail({
          birthDate: new Date(Date.UTC(1995, 9, 21)),
          birthTime: "14:30",
          calendarType: "solar",
          date: new Date(`2026-03-${String(day).padStart(2, "0")}T09:00:00+09:00`),
        }).focusCategories.join("|"),
      ),
    );

    expect(focusSet.size).toBeGreaterThan(1);
  });

  it("keeps a single natal star label when unknown candidates resolve to the same star", () => {
    const detail = buildKuseongDetail({
      birthDate: new Date(Date.UTC(1995, 9, 21)),
      birthTime: "14:30",
      calendarType: "unknown",
      date: new Date("2026-03-10T09:00:00+09:00"),
    });

    expect(detail.referenceMode).toBe("solar-lunar-blend");
    expect(detail.natalYearStar).not.toContain(" / ");
    expect(detail.summary).toContain("양력·음력 후보를 함께 본 구성 참고 기준");
  });

  it("blends differing natal star candidates for unknown calendar input", () => {
    const detail = buildKuseongDetail({
      birthDate: new Date(Date.UTC(1994, 0, 25)),
      birthTime: "08:10",
      calendarType: "unknown",
      date: new Date("2026-03-10T09:00:00+09:00"),
    });

    expect(detail.referenceMode).toBe("solar-lunar-blend");
    expect(detail.natalYearStar).toContain(" / ");
    expect(detail.summary).toContain("양력·음력 후보를 함께 본 구성 참고 기준");
    expect(detail.scoreDelta).toBeGreaterThanOrEqual(-5);
    expect(detail.scoreDelta).toBeLessThanOrEqual(5);
  });
});
