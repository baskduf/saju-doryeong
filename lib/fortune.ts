import { Solar } from "lunar-javascript";
import { generateFortuneNarrativeOverride } from "./fortune-llm";
import {
  calculateTraditionalSajuChart,
  elementFromStem,
  elementLabel,
  fivePhaseRelation,
  type CalendarType,
  type ElementKey,
  type FiveElements,
  type PillarKey,
  type TraditionalSajuChart,
} from "./saju";

export type { FiveElements } from "./saju";

export type DailyFortune = {
  score: number;
  grade: "대길" | "길" | "평" | "주의";
  headline: string;
  summary: string;
  detail: string;
  caution: string;
  recommendedActions: string[];
  keywords: string[];
  categoryScores: Array<{
    key: "work" | "money" | "relationship" | "health";
    label: string;
    score: number;
    summary: string;
  }>;
  avoidToday: string[];
  luckyHints: {
    color: string;
    direction: string;
    place: string;
    timing: string;
    number: string;
  };
  elements: FiveElements;
  manse: {
    solarDateTime: string;
    lunarDateKorean: string;
    calendarTypeResolved: "solar" | "lunar";
    usedNoonFallback: boolean;
    pillars: Array<{
      key: PillarKey;
      label: string;
      ganji: string;
      ganjiKorean: string;
      stem: string;
      stemKorean: string;
      branch: string;
      branchKorean: string;
      hiddenStems: string[];
      hiddenStemsKorean: string[];
      naYin?: string;
    }>;
  } | null;
  analysis: {
    strengthLevel: "strong" | "balanced" | "weak";
    strengthScore: number;
    strengthSummary: string;
    seasonalSummary: string;
    dominantTenGod: string;
    patternName: string;
    patternSummary: string;
    patternTentative: boolean;
    patternRevealLabel: string;
    patternCandidates: Array<{
      stem: string;
      stemKorean: string;
      tenGod: string;
      weight: number;
      revealed: boolean;
    }>;
    yongShin: ElementKey;
    heeShin: ElementKey[];
    giShin: ElementKey;
    guShin: ElementKey[];
    balanceSummary: string;
    usefulElements: ElementKey[];
    unfavorableElements: ElementKey[];
    todayGanji: string;
    todayRelation: "비겁" | "식상" | "재성" | "관성" | "인성";
    usedNoonFallback: boolean;
    calendarTypeInput: CalendarType;
    calendarTypeResolved: "solar" | "lunar";
    rootCount: number;
    branchRelations: Array<{
      pillars: [PillarKey, PillarKey];
      label: string;
      type: "합" | "충" | "형";
      description: string;
    }>;
    visibleTenGods: Array<{
      pillar: Exclude<PillarKey, "day">;
      pillarLabel: string;
      stem: string;
      stemKorean: string;
      tenGod: string;
    }>;
  };
};

const DEFAULT_ELEMENTS: FiveElements = {
  wood: 20,
  fire: 20,
  earth: 20,
  metal: 20,
  water: 20,
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

const ELEMENT_KEYWORD_MAP: Record<ElementKey, string> = {
  wood: "계획",
  fire: "추진",
  earth: "안정",
  metal: "정리",
  water: "유연",
};

const ELEMENT_RISK_MAP: Record<ElementKey, string> = {
  wood: "계획만 늘리고 실행을 미루는 태도",
  fire: "감정이 앞서 말이 빨라지는 흐름",
  earth: "버티기만 하며 결정을 늦추는 태도",
  metal: "기준을 너무 날카롭게 세우는 반응",
  water: "우유부단하게 흐름을 놓치는 모습",
};

const ELEMENT_LUCK_MAP: Record<
  ElementKey,
  { color: string; direction: string; place: string; timing: string; number: string }
> = {
  wood: { color: "청록", direction: "동쪽", place: "창가나 식물 곁", timing: "오전", number: "3, 8" },
  fire: { color: "주홍", direction: "남쪽", place: "밝은 자리", timing: "오후", number: "2, 7" },
  earth: { color: "황토", direction: "중앙", place: "고정된 작업 자리", timing: "점심 전후", number: "5, 10" },
  metal: { color: "백금", direction: "서쪽", place: "정리된 책상", timing: "해질 무렵", number: "4, 9" },
  water: { color: "남색", direction: "북쪽", place: "조용한 공간", timing: "저녁", number: "1, 6" },
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function gradeFromScore(score: number): DailyFortune["grade"] {
  if (score >= 80) return "대길";
  if (score >= 60) return "길";
  if (score >= 40) return "평";
  return "주의";
}

function normalizeElements(elements: FiveElements): FiveElements {
  const total = elements.wood + elements.fire + elements.earth + elements.metal + elements.water;
  if (total <= 0) return DEFAULT_ELEMENTS;

  return {
    wood: Math.round((elements.wood / total) * 100),
    fire: Math.round((elements.fire / total) * 100),
    earth: Math.round((elements.earth / total) * 100),
    metal: Math.round((elements.metal / total) * 100),
    water: Math.round((elements.water / total) * 100),
  };
}

function getNumericField(source: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return undefined;
}

export function extractFiveElements(sajuData: unknown): FiveElements {
  if (!sajuData || typeof sajuData !== "object") return DEFAULT_ELEMENTS;

  const source = sajuData as Record<string, unknown>;
  const five = (source.fiveElements ?? source.elements ?? source.ohang ?? source) as Record<string, unknown>;

  const extracted: FiveElements = {
    wood: getNumericField(five, ["wood", "목", "mok"]) ?? DEFAULT_ELEMENTS.wood,
    fire: getNumericField(five, ["fire", "화", "hwa"]) ?? DEFAULT_ELEMENTS.fire,
    earth: getNumericField(five, ["earth", "토", "to"]) ?? DEFAULT_ELEMENTS.earth,
    metal: getNumericField(five, ["metal", "금", "geum"]) ?? DEFAULT_ELEMENTS.metal,
    water: getNumericField(five, ["water", "수", "su"]) ?? DEFAULT_ELEMENTS.water,
  };

  return normalizeElements(extracted);
}

function dominantElement(elements: FiveElements): ElementKey {
  const entries = Object.entries(elements) as Array<[ElementKey, number]>;
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

function weakestElement(elements: FiveElements): ElementKey {
  const entries = Object.entries(elements) as Array<[ElementKey, number]>;
  entries.sort((a, b) => a[1] - b[1]);
  return entries[0][0];
}

function generatedBy(element: ElementKey): ElementKey {
  const found = (Object.keys(GENERATES) as ElementKey[]).find((key) => GENERATES[key] === element);
  return found ?? "earth";
}

function controlledBy(element: ElementKey): ElementKey {
  const found = (Object.keys(CONTROLS) as ElementKey[]).find((key) => CONTROLS[key] === element);
  return found ?? "earth";
}

function strengthLevelLabel(level: "strong" | "balanced" | "weak"): string {
  if (level === "strong") return "신강";
  if (level === "weak") return "신약";
  return "중화";
}

function formatElementList(elements: ElementKey[]): string {
  return elements.map((element) => elementLabel(element)).join(", ");
}

function pillarLabel(pillar: Exclude<PillarKey, "day">): string {
  switch (pillar) {
    case "year":
      return "연간";
    case "month":
      return "월간";
    case "hour":
      return "시간";
  }
}

function parseSeoulDateParts(date: Date): { year: number; month: number; day: number; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const value = parts.find((item) => item.type === type)?.value;
    return Number(value ?? "0");
  };

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
  };
}

function elementMixFromDay(gan: string, hideGan: string[]): FiveElements {
  const weights: Record<ElementKey, number> = {
    wood: 0,
    fire: 0,
    earth: 0,
    metal: 0,
    water: 0,
  };

  weights[elementFromStem(gan)] += 7;

  const hideWeights = hideGan.length <= 1 ? [3] : hideGan.length === 2 ? [2, 1] : [2, 1, 0.5];
  hideGan.forEach((item, index) => {
    weights[elementFromStem(item)] += hideWeights[index] ?? 0;
  });

  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
  if (total <= 0) return DEFAULT_ELEMENTS;

  return {
    wood: Math.round((weights.wood / total) * 100),
    fire: Math.round((weights.fire / total) * 100),
    earth: Math.round((weights.earth / total) * 100),
    metal: Math.round((weights.metal / total) * 100),
    water: Math.round((weights.water / total) * 100),
  };
}

function recommendedActionsByGrade(grade: DailyFortune["grade"], relation: "비겁" | "식상" | "재성" | "관성" | "인성"): string[] {
  if (grade === "대길") {
    return [
      "핵심 결정을 오전에 단호히 추진하시오.",
      `오늘은 ${relation} 기운이 도우니 중요한 제안을 먼저 꺼내시오.`,
      "문서/계약은 마감 전에 한 번 더 확인하시오.",
    ];
  }
  if (grade === "길") {
    return [
      "할 일을 세 갈래로 나누어 우선순위를 정하시오.",
      `금일 ${relation} 기운을 실무에 연결하면 성과가 따르리다.`,
      "오후에는 일정 여유를 두어 돌발 변수를 대비하시오.",
    ];
  }
  if (grade === "평") {
    return [
      "확장보다 유지에 집중하고 기본기를 다지시오.",
      "대화는 짧고 명확하게, 기록은 상세하게 남기시오.",
      "수면과 수분 보충으로 기운의 편차를 줄이시오.",
    ];
  }
  return [
    "충동 결정과 과한 금전 지출은 피하시오.",
    "중요한 답변은 한 템포 늦춰 검토 후 전하시오.",
    "저녁에는 일정 밀도를 낮추고 회복에 집중하시오.",
  ];
}

function uniqueKeywords(keywords: string[]): string[] {
  return Array.from(new Set(keywords)).slice(0, 4);
}

function buildKeywords(params: {
  grade: DailyFortune["grade"];
  relation: DailyFortune["analysis"]["todayRelation"];
  usefulElements: ElementKey[];
}): string[] {
  const gradeKeyword =
    params.grade === "대길" ? "확장" : params.grade === "길" ? "실행" : params.grade === "평" ? "점검" : "보수";
  const relationKeywordMap: Record<DailyFortune["analysis"]["todayRelation"], string> = {
    비겁: "협력",
    식상: "표현",
    재성: "수익",
    관성: "책임",
    인성: "회복",
  };

  return uniqueKeywords([
    gradeKeyword,
    relationKeywordMap[params.relation],
    ELEMENT_KEYWORD_MAP[params.usefulElements[0] ?? "earth"],
    ELEMENT_KEYWORD_MAP[params.usefulElements[1] ?? params.usefulElements[0] ?? "earth"],
  ]);
}

function summarizeCategory(score: number, label: string): string {
  if (score >= 80) return `${label} 흐름이 부드럽게 열리는 편입니다.`;
  if (score >= 65) return `${label}은 무난하게 밀고 가기 좋습니다.`;
  if (score >= 45) return `${label}은 유지 중심으로 보는 편이 안전합니다.`;
  return `${label}은 속도를 늦추고 보수적으로 접근하는 편이 낫습니다.`;
}

function buildCategoryScores(params: {
  score: number;
  relation: DailyFortune["analysis"]["todayRelation"];
  branchPenalty: number;
  dayMasterStrengthLevel: "strong" | "balanced" | "weak";
}): DailyFortune["categoryScores"] {
  const relationBias = {
    work: params.relation === "관성" || params.relation === "식상" ? 6 : params.relation === "재성" ? 3 : -1,
    money: params.relation === "재성" ? 7 : params.relation === "식상" ? 3 : params.relation === "비겁" ? -4 : 0,
    relationship: params.relation === "비겁" || params.relation === "인성" ? 6 : params.relation === "관성" ? -3 : 1,
    health: params.relation === "인성" ? 6 : params.relation === "관성" ? -3 : 1,
  };
  const strengthBias =
    params.dayMasterStrengthLevel === "weak" ? { work: -2, money: -1, relationship: 1, health: 4 } :
    params.dayMasterStrengthLevel === "strong" ? { work: 2, money: 1, relationship: -1, health: -1 } :
    { work: 0, money: 0, relationship: 0, health: 0 };

  const categories: Array<{ key: "work" | "money" | "relationship" | "health"; label: string; score: number }> = [
    { key: "work", label: "일과", score: clamp(params.score + relationBias.work + strengthBias.work - params.branchPenalty, 25, 95) },
    { key: "money", label: "재물", score: clamp(params.score + relationBias.money + strengthBias.money, 25, 95) },
    {
      key: "relationship",
      label: "관계",
      score: clamp(params.score + relationBias.relationship + strengthBias.relationship - Math.round(params.branchPenalty * 0.5), 25, 95),
    },
    { key: "health", label: "회복", score: clamp(params.score + relationBias.health + strengthBias.health - 2, 25, 95) },
  ];

  return categories.map((category) => ({
    ...category,
    summary: summarizeCategory(category.score, category.label),
  }));
}

function buildAvoidToday(params: {
  grade: DailyFortune["grade"];
  weakest: ElementKey;
  giShin: ElementKey;
  branchPenalty: number;
  relation: DailyFortune["analysis"]["todayRelation"];
}): string[] {
  const avoid = [
    `${ELEMENT_RISK_MAP[params.giShin]}은 오늘 특히 과해지기 쉽습니다.`,
    `${elementLabel(params.weakest)} 기운이 약하니 컨디션 관리 없는 무리수는 피하시오.`,
    params.relation === "관성"
      ? "압박을 이유로 답을 서두르지 마시오."
      : params.relation === "비겁"
        ? "주도권 다툼처럼 보이는 말투는 줄이시오."
        : params.relation === "재성"
          ? "성과 욕심으로 기준을 낮추는 선택은 피하시오."
          : params.relation === "식상"
            ? "하고 싶은 말을 한 번에 다 꺼내려 하지 마시오."
            : "익숙함에 기대어 일정 감각을 늦추지 마시오.",
  ];

  if (params.branchPenalty > 0) {
    avoid.push("사람 문제와 일정 문제를 한 번에 처리하려 들면 마찰이 커집니다.");
  }

  if (params.grade === "주의") {
    avoid.unshift("결론을 급히 내리기보다 한 번 더 미루는 편이 낫습니다.");
  }

  return avoid.slice(0, 3);
}

export function generateDailyFortune(params: {
  userId: string;
  birthDate: Date;
  birthTime?: string;
  calendarType?: CalendarType;
  sajuData: unknown;
  date?: Date;
}): DailyFortune {
  const today = params.date ?? new Date();

  let chartElements = extractFiveElements(params.sajuData);
  let dayMasterElement: ElementKey = "earth";
  let dayMasterLabel = "토(土)";
  let pillarSummary = "사주 정보 기반";
  let usedNoonFallback = false;
  let chart: TraditionalSajuChart | null = null;
  const calendarTypeInput = params.calendarType ?? "solar";
  let calendarTypeResolved: "solar" | "lunar" = calendarTypeInput === "lunar" ? "lunar" : "solar";

  const fallbackResource = generatedBy(dayMasterElement);
  const fallbackSupportScore = chartElements[dayMasterElement] + chartElements[fallbackResource];
  const fallbackDayMasterStrong = fallbackSupportScore >= 52;
  let usefulElements: ElementKey[] = fallbackDayMasterStrong
    ? [GENERATES[dayMasterElement], CONTROLS[dayMasterElement], controlledBy(dayMasterElement)]
    : [dayMasterElement, fallbackResource];
  let unfavorableElements: ElementKey[] = fallbackDayMasterStrong
    ? [dayMasterElement, fallbackResource]
    : [GENERATES[dayMasterElement], CONTROLS[dayMasterElement], controlledBy(dayMasterElement)];
  let strengthSummary = "저장된 오행 기준으로 기운의 흐름을 살폈소.";
  let seasonalSummary = "월령 판단은 단순화된 기준으로 반영했소.";
  let branchRelationSummary: string[] = [];
  let dominantTenGod = "비견";
  let dayMasterStrengthLevel: "strong" | "balanced" | "weak" = fallbackDayMasterStrong ? "strong" : "weak";
  let patternName = "보수적 추정";
  let patternSummary = "격국 후보는 명식을 다시 읽을 때 더 정확히 잡히오.";
  let patternTentative = true;
  let patternRevealLabel = "미투간";
  let patternCandidates: DailyFortune["analysis"]["patternCandidates"] = [];
  let yongShin = usefulElements[0] ?? dayMasterElement;
  let heeShin = usefulElements.slice(1, 3);
  let giShin = unfavorableElements[0] ?? dayMasterElement;
  let guShin = unfavorableElements.slice(1, 3);
  let balanceSummary = `용신은 ${elementLabel(yongShin)}으로 보고, 부담은 ${elementLabel(giShin)} 쪽으로 읽히오.`;

  try {
    chart = calculateTraditionalSajuChart({
      birthDate: params.birthDate,
      birthTime: params.birthTime,
      calendarType: calendarTypeInput,
    });
    chartElements = chart.fiveElements;
    dayMasterElement = chart.dayMaster.element;
    dayMasterLabel = chart.dayMaster.elementLabel;
    usedNoonFallback = chart.usedNoonFallback;
    calendarTypeResolved = chart.calendarTypeResolved;
    pillarSummary = `${chart.pillars.year.ganjiKorean}년 ${chart.pillars.month.ganjiKorean}월 ${chart.pillars.day.ganjiKorean}일 ${chart.pillars.hour.ganjiKorean}시`;
    usefulElements = chart.analysis.usefulElements;
    unfavorableElements = chart.analysis.unfavorableElements;
    strengthSummary = chart.analysis.dayMasterStrength.summary;
    seasonalSummary = chart.analysis.seasonalForce.summary;
    branchRelationSummary = chart.analysis.branchRelations.summary;
    dominantTenGod = chart.analysis.tenGods.dominant;
    dayMasterStrengthLevel = chart.analysis.dayMasterStrength.level;
    patternName = chart.analysis.pattern.name;
    patternSummary = chart.analysis.pattern.summary;
    patternTentative = chart.analysis.pattern.tentative;
    patternRevealLabel = chart.analysis.pattern.revealLabel;
    patternCandidates = chart.analysis.pattern.candidates.map((candidate) => ({
      stem: candidate.stem,
      stemKorean: candidate.stemKorean,
      tenGod: candidate.tenGod,
      weight: candidate.weight,
      revealed: candidate.revealed,
    }));
    yongShin = chart.analysis.balanceDirectives.yongShin;
    heeShin = chart.analysis.balanceDirectives.heeShin;
    giShin = chart.analysis.balanceDirectives.giShin;
    guShin = chart.analysis.balanceDirectives.guShin;
    balanceSummary = chart.analysis.balanceDirectives.summary;
  } catch {
    // 사주 계산 실패 시 기존 저장 오행으로 안전하게 폴백
  }

  const dominant = dominantElement(chartElements);
  const weakest = weakestElement(chartElements);
  const usefulNatalScore = usefulElements.reduce((sum, key) => sum + chartElements[key], 0);
  const unfavorableNatalScore = unfavorableElements.reduce((sum, key) => sum + chartElements[key], 0);

  const seoulNow = parseSeoulDateParts(today);
  const todayLunar = Solar.fromYmdHms(seoulNow.year, seoulNow.month, seoulNow.day, seoulNow.hour, seoulNow.minute, 0).getLunar();
  const todayEightChar = todayLunar.getEightChar();
  const todayDayGan = String(todayEightChar.getDayGan());
  const todayDayZhi = String(todayEightChar.getDayZhi());
  const todayHideGan = ((todayEightChar.getDayHideGan() as string[]) ?? []).map(String);
  const todayElements = elementMixFromDay(todayDayGan, todayHideGan);
  const usefulTodayScore = usefulElements.reduce((sum, key) => sum + todayElements[key], 0);
  const unfavorableTodayScore = unfavorableElements.reduce((sum, key) => sum + todayElements[key], 0);
  const todayGanji = `${todayDayGan}${todayDayZhi}`;

  const spread =
    Math.max(chartElements.wood, chartElements.fire, chartElements.earth, chartElements.metal, chartElements.water) -
    Math.min(chartElements.wood, chartElements.fire, chartElements.earth, chartElements.metal, chartElements.water);

  const relation = fivePhaseRelation(dayMasterElement, elementFromStem(todayDayGan));
  const relationBonus =
    relation === "인성" || relation === "비겁" ? 6 : relation === "식상" ? 4 : relation === "재성" ? 2 : -4;
  const branchPenalty =
    chart?.analysis.branchRelations.pairs.reduce((sum, pair) => sum + (pair.type === "충" ? 4 : pair.type === "형" ? 2 : -1), 0) ??
    0;
  const strengthBonus = chart ? Math.round(chart.analysis.dayMasterStrength.score * 0.18) : fallbackDayMasterStrong ? 3 : -3;

  const balanceBonus = clamp(28 - spread, -12, 18);
  const natalBonus = Math.round((usefulNatalScore - unfavorableNatalScore) * 0.18);
  const dailyBonus = Math.round((usefulTodayScore - unfavorableTodayScore) * 0.15);
  const score = clamp(58 + balanceBonus + natalBonus + dailyBonus + relationBonus + strengthBonus - branchPenalty, 5, 98);
  const grade = gradeFromScore(score);

  const headlineByGrade: Record<DailyFortune["grade"], string> = {
    대길: "명식과 일진의 결이 곱게 맞물려 큰 진전이 가능한 날이로다.",
    길: "사주의 중심이 안정되어 실천하면 성과가 쌓이는 날이로다.",
    평: "기운은 무난하나 과속을 삼가면 복이 보전되는 날이로다.",
    주의: "일진과 원국의 충돌이 있어 신중함이 필요한 날이로다.",
  };

  const summary = [
    `일주 주기운은 ${dayMasterLabel}이며, 원국은 ${pillarSummary}로 잡혔소.`,
    strengthSummary,
    `강한 오행은 ${elementLabel(dominant)}, 약한 오행은 ${elementLabel(weakest)}이니 균형을 우선하시오.`,
  ].join(" ");

  const detailLines = [
    seasonalSummary,
    `서울 기준 금일 일진은 ${todayDayGan}${todayDayZhi}이며, 일주 대비 ${relation}의 흐름이 감지되오.`,
    `주요 십신 흐름은 ${dominantTenGod}, 일간 세는 ${strengthLevelLabel(dayMasterStrengthLevel)} 쪽으로 읽히오.`,
    `${patternSummary} 용신은 ${elementLabel(yongShin)}으로 보오.`,
    branchRelationSummary.length > 0 ? branchRelationSummary.join(" ") : undefined,
    `점수는 ${score}점(${grade})으로, 길한 오행(${formatElementList(usefulElements)})과 부담 오행(${formatElementList(unfavorableElements)})의 차이를 함께 반영했소.`,
  ].filter((line): line is string => Boolean(line));
  const detail = detailLines.join(" ");

  const caution =
    grade === "주의"
      ? `오늘은 ${elementLabel(weakest)} 보완과 일정 충돌 관리가 급하니 중요한 결정을 밤늦게 미루지 마시오.`
      : `금일은 ${elementLabel(weakest)} 보완(휴식, 수분, 호흡 정리)을 지키고 ${formatElementList(usefulElements.slice(0, 2))} 방향의 실무를 살리면 흐름이 더 고르게 펴지리다.`;

  const recommendedActions = recommendedActionsByGrade(grade, relation);
  if (dayMasterStrengthLevel === "weak") {
    recommendedActions.push(`${formatElementList(usefulElements.slice(0, 2))} 기운을 돕는 정리와 보충에 먼저 힘쓰시오.`);
  } else if (dayMasterStrengthLevel === "strong") {
    recommendedActions.push(`${formatElementList(usefulElements.slice(0, 2))} 쪽 실행으로 기운을 풀어내면 답답함이 줄어드오.`);
  }
  recommendedActions.push(`용신 ${elementLabel(yongShin)} 흐름을 먼저 살리고, 기신 ${elementLabel(giShin)} 편중은 줄이시오.`);
  if (branchPenalty > 0) {
    recommendedActions.push("사람과 일정 사이의 충돌을 미리 조율해 형충의 마찰을 줄이시오.");
  }

  if (usedNoonFallback && grade !== "주의") {
    recommendedActions.push("출생 시간이 미상이라 시주를 정오 기준으로 잡았으니, 가능하면 출생시를 보완하시오.");
  }

  const keywords = buildKeywords({
    grade,
    relation,
    usefulElements,
  });
  const categoryScores = buildCategoryScores({
    score,
    relation,
    branchPenalty,
    dayMasterStrengthLevel,
  });
  const avoidToday = buildAvoidToday({
    grade,
    weakest,
    giShin,
    branchPenalty,
    relation,
  });
  const luckyHints = ELEMENT_LUCK_MAP[yongShin];

  return {
    score,
    grade,
    headline: headlineByGrade[grade],
    summary,
    detail,
    caution,
    recommendedActions,
    keywords,
    categoryScores,
    avoidToday,
    luckyHints,
    elements: chartElements,
    manse: chart
      ? {
          solarDateTime: chart.solarDateTime,
          lunarDateKorean: chart.lunarDateKorean,
          calendarTypeResolved,
          usedNoonFallback,
          pillars: (["year", "month", "day", "hour"] as PillarKey[]).map((pillarKey) => {
            const pillar = chart!.pillars[pillarKey];
            const naYin =
              pillarKey === "year"
                ? chart!.auxiliary.naYin.year
                : pillarKey === "month"
                  ? chart!.auxiliary.naYin.month
                  : pillarKey === "day"
                    ? chart!.auxiliary.naYin.day
                    : chart!.auxiliary.naYin.hour;

            return {
              key: pillarKey,
              label:
                pillarKey === "year"
                  ? "연주"
                  : pillarKey === "month"
                    ? "월주"
                    : pillarKey === "day"
                      ? "일주"
                      : "시주",
              ganji: pillar.ganji,
              ganjiKorean: pillar.ganjiKorean,
              stem: pillar.stem,
              stemKorean: pillar.stemKorean,
              branch: pillar.branch,
              branchKorean: pillar.branchKorean,
              hiddenStems: pillar.hiddenStems,
              hiddenStemsKorean: pillar.hiddenStemsKorean,
              naYin,
            };
          }),
        }
      : null,
    analysis: chart
      ? {
          strengthLevel: dayMasterStrengthLevel,
          strengthScore: chart.analysis.dayMasterStrength.score,
          strengthSummary,
          seasonalSummary,
          dominantTenGod,
          patternName,
          patternSummary,
          patternTentative,
          patternRevealLabel,
          patternCandidates,
          yongShin,
          heeShin,
          giShin,
          guShin,
          balanceSummary,
          usefulElements,
          unfavorableElements,
          todayGanji,
          todayRelation: relation,
          usedNoonFallback,
          calendarTypeInput,
          calendarTypeResolved,
          rootCount: chart.analysis.dayMasterStrength.roots.length,
          branchRelations: chart.analysis.branchRelations.pairs.map((pair) => ({
            pillars: pair.pillars,
            label: pair.label,
            type: pair.type,
            description: pair.description,
          })),
          visibleTenGods: (Object.entries(chart.analysis.tenGods.stems) as Array<
            [Exclude<PillarKey, "day">, (typeof chart.analysis.tenGods.stems)[keyof typeof chart.analysis.tenGods.stems]]
          >).map(([pillar, info]) => ({
            pillar,
            pillarLabel: pillarLabel(pillar),
            stem: info.stem,
            stemKorean: info.stemKorean,
            tenGod: info.tenGod,
          })),
        }
      : {
          strengthLevel: dayMasterStrengthLevel,
          strengthScore: fallbackDayMasterStrong ? 8 : -8,
          strengthSummary,
          seasonalSummary,
          dominantTenGod,
          patternName,
          patternSummary,
          patternTentative,
          patternRevealLabel,
          patternCandidates,
          yongShin,
          heeShin,
          giShin,
          guShin,
          balanceSummary,
          usefulElements,
          unfavorableElements,
          todayGanji,
          todayRelation: relation,
          usedNoonFallback,
          calendarTypeInput,
          calendarTypeResolved,
          rootCount: 0,
          branchRelations: [],
          visibleTenGods: [],
        },
  };
}

export async function generateDailyFortuneWithNarrative(
  params: {
    userId: string;
    birthDate: Date;
    birthTime?: string;
    calendarType?: CalendarType;
    sajuData: unknown;
    date?: Date;
  } & {
    profileName?: string;
  },
): Promise<DailyFortune> {
  const baseFortune = generateDailyFortune(params);
  const override = await generateFortuneNarrativeOverride({
    fortune: baseFortune,
    profileName: params.profileName,
    birthDate: params.birthDate,
    birthTime: params.birthTime,
    date: params.date ?? new Date(),
  });

  if (!override) {
    return baseFortune;
  }

  return {
    ...baseFortune,
    ...override,
    caution: baseFortune.caution,
    avoidToday: baseFortune.avoidToday,
  };
}
