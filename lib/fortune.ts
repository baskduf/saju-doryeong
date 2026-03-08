import { Solar } from "lunar-javascript";
import {
  calculateTraditionalSajuChart,
  elementFromStem,
  elementLabel,
  type CalendarType,
  type ElementKey,
  type FiveElements,
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
  elements: FiveElements;
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

function relationFromDayMaster(dayMaster: ElementKey, other: ElementKey): "비겁" | "식상" | "재성" | "관성" | "인성" {
  if (other === dayMaster) return "비겁";
  if (GENERATES[dayMaster] === other) return "식상";
  if (CONTROLS[dayMaster] === other) return "재성";
  if (CONTROLS[other] === dayMaster) return "관성";
  return "인성";
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

  try {
    const chart = calculateTraditionalSajuChart({
      birthDate: params.birthDate,
      birthTime: params.birthTime,
      calendarType: params.calendarType ?? "solar",
    });
    chartElements = chart.fiveElements;
    dayMasterElement = chart.dayMaster.element;
    dayMasterLabel = chart.dayMaster.elementLabel;
    usedNoonFallback = chart.usedNoonFallback;
    pillarSummary = `${chart.pillars.year.ganjiKorean}년 ${chart.pillars.month.ganjiKorean}월 ${chart.pillars.day.ganjiKorean}일 ${chart.pillars.hour.ganjiKorean}시`;
  } catch {
    // 사주 계산 실패 시 기존 저장 오행으로 안전하게 폴백
  }

  const dominant = dominantElement(chartElements);
  const weakest = weakestElement(chartElements);

  const resource = generatedBy(dayMasterElement);
  const output = GENERATES[dayMasterElement];
  const wealth = CONTROLS[dayMasterElement];
  const officer = controlledBy(dayMasterElement);

  const supportScore = chartElements[dayMasterElement] + chartElements[resource];
  const dayMasterStrong = supportScore >= 52;
  const favorableElements: ElementKey[] = dayMasterStrong ? [output, wealth, officer] : [dayMasterElement, resource];

  const favorableNatalScore = favorableElements.reduce((sum, key) => sum + chartElements[key], 0);

  const seoulNow = parseSeoulDateParts(today);
  const todayLunar = Solar.fromYmdHms(seoulNow.year, seoulNow.month, seoulNow.day, seoulNow.hour, seoulNow.minute, 0).getLunar();
  const todayEightChar = todayLunar.getEightChar();
  const todayDayGan = String(todayEightChar.getDayGan());
  const todayDayZhi = String(todayEightChar.getDayZhi());
  const todayHideGan = ((todayEightChar.getDayHideGan() as string[]) ?? []).map(String);
  const todayElements = elementMixFromDay(todayDayGan, todayHideGan);
  const favorableTodayScore = favorableElements.reduce((sum, key) => sum + todayElements[key], 0);

  const spread =
    Math.max(chartElements.wood, chartElements.fire, chartElements.earth, chartElements.metal, chartElements.water) -
    Math.min(chartElements.wood, chartElements.fire, chartElements.earth, chartElements.metal, chartElements.water);

  const relation = relationFromDayMaster(dayMasterElement, elementFromStem(todayDayGan));
  const relationBonus =
    relation === "인성" || relation === "비겁" ? 7 : relation === "식상" ? 4 : relation === "재성" ? 2 : -3;

  const balanceBonus = clamp(28 - spread, -12, 18);
  const natalBonus = Math.round((favorableNatalScore - 50) * 0.2);
  const dailyBonus = Math.round((favorableTodayScore - 45) * 0.3);
  const score = clamp(56 + balanceBonus + natalBonus + dailyBonus + relationBonus, 5, 98);
  const grade = gradeFromScore(score);

  const headlineByGrade: Record<DailyFortune["grade"], string> = {
    대길: "명식과 일진의 결이 곱게 맞물려 큰 진전이 가능한 날이로다.",
    길: "사주의 중심이 안정되어 실천하면 성과가 쌓이는 날이로다.",
    평: "기운은 무난하나 과속을 삼가면 복이 보전되는 날이로다.",
    주의: "일진과 원국의 충돌이 있어 신중함이 필요한 날이로다.",
  };

  const summary = [
    `일주 주기운은 ${dayMasterLabel}이며, 원국은 ${pillarSummary}로 잡혔소.`,
    `강한 오행은 ${elementLabel(dominant)}, 약한 오행은 ${elementLabel(weakest)}이니 균형을 우선하시오.`,
  ].join(" ");

  const detail = [
    `서울 기준 금일 일진은 ${todayDayGan}${todayDayZhi}이며, 일주 대비 ${relation}의 흐름이 감지되오.`,
    `점수는 ${score}점(${grade})으로, 길한 오행 비중(원국 ${favorableNatalScore}%, 일진 ${favorableTodayScore}%)을 반영했소.`,
  ].join(" ");

  const caution =
    grade === "주의"
      ? `오늘은 ${elementLabel(weakest)} 보완이 급하니 중요한 결정을 밤늦게 미루지 마시오.`
      : `금일은 ${elementLabel(weakest)} 보완(휴식, 수분, 호흡 정리)을 지키면 흐름이 더 고르게 펴지리다.`;

  const recommendedActions = recommendedActionsByGrade(grade, relation);

  if (usedNoonFallback && grade !== "주의") {
    recommendedActions.push("출생 시간이 미상이라 시주를 정오 기준으로 잡았으니, 가능하면 출생시를 보완하시오.");
  }

  return {
    score,
    grade,
    headline: headlineByGrade[grade],
    summary,
    detail,
    caution,
    recommendedActions,
    elements: chartElements,
  };
}
