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

export type TraditionalSajuChart = {
  source: "traditional-lunar-javascript-v1";
  calendarTypeInput: CalendarType;
  calendarTypeResolved: "solar" | "lunar";
  birthDateInput: string;
  birthTimeInput: string | null;
  solarDateTime: string;
  lunarDate: string;
  lunarDateKorean: string;
  usedNoonFallback: boolean;
  pillars: {
    year: PillarInfo;
    month: PillarInfo;
    day: PillarInfo;
    hour: PillarInfo;
  };
  dayMaster: {
    stem: string;
    stemKorean: string;
    element: ElementKey;
    elementLabel: string;
  };
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
  };
  fiveElements: FiveElements;
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

const ELEMENT_LABEL: Record<ElementKey, string> = {
  wood: "목(木)",
  fire: "화(火)",
  earth: "토(土)",
  metal: "금(金)",
  water: "수(水)",
};

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

  const resolvedCalendarType: "solar" | "lunar" = params.calendarType === "lunar" ? "lunar" : "solar";

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

  const chart: TraditionalSajuChart = {
    source: "traditional-lunar-javascript-v1",
    calendarTypeInput: params.calendarType,
    calendarTypeResolved: resolvedCalendarType,
    birthDateInput,
    birthTimeInput: params.birthTime ?? null,
    solarDateTime: String(solar.toYmdHms()),
    lunarDate: String(lunar.toString()),
    lunarDateKorean: toLunarDateKorean(String(lunar.toString())),
    usedNoonFallback,
    pillars: {
      year: buildPillar(yearGanji, ((eightChar.getYearHideGan() as string[]) ?? []).map(String)),
      month: buildPillar(monthGanji, ((eightChar.getMonthHideGan() as string[]) ?? []).map(String)),
      day: buildPillar(dayGanji, ((eightChar.getDayHideGan() as string[]) ?? []).map(String)),
      hour: buildPillar(timeGanji, ((eightChar.getTimeHideGan() as string[]) ?? []).map(String)),
    },
    dayMaster: {
      stem: String(eightChar.getDayGan()),
      stemKorean: STEM_KOREAN[String(eightChar.getDayGan())] ?? String(eightChar.getDayGan()),
      element: elementFromStem(String(eightChar.getDayGan())),
      elementLabel: elementLabel(elementFromStem(String(eightChar.getDayGan()))),
    },
    auxiliary: {
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
    },
    fiveElements: computeFiveElementsFromEightChar(eightChar),
  };

  return chart;
}
