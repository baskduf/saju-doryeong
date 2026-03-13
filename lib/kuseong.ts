import { Lunar, Solar } from "lunar-javascript";
import { type CalendarType, type ElementKey } from "./saju";
import {
  kuseongCategoryNarrativeLabel,
  type FortuneCategoryLabelKey,
  type KuseongToneLabelKey,
} from "./kuseong-labels";
import { getSeoulDateTimeParts } from "./seoul-time";

export type KuseongRelation = "support" | "same" | "drain" | "control" | "managed";
export type KuseongReferenceMode = "exact" | "solar-lunar-blend";
export type KuseongNarrativeTone = KuseongToneLabelKey;
export type FortuneCategoryKey = FortuneCategoryLabelKey;

export type HybridSourceKey = "saju" | "kuseong";

export type HybridSourceBadge = {
  key: HybridSourceKey;
  label: string;
  scoreDelta: number;
  summary: string;
};

export type KuseongDetail = {
  natalYearStar: string;
  currentMonthStar: string;
  currentDayStar: string;
  natalRelation: KuseongRelation;
  monthRelation: KuseongRelation;
  qiMenLuckLabel: string;
  direction: string;
  action: string;
  caution: string;
  summary: string;
  scoreDelta: number;
  referenceMode: KuseongReferenceMode;
  breakdown: {
    natalRelationScore: number;
    monthRelationScore: number;
    qiMenLuckScore: number;
  };
  categoryAdjustments: Record<FortuneCategoryKey, number>;
  focusCategories: FortuneCategoryKey[];
  narrativeTone: KuseongNarrativeTone;
  stars: {
    natalYear: Array<{
      label: string;
      number: string;
      position: string;
      positionLabel: string;
    }>;
    currentMonth: {
      label: string;
      number: string;
      position: string;
      positionLabel: string;
      gate: string;
    };
    currentDay: {
      label: string;
      number: string;
      position: string;
      positionLabel: string;
      gate: string;
    };
  };
  narrative: {
    headlineAddon: string;
    summaryAddon: string;
    detailAddon: string;
    cautionAddon: string;
  };
};

type KuseongCandidate = {
  natalYearStar: string;
  natalYearNumber: string;
  natalYearPosition: string;
  natalYearPositionLabel: string;
  natalRelation: KuseongRelation;
  natalRelationScore: number;
  scoreDelta: number;
};

type SolarInstance = ReturnType<typeof Solar.fromYmdHms>;

type NineStarLike = {
  toString(): string;
  getNumber(): string;
  getWuXing(): string;
  getPosition(): string;
  getPositionDesc(): string;
  getLuckInQiMen(): string;
  getBaMenInQiMen(): string;
};

const CATEGORY_PRIORITY: FortuneCategoryKey[] = ["work", "money", "relationship", "health"];

const DAY_ELEMENT_CATEGORY_ADJUSTMENTS: Record<ElementKey, Record<FortuneCategoryKey, number>> = {
  wood: {
    work: 2,
    money: 0,
    relationship: 1,
    health: -1,
  },
  fire: {
    work: 1,
    money: -1,
    relationship: 2,
    health: -1,
  },
  earth: {
    work: 0,
    money: 1,
    relationship: 0,
    health: 2,
  },
  metal: {
    work: 1,
    money: 2,
    relationship: -1,
    health: 0,
  },
  water: {
    work: -1,
    money: 0,
    relationship: 1,
    health: 1,
  },
};

const NATAL_RELATION_CATEGORY_ADJUSTMENTS: Record<KuseongRelation, Partial<Record<FortuneCategoryKey, number>>> = {
  support: {
    work: 1,
    money: 1,
  },
  same: {
    work: 1,
    relationship: 1,
  },
  drain: {
    health: 1,
    money: -1,
  },
  control: {
    health: 1,
    work: -1,
    money: -1,
  },
  managed: {
    relationship: 1,
    health: 1,
  },
};

const GENERATES: Record<ElementKey, ElementKey> = {
  wood: "fire",
  fire: "earth",
  earth: "metal",
  metal: "water",
  water: "wood",
};

const CONTROLS: Record<ElementKey, ElementKey> = {
  wood: "earth",
  fire: "metal",
  earth: "water",
  metal: "wood",
  water: "fire",
};

const DAY_RELATION_SCORE: Record<KuseongRelation, number> = {
  support: 3,
  same: 2,
  drain: -1,
  control: -3,
  managed: 1,
};

const MONTH_RELATION_SCORE: Record<KuseongRelation, number> = {
  support: 1,
  same: 1,
  drain: 0,
  control: -1,
  managed: 0,
};

const QI_MEN_LUCK_DELTA: Record<string, number> = {
  "大吉": 2,
  "吉": 1,
  "小吉": 1,
  "凶": -1,
  "大凶": -2,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function emptyCategoryAdjustments(): Record<FortuneCategoryKey, number> {
  return {
    work: 0,
    money: 0,
    relationship: 0,
    health: 0,
  };
}

function sortCategoryKeysByScore(
  source: Record<FortuneCategoryKey, number>,
  direction: "desc" | "asc",
): FortuneCategoryKey[] {
  return [...CATEGORY_PRIORITY].sort((left, right) => {
    const diff = direction === "desc" ? source[right] - source[left] : source[left] - source[right];
    if (diff !== 0) {
      return diff;
    }
    return CATEGORY_PRIORITY.indexOf(left) - CATEGORY_PRIORITY.indexOf(right);
  });
}

function applyCategoryDelta(
  source: Record<FortuneCategoryKey, number>,
  delta: Partial<Record<FortuneCategoryKey, number>>,
): Record<FortuneCategoryKey, number> {
  const next = { ...source };

  for (const key of CATEGORY_PRIORITY) {
    next[key] += delta[key] ?? 0;
  }

  return next;
}

function addCategoryScore(
  source: Record<FortuneCategoryKey, number>,
  key: FortuneCategoryKey,
  value: number,
): Record<FortuneCategoryKey, number> {
  return {
    ...source,
    [key]: source[key] + value,
  };
}

function clampCategoryAdjustments(source: Record<FortuneCategoryKey, number>): Record<FortuneCategoryKey, number> {
  return {
    work: clamp(source.work, -3, 3),
    money: clamp(source.money, -3, 3),
    relationship: clamp(source.relationship, -3, 3),
    health: clamp(source.health, -3, 3),
  };
}

function parseBirthTimeToHourMinute(birthTime?: string): { hour: number; minute: number } {
  if (!birthTime) {
    return { hour: 12, minute: 0 };
  }

  const match = birthTime.match(/^(\d{2}):(\d{2})$/);
  if (!match) {
    return { hour: 12, minute: 0 };
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return { hour: 12, minute: 0 };
  }

  return {
    hour: clamp(hour, 0, 23),
    minute: clamp(minute, 0, 59),
  };
}

function elementFromWuXing(value: string): ElementKey {
  if (value === "木") return "wood";
  if (value === "火") return "fire";
  if (value === "土") return "earth";
  if (value === "金") return "metal";
  if (value === "水") return "water";
  return "earth";
}

function classifyRelation(current: ElementKey, target: ElementKey): KuseongRelation {
  if (current === target) return "same";
  if (GENERATES[current] === target) return "support";
  if (GENERATES[target] === current) return "drain";
  if (CONTROLS[current] === target) return "control";
  return "managed";
}

function relationFromDelta(score: number): KuseongRelation {
  if (score >= 3) return "support";
  if (score >= 2) return "same";
  if (score >= 1) return "managed";
  if (score <= -2) return "control";
  return "drain";
}

function relationLabel(relation: KuseongRelation): string {
  switch (relation) {
    case "support":
      return "상생";
    case "same":
      return "동질";
    case "drain":
      return "소모";
    case "control":
      return "압박";
    case "managed":
      return "제어";
  }
}

function resolveBirthSolarCandidates(params: {
  birthDate: Date;
  birthTime?: string;
  calendarType: CalendarType;
}): SolarInstance[] {
  const { hour, minute } = parseBirthTimeToHourMinute(params.birthTime);
  const year = params.birthDate.getUTCFullYear();
  const month = params.birthDate.getUTCMonth() + 1;
  const day = params.birthDate.getUTCDate();
  const candidates: SolarInstance[] = [];

  const pushUnique = (candidate: SolarInstance | null | undefined) => {
    if (!candidate) {
      return;
    }

    const ymdHms = candidate.toYmdHms();
    if (!candidates.some((item) => item.toYmdHms() === ymdHms)) {
      candidates.push(candidate);
    }
  };

  if (params.calendarType === "solar" || params.calendarType === "unknown") {
    pushUnique(Solar.fromYmdHms(year, month, day, hour, minute, 0));
  }

  if (params.calendarType === "lunar" || params.calendarType === "unknown") {
    try {
      pushUnique(Lunar.fromYmdHms(year, month, day, hour, minute, 0).getSolar());
    } catch {
      // Ignore invalid lunar candidate and fall back to the remaining exact candidate.
    }
  }

  if (candidates.length === 0) {
    pushUnique(Solar.fromYmdHms(year, month, day, hour, minute, 0));
  }

  return candidates;
}

function currentKstSolar(date?: Date): SolarInstance {
  const parts = getSeoulDateTimeParts(date ?? new Date());
  return Solar.fromYmdHms(parts.year, parts.month, parts.day, parts.hour, parts.minute, 0);
}

function dayBaseTopCategories(dayElement: ElementKey): [FortuneCategoryKey, FortuneCategoryKey] {
  const base = DAY_ELEMENT_CATEGORY_ADJUSTMENTS[dayElement];
  const sorted = sortCategoryKeysByScore(base, "desc");
  return [sorted[0], sorted[1]];
}

function categoryJoinText(keys: FortuneCategoryKey[]): string {
  const labels = keys.map(kuseongCategoryNarrativeLabel);
  if (labels.length <= 1) {
    return labels[0] ?? "회복";
  }
  return `${labels[0]}과 ${labels[1]}`;
}

function buildCategoryAdjustments(params: {
  dayElement: ElementKey;
  natalRelation: KuseongRelation;
  monthRelation: KuseongRelation;
  qiMenLuckLabel: string;
}): {
  categoryAdjustments: Record<FortuneCategoryKey, number>;
  focusCategories: FortuneCategoryKey[];
  weakestCategory: FortuneCategoryKey;
} {
  const [top1, top2] = dayBaseTopCategories(params.dayElement);
  let adjustments = emptyCategoryAdjustments();

  adjustments = applyCategoryDelta(adjustments, DAY_ELEMENT_CATEGORY_ADJUSTMENTS[params.dayElement]);
  adjustments = applyCategoryDelta(adjustments, NATAL_RELATION_CATEGORY_ADJUSTMENTS[params.natalRelation]);

  if (params.monthRelation === "support" || params.monthRelation === "same") {
    adjustments = addCategoryScore(adjustments, top1, 1);
  } else if (params.monthRelation === "control") {
    adjustments = addCategoryScore(adjustments, top1, -1);
  } else if (params.monthRelation === "managed") {
    adjustments = addCategoryScore(adjustments, top2, 1);
  }

  if (params.qiMenLuckLabel === "大吉") {
    adjustments = addCategoryScore(adjustments, top1, 1);
    adjustments = addCategoryScore(adjustments, top2, 1);
  } else if (params.qiMenLuckLabel === "吉") {
    adjustments = addCategoryScore(adjustments, top1, 1);
  } else if (params.qiMenLuckLabel === "小吉") {
    adjustments = addCategoryScore(adjustments, top2, 1);
  } else if (params.qiMenLuckLabel === "凶") {
    adjustments = addCategoryScore(adjustments, top1, -1);
  } else if (params.qiMenLuckLabel === "大凶") {
    adjustments = addCategoryScore(adjustments, top1, -1);
    adjustments = addCategoryScore(adjustments, top2, -1);
  }

  const clamped = clampCategoryAdjustments(adjustments);

  return {
    categoryAdjustments: clamped,
    focusCategories: sortCategoryKeysByScore(clamped, "desc").slice(0, 2),
    weakestCategory: sortCategoryKeysByScore(clamped, "asc")[0],
  };
}

function buildNarrativeTone(params: {
  scoreDelta: number;
  focusCategories: FortuneCategoryKey[];
}): KuseongNarrativeTone {
  if (params.focusCategories[0] === "health" && params.scoreDelta <= 0) {
    return "recover";
  }
  if (params.scoreDelta >= 3) return "push";
  if (params.scoreDelta >= 1) return "steady";
  if (params.scoreDelta <= -2) return "recover";
  return "cautious";
}

function buildNarrative(params: {
  focusCategories: FortuneCategoryKey[];
  weakestCategory: FortuneCategoryKey;
  direction: string;
  narrativeTone: KuseongNarrativeTone;
}): KuseongDetail["narrative"] {
  const focus1 = params.focusCategories[0] ?? "health";
  const focus1Label = kuseongCategoryNarrativeLabel(focus1);
  const focusWeakLabel = kuseongCategoryNarrativeLabel(params.weakestCategory);
  const focusSummary = categoryJoinText(params.focusCategories);

  let headlineAddon: string;
  if (params.narrativeTone === "push") {
    headlineAddon = `구성 흐름까지 받쳐 주니 ${focus1Label} 쪽은 한 걸음 먼저 내도 괜찮소.`;
  } else if (params.narrativeTone === "steady") {
    headlineAddon = `구성 흐름은 ${focus1Label} 쪽을 고르게 밀어 주는 편이오.`;
  } else if (params.narrativeTone === "cautious") {
    headlineAddon = `구성 흐름은 ${focus1Label} 쪽에서 속도보다 결을 먼저 보라 하오.`;
  } else if (focus1 === "health") {
    headlineAddon = "구성 흐름은 회복과 정비를 먼저 택하라 하오.";
  } else if (params.weakestCategory === "health") {
    headlineAddon = `구성 흐름은 ${focus1Label}을 밀기보다 회복과 정비를 먼저 보라 하오.`;
  } else {
    headlineAddon = `구성 흐름은 ${focusWeakLabel} 쪽 과속을 멈추고 약한 분야 조율을 먼저 택하라 하오.`;
  }

  return {
    headlineAddon,
    summaryAddon: `특히 ${focusSummary} 쪽 반응이 두드러지며, ${params.direction} 방향 흐름을 타는 편이 맞소.`,
    detailAddon: `본명성·월성·일성의 맞물림을 보면 ${focusSummary}에 힘이 실리고, 나머지 분야는 과속보다 조율이 낫소.`,
    cautionAddon:
      params.narrativeTone === "push"
        ? `기세가 붙어도 한 번에 판을 키우지 말고 ${focus1Label}부터 순서대로 다루시오.`
        : params.narrativeTone === "steady"
          ? `무난한 흐름이라도 ${focusWeakLabel}은 억지로 끌어올리지 마시오.`
        : params.narrativeTone === "cautious"
          ? `${focusWeakLabel} 쪽은 서두를수록 어긋나기 쉬우니 확인을 먼저 두시오.`
          : params.weakestCategory === "health"
            ? `${focusWeakLabel}과 무리한 확장은 피하고, 회복과 정리부터 앞세우시오.`
            : `${focusWeakLabel} 쪽 과속과 무리한 확장은 줄이고, 약한 분야 조율부터 앞세우시오.`,
  };
}

function buildAction(params: {
  focusCategories: FortuneCategoryKey[];
  weakestCategory: FortuneCategoryKey;
  direction: string;
  narrativeTone: KuseongNarrativeTone;
}): string {
  const focus1 = params.focusCategories[0] ?? "health";
  const focus2 = params.focusCategories[1] ?? null;
  const focus1Label = kuseongCategoryNarrativeLabel(focus1);
  const focus2Label = focus2 ? kuseongCategoryNarrativeLabel(focus2) : null;
  const focusWeakLabel = kuseongCategoryNarrativeLabel(params.weakestCategory);

  if (params.narrativeTone === "push") {
    return `${focus1Label}${focus2Label ? `과 ${focus2Label}` : ""} 쪽은 오늘 먼저 움직여도 좋소. ${params.direction} 방향 흐름을 타며 한 걸음 앞서 보시오.`;
  }

  if (params.narrativeTone === "steady") {
    return `${focus1Label} 쪽을 중심으로 흐름을 고르게 밀고, ${focus2Label ? `${focus2Label}도 함께 맞춰 가시오.` : `${params.direction} 방향 흐름을 타며 차분히 이어 가시오.`}`;
  }

  if (params.narrativeTone === "cautious") {
    return `${focus1Label} 쪽은 속도보다 결을 먼저 보며 움직이고, ${focusWeakLabel}은 서두르지 마시오.`;
  }

  if (params.weakestCategory === "health") {
    return `오늘은 ${focusWeakLabel}과 무리한 확장을 쉬고, 회복과 정비를 먼저 앞세우시오.`;
  }

  return `오늘은 ${focusWeakLabel} 쪽 과속을 멈추고, 약한 분야 조율과 정비를 먼저 앞세우시오.`;
}

function buildCaution(params: {
  weakestCategory: FortuneCategoryKey;
  narrativeTone: KuseongNarrativeTone;
  focusCategories: FortuneCategoryKey[];
}): string {
  const focus1 = params.focusCategories[0] ?? "health";
  const focus1Label = kuseongCategoryNarrativeLabel(focus1);
  const focusWeakLabel = kuseongCategoryNarrativeLabel(params.weakestCategory);

  if (params.narrativeTone === "push") {
    return `기세가 붙어도 한 번에 판을 키우지 말고 ${focus1Label}부터 순서대로 다루시오.`;
  }

  if (params.narrativeTone === "steady") {
    return `무난한 흐름이라도 ${focusWeakLabel}은 억지로 끌어올리지 마시오.`;
  }

  if (params.narrativeTone === "cautious") {
    return `${focusWeakLabel} 쪽은 서두를수록 어긋나기 쉬우니 확인을 먼저 두시오.`;
  }

  if (params.weakestCategory === "health") {
    return `${focusWeakLabel}과 무리한 확장은 피하고, 회복과 정리부터 앞세우시오.`;
  }

  return `${focusWeakLabel} 쪽 과속과 무리한 확장은 피하고, 약한 분야 조율부터 앞세우시오.`;
}

function describeRelationSummary(params: {
  natalYearStar: string;
  currentMonthStar: string;
  currentDayStar: string;
  natalRelation: KuseongRelation;
  monthRelation: KuseongRelation;
  direction: string;
  scoreDelta: number;
  referenceMode: KuseongReferenceMode;
}): string {
  const deltaLabel =
    params.scoreDelta > 0
      ? `+${params.scoreDelta}점`
      : params.scoreDelta < 0
        ? `${params.scoreDelta}점`
        : "0점";
  const referenceLead =
    params.referenceMode === "solar-lunar-blend" ? "양력·음력 후보를 함께 본 구성 참고 기준으로 " : "";

  return [
    `${referenceLead}본명성 ${params.natalYearStar}, 당월성 ${params.currentMonthStar}, 일성 ${params.currentDayStar}이오.`,
    `본명성과 일성은 ${relationLabel(params.natalRelation)} 관계이고, 당월성과 일성은 ${relationLabel(params.monthRelation)} 관계로 작용하오.`,
    `오늘은 ${params.direction} 방향 흐름이 두드러지며 구성 보정은 ${deltaLabel}로 반영했소.`,
  ].join(" ");
}

function buildCandidate(params: {
  natalSolar: SolarInstance;
  currentMonthStar: NineStarLike;
  currentDayStar: NineStarLike;
}): KuseongCandidate {
  const natalYearStar = params.natalSolar.getLunar().getYearNineStar();
  const natalElement = elementFromWuXing(natalYearStar.getWuXing());
  const monthElement = elementFromWuXing(params.currentMonthStar.getWuXing());
  const dayElement = elementFromWuXing(params.currentDayStar.getWuXing());
  const natalRelation = classifyRelation(dayElement, natalElement);
  const monthRelation = classifyRelation(monthElement, dayElement);
  const qiMenLuck = params.currentDayStar.getLuckInQiMen();
  const natalRelationScore = DAY_RELATION_SCORE[natalRelation];
  const monthRelationScore = MONTH_RELATION_SCORE[monthRelation];
  const qiMenLuckScore = QI_MEN_LUCK_DELTA[qiMenLuck] ?? 0;

  return {
    natalYearStar: natalYearStar.toString(),
    natalYearNumber: natalYearStar.getNumber(),
    natalYearPosition: natalYearStar.getPosition(),
    natalYearPositionLabel: natalYearStar.getPositionDesc(),
    natalRelation,
    natalRelationScore,
    scoreDelta: clamp(natalRelationScore + monthRelationScore + qiMenLuckScore, -5, 5),
  };
}

export function buildKuseongDetail(params: {
  birthDate: Date;
  birthTime?: string;
  calendarType?: CalendarType;
  date?: Date;
}): KuseongDetail {
  const calendarType = params.calendarType ?? "solar";
  const solarCandidates = resolveBirthSolarCandidates({
    birthDate: params.birthDate,
    birthTime: params.birthTime,
    calendarType,
  });
  const currentSolar = currentKstSolar(params.date);
  const currentLunar = currentSolar.getLunar();
  const currentMonthStar = currentLunar.getMonthNineStar();
  const currentDayStar = currentLunar.getDayNineStar();
  const currentMonthElement = elementFromWuXing(currentMonthStar.getWuXing());
  const currentDayElement = elementFromWuXing(currentDayStar.getWuXing());
  const monthRelation = classifyRelation(currentMonthElement, currentDayElement);
  const monthRelationScore = MONTH_RELATION_SCORE[monthRelation];
  const qiMenLuckLabel = currentDayStar.getLuckInQiMen();
  const qiMenLuckScore = QI_MEN_LUCK_DELTA[qiMenLuckLabel] ?? 0;
  const referenceMode: KuseongReferenceMode = calendarType === "unknown" ? "solar-lunar-blend" : "exact";
  const candidates = solarCandidates.map((candidate) =>
    buildCandidate({
      natalSolar: candidate,
      currentMonthStar,
      currentDayStar,
    }),
  );
  const averageDelta =
    candidates.length > 0
      ? Math.round(candidates.reduce((sum, candidate) => sum + candidate.scoreDelta, 0) / candidates.length)
      : 0;
  const averageNatalRelationScore =
    candidates.length > 0
      ? Math.round(candidates.reduce((sum, candidate) => sum + candidate.natalRelationScore, 0) / candidates.length)
      : 0;
  const uniqueNatalYearStars = [...new Set(candidates.map((candidate) => candidate.natalYearStar))];

  const referenceNatal =
    candidates.length === 1 || uniqueNatalYearStars.length === 1
      ? candidates[0]
      : {
          natalYearStar: uniqueNatalYearStars.join(" / "),
          natalYearNumber: [...new Set(candidates.map((candidate) => candidate.natalYearNumber))].join(" / "),
          natalYearPosition: "",
          natalYearPositionLabel: "",
          natalRelation: relationFromDelta(averageDelta),
          natalRelationScore: averageNatalRelationScore,
          scoreDelta: averageDelta,
        };

  const direction = currentDayStar.getPositionDesc();
  const scoreDelta = clamp(referenceNatal.scoreDelta, -5, 5);
  const { categoryAdjustments, focusCategories, weakestCategory } = buildCategoryAdjustments({
    dayElement: currentDayElement,
    natalRelation: referenceNatal.natalRelation,
    monthRelation,
    qiMenLuckLabel,
  });
  const narrativeTone = buildNarrativeTone({
    scoreDelta,
    focusCategories,
  });
  const narrative = buildNarrative({
    focusCategories,
    weakestCategory,
    direction,
    narrativeTone,
  });
  const summary = describeRelationSummary({
    natalYearStar: referenceNatal.natalYearStar,
    currentMonthStar: currentMonthStar.toString(),
    currentDayStar: currentDayStar.toString(),
    natalRelation: referenceNatal.natalRelation,
    monthRelation,
    direction,
    scoreDelta,
    referenceMode,
  });

  return {
    natalYearStar: referenceNatal.natalYearStar,
    currentMonthStar: currentMonthStar.toString(),
    currentDayStar: currentDayStar.toString(),
    natalRelation: referenceNatal.natalRelation,
    monthRelation,
    qiMenLuckLabel,
    direction,
    action: buildAction({
      focusCategories,
      weakestCategory,
      direction,
      narrativeTone,
    }),
    caution: buildCaution({
      weakestCategory,
      narrativeTone,
      focusCategories,
    }),
    summary,
    scoreDelta,
    referenceMode,
    breakdown: {
      natalRelationScore: referenceNatal.natalRelationScore,
      monthRelationScore,
      qiMenLuckScore,
    },
    categoryAdjustments,
    focusCategories,
    narrativeTone,
    stars: {
      natalYear: candidates.map((candidate) => ({
        label: candidate.natalYearStar,
        number: candidate.natalYearNumber,
        position: candidate.natalYearPosition,
        positionLabel: candidate.natalYearPositionLabel,
      })),
      currentMonth: {
        label: currentMonthStar.toString(),
        number: currentMonthStar.getNumber(),
        position: currentMonthStar.getPosition(),
        positionLabel: currentMonthStar.getPositionDesc(),
        gate: currentMonthStar.getBaMenInQiMen(),
      },
      currentDay: {
        label: currentDayStar.toString(),
        number: currentDayStar.getNumber(),
        position: currentDayStar.getPosition(),
        positionLabel: currentDayStar.getPositionDesc(),
        gate: currentDayStar.getBaMenInQiMen(),
      },
    },
    narrative,
  };
}
