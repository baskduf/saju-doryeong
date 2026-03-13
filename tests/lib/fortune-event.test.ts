import { describe, expect, it } from "vitest";
import type { FortuneEvidence, FortuneFact } from "../../lib/fortune-facts";
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

function makeFact(overrides: Partial<FortuneFact> & Pick<FortuneFact, "id" | "source" | "kind" | "subtype" | "summary">): FortuneFact {
  return {
    id: overrides.id,
    source: overrides.source,
    kind: overrides.kind,
    subtype: overrides.subtype,
    domains: overrides.domains ?? ["timing"],
    polarity: overrides.polarity ?? "mixed",
    strength: overrides.strength ?? 3,
    risk: overrides.risk ?? 0,
    opportunity: overrides.opportunity ?? 0,
    summary: overrides.summary,
    rawRefs: overrides.rawRefs ?? {},
  };
}

function makeEvidence(facts: FortuneFact[] = []): FortuneEvidence {
  return {
    facts,
    signalContributions: [],
  };
}

function buildScenarioInput(overrides: Partial<EventOutlookInput> = {}): EventOutlookInput {
  const defaultSignals: FortuneSignal[] = [
    makeSignal("momentum", 62, "추진 흐름은 무난하오.", "steady"),
    makeSignal("friction", 40, "마찰은 아직 크지 않소.", "steady"),
    makeSignal("timing", 60, "때를 맞추면 반응을 받기 좋소.", "push"),
    makeSignal("work", 58, "일은 순서를 세우면 무난하오.", "steady"),
    makeSignal("money", 60, "재물 흐름은 기준을 잡는 편이 좋소.", "steady"),
    makeSignal("relationship", 62, "관계는 말을 고르면 무난하오.", "steady"),
    makeSignal("recovery", 50, "회복은 무리하지 않으면 지킬 만하오.", "recover"),
  ];

  return {
    certainty: "exact",
    referenceMode: "none",
    caution: "무리한 결정은 한 박자 늦추시오.",
    directiveDelta: 1,
    directiveSummary: "오늘은 균형을 맞추는 쪽이 흐름상 유리하오.",
    relationStrengthSummary: "원국과 일진의 흐름은 차분히 결을 맞추는 편이 좋소.",
    todayRelation: "식상",
    todayBranchImpact: 1,
    todayBranchSummary: "오늘 지지 작용은 직접 부딪힘보다 순서 조정 쪽에 가깝소.",
    signals: defaultSignals,
    evidence: makeEvidence(),
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
  it("classifies branch clash as conflict when negative pressure dominates", () => {
    const base = buildScenarioInput({
      directiveDelta: -4,
      todayBranchImpact: -6,
      todayBranchSummary: "금일 지지가 크게 부딪혀 하루 흐름을 흔들 수 있소.",
      evidence: makeEvidence([
        makeFact({
          id: "branch-clash-1",
          source: "today-branch",
          kind: "branch-interaction",
          subtype: "branch-clash",
          domains: ["friction", "momentum", "timing"],
          polarity: "mixed",
          strength: 5,
          risk: 5,
          opportunity: 2,
          summary: "일지 충이 직접적인 마찰 신호로 떠오르오.",
        }),
        makeFact({
          id: "directive-negative-1",
          source: "directive",
          kind: "directive",
          subtype: "directive-negative",
          domains: ["friction", "money"],
          polarity: "risk",
          strength: 4,
          risk: 4,
          summary: "해야 할 일의 압박이 앞서 흐름이 거칠어지오.",
        }),
      ]),
      signals: replaceSignals(buildScenarioInput(), [
        makeSignal("friction", 82, "마찰 신호가 크게 올라오오.", "caution"),
        makeSignal("timing", 68, "타이밍은 빠르게 움직일수록 흔들리기 쉬우오.", "push"),
      ]),
    });

    const scenario = resolveEventOutlookScenario(base);

    expect(scenario.kind).toBe("conflict");
    expect(scenario.subtype).toBe("branch-clash");
    expect(scenario.intensity).toBe("major");
    expect(scenario.basisSignals).toEqual(["friction", "timing"]);
    expect(scenario.basisFactIds).toContain("branch-clash-1");
  });

  it("allows branch clash to resolve as movement when momentum and timing are stronger", () => {
    const base = buildScenarioInput({
      directiveDelta: 4,
      evidence: makeEvidence([
        makeFact({
          id: "branch-clash-1",
          source: "today-branch",
          kind: "branch-interaction",
          subtype: "branch-clash",
          domains: ["friction", "momentum", "timing"],
          polarity: "mixed",
          strength: 4,
          risk: 3,
          opportunity: 4,
          summary: "충이 변화를 만들 여지도 함께 품고 있소.",
        }),
        makeFact({
          id: "directive-positive-1",
          source: "directive",
          kind: "directive",
          subtype: "directive-positive",
          domains: ["momentum", "timing", "work"],
          polarity: "opportunity",
          strength: 4,
          opportunity: 4,
          summary: "용신 쪽 기세가 붙어 움직임을 열어 주오.",
        }),
        makeFact({
          id: "timing-mid-1",
          source: "timing",
          kind: "timing",
          subtype: "timing-mid",
          domains: ["timing", "momentum"],
          polarity: "opportunity",
          strength: 3,
          opportunity: 3,
          summary: "반응이 붙는 구간을 잡기 좋은 때이오.",
        }),
      ]),
      signals: replaceSignals(buildScenarioInput(), [
        makeSignal("momentum", 78, "추진 흐름이 실제 변화로 이어질 기미가 있소.", "push"),
        makeSignal("friction", 63, "마찰은 있으나 감당 가능한 편이오.", "steady"),
        makeSignal("timing", 74, "타이밍을 맞추면 변화가 붙기 쉽소.", "push"),
      ]),
    });

    const scenario = resolveEventOutlookScenario(base);

    expect(scenario.kind).toBe("movement");
    expect(scenario.subtype).toBeNull();
    expect(scenario.basisSignals).toEqual(["momentum", "timing"]);
    expect(scenario.reason).toContain("충이 변화를 만들 여지도 함께 품고 있소.");
  });

  it("classifies directive pressure conflicts from negative directive facts", () => {
    const scenario = resolveEventOutlookScenario(
      buildScenarioInput({
        directiveDelta: -7,
        evidence: makeEvidence([
          makeFact({
            id: "directive-negative-1",
            source: "directive",
            kind: "directive",
            subtype: "directive-negative",
            domains: ["friction", "money"],
            polarity: "risk",
            strength: 5,
            risk: 5,
            summary: "해야 할 일의 압박이 먼저 몰리오.",
          }),
        ]),
        signals: replaceSignals(buildScenarioInput(), [
          makeSignal("friction", 76, "마찰은 조용히 눌러 오오.", "caution"),
          makeSignal("momentum", 52, "추진은 범위를 줄이는 편이 낫소.", "caution"),
        ]),
      }),
    );

    expect(scenario.kind).toBe("conflict");
    expect(["directive-pressure", "friction-overload"]).toContain(scenario.subtype);
    expect(scenario.basisSignals).toEqual(["friction", "momentum"]);
    expect(scenario.basisFactIds).toContain("directive-negative-1");
  });

  it("classifies incoming contact only when relationship has supporting facts", () => {
    const scenario = resolveEventOutlookScenario(
      buildScenarioInput({
        directiveDelta: 3,
        evidence: makeEvidence([
          makeFact({
            id: "branch-harmony-1",
            source: "today-branch",
            kind: "branch-interaction",
            subtype: "branch-harmony",
            domains: ["relationship", "timing", "momentum"],
            polarity: "opportunity",
            strength: 4,
            opportunity: 4,
            summary: "합이 닿아 관계 흐름을 부드럽게 잇소.",
          }),
          makeFact({
            id: "timing-mid-1",
            source: "timing",
            kind: "timing",
            subtype: "timing-mid",
            domains: ["timing", "momentum"],
            polarity: "opportunity",
            strength: 3,
            opportunity: 3,
            summary: "반응이 붙는 구간을 잡기 좋은 때이오.",
          }),
        ]),
        signals: replaceSignals(buildScenarioInput(), [
          makeSignal("relationship", 84, "관계 흐름이 부드럽게 열리고 있소.", "push"),
          makeSignal("timing", 72, "연락을 붙이기 좋은 때가 보이오.", "push"),
          makeSignal("friction", 44, "마찰은 아직 크지 않소.", "steady"),
        ]),
      }),
    );

    expect(scenario.kind).toBe("contact");
    expect(scenario.subtype).toBe("incoming-contact");
    expect(scenario.basisSignals).toEqual(["relationship", "timing"]);
    expect(scenario.basisFactIds).toContain("branch-harmony-1");
  });

  it("classifies expense pressure when money has risk facts", () => {
    const scenario = resolveEventOutlookScenario(
      buildScenarioInput({
        directiveDelta: -3,
        todayRelation: "재성",
        evidence: makeEvidence([
          makeFact({
            id: "money-pressure-1",
            source: "category",
            kind: "category-trend",
            subtype: "money-pressure",
            domains: ["money"],
            polarity: "risk",
            strength: 4,
            risk: 4,
            summary: "재물 흐름보다 새는 구멍을 먼저 막아야 하오.",
          }),
        ]),
        signals: replaceSignals(buildScenarioInput(), [
          makeSignal("money", 80, "돈 흐름은 보이나 지출도 함께 따라오오.", "steady"),
          makeSignal("friction", 66, "금전 판단이 마찰로 번지기 쉬우오.", "caution"),
        ]),
      }),
    );

    expect(scenario.kind).toBe("money-shift");
    expect(scenario.subtype).toBe("expense-pressure");
    expect(scenario.basisSignals).toEqual(["money", "friction"]);
  });

  it("classifies deal opportunity when money has positive facts", () => {
    const scenario = resolveEventOutlookScenario(
      buildScenarioInput({
        directiveDelta: 3,
        todayRelation: "재성",
        evidence: makeEvidence([
          makeFact({
            id: "money-opportunity-1",
            source: "relation",
            kind: "relation",
            subtype: "relation-money",
            domains: ["money", "work", "momentum"],
            polarity: "opportunity",
            strength: 4,
            opportunity: 4,
            summary: "재성 흐름이 실속과 거래 쪽을 먼저 열어 주오.",
          }),
          makeFact({
            id: "timing-mid-1",
            source: "timing",
            kind: "timing",
            subtype: "timing-mid",
            domains: ["timing", "momentum"],
            polarity: "opportunity",
            strength: 3,
            opportunity: 3,
            summary: "반응이 붙는 구간을 잡기 좋은 때이오.",
          }),
        ]),
        signals: replaceSignals(buildScenarioInput(), [
          makeSignal("money", 88, "재물 흐름이 실제 계약 쪽으로 붙기 쉽소.", "push"),
          makeSignal("momentum", 76, "추진 흐름이 손에 잡히는 편이오.", "push"),
          makeSignal("timing", 70, "계약 타이밍을 맞추기 좋소.", "push"),
          makeSignal("friction", 42, "마찰은 아직 크지 않소.", "steady"),
        ]),
      }),
    );

    expect(scenario.kind).toBe("money-shift");
    expect(scenario.subtype).toBe("deal-opportunity");
    expect(scenario.basisSignals).toEqual(["money", "momentum"]);
  });

  it("does not promote recovery without foreground recovery facts", () => {
    const scenario = resolveEventOutlookScenario(
      buildScenarioInput({
        directiveDelta: 0,
        evidence: makeEvidence([
          makeFact({
            id: "timing-mid-1",
            source: "timing",
            kind: "timing",
            subtype: "timing-mid",
            domains: ["timing", "momentum"],
            polarity: "opportunity",
            strength: 3,
            opportunity: 3,
            summary: "반응이 붙는 구간을 잡기 좋은 때이오.",
          }),
        ]),
        signals: replaceSignals(buildScenarioInput(), [
          makeSignal("momentum", 61, "추진은 무난하되 크게 밀 판은 아니오.", "steady"),
          makeSignal("work", 59, "일은 차분히 순서를 잡는 편이 낫소.", "steady"),
          makeSignal("timing", 62, "타이밍은 무난히 열리는 편이오.", "steady"),
          makeSignal("friction", 44, "마찰은 아직 크지 않소.", "steady"),
          makeSignal("recovery", 79, "회복은 정비를 하면 충분히 지킬 수 있소.", "recover"),
        ]),
      }),
    );

    expect(scenario.kind).not.toBe("recovery");
  });

  it("keeps recovery outlook only when recovery facts are foregrounded", () => {
    const scenario = resolveEventOutlookScenario(
      buildScenarioInput({
        directiveDelta: -1,
        evidence: makeEvidence([
          makeFact({
            id: "recovery-need-1",
            source: "recovery",
            kind: "recovery",
            subtype: "recovery-need",
            domains: ["recovery", "friction"],
            polarity: "risk",
            strength: 5,
            risk: 5,
            summary: "회복과 정비를 먼저 세워야 하루 흐름이 버티오.",
          }),
        ]),
        signals: replaceSignals(buildScenarioInput(), [
          makeSignal("momentum", 56, "추진보다 정비가 먼저인 흐름이오.", "steady"),
          makeSignal("work", 55, "일은 속도보다 리듬 조정이 낫소.", "steady"),
          makeSignal("timing", 58, "때는 있으나 서둘러 여는 날은 아니오.", "steady"),
          makeSignal("friction", 52, "마찰은 아직 과하지 않소.", "steady"),
          makeSignal("recovery", 82, "회복 신호가 하루 전면으로 올라오오.", "recover"),
        ]),
      }),
    );

    expect(scenario.kind).toBe("recovery");
    expect(scenario.intensity).toBe("notable");
    expect(scenario.basisSignals).toEqual(["recovery", "timing"]);
    expect(scenario.basisFactIds).toContain("recovery-need-1");
  });
});

describe("fortune event outlook integration", () => {
  it("attaches additive evidence and exact event outlook to exact fortunes", () => {
    const fortune = buildFortune("solar");

    expect(fortune.analysis.evidence.facts.length).toBeGreaterThan(0);
    expect(fortune.analysis.evidence.signalContributions.length).toBeGreaterThan(0);
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

  it("keeps unknown calendar fortunes in reference mode with evidence attached", () => {
    const fortune = buildFortune("unknown");

    expect(fortune.analysis.certainty).toBe("calendar-unknown");
    expect(fortune.analysis.evidence.facts.length).toBeGreaterThan(0);
    expect(fortune.analysis.eventOutlook.confidenceMode).toBe("reference");
    expect(fortune.analysis.eventOutlook.lead.startsWith("공통 흐름으로 보면 ")).toBe(true);
    expect(fortune.analysis.signals.some((signal) => signal.summary.includes("공통 흐름 기준으로"))).toBe(true);
  });
});
