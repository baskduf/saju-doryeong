import { describe, expect, it } from "vitest";
import type { FortuneSignal } from "../../lib/fortune";
import { generateDailyFortune } from "../../lib/fortune";
import { resolveEventOutlookScenario, type EventOutlookInput } from "../../lib/fortune-event";

function makeSignal(
  key: FortuneSignal["key"],
  score: number,
  summary: string,
  tone: FortuneSignal["tone"] = "steady",
): FortuneSignal {
  return {
    key,
    label: key,
    score,
    tone,
    title: `${key}-title`,
    summary,
    action: `${key}-action`,
    caution: `${key}-caution`,
    reasons: [summary],
    sources: ["saju"],
  };
}

function buildScenarioInput(overrides: Partial<EventOutlookInput> = {}): EventOutlookInput {
  const defaultSignals: FortuneSignal[] = [
    makeSignal("momentum", 62, "추진 흐름은 무난하오.", "steady"),
    makeSignal("friction", 40, "마찰은 아직 크지 않소.", "steady"),
    makeSignal("timing", 60, "타이밍을 맞추면 호흡이 붙기 쉽소.", "push"),
    makeSignal("work", 58, "일은 순서를 세우면 무난하오.", "steady"),
    makeSignal("money", 60, "재물 흐름은 점검 위주가 좋소.", "steady"),
    makeSignal("relationship", 62, "관계는 톤을 고르면 무난하오.", "steady"),
    makeSignal("recovery", 50, "회복은 무리하지 않으면 지킬 수 있소.", "recover"),
  ];

  return {
    certainty: "exact",
    referenceMode: "none",
    caution: "무리수는 줄이고 한 번 더 확인하시오.",
    directiveDelta: 1,
    directiveSummary: "오늘은 속도보다 결을 맞추는 쪽이 흐름을 살리오.",
    relationStrengthSummary: "사람과 일의 흐름은 차분히 결을 맞출수록 살아나오.",
    todayRelation: "식상",
    todayBranchImpact: 1,
    todayBranchSummary: "일진 흐름은 직접 부딪힘보다 순서 조율에 가깝소.",
    signals: defaultSignals,
    ...overrides,
  };
}

function replaceSignals(
  input: EventOutlookInput,
  replacements: Array<FortuneSignal>,
): EventOutlookInput["signals"] {
  const replacementMap = new Map(replacements.map((signal) => [signal.key, signal]));
  return input.signals.map((signal) => replacementMap.get(signal.key) ?? signal);
}

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

describe("resolveEventOutlookScenario", () => {
  it("classifies branch-clash conflicts", () => {
    const base = buildScenarioInput();
    const scenario = resolveEventOutlookScenario({
      ...base,
      todayBranchImpact: -6,
      todayBranchSummary: "일진 충돌이 바깥 변수로 직접 들어오는 흐름이오.",
      signals: replaceSignals(base, [
        makeSignal("friction", 82, "마찰 신호가 크게 올라와 있소.", "caution"),
        makeSignal("timing", 68, "시간대 흐름이 변수를 빠르게 키우기 쉽소.", "push"),
      ]),
    });

    expect(scenario.kind).toBe("conflict");
    expect(scenario.subtype).toBe("branch-clash");
    expect(scenario.intensity).toBe("major");
    expect(scenario.basisSignals).toEqual(["friction", "timing"]);
    expect(scenario.lead).toContain("부딪히는 자리");
    expect(scenario.reason).toContain("일진 쪽 부딪힘");
  });

  it("classifies directive-pressure conflicts", () => {
    const base = buildScenarioInput();
    const scenario = resolveEventOutlookScenario({
      ...base,
      directiveDelta: -7,
      todayBranchImpact: -1,
      signals: replaceSignals(base, [
        makeSignal("friction", 69, "마찰이 조용히 압박으로 쌓이기 쉽소.", "caution"),
        makeSignal("momentum", 54, "추진보다 부담 조율이 먼저이오.", "caution"),
      ]),
    });

    expect(scenario.kind).toBe("conflict");
    expect(scenario.subtype).toBe("directive-pressure");
    expect(scenario.basisSignals).toEqual(["friction", "momentum"]);
    expect(scenario.lead).toContain("압박");
    expect(scenario.reason).toContain("압박");
  });

  it("classifies incoming-contact flows", () => {
    const base = buildScenarioInput();
    const scenario = resolveEventOutlookScenario({
      ...base,
      directiveDelta: 3,
      signals: replaceSignals(base, [
        makeSignal("relationship", 83, "관계 흐름이 부드럽게 열려 있소.", "push"),
        makeSignal("timing", 70, "연락을 붙이기 좋은 타이밍이 잡혀 있소.", "push"),
        makeSignal("friction", 42, "마찰은 아직 얕은 편이오.", "steady"),
      ]),
    });

    expect(scenario.kind).toBe("contact");
    expect(scenario.subtype).toBe("incoming-contact");
    expect(scenario.basisSignals).toEqual(["relationship", "timing"]);
    expect(scenario.lead).toContain("연락");
    expect(scenario.reason).toContain("먼저 들어오는 연락");
  });

  it("classifies relationship-realignment flows", () => {
    const base = buildScenarioInput();
    const scenario = resolveEventOutlookScenario({
      ...base,
      directiveDelta: -1,
      signals: replaceSignals(base, [
        makeSignal("relationship", 76, "관계 흐름은 방향 조정이 먼저 보이오.", "steady"),
        makeSignal("timing", 55, "타이밍은 서두르기보다 조율이 좋소.", "steady"),
        makeSignal("friction", 58, "말의 속도가 빨라지면 마찰이 생기기 쉽소.", "caution"),
      ]),
    });

    expect(scenario.kind).toBe("contact");
    expect(scenario.subtype).toBe("relationship-realignment");
    expect(scenario.basisSignals).toEqual(["relationship", "friction"]);
    expect(scenario.lead).toContain("관계의 방향");
    expect(scenario.reason).toContain("기존 관계의 거리");
  });

  it("classifies deal-opportunity money shifts", () => {
    const base = buildScenarioInput();
    const scenario = resolveEventOutlookScenario({
      ...base,
      directiveDelta: 3,
      todayRelation: "재성",
      signals: replaceSignals(base, [
        makeSignal("money", 88, "재물 흐름이 실제 계약 쪽으로 붙기 쉽소.", "push"),
        makeSignal("momentum", 75, "추진 기세가 실익과 맞물릴 수 있소.", "push"),
        makeSignal("work", 68, "일의 순서도 실속 쪽으로 정리되오.", "steady"),
        makeSignal("timing", 68, "계약 타이밍이 붙기 쉬운 날이오.", "push"),
        makeSignal("friction", 44, "마찰은 아직 낮은 편이오.", "steady"),
      ]),
    });

    expect(scenario.kind).toBe("money-shift");
    expect(scenario.subtype).toBe("deal-opportunity");
    expect(scenario.basisSignals).toEqual(["money", "momentum"]);
    expect(scenario.lead).toContain("계약의 기회");
    expect(scenario.reason).toContain("거래나 계약의 실익");
  });

  it("classifies expense-pressure money shifts", () => {
    const base = buildScenarioInput();
    const scenario = resolveEventOutlookScenario({
      ...base,
      directiveDelta: -4,
      todayRelation: "재성",
      signals: replaceSignals(base, [
        makeSignal("money", 78, "재물은 보이지만 지출 점검이 먼저이오.", "steady"),
        makeSignal("friction", 65, "금전 판단이 마찰로 번지기 쉽소.", "caution"),
      ]),
    });

    expect(scenario.kind).toBe("money-shift");
    expect(scenario.subtype).toBe("expense-pressure");
    expect(scenario.basisSignals).toEqual(["money", "friction"]);
    expect(scenario.lead).toContain("새는 구멍");
    expect(scenario.reason).toContain("새는 결");
  });

  it("classifies settlement-movement money shifts", () => {
    const base = buildScenarioInput();
    const scenario = resolveEventOutlookScenario({
      ...base,
      directiveDelta: 0,
      todayRelation: "재성",
      signals: replaceSignals(base, [
        makeSignal("money", 78, "돈의 흐름은 정산과 조율이 먼저 보이오.", "steady"),
        makeSignal("timing", 64, "정리와 결산을 맞추기 좋은 타이밍이오.", "steady"),
        makeSignal("friction", 45, "마찰은 아직 낮은 편이오.", "steady"),
      ]),
    });

    expect(scenario.kind).toBe("money-shift");
    expect(scenario.subtype).toBe("settlement-movement");
    expect(scenario.basisSignals).toEqual(["money", "timing"]);
    expect(scenario.lead).toContain("돈의 자리");
    expect(scenario.reason).toContain("정산과 조율");
  });

  it("does not promote mid recovery scores into recovery outlooks", () => {
    const base = buildScenarioInput();
    const scenario = resolveEventOutlookScenario({
      ...base,
      directiveDelta: 0,
      signals: replaceSignals(base, [
        makeSignal("momentum", 61, "추진은 무난하지만 크게 밀 날은 아니오.", "steady"),
        makeSignal("work", 59, "일은 차분히 순서를 세우는 편이 좋소.", "steady"),
        makeSignal("timing", 58, "타이밍은 무난한 편이오.", "steady"),
        makeSignal("friction", 44, "마찰은 아직 낮은 편이오.", "steady"),
        makeSignal("recovery", 71, "회복은 정비를 하면 충분히 지킬 수 있소.", "recover"),
      ]),
    });

    expect(scenario.kind).not.toBe("recovery");
    expect(scenario.kind).toBe("rebalancing");
  });

  it("keeps recovery outlooks only when recovery is clearly foregrounded", () => {
    const base = buildScenarioInput();
    const scenario = resolveEventOutlookScenario({
      ...base,
      directiveDelta: -1,
      signals: replaceSignals(base, [
        makeSignal("momentum", 58, "추진보다 정비가 먼저인 흐름이오.", "steady"),
        makeSignal("work", 56, "일은 속도보다 리듬 조정이 맞소.", "steady"),
        makeSignal("timing", 57, "타이밍은 서두르지 않는 편이 좋소.", "steady"),
        makeSignal("friction", 52, "마찰은 아직 과하지 않소.", "steady"),
        makeSignal("recovery", 78, "회복 흐름이 실제 중심축으로 올라오고 있소.", "recover"),
      ]),
    });

    expect(scenario.kind).toBe("recovery");
    expect(scenario.intensity).toBe("notable");
    expect(scenario.basisSignals).toEqual(["recovery"]);
    expect(scenario.lead).toContain("리듬");
    expect(scenario.reason).toContain("흐트러진 리듬");
  });
});

describe("fortune event outlook integration", () => {
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
