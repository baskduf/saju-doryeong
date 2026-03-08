export type FiveElements = {
  wood: number;
  fire: number;
  earth: number;
  metal: number;
  water: number;
};

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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) % 2147483647;
  }
  return hash;
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

function dominantElement(elements: FiveElements): keyof FiveElements {
  const entries = Object.entries(elements) as Array<[keyof FiveElements, number]>;
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

function weakestElement(elements: FiveElements): keyof FiveElements {
  const entries = Object.entries(elements) as Array<[keyof FiveElements, number]>;
  entries.sort((a, b) => a[1] - b[1]);
  return entries[0][0];
}

function elementLabel(element: keyof FiveElements): string {
  switch (element) {
    case "wood":
      return "목(木)";
    case "fire":
      return "화(火)";
    case "earth":
      return "토(土)";
    case "metal":
      return "금(金)";
    default:
      return "수(水)";
  }
}

function recommendedActionsByGrade(grade: DailyFortune["grade"]): string[] {
  if (grade === "대길") {
    return ["중요한 결정을 오전에 밀어붙이시오.", "귀인을 만날 수 있으니 약속을 미루지 마시오.", "감사의 한마디가 큰 복으로 돌아오리다."];
  }
  if (grade === "길") {
    return ["작은 목표를 세워 차근차근 이루시오.", "문서와 일정은 한 번 더 확인하시오.", "가벼운 산책으로 기운을 정리하시오."];
  }
  if (grade === "평") {
    return ["무리한 확장은 피하고 기본을 지키시오.", "마감 시간보다 조금 일찍 움직이시오.", "따뜻한 차 한 잔으로 마음을 가라앉히시오."];
  }
  return ["급한 투자와 충동구매는 삼가시오.", "말을 아끼고 기록을 남기시오.", "해가 지기 전 가벼운 스트레칭으로 탁한 기운을 푸시오."];
}

export function generateDailyFortune(params: {
  userId: string;
  birthDate: Date;
  sajuData: unknown;
  date?: Date;
}): DailyFortune {
  const today = params.date ?? new Date();
  const dayKey = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
  const elements = extractFiveElements(params.sajuData);

  const dominant = dominantElement(elements);
  const weakest = weakestElement(elements);
  const spread =
    Math.max(elements.wood, elements.fire, elements.earth, elements.metal, elements.water) -
    Math.min(elements.wood, elements.fire, elements.earth, elements.metal, elements.water);

  const seed = hashString(`${params.userId}:${params.birthDate.toISOString()}:${dayKey}`);
  const base = (seed % 61) + 20;
  const balanceBonus = clamp(22 - spread, -10, 15);
  const score = clamp(base + balanceBonus, 5, 98);
  const grade = gradeFromScore(score);

  const headlineByGrade: Record<DailyFortune["grade"], string> = {
    대길: "오늘은 하늘의 문이 크게 열리는 날이로다.",
    길: "기운이 순하게 흐르니, 행하면 성취가 따르리다.",
    평: "무난하되 방심은 금물, 꾸준함이 복을 부르리다.",
    주의: "기운이 다소 거칠어 조심성이 곧 방패가 되리다.",
  };

  const summary = `주된 기운은 ${elementLabel(dominant)}, 약한 기운은 ${elementLabel(weakest)}이니 균형을 의식하시오.`;
  const detail = `도령이 보건대 금일 운세 점수는 ${score}점, "${grade}"의 흐름이오. 말 한마디와 걸음 하나를 가다듬으면 흉도 길로 바뀌리다.`;
  const caution =
    grade === "주의"
      ? `특히 ${elementLabel(weakest)} 기운이 약하니 늦은 밤의 결정은 피하시오.`
      : `다만 ${elementLabel(weakest)} 기운을 보완하려면 수분 섭취와 휴식을 잊지 마시오.`;

  return {
    score,
    grade,
    headline: headlineByGrade[grade],
    summary,
    detail,
    caution,
    recommendedActions: recommendedActionsByGrade(grade),
    elements,
  };
}
