import { Lunar, Solar } from "lunar-javascript";

export type CalendarType = "solar" | "lunar" | "unknown";

export type FiveElements = {
  wood: number;
  fire: number;
  earth: number;
  metal: number;
  water: number;
};

export type ElementKey = keyof FiveElements;
export type FivePhaseRelation = "비겁" | "식상" | "재성" | "관성" | "인성";
export type TenGod = "비견" | "겁재" | "식신" | "상관" | "편재" | "정재" | "편관" | "정관" | "편인" | "정인";
export type PillarKey = "year" | "month" | "day" | "hour";
export type BranchRelationType = "합" | "충" | "형";

type YinYang = "yang" | "yin";

export type PillarInfo = {
  ganji: string;
  ganjiKorean: string;
  stem: string;
  stemKorean: string;
  branch: string;
  branchKorean: string;
  hiddenStems: string[];
  hiddenStemsKorean: string[];
};

export type TraditionalSajuAnalysis = {
  seasonalForce: {
    branch: string;
    branchKorean: string;
    element: ElementKey;
    relation: FivePhaseRelation;
    influence: number;
    summary: string;
  };
  dayMasterStrength: {
    score: number;
    level: "strong" | "balanced" | "weak";
    support: number;
    pressure: number;
    roots: Array<{
      pillar: PillarKey;
      branch: string;
      branchKorean: string;
      stem: string;
      stemKorean: string;
      relation: FivePhaseRelation;
    }>;
    summary: string;
  };
  tenGods: {
    stems: Record<"year" | "month" | "hour", { stem: string; stemKorean: string; tenGod: TenGod }>;
    hiddenStems: Record<PillarKey, Array<{ stem: string; stemKorean: string; tenGod: TenGod }>>;
    dominant: TenGod;
  };
  pattern: {
    name: string;
    tenGod: TenGod;
    monthLeaderStem: string;
    monthLeaderStemKorean: string;
    summary: string;
    tentative: boolean;
    revealLabel: string;
    revealedPillars: Array<Exclude<PillarKey, "day">>;
    candidates: Array<{
      stem: string;
      stemKorean: string;
      tenGod: TenGod;
      weight: number;
      revealed: boolean;
    }>;
  };
  balanceDirectives: {
    yongShin: ElementKey;
    heeShin: ElementKey[];
    giShin: ElementKey;
    guShin: ElementKey[];
    summary: string;
    priorityScores: Record<ElementKey, { useful: number; unfavorable: number }>;
    reasons: {
      yongShin: string;
      heeShin: string[];
      giShin: string;
      guShin: string[];
    };
  };
  usefulElements: ElementKey[];
  unfavorableElements: ElementKey[];
  branchRelations: {
    pairs: Array<{
      pillars: [PillarKey, PillarKey];
      type: BranchRelationType;
      branches: [string, string];
      label: string;
      description: string;
    }>;
    summary: string[];
  };
};

export type TodayBranchInteraction = {
  pillar: PillarKey;
  pillarLabel: string;
  branch: string;
  branchKorean: string;
  type: BranchRelationType;
  weight: number;
  description: string;
};

export type ChartCertainty = "exact" | "calendar-unknown";

export type TraditionalSajuChart = {
  source: "traditional-lunar-javascript-v1";
  certainty: ChartCertainty;
  uncertaintyMessage: string | null;
  calendarTypeInput: CalendarType;
  calendarTypeResolved: CalendarType;
  birthDateInput: string;
  birthTimeInput: string | null;
  solarDateTime: string | null;
  lunarDate: string | null;
  lunarDateKorean: string | null;
  usedNoonFallback: boolean;
  pillars: {
    year: PillarInfo;
    month: PillarInfo;
    day: PillarInfo;
    hour: PillarInfo;
  } | null;
  dayMaster: {
    stem: string;
    stemKorean: string;
    element: ElementKey;
    elementLabel: string;
  } | null;
  auxiliary: {
    taiYuan: string;
    mingGong: string;
    shenGong: string;
    yearXunKong: string;
    dayXunKong: string;
    naYin: {
      year: string;
      month: string;
        day: string;
        hour: string;
    };
  } | null;
  fiveElements: FiveElements | null;
  analysis: TraditionalSajuAnalysis | null;
};

const STEM_KOREAN: Record<string, string> = {
  甲: "갑",
  乙: "을",
  丙: "병",
  丁: "정",
  戊: "무",
  己: "기",
  庚: "경",
  辛: "신",
  壬: "임",
  癸: "계",
};

const BRANCH_KOREAN: Record<string, string> = {
  子: "자",
  丑: "축",
  寅: "인",
  卯: "묘",
  辰: "진",
  巳: "사",
  午: "오",
  未: "미",
  申: "신",
  酉: "유",
  戌: "술",
  亥: "해",
};

const STEM_TO_ELEMENT: Record<string, ElementKey> = {
  甲: "wood",
  乙: "wood",
  丙: "fire",
  丁: "fire",
  戊: "earth",
  己: "earth",
  庚: "metal",
  辛: "metal",
  壬: "water",
  癸: "water",
};

const STEM_YIN_YANG: Record<string, YinYang> = {
  甲: "yang",
  乙: "yin",
  丙: "yang",
  丁: "yin",
  戊: "yang",
  己: "yin",
  庚: "yang",
  辛: "yin",
  壬: "yang",
  癸: "yin",
};

const ELEMENT_LABEL: Record<ElementKey, string> = {
  wood: "목(木)",
  fire: "화(火)",
  earth: "토(土)",
  metal: "금(金)",
  water: "수(水)",
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

const BRANCH_MAIN_ELEMENT: Record<string, ElementKey> = {
  子: "water",
  丑: "earth",
  寅: "wood",
  卯: "wood",
  辰: "earth",
  巳: "fire",
  午: "fire",
  未: "earth",
  申: "metal",
  酉: "metal",
  戌: "earth",
  亥: "water",
};

const PILLAR_LABEL: Record<PillarKey, string> = {
  year: "연주",
  month: "월주",
  day: "일주",
  hour: "시주",
};

const BRANCH_COMBINATIONS: Array<[string, string]> = [
  ["子", "丑"],
  ["寅", "亥"],
  ["卯", "戌"],
  ["辰", "酉"],
  ["巳", "申"],
  ["午", "未"],
];

const BRANCH_CLASHES: Array<[string, string]> = [
  ["子", "午"],
  ["丑", "未"],
  ["寅", "申"],
  ["卯", "酉"],
  ["辰", "戌"],
  ["巳", "亥"],
];

const BRANCH_PUNISHMENTS: Array<[string, string]> = [
  ["寅", "巳"],
  ["寅", "申"],
  ["巳", "申"],
  ["丑", "戌"],
  ["丑", "未"],
  ["戌", "未"],
  ["子", "卯"],
];

function toIsoDateString(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseBirthTimeToHourMinute(birthTime?: string): { hour: number; minute: number; usedNoonFallback: boolean } {
  if (!birthTime) {
    return { hour: 12, minute: 0, usedNoonFallback: true };
  }

  const match = birthTime.match(/^(\d{2}):(\d{2})$/);
  if (!match) {
    return { hour: 12, minute: 0, usedNoonFallback: true };
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return { hour: 12, minute: 0, usedNoonFallback: true };
  }

  return { hour, minute, usedNoonFallback: false };
}

function toKoreanGanji(ganji: string): string {
  const [stem, branch] = [...ganji];
  return `${STEM_KOREAN[stem] ?? stem}${BRANCH_KOREAN[branch] ?? branch}`;
}

function buildPillar(ganji: string, hiddenStems: string[]): PillarInfo {
  const [stem, branch] = [...ganji];
  return {
    ganji,
    ganjiKorean: toKoreanGanji(ganji),
    stem,
    stemKorean: STEM_KOREAN[stem] ?? stem,
    branch,
    branchKorean: BRANCH_KOREAN[branch] ?? branch,
    hiddenStems,
    hiddenStemsKorean: hiddenStems.map((item) => STEM_KOREAN[item] ?? item),
  };
}

function emptyElements(): Record<ElementKey, number> {
  return {
    wood: 0,
    fire: 0,
    earth: 0,
    metal: 0,
    water: 0,
  };
}

function generatedByElement(element: ElementKey): ElementKey {
  const found = (Object.keys(GENERATES) as ElementKey[]).find((key) => GENERATES[key] === element);
  return found ?? "earth";
}

function controlledByElement(element: ElementKey): ElementKey {
  const found = (Object.keys(CONTROLS) as ElementKey[]).find((key) => CONTROLS[key] === element);
  return found ?? "earth";
}

function isSamePair(pair: [string, string], left: string, right: string): boolean {
  return (pair[0] === left && pair[1] === right) || (pair[0] === right && pair[1] === left);
}

function uniqueElements(elements: ElementKey[]): ElementKey[] {
  return [...new Set(elements)];
}

function sortElementsByWeight(
  candidates: ElementKey[],
  weights: FiveElements,
  direction: "asc" | "desc",
): ElementKey[] {
  return uniqueElements(candidates)
    .map((element, index) => ({ element, index }))
    .sort((left, right) => {
      const delta =
        direction === "asc"
          ? weights[left.element] - weights[right.element]
          : weights[right.element] - weights[left.element];
      return delta !== 0 ? delta : left.index - right.index;
    })
    .map((item) => item.element);
}

function rankedElements(elements: FiveElements, direction: "asc" | "desc"): ElementKey[] {
  return sortElementsByWeight(["wood", "fire", "earth", "metal", "water"], elements, direction);
}

function emptyPriorityScores(): Record<ElementKey, { useful: number; unfavorable: number }> {
  return {
    wood: { useful: 0, unfavorable: 0 },
    fire: { useful: 0, unfavorable: 0 },
    earth: { useful: 0, unfavorable: 0 },
    metal: { useful: 0, unfavorable: 0 },
    water: { useful: 0, unfavorable: 0 },
  };
}

function emptyPriorityReasons(): Record<ElementKey, { useful: string[]; unfavorable: string[] }> {
  return {
    wood: { useful: [], unfavorable: [] },
    fire: { useful: [], unfavorable: [] },
    earth: { useful: [], unfavorable: [] },
    metal: { useful: [], unfavorable: [] },
    water: { useful: [], unfavorable: [] },
  };
}

function pushUsefulDirective(
  priorityScores: Record<ElementKey, { useful: number; unfavorable: number }>,
  priorityReasons: Record<ElementKey, { useful: string[]; unfavorable: string[] }>,
  element: ElementKey,
  score: number,
  reason: string,
): void {
  priorityScores[element].useful += score;
  priorityReasons[element].useful.push(reason);
}

function pushUnfavorableDirective(
  priorityScores: Record<ElementKey, { useful: number; unfavorable: number }>,
  priorityReasons: Record<ElementKey, { useful: string[]; unfavorable: string[] }>,
  element: ElementKey,
  score: number,
  reason: string,
): void {
  priorityScores[element].unfavorable += score;
  priorityReasons[element].unfavorable.push(reason);
}

function formatDirectiveReason(
  reasons: string[],
  fallback: string,
): string {
  if (reasons.length === 0) return fallback;
  return Array.from(new Set(reasons)).slice(0, 2).join(" ");
}

function addStemWeight(bucket: Record<ElementKey, number>, stem: string, weight: number): void {
  const element = STEM_TO_ELEMENT[stem];
  if (!element) return;
  bucket[element] += weight;
}

function hiddenStemWeights(length: number): number[] {
  if (length <= 0) return [];
  if (length === 1) return [10];
  if (length === 2) return [7, 3];
  return [6, 3, 1];
}

type EightCharLike = {
  getYearGan(): string;
  getMonthGan(): string;
  getDayGan(): string;
  getTimeGan(): string;
  getYearHideGan(): string[];
  getMonthHideGan(): string[];
  getDayHideGan(): string[];
  getTimeHideGan(): string[];
  getYear(): string;
  getMonth(): string;
  getDay(): string;
  getTime(): string;
  getTaiYuan(): string;
  getMingGong(): string;
  getShenGong(): string;
  getYearXunKong(): string;
  getDayXunKong(): string;
  getYearNaYin(): string;
  getMonthNaYin(): string;
  getDayNaYin(): string;
  getTimeNaYin(): string;
};

function normalizeElements(raw: Record<ElementKey, number>): FiveElements {
  const keys: ElementKey[] = ["wood", "fire", "earth", "metal", "water"];
  const total = keys.reduce((sum, key) => sum + raw[key], 0);
  if (total <= 0) {
    return { wood: 20, fire: 20, earth: 20, metal: 20, water: 20 };
  }

  const scaled = keys.map((key) => ({ key, value: (raw[key] / total) * 100 }));
  const floored = scaled.map((item) => ({ ...item, floor: Math.floor(item.value) }));

  let remainder = 100 - floored.reduce((sum, item) => sum + item.floor, 0);
  const byFraction = [...floored].sort((a, b) => b.value - b.floor - (a.value - a.floor));

  for (let i = 0; i < byFraction.length && remainder > 0; i += 1) {
    byFraction[i].floor += 1;
    remainder -= 1;
  }

  const result = emptyElements();
  for (const item of byFraction) {
    result[item.key] = item.floor;
  }

  return {
    wood: result.wood,
    fire: result.fire,
    earth: result.earth,
    metal: result.metal,
    water: result.water,
  };
}

function computeFiveElementsFromEightChar(eightChar: EightCharLike): FiveElements {
  const raw = emptyElements();

  const pillarRaw = [
    {
      stem: String(eightChar.getYearGan()),
      hiddenStems: (eightChar.getYearHideGan() as string[]) ?? [],
      stemWeight: 10,
      monthBoost: 0,
    },
    {
      stem: String(eightChar.getMonthGan()),
      hiddenStems: (eightChar.getMonthHideGan() as string[]) ?? [],
      stemWeight: 12,
      monthBoost: 4,
    },
    {
      stem: String(eightChar.getDayGan()),
      hiddenStems: (eightChar.getDayHideGan() as string[]) ?? [],
      stemWeight: 10,
      monthBoost: 0,
    },
    {
      stem: String(eightChar.getTimeGan()),
      hiddenStems: (eightChar.getTimeHideGan() as string[]) ?? [],
      stemWeight: 8,
      monthBoost: 0,
    },
  ];

  for (const pillar of pillarRaw) {
    addStemWeight(raw, pillar.stem, pillar.stemWeight);

    const weights = hiddenStemWeights(pillar.hiddenStems.length);
    pillar.hiddenStems.forEach((hidden, index) => {
      const weight = (weights[index] ?? 0) + (index === 0 ? pillar.monthBoost : 0);
      addStemWeight(raw, hidden, weight);
    });
  }

  return normalizeElements(raw);
}

function toLunarDateKorean(lunarText: string): string {
  return lunarText
    .replaceAll("一", "1")
    .replaceAll("二", "2")
    .replaceAll("三", "3")
    .replaceAll("四", "4")
    .replaceAll("五", "5")
    .replaceAll("六", "6")
    .replaceAll("七", "7")
    .replaceAll("八", "8")
    .replaceAll("九", "9")
    .replaceAll("〇", "0")
    .replaceAll("年", "년 ")
    .replaceAll("月", "월 ")
    .replaceAll("闰", "윤")
    .trim();
}

export function elementLabel(element: ElementKey): string {
  return ELEMENT_LABEL[element];
}

export function elementFromStem(stem: string): ElementKey {
  return STEM_TO_ELEMENT[stem] ?? "earth";
}

export function fivePhaseRelation(dayMaster: ElementKey, other: ElementKey): FivePhaseRelation {
  if (other === dayMaster) return "비겁";
  if (GENERATES[dayMaster] === other) return "식상";
  if (CONTROLS[dayMaster] === other) return "재성";
  if (CONTROLS[other] === dayMaster) return "관성";
  return "인성";
}

export function tenGodFromStem(dayStem: string, otherStem: string): TenGod {
  const relation = fivePhaseRelation(elementFromStem(dayStem), elementFromStem(otherStem));
  const samePolarity = STEM_YIN_YANG[dayStem] === STEM_YIN_YANG[otherStem];

  if (relation === "비겁") return samePolarity ? "비견" : "겁재";
  if (relation === "식상") return samePolarity ? "식신" : "상관";
  if (relation === "재성") return samePolarity ? "편재" : "정재";
  if (relation === "관성") return samePolarity ? "편관" : "정관";
  return samePolarity ? "편인" : "정인";
}

function tenGodGroup(tenGod: TenGod): FivePhaseRelation {
  if (tenGod === "비견" || tenGod === "겁재") return "비겁";
  if (tenGod === "식신" || tenGod === "상관") return "식상";
  if (tenGod === "편재" || tenGod === "정재") return "재성";
  if (tenGod === "편관" || tenGod === "정관") return "관성";
  return "인성";
}

function seasonalInfluence(relation: FivePhaseRelation): number {
  switch (relation) {
    case "비겁":
      return 18;
    case "인성":
      return 14;
    case "식상":
      return -4;
    case "재성":
      return -8;
    case "관성":
      return -12;
    default:
      return 0;
  }
}

function strengthLevelLabel(level: TraditionalSajuAnalysis["dayMasterStrength"]["level"]): string {
  if (level === "strong") return "신강";
  if (level === "weak") return "신약";
  return "중화";
}

function patternCandidateName(tenGod: TenGod): string {
  if (tenGod === "비견" || tenGod === "겁재") {
    return `${tenGod}격 계열`;
  }
  return `${tenGod}격`;
}

function stemVisiblePillarLabel(pillar: Exclude<PillarKey, "day">): string {
  switch (pillar) {
    case "year":
      return "연간";
    case "month":
      return "월간";
    case "hour":
      return "시간";
  }
}

function detectBranchRelationTypes(leftBranch: string, rightBranch: string): BranchRelationType[] {
  const types: BranchRelationType[] = [];

  if (BRANCH_COMBINATIONS.some((pair) => isSamePair(pair, leftBranch, rightBranch))) {
    types.push("합");
  }

  if (BRANCH_CLASHES.some((pair) => isSamePair(pair, leftBranch, rightBranch))) {
    types.push("충");
  }

  if (BRANCH_PUNISHMENTS.some((pair) => isSamePair(pair, leftBranch, rightBranch))) {
    types.push("형");
  }

  return types;
}

function branchRelationLabel(type: BranchRelationType): string {
  switch (type) {
    case "합":
      return "합";
    case "충":
      return "충";
    case "형":
      return "형";
  }
}

function describeBranchRelation(params: {
  leftLabel: string;
  leftBranchKorean: string;
  rightLabel: string;
  rightBranchKorean: string;
  type: BranchRelationType;
}): string {
  switch (params.type) {
    case "합":
      return `${params.leftLabel} ${params.leftBranchKorean}와 ${params.rightLabel} ${params.rightBranchKorean}가 합을 이루오.`;
    case "충":
      return `${params.leftLabel} ${params.leftBranchKorean}와 ${params.rightLabel} ${params.rightBranchKorean}가 충을 이루어 변화성이 크오.`;
    case "형":
      return `${params.leftLabel} ${params.leftBranchKorean}와 ${params.rightLabel} ${params.rightBranchKorean} 사이에 형살 기운이 있소.`;
  }
}

function buildBranchRelationPairs(params: {
  leftKey: PillarKey;
  leftBranch: string;
  leftBranchKorean: string;
  rightKey: PillarKey;
  rightBranch: string;
  rightBranchKorean: string;
}): TraditionalSajuAnalysis["branchRelations"]["pairs"] {
  const branches: [string, string] = [params.leftBranch, params.rightBranch];
  const labelBase = `${PILLAR_LABEL[params.leftKey]}-${PILLAR_LABEL[params.rightKey]}`;

  return detectBranchRelationTypes(params.leftBranch, params.rightBranch).map((type) => ({
    pillars: [params.leftKey, params.rightKey] as [PillarKey, PillarKey],
    type,
    branches,
    label: `${labelBase} ${branchRelationLabel(type)}`,
    description: describeBranchRelation({
      leftLabel: PILLAR_LABEL[params.leftKey],
      leftBranchKorean: params.leftBranchKorean,
      rightLabel: PILLAR_LABEL[params.rightKey],
      rightBranchKorean: params.rightBranchKorean,
      type,
    }),
  }));
}

function todayBranchPillarWeight(type: BranchRelationType, pillar: PillarKey): number {
  const baseWeight: Record<BranchRelationType, number> = {
    합: 3,
    충: -5,
    형: -3,
  };

  const pillarMultiplier: Record<PillarKey, number> = {
    year: 1,
    month: 1.25,
    day: 1.5,
    hour: 1,
  };

  return Math.min(6, Math.max(-8, Math.round(baseWeight[type] * pillarMultiplier[pillar])));
}

function detectBranchRelations(pillars: Record<PillarKey, PillarInfo>): TraditionalSajuAnalysis["branchRelations"] {
  const entries = Object.entries(pillars) as Array<[PillarKey, PillarInfo]>;
  const pairs: TraditionalSajuAnalysis["branchRelations"]["pairs"] = [];

  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      const [leftKey, leftPillar] = entries[i];
      const [rightKey, rightPillar] = entries[j];
      pairs.push(
        ...buildBranchRelationPairs({
          leftKey,
          leftBranch: leftPillar.branch,
          leftBranchKorean: leftPillar.branchKorean,
          rightKey,
          rightBranch: rightPillar.branch,
          rightBranchKorean: rightPillar.branchKorean,
        }),
      );
    }
  }

  return {
    pairs,
    summary:
      pairs.length > 0
        ? pairs.map((pair) => pair.description)
        : ["지지 간 큰 충돌은 약한 편이니 흐름이 비교적 단정하오."],
  };
}

export function detectTodayBranchInteractions(
  todayBranch: string,
  pillars: Record<PillarKey, PillarInfo>,
): TodayBranchInteraction[] {
  const todayBranchKorean = BRANCH_KOREAN[todayBranch] ?? todayBranch;
  const interactions: TodayBranchInteraction[] = [];

  for (const [pillarKey, pillar] of Object.entries(pillars) as Array<[PillarKey, PillarInfo]>) {
    for (const type of detectBranchRelationTypes(todayBranch, pillar.branch)) {
      interactions.push({
        pillar: pillarKey,
        pillarLabel: PILLAR_LABEL[pillarKey],
        branch: pillar.branch,
        branchKorean: pillar.branchKorean,
        type,
        weight: todayBranchPillarWeight(type, pillarKey),
        description: describeBranchRelation({
          leftLabel: "금일",
          leftBranchKorean: todayBranchKorean,
          rightLabel: PILLAR_LABEL[pillarKey],
          rightBranchKorean: pillar.branchKorean,
          type,
        }),
      });
    }
  }

  return interactions;
}

function analyzeTraditionalSajuChart(params: {
  pillars: Record<PillarKey, PillarInfo>;
  dayStem: string;
  fiveElements: FiveElements;
}): TraditionalSajuAnalysis {
  const dayMasterElement = elementFromStem(params.dayStem);
  const resourceElement = generatedByElement(dayMasterElement);
  const outputElement = GENERATES[dayMasterElement];
  const wealthElement = CONTROLS[dayMasterElement];
  const officerElement = controlledByElement(dayMasterElement);

  const monthPillar = params.pillars.month;
  const seasonalElement = BRANCH_MAIN_ELEMENT[monthPillar.branch] ?? "earth";
  const seasonalRelation = fivePhaseRelation(dayMasterElement, seasonalElement);
  const seasonBoost = seasonalInfluence(seasonalRelation);

  const roots: TraditionalSajuAnalysis["dayMasterStrength"]["roots"] = [];
  for (const [pillarKey, pillar] of Object.entries(params.pillars) as Array<[PillarKey, PillarInfo]>) {
    pillar.hiddenStems.forEach((stem) => {
      const relation = fivePhaseRelation(dayMasterElement, elementFromStem(stem));
      if (relation === "비겁" || relation === "인성") {
        roots.push({
          pillar: pillarKey,
          branch: pillar.branch,
          branchKorean: pillar.branchKorean,
          stem,
          stemKorean: STEM_KOREAN[stem] ?? stem,
          relation,
        });
      }
    });
  }

  const rootSupport = Math.min(roots.length * 6, 18);
  const support = params.fiveElements[dayMasterElement] + params.fiveElements[resourceElement] + seasonBoost + rootSupport;
  const pressure =
    Math.round(params.fiveElements[outputElement] * 0.55) +
    Math.round(params.fiveElements[wealthElement] * 0.8) +
    Math.round(params.fiveElements[officerElement] * 0.9);
  const strengthScore = support - pressure;
  const level: TraditionalSajuAnalysis["dayMasterStrength"]["level"] =
    strengthScore >= 12 ? "strong" : strengthScore <= -6 ? "weak" : "balanced";

  const stemTenGods: TraditionalSajuAnalysis["tenGods"]["stems"] = {
    year: {
      stem: params.pillars.year.stem,
      stemKorean: params.pillars.year.stemKorean,
      tenGod: tenGodFromStem(params.dayStem, params.pillars.year.stem),
    },
    month: {
      stem: params.pillars.month.stem,
      stemKorean: params.pillars.month.stemKorean,
      tenGod: tenGodFromStem(params.dayStem, params.pillars.month.stem),
    },
    hour: {
      stem: params.pillars.hour.stem,
      stemKorean: params.pillars.hour.stemKorean,
      tenGod: tenGodFromStem(params.dayStem, params.pillars.hour.stem),
    },
  };

  const hiddenStemTenGods = (Object.entries(params.pillars) as Array<[PillarKey, PillarInfo]>).reduce(
    (acc, [pillarKey, pillar]) => {
      acc[pillarKey] = pillar.hiddenStems.map((stem) => ({
        stem,
        stemKorean: STEM_KOREAN[stem] ?? stem,
        tenGod: tenGodFromStem(params.dayStem, stem),
      }));
      return acc;
    },
    {} as TraditionalSajuAnalysis["tenGods"]["hiddenStems"],
  );

  const tenGodScores = new Map<TenGod, number>();
  const pushTenGod = (tenGod: TenGod, weight: number) => {
    tenGodScores.set(tenGod, (tenGodScores.get(tenGod) ?? 0) + weight);
  };

  pushTenGod(stemTenGods.year.tenGod, 1);
  pushTenGod(stemTenGods.month.tenGod, 2);
  pushTenGod(stemTenGods.hour.tenGod, 1);
  Object.values(hiddenStemTenGods).forEach((items) => {
    items.forEach((item) => pushTenGod(item.tenGod, 1));
  });

  const dominantTenGod =
    [...tenGodScores.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? stemTenGods.month.tenGod;

  const monthHiddenWeights = hiddenStemWeights(monthPillar.hiddenStems.length);
  const visibleStemPillars = (["year", "month", "hour"] as Array<Exclude<PillarKey, "day">>).map((pillarKey) => [
    pillarKey,
    params.pillars[pillarKey],
  ]) as Array<[Exclude<PillarKey, "day">, PillarInfo]>;
  const patternCandidates = monthPillar.hiddenStems
    .map((stem, index) => {
      const tenGod = tenGodFromStem(params.dayStem, stem);
      const revealedPillars = visibleStemPillars
        .filter(([, pillar]) => pillar.stem === stem)
        .map(([pillarKey]) => pillarKey);
      const revealed = revealedPillars.length > 0;
      const score = (monthHiddenWeights[index] ?? 0) * 2 + revealedPillars.length * 4 + (tenGod === dominantTenGod ? 2 : 0);

      return {
        stem,
        stemKorean: STEM_KOREAN[stem] ?? stem,
        tenGod,
        weight: monthHiddenWeights[index] ?? 0,
        revealed,
        revealedPillars,
        score,
      };
    })
    .sort((left, right) => right.score - left.score || right.weight - left.weight);

  const primaryPatternCandidate = patternCandidates[0] ?? {
    stem: monthPillar.stem,
    stemKorean: monthPillar.stemKorean,
    tenGod: stemTenGods.month.tenGod,
    weight: 0,
    revealed: true,
    revealedPillars: ["month"] as Array<Exclude<PillarKey, "day">>,
    score: 0,
  };
  const monthLeaderStem = primaryPatternCandidate.stem;
  const monthLeaderStemKorean = primaryPatternCandidate.stemKorean;
  const patternTenGod = primaryPatternCandidate.tenGod;
  const patternName = patternCandidateName(patternTenGod);
  const patternRevealedPillars = primaryPatternCandidate.revealedPillars;
  const patternRevealLabel =
    patternRevealedPillars.length > 0
      ? `${patternRevealedPillars.map((pillar) => stemVisiblePillarLabel(pillar)).join(", ")} 투간`
      : "미투간";

  const priorityScores = emptyPriorityScores();
  const priorityReasons = emptyPriorityReasons();
  const weakestRank = rankedElements(params.fiveElements, "asc");
  const strongestRank = rankedElements(params.fiveElements, "desc");
  const dominantGroup = tenGodGroup(dominantTenGod);
  const strongestCurrentElement = strongestRank[0] ?? dayMasterElement;
  const weakestCurrentElement = weakestRank[0] ?? dayMasterElement;
  const secondWeakestElement = weakestRank[1] ?? weakestCurrentElement;
  const usefulCore: ElementKey[] = [];
  const unfavorableCore: ElementKey[] = [];

  if (level === "strong") {
    pushUsefulDirective(priorityScores, priorityReasons, outputElement, 3, "신강한 명식은 식상으로 기운을 흘려 주는 편이 좋소.");
    pushUsefulDirective(priorityScores, priorityReasons, wealthElement, 4, "신강한 명식은 재성으로 현실 감각을 세울 때 균형이 잡히오.");
    pushUsefulDirective(priorityScores, priorityReasons, officerElement, 3, "관성 기운이 들어오면 흐름이 단정해지기 쉽소.");
    pushUnfavorableDirective(priorityScores, priorityReasons, dayMasterElement, 4, "비겁이 과해지면 자기 기운이 너무 불어나 흐름이 답답해질 수 있소.");
    pushUnfavorableDirective(priorityScores, priorityReasons, resourceElement, 4, "인성이 겹치면 기운이 안으로만 쌓여 답답해질 수 있소.");
    usefulCore.push(outputElement, wealthElement, officerElement);
    unfavorableCore.push(dayMasterElement, resourceElement);
  } else if (level === "weak") {
    pushUsefulDirective(priorityScores, priorityReasons, dayMasterElement, 4, "신약한 명식은 비겁으로 중심을 세워야 버티는 힘이 생기오.");
    pushUsefulDirective(priorityScores, priorityReasons, resourceElement, 5, "인성이 받쳐 주어야 약한 기운이 다시 숨을 고르오.");
    pushUnfavorableDirective(priorityScores, priorityReasons, outputElement, 3, "식상이 강해지면 기운이 더 빠져나가 버거워질 수 있소.");
    pushUnfavorableDirective(priorityScores, priorityReasons, wealthElement, 3, "재성이 과하면 감당할 일과 욕심이 함께 늘어날 수 있소.");
    pushUnfavorableDirective(priorityScores, priorityReasons, officerElement, 3, "관성이 눌러오면 압박이 먼저 느껴지기 쉬운 명식이오.");
    usefulCore.push(dayMasterElement, resourceElement);
    unfavorableCore.push(outputElement, wealthElement, officerElement);
  } else {
    pushUsefulDirective(priorityScores, priorityReasons, wealthElement, 3, "중화된 명식은 재성으로 현실 감각을 세울 때 흐름이 정리되오.");
    pushUsefulDirective(priorityScores, priorityReasons, officerElement, 3, "관성이 들어오면 균형이 흐트러지지 않고 단정해지오.");
    pushUsefulDirective(priorityScores, priorityReasons, outputElement, 2, "식상이 부드럽게 열리면 막힌 기운이 풀리기 쉽소.");
    pushUnfavorableDirective(priorityScores, priorityReasons, strongestCurrentElement, 2, `이미 강한 ${elementLabel(strongestCurrentElement)} 기운이 더 세지면 한쪽으로 치우칠 수 있소.`);
    usefulCore.push(wealthElement, officerElement, outputElement);
    unfavorableCore.push(strongestCurrentElement);
  }

  if (usefulCore.includes(seasonalElement)) {
    pushUsefulDirective(
      priorityScores,
      priorityReasons,
      seasonalElement,
      2,
      `월령의 ${elementLabel(seasonalElement)} 기운이 지금 명식에 필요한 축을 받쳐 주오.`,
    );
  }
  if (unfavorableCore.includes(seasonalElement)) {
    pushUnfavorableDirective(
      priorityScores,
      priorityReasons,
      seasonalElement,
      2,
      `월령의 ${elementLabel(seasonalElement)} 기운이 이미 과한 흐름을 더 밀어 올릴 수 있소.`,
    );
  }

  if (level === "strong" && (dominantGroup === "비겁" || dominantGroup === "인성")) {
    pushUsefulDirective(priorityScores, priorityReasons, outputElement, 2, "주도 십신이 비겁·인성 쪽이라 식상으로 기운을 풀어내야 숨통이 트이오.");
    pushUsefulDirective(priorityScores, priorityReasons, wealthElement, 2, "재성으로 현실 감각을 세워야 무거워진 기운이 정리되오.");
    pushUnfavorableDirective(priorityScores, priorityReasons, dayMasterElement, 2, "비겁이 더 겹치면 자기 기운이 과도하게 부풀 수 있소.");
    pushUnfavorableDirective(priorityScores, priorityReasons, resourceElement, 2, "인성이 더 쌓이면 생각과 준비만 늘어질 수 있소.");
  }

  if (level === "weak" && (dominantGroup === "재성" || dominantGroup === "관성" || dominantGroup === "식상")) {
    pushUsefulDirective(priorityScores, priorityReasons, dayMasterElement, 2, "주도 십신이 새어나가거나 눌리는 축이라 비겁으로 중심을 보강해야 하오.");
    pushUsefulDirective(priorityScores, priorityReasons, resourceElement, 2, "인성으로 기력을 채워야 흐름을 견디기 쉬워지오.");
    pushUnfavorableDirective(priorityScores, priorityReasons, wealthElement, 2, "재성이 더 강해지면 감당 범위를 넘기기 쉬운 형세요.");
    pushUnfavorableDirective(priorityScores, priorityReasons, officerElement, 2, "관성이 겹치면 해야 할 일보다 압박이 먼저 커질 수 있소.");
  }

  pushUsefulDirective(priorityScores, priorityReasons, weakestCurrentElement, 2, `가장 약한 ${elementLabel(weakestCurrentElement)} 기운을 보완해야 균형이 빨리 살아나오.`);
  pushUsefulDirective(priorityScores, priorityReasons, secondWeakestElement, 1, `${elementLabel(secondWeakestElement)} 기운도 보조로 살려 두면 균형이 부드럽게 이어지오.`);
  pushUnfavorableDirective(priorityScores, priorityReasons, strongestCurrentElement, 2, `가장 강한 ${elementLabel(strongestCurrentElement)} 기운이 더 세지면 흐름이 한쪽으로 거칠어질 수 있소.`);

  const usefulRanking = (["wood", "fire", "earth", "metal", "water"] as ElementKey[]).sort((left, right) => {
    const scoreDelta = priorityScores[right].useful - priorityScores[left].useful;
    if (scoreDelta !== 0) return scoreDelta;
    const weightDelta = params.fiveElements[left] - params.fiveElements[right];
    if (weightDelta !== 0) return weightDelta;
    return 0;
  });
  const unfavorableRanking = (["wood", "fire", "earth", "metal", "water"] as ElementKey[]).sort((left, right) => {
    const scoreDelta = priorityScores[right].unfavorable - priorityScores[left].unfavorable;
    if (scoreDelta !== 0) return scoreDelta;
    const weightDelta = params.fiveElements[right] - params.fiveElements[left];
    if (weightDelta !== 0) return weightDelta;
    return 0;
  });

  const yongShin = usefulRanking[0] ?? dayMasterElement;
  const heeShin = usefulRanking.slice(1, 3);
  const giShin = unfavorableRanking[0] ?? strongestCurrentElement;
  const guShin = unfavorableRanking.slice(1, 3);
  const usefulElements = usefulRanking.filter((element) => priorityScores[element].useful > 0).slice(0, 3);
  const unfavorableElements = unfavorableRanking.filter((element) => priorityScores[element].unfavorable > 0).slice(0, 3);

  const yongShinReason = formatDirectiveReason(
    priorityReasons[yongShin].useful,
    `${elementLabel(yongShin)} 기운이 지금 명식의 균형을 세워 주는 축이오.`,
  );
  const giShinReason = formatDirectiveReason(
    priorityReasons[giShin].unfavorable,
    `${elementLabel(giShin)} 기운이 과해지면 흐름을 거칠게 만들기 쉽소.`,
  );
  const heeShinReasons = heeShin.map((element) =>
    formatDirectiveReason(priorityReasons[element].useful, `${elementLabel(element)} 기운이 보조로 균형을 거들어 주오.`),
  );
  const guShinReasons = guShin.map((element) =>
    formatDirectiveReason(priorityReasons[element].unfavorable, `${elementLabel(element)} 기운이 따라오면 부담이 더 커질 수 있소.`),
  );

  const branchRelations = detectBranchRelations(params.pillars);
  const rootSummary =
    roots.length > 0
      ? `${roots.length}곳에 통근되어 뿌리가 이어지오.`
      : "통근이 엷어 바깥 기세에 민감하오.";

  return {
    seasonalForce: {
      branch: monthPillar.branch,
      branchKorean: monthPillar.branchKorean,
      element: seasonalElement,
      relation: seasonalRelation,
      influence: seasonBoost,
      summary: `${monthPillar.branchKorean}월의 ${elementLabel(seasonalElement)} 기운이 ${seasonalRelation} 축으로 작용하오.`,
    },
    dayMasterStrength: {
      score: strengthScore,
      level,
      support,
      pressure,
      roots,
      summary: `월령은 ${monthPillar.branchKorean}월의 ${elementLabel(seasonalElement)} 기운이며, ${rootSummary} 일간 세는 ${strengthLevelLabel(level)}에 가깝소.`,
    },
    tenGods: {
      stems: stemTenGods,
      hiddenStems: hiddenStemTenGods,
      dominant: dominantTenGod,
    },
    pattern: {
      name: patternName,
      tenGod: patternTenGod,
      monthLeaderStem,
      monthLeaderStemKorean,
      tentative: !primaryPatternCandidate.revealed,
      revealLabel: patternRevealLabel,
      revealedPillars: patternRevealedPillars,
      candidates: patternCandidates.map((candidate) => ({
        stem: candidate.stem,
        stemKorean: candidate.stemKorean,
        tenGod: candidate.tenGod,
        weight: candidate.weight,
        revealed: candidate.revealed,
      })),
      summary: primaryPatternCandidate.revealed
        ? `월지 ${monthPillar.branchKorean}의 주기 ${monthLeaderStem}${monthLeaderStemKorean}이 ${patternRevealLabel}되어 ${patternName} 성향을 드러내오.`
        : `월지 ${monthPillar.branchKorean}의 주기 ${monthLeaderStem}${monthLeaderStemKorean}이 아직 투간되지 않아 ${patternName} 후보로 보수적으로 봅니다.`,
    },
    balanceDirectives: {
      yongShin,
      heeShin,
      giShin,
      guShin,
      summary: `지금 명식은 ${elementLabel(yongShin)} 기운으로 균형을 잡고, ${elementLabel(giShin)} 기운이 과해지면 흐름이 거칠어집니다.`,
      priorityScores,
      reasons: {
        yongShin: yongShinReason,
        heeShin: heeShinReasons,
        giShin: giShinReason,
        guShin: guShinReasons,
      },
    },
    usefulElements,
    unfavorableElements,
    branchRelations,
  };
}

export function calculateTraditionalSajuChart(params: {
  birthDate: Date;
  birthTime?: string;
  calendarType: CalendarType;
}): TraditionalSajuChart {
  const birthDateInput = toIsoDateString(params.birthDate);
  const { hour, minute, usedNoonFallback } = parseBirthTimeToHourMinute(params.birthTime);

  const year = params.birthDate.getUTCFullYear();
  const month = params.birthDate.getUTCMonth() + 1;
  const day = params.birthDate.getUTCDate();

  if (params.calendarType === "unknown") {
    return {
      source: "traditional-lunar-javascript-v1",
      certainty: "calendar-unknown",
      uncertaintyMessage: "달력 기준이 확정되지 않아 참고용 풀이로만 보시오. 양력이나 음력을 다시 선택하면 만세력과 운세를 더 정확히 읽을 수 있소.",
      calendarTypeInput: params.calendarType,
      calendarTypeResolved: "unknown",
      birthDateInput,
      birthTimeInput: params.birthTime ?? null,
      solarDateTime: null,
      lunarDate: null,
      lunarDateKorean: null,
      usedNoonFallback,
      pillars: null,
      dayMaster: null,
      auxiliary: null,
      fiveElements: null,
      analysis: null,
    };
  }

  const resolvedCalendarType: "solar" | "lunar" = params.calendarType;

  const solar =
    resolvedCalendarType === "lunar"
      ? Lunar.fromYmdHms(year, month, day, hour, minute, 0).getSolar()
      : Solar.fromYmdHms(year, month, day, hour, minute, 0);

  const lunar = solar.getLunar();
  const eightChar = lunar.getEightChar();

  const yearGanji = String(eightChar.getYear());
  const monthGanji = String(eightChar.getMonth());
  const dayGanji = String(eightChar.getDay());
  const timeGanji = String(eightChar.getTime());
  const pillars = {
    year: buildPillar(yearGanji, ((eightChar.getYearHideGan() as string[]) ?? []).map(String)),
    month: buildPillar(monthGanji, ((eightChar.getMonthHideGan() as string[]) ?? []).map(String)),
    day: buildPillar(dayGanji, ((eightChar.getDayHideGan() as string[]) ?? []).map(String)),
    hour: buildPillar(timeGanji, ((eightChar.getTimeHideGan() as string[]) ?? []).map(String)),
  };
  const dayMaster = {
    stem: String(eightChar.getDayGan()),
    stemKorean: STEM_KOREAN[String(eightChar.getDayGan())] ?? String(eightChar.getDayGan()),
    element: elementFromStem(String(eightChar.getDayGan())),
    elementLabel: elementLabel(elementFromStem(String(eightChar.getDayGan()))),
  };
  const auxiliary = {
    taiYuan: String(eightChar.getTaiYuan()),
    mingGong: String(eightChar.getMingGong()),
    shenGong: String(eightChar.getShenGong()),
    yearXunKong: String(eightChar.getYearXunKong()),
    dayXunKong: String(eightChar.getDayXunKong()),
    naYin: {
      year: String(eightChar.getYearNaYin()),
      month: String(eightChar.getMonthNaYin()),
      day: String(eightChar.getDayNaYin()),
      hour: String(eightChar.getTimeNaYin()),
    },
  };
  const fiveElements = computeFiveElementsFromEightChar(eightChar);

  const chart: TraditionalSajuChart = {
    source: "traditional-lunar-javascript-v1",
    certainty: "exact",
    uncertaintyMessage: null,
    calendarTypeInput: params.calendarType,
    calendarTypeResolved: resolvedCalendarType,
    birthDateInput,
    birthTimeInput: params.birthTime ?? null,
    solarDateTime: String(solar.toYmdHms()),
    lunarDate: String(lunar.toString()),
    lunarDateKorean: toLunarDateKorean(String(lunar.toString())),
    usedNoonFallback,
    pillars,
    dayMaster,
    auxiliary,
    fiveElements,
    analysis: {} as TraditionalSajuAnalysis,
  };

  chart.analysis = analyzeTraditionalSajuChart({
    pillars,
    dayStem: dayMaster.stem,
    fiveElements,
  });

  return chart;
}
