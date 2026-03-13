import { describe, expect, it } from "vitest";
import {
  analyzeWeakness,
  buildRecommendedActionList,
  buildWeaknessWarning,
  toneFromCategoryScore,
} from "../../lib/fortune-guidance";

describe("fortune guidance helpers", () => {
  it("treats balanced charts with low spread as having no weakness warning", () => {
    const weakness = analyzeWeakness({
      wood: 21,
      fire: 22,
      earth: 23,
      metal: 24,
      water: 25,
    });

    expect(weakness.severity).toBe("none");
    expect(buildWeaknessWarning({
      wood: 21,
      fire: 22,
      earth: 23,
      metal: 24,
      water: 25,
    })).toBeNull();
  });

  it("classifies moderate weakness when the weakest element is low and spread is wide enough", () => {
    const weakness = analyzeWeakness({
      wood: 18,
      fire: 44,
      earth: 30,
      metal: 26,
      water: 22,
    });

    expect(weakness.weakest).toBe("wood");
    expect(weakness.spread).toBe(26);
    expect(weakness.severity).toBe("moderate");
    expect(buildWeaknessWarning({
      wood: 18,
      fire: 44,
      earth: 30,
      metal: 26,
      water: 22,
    })?.text).toContain("계획만 늘리고 실행");
  });

  it("uses element-specific severe warnings when weakness is strong", () => {
    const elements = {
      wood: 38,
      fire: 30,
      earth: 27,
      metal: 26,
      water: 12,
    };
    const warning = buildWeaknessWarning(elements);

    expect(analyzeWeakness(elements).severity).toBe("severe");
    expect(warning?.text).toContain("집중과 체력");
    expect(warning?.text).toContain("회복 간격");
  });

  it("raises the recovery threshold so mid-60 to low-70 scores stay steady", () => {
    expect(toneFromCategoryScore("recovery", 65)).toBe("steady");
    expect(toneFromCategoryScore("recovery", 71)).toBe("steady");
    expect(toneFromCategoryScore("recovery", 72)).toBe("recover");
  });

  it("skips recovery actions when recovery is not the foreground outcome", () => {
    const actions = buildRecommendedActionList({
      topSignals: [
        { key: "momentum", action: "중요한 일부터 밀어 보시오." },
        { key: "recovery", action: "무리한 일정부터 덜어내고 쉬시오." },
      ],
      signals: [
        { key: "momentum", action: "중요한 일부터 밀어 보시오." },
        { key: "timing", action: "오전에 중요한 연락부터 두시오." },
        { key: "recovery", action: "무리한 일정부터 덜어내고 쉬시오." },
        { key: "work", action: "일의 순서를 먼저 정리하시오." },
      ],
      eventKind: "movement",
      healthScore: 62,
    });

    expect(actions).not.toContain("무리한 일정부터 덜어내고 쉬시오.");
    expect(actions).toEqual([
      "중요한 일부터 밀어 보시오.",
      "오전에 중요한 연락부터 두시오.",
      "일의 순서를 먼저 정리하시오.",
    ]);
  });

  it("keeps recovery actions when recovery is genuinely foregrounded", () => {
    const actions = buildRecommendedActionList({
      topSignals: [
        { key: "momentum", action: "중요한 일부터 밀어 보시오." },
        { key: "recovery", action: "무리한 일정부터 덜어내고 쉬시오." },
      ],
      signals: [
        { key: "momentum", action: "중요한 일부터 밀어 보시오." },
        { key: "recovery", action: "무리한 일정부터 덜어내고 쉬시오." },
        { key: "timing", action: "오전에 중요한 연락부터 두시오." },
      ],
      eventKind: "recovery",
      healthScore: 62,
    });

    expect(actions).toContain("무리한 일정부터 덜어내고 쉬시오.");
  });
});
