import { describe, expect, it } from "vitest";
import { generateDailyFortune } from "../../lib/fortune";

function buildFortune(calendarType: "solar" | "unknown") {
  return generateDailyFortune({
    userId: `event-${calendarType}`,
    birthDate: new Date(Date.UTC(1995, 9, 21)),
    birthTime: "14:30",
    calendarType,
    sajuData: {},
    date: new Date("2026-03-10T09:00:00+09:00"),
  });
}

describe("fortune event outlook", () => {
  it("attaches exact event outlook to exact fortunes", () => {
    const fortune = buildFortune("solar");

    expect(fortune.analysis.eventOutlook.confidenceMode).toBe("exact");
    expect(fortune.analysis.eventOutlook.basisSignals.length).toBeGreaterThan(0);
    expect(fortune.headline).toContain(fortune.analysis.eventOutlook.lead);
    expect(fortune.summary).toContain(fortune.analysis.eventOutlook.reason);
    expect(fortune.detail).toContain(fortune.analysis.eventOutlook.lead);
    expect(
      fortune.analysis.eventOutlook.basisSignals.every((key) =>
        fortune.analysis.signals.some((signal) => signal.key === key),
      ),
    ).toBe(true);
  });

  it("keeps unknown calendar fortunes in reference mode", () => {
    const fortune = buildFortune("unknown");

    expect(fortune.analysis.certainty).toBe("calendar-unknown");
    expect(fortune.analysis.eventOutlook.confidenceMode).toBe("reference");
    expect(fortune.analysis.eventOutlook.lead.startsWith("공통 흐름으로 보면 ")).toBe(true);
    expect(fortune.headline).toContain(fortune.analysis.eventOutlook.lead);
    expect(fortune.summary).toContain(fortune.analysis.eventOutlook.reason);
  });
});
