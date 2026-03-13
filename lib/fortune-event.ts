import type { FortuneEvidence, FortuneFact } from "./fortune-facts";
import type {
  DailyFortune,
  FortuneEventOutlook,
  FortuneEventOutlookIntensity,
  FortuneEventOutlookKind,
  FortuneSignal,
  FortuneSignalKey,
} from "./fortune";

type EventConfidenceMode = FortuneEventOutlook["confidenceMode"];

export type FortuneEventSubtype =
  | "branch-clash"
  | "directive-pressure"
  | "friction-overload"
  | "incoming-contact"
  | "relationship-realignment"
  | "expense-pressure"
  | "deal-opportunity"
  | "settlement-movement"
  | null;

export type EventOutlookInput = {
  certainty: DailyFortune["analysis"]["certainty"];
  referenceMode: DailyFortune["analysis"]["referenceMode"];
  caution: string;
  directiveDelta: number;
  directiveSummary: string;
  relationStrengthSummary: string;
  todayRelation: DailyFortune["analysis"]["todayRelation"];
  todayBranchImpact: number;
  todayBranchSummary: string;
  signals: FortuneSignal[];
  evidence: FortuneEvidence;
};

export type ResolvedEventOutlookScenario = FortuneEventOutlook & {
  subtype: FortuneEventSubtype;
  basisFactIds: string[];
};

type EventScores = {
  frictionScore: number;
  momentumScore: number;
  timingScore: number;
  workScore: number;
  moneyScore: number;
  relationshipScore: number;
  recoveryScore: number;
  driveScore: number;
};

type EventSignalMap = Partial<Record<FortuneSignalKey, FortuneSignal>>;

type EventContext = EventOutlookInput &
  EventScores & {
    confidenceMode: EventConfidenceMode;
    signalMap: EventSignalMap;
    facts: FortuneFact[];
  };

function orderedUniqueStrings(items: Array<string | undefined | null>): string[] {
  const seen = new Set<string>();
  const values: string[] = [];

  for (const item of items) {
    const value = item?.trim();
    if (!value || seen.has(value)) {
      continue;
    }
    seen.add(value);
    values.push(value);
  }

  return values;
}

function orderedSignalKeys(items: Array<FortuneSignalKey | undefined | null>): FortuneSignalKey[] {
  const seen = new Set<FortuneSignalKey>();
  const keys: FortuneSignalKey[] = [];

  for (const item of items) {
    if (!item || seen.has(item)) {
      continue;
    }
    seen.add(item);
    keys.push(item);
  }

  return keys;
}

function signalMap(signals: FortuneSignal[]): EventSignalMap {
  return Object.fromEntries(signals.map((signal) => [signal.key, signal])) as EventSignalMap;
}

function confidenceMode(input: EventOutlookInput): EventConfidenceMode {
  return input.certainty === "calendar-unknown" || input.referenceMode === "solar-lunar-blend"
    ? "reference"
    : "exact";
}

function referenceLeadPrefix(mode: EventConfidenceMode): string {
  return mode === "reference" ? "공통 흐름으로 보면 " : "";
}

function eventReason(parts: Array<string | undefined | null>, fallback: string): string {
  const values = orderedUniqueStrings(parts);
  return values.length > 0 ? values.join(" ") : fallback;
}

function eventFactsBySubtype(context: EventContext, subtypes: string[]): FortuneFact[] {
  return context.facts.filter((fact) => subtypes.includes(fact.subtype));
}

function eventFactsByDomain(context: EventContext, domain: FortuneSignalKey): FortuneFact[] {
  return context.facts.filter((fact) => fact.domains.includes(domain));
}

function strongestFact(facts: FortuneFact[]): FortuneFact | null {
  if (facts.length === 0) {
    return null;
  }

  return [...facts].sort((left, right) => right.strength - left.strength)[0] ?? null;
}

function basisFactIds(facts: FortuneFact[]): string[] {
  return facts.slice(0, 3).map((fact) => fact.id);
}

function factSummaries(facts: FortuneFact[]): string[] {
  return facts.map((fact) => fact.summary);
}

function genericEventLead(params: {
  confidenceMode: EventConfidenceMode;
  kind: FortuneEventOutlookKind;
  intensity: FortuneEventOutlookIntensity;
}): string {
  const prefix = referenceLeadPrefix(params.confidenceMode);

  if (params.kind === "conflict") {
    if (params.intensity === "major") return `${prefix}오늘은 작은 마찰도 사건처럼 커질 수 있소.`;
    if (params.intensity === "notable") return `${prefix}오늘은 예상 밖 변수 하나가 흐름을 흔들 수 있소.`;
    return `${prefix}사소한 어긋남도 가볍게 넘기지 말아야 할 날이오.`;
  }

  if (params.kind === "contact") {
    if (params.intensity === "major") return `${prefix}오늘은 사람 쪽으로 서는 일이 바깥에서 붙을 수 있소.`;
    if (params.intensity === "notable") return `${prefix}기다리던 연락이나 관계 변화가 들어올 기미가 있소.`;
    return `${prefix}사람 사이 흐름이 평소보다 더 잘 열릴 수 있소.`;
  }

  if (params.kind === "money-shift") {
    if (params.intensity === "major") return `${prefix}오늘은 돈이나 계약 문제의 움직임이 커질 수 있소.`;
    if (params.intensity === "notable") return `${prefix}재물 흐름이 말보다 실제 일로 붙기 쉬운 날이오.`;
    return `${prefix}돈 문제에서 작은 방향 전환이 생기기 쉬운 날이오.`;
  }

  if (params.kind === "breakthrough") {
    if (params.intensity === "major") return `${prefix}오늘은 막혀 있던 일이 크게 움직일 수 있소.`;
    if (params.intensity === "notable") return `${prefix}막혀 있던 일이 다시 속도를 붙일 수 있소.`;
    return `${prefix}가볍게 밀던 일이 뜻밖의 반응을 받을 수 있소.`;
  }

  if (params.kind === "movement") {
    if (params.intensity === "major") return `${prefix}오늘은 한 판의 흐름이 크게 움직일 수 있소.`;
    if (params.intensity === "notable") return `${prefix}조용히 보이던 일도 실제 변화로 이어질 기미가 있소.`;
    return `${prefix}작은 변화가 쌓여 방향이 바뀌기 쉬운 날이오.`;
  }

  if (params.kind === "recovery") {
    if (params.intensity === "major") return `${prefix}오늘은 몸과 리듬 관리가 하루 흐름을 가를 수 있소.`;
    if (params.intensity === "notable") return `${prefix}오늘은 흐트러진 리듬을 바로잡는 일이 크게 작용하오.`;
    return `${prefix}정비와 리듬 조절이 흐름을 지키는 날이오.`;
  }

  if (params.intensity === "major") return `${prefix}오늘은 확장보다 방향 전환이 먼저 보이는 날이오.`;
  if (params.intensity === "notable") return `${prefix}오늘은 속도보다 중심을 다시 고르는 날이오.`;
  return `${prefix}오늘은 확장보다 작은 방향 전환을 보는 편이 낫소.`;
}

function genericEventReason(input: EventContext, kind: FortuneEventOutlookKind, facts: FortuneFact[]): string {
  const timing = input.signalMap.timing;
  const relationship = input.signalMap.relationship;
  const money = input.signalMap.money;
  const momentum = input.signalMap.momentum;
  const work = input.signalMap.work;
  const recovery = input.signalMap.recovery;

  if (kind === "conflict") {
    return eventReason(
      [
        ...factSummaries(facts),
        input.todayBranchImpact < 0 ? input.todayBranchSummary : undefined,
        input.directiveDelta < 0 ? input.directiveSummary : undefined,
        input.signalMap.friction?.summary,
        input.caution,
      ],
      input.caution,
    );
  }

  if (kind === "contact") {
    return eventReason(
      [
        ...factSummaries(facts),
        relationship?.summary,
        timing?.summary,
        input.relationStrengthSummary,
      ],
      input.relationStrengthSummary,
    );
  }

  if (kind === "money-shift") {
    return eventReason(
      [
        ...factSummaries(facts),
        money?.summary,
        input.directiveSummary,
        timing?.summary,
      ],
      input.directiveSummary,
    );
  }

  if (kind === "breakthrough" || kind === "movement") {
    return eventReason(
      [
        ...factSummaries(facts),
        momentum?.summary,
        work?.summary,
        timing?.summary,
        input.directiveSummary,
      ],
      input.directiveSummary,
    );
  }

  if (kind === "recovery") {
    return eventReason(
      [
        ...factSummaries(facts),
        recovery?.summary,
        input.relationStrengthSummary,
        input.caution,
      ],
      input.relationStrengthSummary,
    );
  }

  return eventReason(
    [
      ...factSummaries(facts),
      input.relationStrengthSummary,
      input.directiveSummary,
      timing?.summary,
    ],
    input.directiveSummary,
  );
}

function buildConflictScenario(input: EventContext): ResolvedEventOutlookScenario | null {
  const branchClashFacts = eventFactsBySubtype(input, ["branch-clash", "natal-branch-clash"]);
  const negativeDirectiveFacts = eventFactsBySubtype(input, ["directive-negative"]);
  if (branchClashFacts.length === 0 && negativeDirectiveFacts.length === 0) {
    return null;
  }

  const movementBias =
    branchClashFacts.length > 0 &&
    negativeDirectiveFacts.length === 0 &&
    input.directiveDelta >= 2 &&
    input.timingScore >= 68 &&
    input.momentumScore >= 68 &&
    input.frictionScore < 78;
  if (movementBias) {
    return null;
  }

  const prefix = referenceLeadPrefix(input.confidenceMode);
  const conflictFacts = branchClashFacts.length > 0 ? branchClashFacts : negativeDirectiveFacts;
  const strongest = strongestFact(conflictFacts);
  let subtype: FortuneEventSubtype;
  let intensity: FortuneEventOutlookIntensity;
  let lead: string;
  let basisSignals: FortuneSignalKey[];

  if (branchClashFacts.length > 0) {
    subtype = "branch-clash";
    intensity = (strongest?.strength ?? 0) >= 5 || input.frictionScore >= 82 ? "major" : "notable";
    lead =
      intensity === "major"
        ? `${prefix}오늘은 부딪히는 자리 하나가 하루 흐름을 크게 흔들 수 있소.`
        : `${prefix}오늘은 방향이 맞지 않는 부딪힘이 먼저 드러날 수 있소.`;
    basisSignals = orderedSignalKeys(["friction", "timing"]);
  } else {
    subtype = input.frictionScore >= 82 ? "friction-overload" : "directive-pressure";
    intensity = (strongest?.strength ?? 0) >= 5 || input.frictionScore >= 78 ? "major" : "notable";
    lead =
      subtype === "friction-overload"
        ? `${prefix}오늘은 밀어붙인 일의 마찰이 한꺼번에 드러날 수 있소.`
        : intensity === "major"
          ? `${prefix}오늘은 해야 할 일의 압박이 크게 몰릴 수 있소.`
          : `${prefix}오늘은 보이지 않던 압박이 먼저 표면으로 올라올 수 있소.`;
    basisSignals = orderedSignalKeys(["friction", "momentum"]);
  }

  return {
    kind: "conflict",
    subtype,
    intensity,
    confidenceMode: input.confidenceMode,
    lead,
    reason: genericEventReason(input, "conflict", conflictFacts),
    basisSignals,
    basisFactIds: basisFactIds(conflictFacts),
  };
}

function buildContactScenario(input: EventContext): ResolvedEventOutlookScenario | null {
  if (input.relationshipScore < 72) {
    return null;
  }

  const harmonyFacts = eventFactsBySubtype(input, ["branch-harmony", "natal-branch-harmony"]);
  const relationSupportFacts = eventFactsBySubtype(input, ["relation-support"]);
  const timingFacts = eventFactsBySubtype(input, ["timing-early", "timing-mid", "timing-late"]);
  const qualifyingFacts = [...harmonyFacts, ...relationSupportFacts, ...timingFacts];

  if (qualifyingFacts.length === 0) {
    return null;
  }

  const prefix = referenceLeadPrefix(input.confidenceMode);
  const incomingReady =
    input.relationshipScore >= 80 &&
    input.timingScore >= 64 &&
    input.frictionScore < 58 &&
    input.directiveDelta >= 0 &&
    (harmonyFacts.length > 0 || (relationSupportFacts.length > 0 && timingFacts.length > 0));
  const scenarioFacts = incomingReady
    ? [...harmonyFacts, ...relationSupportFacts, ...timingFacts]
    : [...harmonyFacts, ...relationSupportFacts];
  const intensity: FortuneEventOutlookIntensity =
    incomingReady
      ? input.relationshipScore >= 86 && input.timingScore >= 72
        ? "major"
        : "notable"
      : input.relationshipScore >= 84 && (harmonyFacts.length > 0 || input.timingScore >= 64)
        ? "major"
        : input.relationshipScore >= 76 || harmonyFacts.length > 0
          ? "notable"
          : "subtle";

  return {
    kind: "contact",
    subtype: incomingReady ? "incoming-contact" : "relationship-realignment",
    intensity,
    confidenceMode: input.confidenceMode,
    lead: incomingReady
      ? intensity === "major"
        ? `${prefix}오늘은 기다리던 연락이나 제안이 실제로 들어올 수 있소.`
        : `${prefix}오늘은 연락 하나가 흐름을 바꿔 놓을 기미가 있소.`
      : intensity === "major"
        ? `${prefix}오늘은 관계의 거리와 방향이 크게 다시 맞춰질 수 있소.`
        : intensity === "notable"
          ? `${prefix}오늘은 관계의 방향을 다시 정리하게 될 수 있소.`
          : `${prefix}오늘은 사람 사이 거리 조정이 먼저 보이는 날이오.`,
    reason: genericEventReason(input, "contact", scenarioFacts),
    basisSignals: orderedSignalKeys(["relationship", input.timingScore >= 60 ? "timing" : "momentum"]),
    basisFactIds: basisFactIds(scenarioFacts),
  };
}

function buildMoneyScenario(input: EventContext): ResolvedEventOutlookScenario | null {
  if (input.moneyScore < 74) {
    return null;
  }

  const moneyFacts = eventFactsByDomain(input, "money");
  const timingFacts = eventFactsBySubtype(input, ["timing-early", "timing-mid", "timing-late"]);
  const pressureFacts = moneyFacts.filter((fact) => fact.polarity === "risk");
  const opportunityFacts = moneyFacts.filter((fact) => fact.polarity === "opportunity");
  const settlementFacts = moneyFacts.filter((fact) => fact.polarity === "mixed");

  if (pressureFacts.length === 0 && opportunityFacts.length === 0 && settlementFacts.length === 0) {
    return null;
  }

  const prefix = referenceLeadPrefix(input.confidenceMode);
  if (pressureFacts.length > 0 && (input.directiveDelta <= 0 || input.frictionScore >= 58)) {
    const intensity: FortuneEventOutlookIntensity =
      input.frictionScore >= 72 || input.directiveDelta <= -4 ? "major" : input.moneyScore >= 78 ? "notable" : "subtle";
    return {
      kind: "money-shift",
      subtype: "expense-pressure",
      intensity,
      confidenceMode: input.confidenceMode,
      lead:
        intensity === "major"
          ? `${prefix}오늘은 지출이나 금전 판단 하나가 흐름을 크게 흔들 수 있소.`
          : intensity === "notable"
            ? `${prefix}오늘은 돈 문제에서 기회보다 막아야 할 조건이 먼저 보이오.`
            : `${prefix}오늘은 재물보다 지출 관리가 먼저 눈에 드는 날이오.`,
      reason: genericEventReason(input, "money-shift", pressureFacts),
      basisSignals: orderedSignalKeys(["money", input.frictionScore >= 60 ? "friction" : "momentum"]),
      basisFactIds: basisFactIds(pressureFacts),
    };
  }

  if (
    opportunityFacts.length > 0 &&
    input.directiveDelta >= 0 &&
    input.frictionScore < 55 &&
    (input.driveScore >= 64 || input.timingScore >= 64)
  ) {
    const intensity: FortuneEventOutlookIntensity =
      input.moneyScore >= 88 && (input.timingScore >= 68 || input.driveScore >= 72) ? "major" : "notable";
    return {
      kind: "money-shift",
      subtype: "deal-opportunity",
      intensity,
      confidenceMode: input.confidenceMode,
      lead:
        intensity === "major"
          ? `${prefix}오늘은 거래나 계약의 기회가 실제 움직임으로 붙을 수 있소.`
          : `${prefix}오늘은 재물 흐름이 말보다 실제 일로 이어질 수 있소.`,
      reason: genericEventReason(input, "money-shift", opportunityFacts),
      basisSignals: orderedSignalKeys(["money", input.driveScore >= input.timingScore ? "momentum" : "timing"]),
      basisFactIds: basisFactIds(opportunityFacts),
    };
  }

  if (timingFacts.length > 0 || settlementFacts.length > 0 || opportunityFacts.length > 0) {
    const scenarioFacts = settlementFacts.length > 0 ? settlementFacts : [...opportunityFacts, ...timingFacts];
    const intensity: FortuneEventOutlookIntensity =
      input.moneyScore >= 86 && input.timingScore >= 66 ? "major" : input.moneyScore >= 78 || input.timingScore >= 60 ? "notable" : "subtle";
    return {
      kind: "money-shift",
      subtype: "settlement-movement",
      intensity,
      confidenceMode: input.confidenceMode,
      lead:
        intensity === "major"
          ? `${prefix}오늘은 정산이나 계약의 흐름이 한 번 더 맞춰질 수 있소.`
          : intensity === "notable"
            ? `${prefix}오늘은 돈의 순서와 기준이 다시 정리될 수 있소.`
            : `${prefix}오늘은 재물 흐름에서 작은 정산 움직임이 보일 수 있소.`,
      reason: genericEventReason(input, "money-shift", scenarioFacts),
      basisSignals: orderedSignalKeys(["money", input.timingScore >= 60 ? "timing" : "momentum"]),
      basisFactIds: basisFactIds(scenarioFacts),
    };
  }

  return null;
}

function buildGenericScenario(input: EventContext): ResolvedEventOutlookScenario {
  const recoveryFacts = eventFactsBySubtype(input, ["recovery-need", "recovery-window"]);
  const movementFacts = [
    ...eventFactsBySubtype(input, ["branch-clash"]),
    ...eventFactsBySubtype(input, ["directive-positive", "relation-output", "timing-early", "timing-mid", "timing-late"]),
  ];
  const rebalancingFacts = [
    ...eventFactsBySubtype(input, ["branch-pressure", "directive-neutral"]),
    ...eventFactsBySubtype(input, ["relation-duty", "relation-recovery"]),
  ];

  let kind: FortuneEventOutlookKind = "rebalancing";
  let intensity: FortuneEventOutlookIntensity = "subtle";
  let basisSignals: FortuneSignalKey[] = ["momentum"];
  let facts: FortuneFact[] = rebalancingFacts;

  if (
    input.driveScore >= 80 &&
    input.frictionScore < 60 &&
    input.directiveDelta >= 3 &&
    input.timingScore >= 64
  ) {
    kind = "breakthrough";
    intensity = input.driveScore >= 88 ? "major" : "notable";
    basisSignals = orderedSignalKeys([
      input.workScore >= input.momentumScore ? "work" : "momentum",
      "timing",
    ]);
    facts = movementFacts;
  } else if (
    recoveryFacts.length > 0 &&
    (input.recoveryScore >= 78 ||
      (input.recoveryScore >= 72 && input.driveScore < 64 && input.signalMap.recovery?.tone === "recover"))
  ) {
    kind = "recovery";
    intensity = input.recoveryScore >= 86 ? "major" : "notable";
    basisSignals = orderedSignalKeys(["recovery", input.frictionScore >= 55 ? "friction" : "timing"]);
    facts = recoveryFacts;
  } else if (
    input.driveScore >= 66 ||
    (input.directiveDelta >= 2 && input.timingScore >= 64) ||
    (eventFactsBySubtype(input, ["branch-clash"]).length > 0 &&
      input.directiveDelta >= 2 &&
      input.timingScore >= 68)
  ) {
    kind = "movement";
    intensity = input.driveScore >= 74 || input.timingScore >= 68 ? "notable" : "subtle";
    basisSignals = orderedSignalKeys([
      input.workScore >= input.momentumScore ? "work" : "momentum",
      input.timingScore >= 60 ? "timing" : undefined,
    ]);
    facts = movementFacts;
  } else {
    basisSignals = orderedSignalKeys([
      input.momentumScore >= input.recoveryScore ? "momentum" : undefined,
      input.recoveryScore > input.momentumScore ? "recovery" : undefined,
      input.timingScore >= 60 ? "timing" : undefined,
    ]);
  }

  return {
    kind,
    subtype: null,
    intensity,
    confidenceMode: input.confidenceMode,
    lead: genericEventLead({
      confidenceMode: input.confidenceMode,
      kind,
      intensity,
    }),
    reason: genericEventReason(input, kind, facts),
    basisSignals: basisSignals.length > 0 ? basisSignals : ["momentum"],
    basisFactIds: basisFactIds(facts),
  };
}

function eventContext(input: EventOutlookInput): EventContext {
  const map = signalMap(input.signals);

  return {
    ...input,
    confidenceMode: confidenceMode(input),
    signalMap: map,
    facts: input.evidence.facts,
    frictionScore: map.friction?.score ?? 0,
    momentumScore: map.momentum?.score ?? 0,
    timingScore: map.timing?.score ?? 0,
    workScore: map.work?.score ?? 0,
    moneyScore: map.money?.score ?? 0,
    relationshipScore: map.relationship?.score ?? 0,
    recoveryScore: map.recovery?.score ?? 0,
    driveScore: Math.max(map.momentum?.score ?? 0, map.work?.score ?? 0),
  };
}

export function resolveEventOutlookScenario(input: EventOutlookInput): ResolvedEventOutlookScenario {
  const context = eventContext(input);

  return (
    buildConflictScenario(context) ??
    buildContactScenario(context) ??
    buildMoneyScenario(context) ??
    buildGenericScenario(context)
  );
}

export function buildEventOutlook(input: EventOutlookInput): FortuneEventOutlook {
  const scenario = resolveEventOutlookScenario(input);

  return {
    kind: scenario.kind,
    intensity: scenario.intensity,
    confidenceMode: scenario.confidenceMode,
    lead: scenario.lead,
    reason: scenario.reason,
    basisSignals: scenario.basisSignals,
  };
}
