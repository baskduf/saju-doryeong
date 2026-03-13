import type { ElementKey, FiveElements } from "./saju";

export type WeaknessSeverity = "none" | "moderate" | "severe";
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
