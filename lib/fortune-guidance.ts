import type { ElementKey, FiveElements } from "./saju";

export type WeaknessSeverity = "none" | "moderate" | "severe";
export type TimingWindowPhase = "early" | "mid" | "late";
export type FrictionDriver = "branch-clash" | "directive-pressure" | "money-check" | "reply-delay";
export type WarningBucket =
  | "overload"
  | "weakness"
  | "recovery"
  | "relationship"
  | "money"
  | "timing";

export type WarningItem = {
  bucket: WarningBucket;
  text: string;
};

function hashSeed(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) || 1;
}

export function selectDeterministicVariant<T>(
  seedParts: Array<string | number | boolean | null | undefined>,
  variants: T[],
): T {
  if (variants.length === 0) {
    throw new Error("variants must not be empty");
  }

  const seed = seedParts
    .filter((part): part is string | number | boolean => part !== null && part !== undefined)
    .map((part) => String(part))
    .join("|");
  const index = hashSeed(seed || "default") % variants.length;
  return variants[index];
}

export function calculateElementSpread(elements: FiveElements): number {
  return (
    Math.max(elements.wood, elements.fire, elements.earth, elements.metal, elements.water) -
    Math.min(elements.wood, elements.fire, elements.earth, elements.metal, elements.water)
  );
}

export function analyzeWeakness(elements: FiveElements): {
  weakest: ElementKey;
  weakestValue: number;
  spread: number;
  severity: WeaknessSeverity;
} {
  const entries = Object.entries(elements) as Array<[ElementKey, number]>;
  entries.sort((left, right) => left[1] - right[1]);

  const weakest = entries[0]?.[0] ?? "earth";
  const weakestValue = entries[0]?.[1] ?? 0;
  const spread = calculateElementSpread(elements);
  const severity: WeaknessSeverity =
    weakestValue > 18 || spread < 26 ? "none" : weakestValue <= 14 || spread >= 34 ? "severe" : "moderate";

  return {
    weakest,
    weakestValue,
    spread,
    severity,
  };
}

export function dedupeWarningItems(items: Array<WarningItem | null | undefined>): string[] {
  const seenBuckets = new Set<WarningBucket>();
  const seenTexts = new Set<string>();
  const results: string[] = [];

  for (const item of items) {
    const text = item?.text?.trim();
    if (!item || !text || seenBuckets.has(item.bucket) || seenTexts.has(text)) {
      continue;
    }

    seenBuckets.add(item.bucket);
    seenTexts.add(text);
    results.push(text);
  }

  return results;
}

export function buildWeaknessWarning(elements: FiveElements): WarningItem | null {
  const weakness = analyzeWeakness(elements);
  if (weakness.severity === "none") {
    return null;
  }

  let text: string;
  if (weakness.weakest === "wood") {
    text =
      weakness.severity === "severe"
        ? "목 기운이 크게 말라 계획만 쌓고 손이 멈추는 흐름을 경계하시오."
        : "목 기운이 약하니 계획만 늘리고 실행을 미루지 마시오.";
  } else if (weakness.weakest === "fire") {
    text =
      weakness.severity === "severe"
        ? "화 기운이 크게 약하니 흥으로 밀다 금세 지치는 번아웃을 경계하시오."
        : "화 기운이 약하니 흥으로 밀어붙이기보다 호흡을 고르게 나누시오.";
  } else if (weakness.weakest === "earth") {
    text =
      weakness.severity === "severe"
        ? "토 기운이 크게 비었으니 일정과 책임을 한꺼번에 떠안는 흐름을 끊어야 하오."
        : "토 기운이 약하니 일정과 책임을 한 번에 얹지 말고 무게를 나누시오.";
  } else if (weakness.weakest === "metal") {
    text =
      weakness.severity === "severe"
        ? "금 기운이 크게 약하니 정답 집착과 예민한 판단으로 스스로를 몰아세우지 마시오."
        : "금 기운이 약하니 정답만 고집하며 예민하게 몰아붙이지 마시오.";
  } else {
    text =
      weakness.severity === "severe"
        ? "수 기운이 크게 말라 집중과 체력이 함께 꺼질 수 있으니 회복 간격을 먼저 남기시오."
        : "수 기운이 약하니 집중력과 체력이 마르기 전에 쉬는 간격을 먼저 남기시오.";
  }

  return {
    bucket: "weakness",
    text,
  };
}

export function describeTimingWindow(timing: string): {
  phase: TimingWindowPhase;
  directLabel: string;
  abstractTitle: string;
  abstractSummary: string;
  abstractAction: string;
  abstractCaution: string;
} {
  const normalized = timing.trim();

  if (/(오전|새벽|초반)/.test(normalized)) {
    return {
      phase: "early",
      directLabel: normalized || "초반",
      abstractTitle: "처음 붙는 흐름을 제때 잡는 편이 좋소.",
      abstractSummary: "초반에 판이 붙기 쉬우니 첫 순서를 너무 늦추지 않는 편이 좋소.",
      abstractAction: "처음 붙는 일부터 먼저 꺼내고 뒤 일정은 가볍게 비워 두시오.",
      abstractCaution: "첫 반응이 지나간 뒤 급히 만회하려 들지 마시오.",
    };
  }

  if (/(저녁|해질|늦은)/.test(normalized)) {
    return {
      phase: "late",
      directLabel: normalized || "후반",
      abstractTitle: "뒤로 갈수록 살아나는 흐름을 기다릴 줄 알아야 하오.",
      abstractSummary: "후반에 반응이 커지기 쉬우니 초반 성과가 약하다고 판을 급히 바꾸지 마시오.",
      abstractAction: "뒤로 갈수록 붙는 흐름에 맞춰 중요한 말은 후반으로 남겨 두시오.",
      abstractCaution: "초반이 잠잠하다고 성급히 결론을 확정하지 마시오.",
    };
  }

  return {
    phase: "mid",
    directLabel: normalized || "중반",
    abstractTitle: "판이 붙는 구간을 읽는 편이 좋소.",
    abstractSummary: "한가운데서 반응이 붙기 쉬우니 앞머리보다 살아나는 구간을 기다리는 편이 좋소.",
    abstractAction: "판이 붙는 구간에 핵심 답과 연락을 두고 앞머리는 가볍게 열어 두시오.",
    abstractCaution: "초반에 답이 없다고 조급히 결론을 내리지 마시오.",
  };
}

export function isStrongTimingSignal(params: {
  topSignalKey?: string;
  timingScore: number;
  eventBasisSignals: string[];
  eventIntensity: "major" | "notable" | "subtle";
}): boolean {
  return (
    params.topSignalKey === "timing" ||
    params.timingScore >= 72 ||
    (params.eventIntensity !== "subtle" && params.eventBasisSignals.includes("timing"))
  );
}

export function buildTimingNarrative(params: {
  timing: string;
  strongTiming: boolean;
  positive: boolean;
  referenceLead?: string;
  eventKind?: string;
}): {
  title: string;
  summary: string;
  action: string;
  caution: string;
  reason: string;
} {
  const window = describeTimingWindow(params.timing);
  const seed = [params.timing, params.strongTiming, params.positive, params.eventKind];
  const referenceLead = params.referenceLead ?? "";

  if (params.strongTiming) {
    const title = selectDeterministicVariant(seed, [
      `${window.directLabel} 흐름을 먼저 쓰는 편이 좋소.`,
      `${window.directLabel} 무렵 반응을 잡는 편이 유리하오.`,
      `${window.directLabel} 쪽 판을 놓치지 않는 편이 좋소.`,
    ]);
    const summary = params.positive
      ? selectDeterministicVariant(seed, [
          `${referenceLead}${window.directLabel} 무렵에 판이 붙기 쉬우니 중요한 일은 그 구간으로 모으시오.`,
          `${referenceLead}${window.directLabel} 쪽에서 반응이 살아날 수 있으니 핵심 답은 그때 꺼내는 편이 좋소.`,
        ])
      : selectDeterministicVariant(seed, [
          `${referenceLead}${window.directLabel} 전후로 흐름을 다시 고르는 편이 낫소. 서두른 만회는 오히려 판을 흩뜨리오.`,
          `${referenceLead}${window.directLabel} 무렵을 놓치면 뒤늦은 만회가 거칠어질 수 있으니 급히 따라붙지 마시오.`,
        ]);
    const action = selectDeterministicVariant(seed, [
      `${window.directLabel}에 중요한 연락과 결정을 먼저 두시오.`,
      `${window.directLabel} 무렵 핵심 답과 제안을 꺼내시오.`,
    ]);
    const caution = params.positive
      ? selectDeterministicVariant(seed, [
          `${window.directLabel}이 지나간 뒤 급히 판을 키우지 마시오.`,
          `${window.directLabel}을 놓친 뒤 조급히 만회하려 들지 마시오.`,
        ])
      : selectDeterministicVariant(seed, [
          `${window.directLabel} 전에 답을 서둘러 꺼내지 마시오.`,
          `${window.directLabel}을 기다리지 못하고 조급히 밀어붙이지 마시오.`,
        ]);

    return {
      title,
      summary,
      action,
      caution,
      reason: `${window.directLabel} 쪽에서 반응이 또렷해질 수 있소.`,
    };
  }

  return {
    title: window.abstractTitle,
    summary: `${referenceLead}${window.abstractSummary}`,
    action: window.abstractAction,
    caution: window.abstractCaution,
    reason:
      window.phase === "early"
        ? "처음 붙는 순서를 고르는 쪽이 흐름을 살리기 쉽소."
        : window.phase === "late"
          ? "뒤로 갈수록 반응이 붙는 흐름을 기다리는 편이 낫소."
          : "판이 붙는 구간을 무리하게 앞당기지 않는 편이 좋소.",
  };
}

export function resolveFrictionDriver(params: {
  todayBranchImpact: number;
  directiveDelta: number;
  todayRelation: string;
  moneyScore: number;
}): FrictionDriver {
  if (params.todayBranchImpact <= -4) {
    return "branch-clash";
  }
  if (params.todayRelation === "재성" && (params.directiveDelta <= -2 || params.moneyScore >= 60)) {
    return "money-check";
  }
  if (params.directiveDelta <= -4 || params.todayRelation === "관성") {
    return "directive-pressure";
  }
  return "reply-delay";
}

export function buildFrictionNarrative(params: {
  driver: FrictionDriver;
  score: number;
  referenceLead?: string;
  todayBranchSummary: string;
  directiveSummary: string;
  caution: string;
  moneySummary?: string;
  eventKind?: string;
}): {
  title: string;
  summary: string;
  action: string;
  caution: string;
} {
  const intense = params.score >= 70;
  const referenceLead = params.referenceLead ?? "";
  const conflictContext = params.eventKind === "conflict";
  const seed = [params.driver, params.score, params.eventKind];

  if (params.driver === "branch-clash") {
    return {
      title: intense
        ? "사람과 일정이 맞부딪히면 작은 마찰도 크게 번질 수 있소."
        : "부딪히는 자리를 건드리면 흐름이 거칠어지기 쉬운 날이오.",
      summary: `${referenceLead}${params.todayBranchSummary}`,
      action: selectDeterministicVariant(seed, [
        "사람 문제와 일정 문제는 따로 끊어 처리하시오.",
        "감정 반응과 실무 답변은 한 자리에 섞지 마시오.",
      ]),
      caution: conflictContext
        ? selectDeterministicVariant(seed, [
            "부딪힌 자리를 더 키우지 말고 사람 문제와 일정 문제를 갈라 다루시오.",
            "맞부딪히는 장면을 길게 끌지 말고 말과 일정을 따로 정리하시오.",
          ])
        : selectDeterministicVariant(seed, [
            "사람 문제와 일정 문제를 한 번에 밀어붙이지 마시오.",
            "감정 반응이 올라온 자리에서 약속과 답을 같이 정하지 마시오.",
          ]),
    };
  }

  if (params.driver === "directive-pressure") {
    return {
      title: intense
        ? "해야 할 범위가 부풀면 압박이 먼저 판을 흔들 수 있소."
        : "안쪽 압박이 커지면 작은 일도 버거워지기 쉬운 날이오.",
      summary: `${referenceLead}${params.directiveSummary}`,
      action: selectDeterministicVariant(seed, [
        "받을 일과 미룰 일을 갈라 범위를 먼저 줄이시오.",
        "감당할 선을 먼저 정하고 나머지는 뒤로 미루시오.",
      ]),
      caution: conflictContext
        ? selectDeterministicVariant(seed, [
            "압박이 올라온다고 범위 밖 책임까지 끌어안지 마시오.",
            "해야 할 일의 압박을 이유로 즉답과 과수락을 겹치지 마시오.",
          ])
        : selectDeterministicVariant(seed, [
            "감당할 선을 넘는 약속과 책임을 한 번에 끌어안지 마시오.",
            "범위가 넘친 상태에서 답을 서둘러 확정하지 마시오.",
          ]),
    };
  }

  if (params.driver === "money-check") {
    return {
      title: intense
        ? "돈 문제는 속도보다 조건 확인이 먼저인 날이오."
        : "재물 판단은 기세보다 계산을 앞세우는 편이 낫소.",
      summary: `${referenceLead}${params.moneySummary ?? params.caution}`,
      action: selectDeterministicVariant(seed, [
        "지출과 계약은 바로 누르지 말고 남는 조건부터 따지시오.",
        "돈이 움직일수록 결제보다 조건과 회수선을 먼저 보시오.",
      ]),
      caution: conflictContext
        ? selectDeterministicVariant(seed, [
            "돈 문제를 충돌 수습용으로 급히 확정하지 마시오.",
            "마찰을 덮으려 결제나 조건을 성급히 눌러 버리지 마시오.",
          ])
        : selectDeterministicVariant(seed, [
            "이익이 보여도 결제와 계약을 급히 확정하지 마시오.",
            "지출로 흐름을 만회하려 들지 말고 조건부터 다시 보시오.",
          ]),
    };
  }

  return {
    title: intense
      ? "빠른 답 하나가 흐름을 거칠게 만들기 쉬운 날이오."
      : "조급한 반응이 판을 흐트러뜨리기 쉬운 날이오.",
    summary: `${referenceLead}${params.caution}`,
    action: selectDeterministicVariant(seed, [
      "즉답보다 한 템포 늦춘 확인과 정리를 먼저 두시오.",
      "답을 바로 내기보다 앞뒤를 다시 살핀 뒤 움직이시오.",
    ]),
    caution: conflictContext
      ? selectDeterministicVariant(seed, [
          "이미 흔들린 판에서 반응 속도로 승부를 보지 마시오.",
          "마찰이 오른 자리에서는 빠른 답보다 정리된 답을 택하시오.",
        ])
      : selectDeterministicVariant(seed, [
          "반응이 앞서 답을 서둘러 내지 마시오.",
          "즉답으로 흐름을 만회하려 들지 마시오.",
        ]),
  };
}

export function toneFromCategoryScore(
  key: "work" | "money" | "relationship" | "recovery",
  score: number,
): "push" | "steady" | "caution" | "recover" {
  if (key === "recovery") {
    if (score >= 72) return "recover";
    return score >= 58 ? "steady" : "caution";
  }

  if (score >= 78) return "push";
  if (score >= 58) return "steady";
  return "caution";
}

export function buildRecommendedActionList(params: {
  topSignals: Array<{ key: string; action: string }>;
  signals: Array<{ key: string; action: string }>;
  eventKind: string;
  healthScore: number;
}): string[] {
  const allowRecovery =
    params.topSignals[0]?.key === "recovery" || params.eventKind === "recovery" || params.healthScore < 55;
  const seenKeys = new Set<string>();
  const actions: string[] = [];

  for (const signal of [...params.topSignals, ...params.signals]) {
    if (seenKeys.has(signal.key)) {
      continue;
    }
    seenKeys.add(signal.key);

    if (signal.key === "recovery" && !allowRecovery) {
      continue;
    }

    const action = signal.action.trim();
    if (!action || actions.includes(action)) {
      continue;
    }

    actions.push(action);
    if (actions.length === 3) {
      break;
    }
  }

  return actions;
}
