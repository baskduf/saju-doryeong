import { describe, expect, it } from "vitest";
import {
  buildUnknownReferenceProfileData,
  generateDailyFortune,
} from "../../lib/fortune";

describe("unknown calendar fortunes", () => {
  it("builds blended reference profile data", () => {
    const reference = buildUnknownReferenceProfileData({
      birthDate: new Date(Date.UTC(1995, 9, 21)),
      birthTime: "14:30",
      date: new Date("2026-03-10T00:30:00+09:00"),
    });

    expect(reference).not.toBeNull();
    expect(reference?.referenceMode).toBe("solar-lunar-blend");
    expect(reference?.uncertaintyMessage).toContain("참고");
  });

  it("keeps unknown calendar fortunes as blended references", () => {
    const fortune = generateDailyFortune({
      userId: "unknown-user",
      birthDate: new Date(Date.UTC(1995, 9, 21)),
      birthTime: "14:30",
      calendarType: "unknown",
      sajuData: {},
      date: new Date("2026-03-09T15:30:00Z"),
    });

    expect(fortune.analysis.certainty).toBe("calendar-unknown");
    expect(fortune.analysis.referenceMode).toBe("solar-lunar-blend");
    expect(fortune.manse).toBeNull();
    expect(fortune.analysis.uncertaintyMessage).toContain("양력");
    expect(fortune.analysis.patternName).toBe("양·음력 공통 흐름");
    expect(fortune.analysis.patternRevealLabel).toBe("양·음력 공통 참고");
    expect(fortune.featuredInsight.title.length).toBeGreaterThan(0);
  });

  it("selects the same featured insight for the same user and date", () => {
    const params = {
      userId: "stable-user",
      birthDate: new Date(Date.UTC(1988, 3, 12)),
      birthTime: "06:45",
      calendarType: "unknown" as const,
      sajuData: {},
      date: new Date("2026-03-10T09:00:00+09:00"),
    };

    const first = generateDailyFortune(params);
    const second = generateDailyFortune(params);

    expect(first.featuredInsight.key).toBe(second.featuredInsight.key);
    expect(first.featuredInsight.title).toBe(second.featuredInsight.title);
  });
});
