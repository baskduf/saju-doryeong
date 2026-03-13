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
};

export type ResolvedEventOutlookScenario = FortuneEventOutlook & {
  subtype: FortuneEventSubtype;
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
    if (params.intensity === "major") return `${prefix}오늘은 사람 일로 하루 판이 바뀔 수 있소.`;
    if (params.intensity === "notable") return `${prefix}기다리던 연락이나 관계 변화가 들어올 기미가 있소.`;
    return `${prefix}사람 사이 흐름이 평소보다 더 크게 남을 수 있소.`;
  }

  if (params.kind === "money-shift") {
    if (params.intensity === "major") return `${prefix}오늘은 돈이나 계약 문제의 움직임이 커질 수 있소.`;
    if (params.intensity === "notable") return `${prefix}재물 흐름이 말보다 실제 일로 붙기 쉬운 날이오.`;
    return `${prefix}돈 문제에서 작은 방향 전환이 생기기 쉬운 날이오.`;
  }

  if (params.kind === "breakthrough") {
    if (params.intensity === "major") return `${prefix}오늘은 멈춰 있던 일이 크게 움직일 수 있소.`;
    if (params.intensity === "notable") return `${prefix}밀어 두던 일이 다시 속도를 얻을 수 있소.`;
    return `${prefix}작게 밀던 일이 뜻밖에 힘을 받을 수 있소.`;
  }

  if (params.kind === "movement") {
    if (params.intensity === "major") return `${prefix}오늘은 한 번 판이 꺾이며 흐름이 바뀔 수 있소.`;
    if (params.intensity === "notable") return `${prefix}조용히 지나가기보다 한 번 흐름이 움직일 기미가 있소.`;
    return `${prefix}작은 변화가 쌓여 방향이 정해지기 쉬운 날이오.`;
  }

  if (params.kind === "recovery") {
    if (params.intensity === "major") return `${prefix}오늘은 몸과 리듬 관리가 하루 판세를 가를 수 있소.`;
    if (params.intensity === "notable") return `${prefix}오늘은 흐트러진 리듬을 바로잡는 일이 생각보다 크게 작용하오.`;
    return `${prefix}정비와 리듬 재정렬이 흐름을 지키는 날이오.`;
  }

  if (params.intensity === "major") return `${prefix}오늘은 큰 파문보다 큰 방향 전환이 먼저 보이는 날이오.`;
  if (params.intensity === "notable") return `${prefix}오늘은 한쪽으로 밀기보다 판을 다시 고르는 날이오.`;
  return `${prefix}큰 파문보다 작은 방향 전환이 쌓이는 날이오.`;
}

function genericEventReason(input: EventContext, kind: FortuneEventOutlookKind): string {
  const friction = input.signalMap.friction;
  const timing = input.signalMap.timing;
  const relationship = input.signalMap.relationship;
  const money = input.signalMap.money;
  const momentum = input.signalMap.momentum;
  const work = input.signalMap.work;
  const recovery = input.signalMap.recovery;

  if (kind === "conflict") {
    return eventReason(
      [
        input.todayBranchImpact < 0 ? input.todayBranchSummary : undefined,
        input.directiveDelta < 0 ? input.directiveSummary : undefined,
        friction?.summary,
        input.caution,
      ],
      input.caution,
    );
  }

  if (kind === "contact") {
    return eventReason(
      [
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
        "흐트러진 리듬을 다시 고르게 맞추는 쪽이 오늘 기세를 지키기 쉽소.",
        recovery?.summary,
        input.relationStrengthSummary,
        input.caution,
      ],
      input.relationStrengthSummary,
    );
  }

  return eventReason(
    [
      input.relationStrengthSummary,
      input.directiveSummary,
      timing?.summary,
    ],
    input.directiveSummary,
  );
}

function buildConflictScenario(input: EventContext): ResolvedEventOutlookScenario | null {
  if (input.frictionScore < 72 && input.todayBranchImpact > -4 && input.directiveDelta > -6) {
    return null;
  }

  const prefix = referenceLeadPrefix(input.confidenceMode);
  const friction = input.signalMap.friction;
  let subtype: FortuneEventSubtype = "friction-overload";
  let intensity: FortuneEventOutlookIntensity = "notable";
  let lead = `${prefix}오늘은 일이 겹치며 작은 무리수도 곧바로 부담으로 돌아올 수 있소.`;
  let reason = eventReason(
    [
      "작은 과속이 겹치면 부담이 한꺼번에 마찰로 드러나기 쉬운 흐름이오.",
      friction?.summary,
      input.directiveDelta < 0 ? input.directiveSummary : undefined,
      input.caution,
    ],
    input.caution,
  );
  let basisSignals = orderedSignalKeys([
    "friction",
    input.frictionScore >= 80 || input.directiveDelta < 0 ? "momentum" : undefined,
  ]);

  if (input.todayBranchImpact <= -5 || (input.todayBranchImpact <= -4 && input.frictionScore >= 70)) {
    subtype = "branch-clash";
    intensity = input.todayBranchImpact <= -6 || input.frictionScore >= 82 ? "major" : "notable";
    lead =
      intensity === "major"
        ? `${prefix}오늘은 부딪히는 자리 하나가 하루 흐름을 크게 흔들 수 있소.`
        : `${prefix}오늘은 바깥 변수와 맞부딪히는 장면이 먼저 드러날 수 있소.`;
    reason = eventReason(
      [
        "일진 쪽 부딪힘이 직접 변수로 들어오기 쉬운 흐름이오.",
        input.todayBranchSummary,
        friction?.summary,
        input.caution,
      ],
      input.todayBranchSummary,
    );
    basisSignals = orderedSignalKeys(["friction", "timing"]);
  } else if (input.directiveDelta <= -6 && input.frictionScore < 78) {
    subtype = "directive-pressure";
    intensity = input.directiveDelta <= -8 || input.frictionScore >= 70 ? "major" : "notable";
    lead =
      intensity === "major"
        ? `${prefix}오늘은 해야 할 일의 압박이 커져 흐름이 급히 조여올 수 있소.`
        : `${prefix}오늘은 안쪽 압박이 먼저 올라와 판단을 흔들 수 있소.`;
    reason = eventReason(
      [
        "오늘은 바깥 충돌보다 해야 할 일의 압박이 먼저 커지기 쉬운 흐름이오.",
        input.directiveSummary,
        friction?.summary,
        input.caution,
      ],
      input.directiveSummary,
    );
    basisSignals = orderedSignalKeys(["friction", "momentum"]);
  } else if (input.frictionScore >= 84) {
    intensity = "major";
  }

  return {
    kind: "conflict",
    subtype,
    intensity,
    confidenceMode: input.confidenceMode,
    lead,
    reason,
    basisSignals: basisSignals.length > 0 ? basisSignals : ["friction"],
  };
}

function buildContactScenario(input: EventContext): ResolvedEventOutlookScenario | null {
  if (input.relationshipScore < 72 || (input.timingScore < 58 && input.directiveDelta < 0 && input.frictionScore < 52)) {
    return null;
  }

  const prefix = referenceLeadPrefix(input.confidenceMode);
  const relationship = input.signalMap.relationship;
  const timing = input.signalMap.timing;

  if (
    input.relationshipScore >= 80 &&
    input.timingScore >= 64 &&
    input.frictionScore < 58 &&
    input.directiveDelta >= 0
  ) {
    const intensity: FortuneEventOutlookIntensity =
      input.relationshipScore >= 86 && input.timingScore >= 72 ? "major" : "notable";
    return {
      kind: "contact",
      subtype: "incoming-contact",
      intensity,
      confidenceMode: input.confidenceMode,
      lead:
        intensity === "major"
          ? `${prefix}오늘은 기다리던 연락이나 제안이 실제 판을 움직일 수 있소.`
          : `${prefix}오늘은 연락 하나가 흐름을 바꾸는 실마리가 될 수 있소.`,
      reason: eventReason(
        [
          "사람 기운과 타이밍 신호가 함께 올라와 먼저 들어오는 연락을 받기 쉬운 흐름이오.",
          relationship?.summary,
          timing?.summary,
          input.relationStrengthSummary,
        ],
        input.relationStrengthSummary,
      ),
      basisSignals: orderedSignalKeys(["relationship", "timing"]),
    };
  }

  const intensity: FortuneEventOutlookIntensity =
    input.relationshipScore >= 84 && (input.timingScore >= 64 || input.frictionScore >= 58)
      ? "major"
      : input.relationshipScore >= 76 || input.frictionScore >= 55
        ? "notable"
        : "subtle";

  return {
    kind: "contact",
    subtype: "relationship-realignment",
    intensity,
    confidenceMode: input.confidenceMode,
    lead:
      intensity === "major"
        ? `${prefix}오늘은 사람 사이 거리와 결이 크게 다시 맞춰질 수 있소.`
        : intensity === "notable"
          ? `${prefix}오늘은 관계의 방향이 다시 정리될 수 있소.`
          : `${prefix}오늘은 사람 일에서 미묘한 거리 조정이 먼저 보이오.`,
    reason: eventReason(
      [
        "새 인연을 넓히기보다 기존 관계의 거리와 말투를 다시 맞출 기운이 먼저 드러나오.",
        input.relationStrengthSummary,
        relationship?.summary,
        input.frictionScore >= 55 ? input.signalMap.friction?.summary : undefined,
      ],
      input.relationStrengthSummary,
    ),
    basisSignals: orderedSignalKeys([
      "relationship",
      input.frictionScore >= 55 ? "friction" : input.timingScore >= 58 ? "timing" : "momentum",
    ]),
  };
}

function buildMoneyScenario(input: EventContext): ResolvedEventOutlookScenario | null {
  if (
    input.moneyScore < 74 ||
    (input.todayRelation !== "재성" && input.driveScore < 60 && input.timingScore < 60)
  ) {
    return null;
  }

  const prefix = referenceLeadPrefix(input.confidenceMode);
  const money = input.signalMap.money;
  const timing = input.signalMap.timing;

  if (input.directiveDelta <= -3 || input.frictionScore >= 60) {
    const intensity: FortuneEventOutlookIntensity =
      input.frictionScore >= 72 || input.directiveDelta <= -6 ? "major" : input.moneyScore >= 78 ? "notable" : "subtle";
    return {
      kind: "money-shift",
      subtype: "expense-pressure",
      intensity,
      confidenceMode: input.confidenceMode,
      lead:
        intensity === "major"
          ? `${prefix}오늘은 지출이나 금전 판단 하나가 흐름을 먼저 흔들 수 있소.`
          : intensity === "notable"
            ? `${prefix}오늘은 돈 문제에서 새 기회보다 새는 구멍을 먼저 막아야 하오.`
            : `${prefix}오늘은 재물보다 지출 관리가 먼저 눈에 띄는 날이오.`,
      reason: eventReason(
        [
          "재물 흐름이 보여도 새로 벌리기보다 새는 결부터 막아야 손실을 줄이오.",
          money?.summary,
          input.directiveSummary,
          input.caution,
        ],
        input.directiveSummary,
      ),
      basisSignals: orderedSignalKeys(["money", input.frictionScore >= 60 ? "friction" : "momentum"]),
    };
  }

  if (
    input.moneyScore >= 82 &&
    (input.todayRelation === "재성" || input.driveScore >= 68) &&
    input.timingScore >= 60 &&
    input.frictionScore < 55 &&
    input.directiveDelta >= 0
  ) {
    const intensity: FortuneEventOutlookIntensity =
      input.moneyScore >= 88 && (input.timingScore >= 68 || input.driveScore >= 75) ? "major" : "notable";
    return {
      kind: "money-shift",
      subtype: "deal-opportunity",
      intensity,
      confidenceMode: input.confidenceMode,
      lead:
        intensity === "major"
          ? `${prefix}오늘은 돈이나 계약의 기회가 실익으로 붙을 수 있소.`
          : `${prefix}오늘은 재물 흐름이 말보다 실제 움직임으로 이어질 수 있소.`,
      reason: eventReason(
        [
          "재성 쪽 흐름과 추진 기세가 맞물리면 거래나 계약의 실익이 붙기 쉬운 흐름이오.",
          money?.summary,
          timing?.summary,
          input.directiveSummary,
        ],
        input.directiveSummary,
      ),
      basisSignals: orderedSignalKeys(["money", input.driveScore >= input.timingScore ? "momentum" : "timing"]),
    };
  }

  const intensity: FortuneEventOutlookIntensity =
    input.moneyScore >= 86 && input.timingScore >= 66 && input.driveScore >= 64
      ? "major"
      : input.moneyScore >= 78 || input.timingScore >= 64
        ? "notable"
        : "subtle";

  return {
    kind: "money-shift",
    subtype: "settlement-movement",
    intensity,
    confidenceMode: input.confidenceMode,
    lead:
      intensity === "major"
        ? `${prefix}오늘은 밀린 정산이나 계약 흐름이 한 번 크게 재배치될 수 있소.`
        : intensity === "notable"
          ? `${prefix}오늘은 돈의 자리와 순서가 다시 맞춰질 수 있소.`
          : `${prefix}오늘은 재물 흐름에서 작은 정산 움직임이 먼저 보이오.`,
    reason: eventReason(
      [
        "들어오고 나가는 돈의 순서가 다시 맞물리며 정산과 조율이 먼저 움직이기 쉬운 흐름이오.",
        money?.summary,
        timing?.summary,
        input.directiveSummary,
      ],
      input.directiveSummary,
    ),
    basisSignals: orderedSignalKeys(["money", input.timingScore >= 60 ? "timing" : "momentum"]),
  };
}

function buildGenericScenario(input: EventContext): ResolvedEventOutlookScenario {
  let kind: FortuneEventOutlookKind = "rebalancing";
  let intensity: FortuneEventOutlookIntensity = "subtle";
  let basisSignals: FortuneSignalKey[] = ["momentum"];

  if (
    input.driveScore >= 78 &&
    input.frictionScore < 55 &&
    (input.timingScore >= 60 || input.directiveDelta >= 4)
  ) {
    kind = "breakthrough";
    intensity = input.driveScore >= 86 ? "major" : "notable";
    basisSignals = orderedSignalKeys([
      input.workScore >= input.momentumScore ? "work" : "momentum",
      input.timingScore >= 60 ? "timing" : undefined,
    ]);
  } else if (
    input.recoveryScore >= 78 ||
    (input.recoveryScore >= 72 &&
      input.driveScore < 62 &&
      input.frictionScore < 58 &&
      input.signalMap.recovery?.tone === "recover")
  ) {
    kind = "recovery";
    intensity = input.recoveryScore >= 86 ? "major" : "notable";
    basisSignals = orderedSignalKeys(["recovery", input.frictionScore >= 55 ? "friction" : undefined]);
  } else if (input.driveScore >= 64 || input.timingScore >= 60) {
    kind = "movement";
    intensity = input.driveScore >= 72 || input.timingScore >= 68 ? "notable" : "subtle";
    basisSignals = orderedSignalKeys([
      input.workScore >= input.momentumScore ? "work" : "momentum",
      input.timingScore >= 60 ? "timing" : undefined,
    ]);
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
    reason: genericEventReason(input, kind),
    basisSignals: basisSignals.length > 0 ? basisSignals : ["momentum"],
  };
}

function eventContext(input: EventOutlookInput): EventContext {
  const map = signalMap(input.signals);

  return {
    ...input,
    confidenceMode: confidenceMode(input),
    signalMap: map,
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
