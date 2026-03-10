import { Solar } from "lunar-javascript";
import { generateFortuneNarrativeOverride } from "./fortune-llm";
import {
  calculateTraditionalSajuChart,
  detectTodayBranchInteractions,
  elementFromStem,
  elementLabel,
  fivePhaseRelation,
  type ChartCertainty,
  type CalendarType,
  type ElementKey,
  type FiveElements,
  type PillarKey,
  type TodayBranchInteraction,
  type TraditionalSajuChart,
} from "./saju";
import { getSeoulDateTimeParts } from "./seoul-time";

export type { FiveElements } from "./saju";

export type ReferenceMode = "none" | "solar-lunar-blend";

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
    certainty: ChartCertainty;
    referenceMode: ReferenceMode;
    uncertaintyMessage: string | null;
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
    directiveDelta: number;
    directiveSummary: string;
    yongShinReason: string;
    giShinReason: string;
    relationStrengthSummary: string;
    relationStrengthDetail: string;
    relationStrengthCaution: string;
    relationStrengthAction: string;
    relationStrengthAvoid: string;
    usefulElements: ElementKey[];
    unfavorableElements: ElementKey[];
    todayGanji: string;
    todayRelation: "비겁" | "식상" | "재성" | "관성" | "인성" | "unknown";
    todayBranchImpact: number;
    todayBranchSummary: string;
    todayBranchInteractions: Array<{
      pillar: PillarKey;
      pillarLabel: string;
      branch: string;
      branchKorean: string;
      type: TodayBranchInteraction["type"];
      weight: number;
      description: string;
    }>;
    usedNoonFallback: boolean;
    calendarTypeInput: CalendarType;
    calendarTypeResolved: CalendarType;
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

const ELEMENT_SUPPORT_ACTION_MAP: Record<ElementKey, string> = {
  wood: "계획을 세우고 순서를 다듬는 일부터 잡으시오.",
  fire: "먼저 연락하거나 추진력을 살리는 움직임을 택하시오.",
  earth: "기준을 정리하고 익숙한 루틴을 안정시키시오.",
  metal: "정리와 정돈, 기준을 분명히 하는 실무를 살리시오.",
  water: "경청과 여유를 두고 유연하게 조율하는 편이 좋소.",
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

const UNKNOWN_REFERENCE_UNCERTAINTY_MESSAGE =
  "달력 기준이 확정되지 않아 양력·음력 두 가능성을 함께 살핀 참고 운세이오. 정확한 만세력과 격국은 양력이나 음력을 정한 뒤 다시 보아야 하오.";
const UNKNOWN_REFERENCE_PATTERN_NAME = "양·음력 공통 흐름";
const UNKNOWN_REFERENCE_PATTERN_SUMMARY =
  "양력과 음력 두 가능성에서 공통으로 겹치는 흐름만 추려 참고용으로 풀었소. 정확한 격국과 만세력은 달력 기준을 정한 뒤 다시 읽어야 하오.";
const UNKNOWN_REFERENCE_PATTERN_REVEAL_LABEL = "양·음력 공통 참고";

type TodayRelation = DailyFortune["analysis"]["todayRelation"];
type StrengthLevel = DailyFortune["analysis"]["strengthLevel"];
type CategoryKey = DailyFortune["categoryScores"][number]["key"];

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
  const keys: ElementKey[] = ["wood", "fire", "earth", "metal", "water"];
  const total = keys.reduce((sum, key) => sum + elements[key], 0);
  if (total <= 0) return DEFAULT_ELEMENTS;

  const scaled = keys.map((key) => ({ key, value: (elements[key] / total) * 100 }));
  const floored = scaled.map((item) => ({ ...item, floor: Math.floor(item.value) }));
  let remainder = 100 - floored.reduce((sum, item) => sum + item.floor, 0);

  floored
    .sort((left, right) => right.value - right.floor - (left.value - left.floor))
    .forEach((item) => {
      if (remainder <= 0) {
        return;
      }
      item.floor += 1;
      remainder -= 1;
    });

  const result = {
    wood: 0,
    fire: 0,
    earth: 0,
    metal: 0,
    water: 0,
  } satisfies FiveElements;

  floored.forEach((item) => {
    result[item.key] = item.floor;
  });

  return result;
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
  return getSeoulDateTimeParts(date);
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

function recommendedActionsByGrade(
  grade: DailyFortune["grade"],
  relation: DailyFortune["analysis"]["todayRelation"],
): string[] {
  const relationLabel = relation === "unknown" ? "참고용" : relation;
  if (grade === "대길") {
    return [
      "핵심 결정을 오전에 단호히 추진하시오.",
      `오늘은 ${relationLabel} 기운이 도우니 중요한 제안을 먼저 꺼내시오.`,
      "문서/계약은 마감 전에 한 번 더 확인하시오.",
    ];
  }
  if (grade === "길") {
    return [
      "할 일을 세 갈래로 나누어 우선순위를 정하시오.",
      `금일 ${relationLabel} 기운을 실무에 연결하면 성과가 따르리다.`,
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

function buildStrengthAwareRelationGuide(params: {
  relation: DailyFortune["analysis"]["todayRelation"];
  strengthLevel: DailyFortune["analysis"]["strengthLevel"];
}): {
  summary: string;
  detail: string;
  caution: string;
  action: string;
  avoid: string;
} {
  switch (params.relation) {
    case "unknown":
      return {
        summary: "달력 기준이 미확정이라 오늘 일진과 원국의 정밀 맞물림은 참고용으로만 읽어야 하오.",
        detail: "양력과 음력 중 어느 기준인지 정해지지 않아 정밀한 만세력과 일진 작용은 확정하지 않고, 저장된 기본 기운을 바탕으로만 흐름을 풀이했소.",
        caution: "달력 기준이 모호한 날에는 결과를 확정 판단처럼 밀어붙이지 말고 중요한 결정은 한 번 더 확인하시오.",
        action: "양력이나 음력 기준을 다시 정하고, 그 전까지는 오늘 운세를 참고용 조언으로만 쓰시오.",
        avoid: "모름 상태의 운세를 확정 결과처럼 믿고 큰 결정에 바로 쓰지 마시오.",
      };
    case "비겁":
      if (params.strengthLevel === "strong") {
        return {
          summary: "비겁이 들어와 기세는 서나, 신강 명식에는 경쟁심과 고집이 먼저 올라오기 쉬운 날이오.",
          detail: "같은 편을 모을 힘은 있으되 주도권을 쥐려는 마음이 과해지면 말과 태도가 거칠어질 수 있소.",
          caution: "비겁 기운이 강한 쪽으로 실리니 의견 싸움과 힘겨루기를 먼저 경계하시오.",
          action: "혼자 밀어붙이기보다 역할을 나누고 주도권은 한 번씩 나눠 가지시오.",
          avoid: "맞서는 말투와 주도권 다툼을 키우지 마시오.",
        };
      }
      if (params.strengthLevel === "weak") {
        return {
          summary: "비겁이 들어와 신약 명식의 기운을 북돋우니 사람을 붙잡는 쪽이 유리한 날이오.",
          detail: "혼자 버티기보다 손을 빌리면 힘이 붙고 마음도 가벼워질 수 있소.",
          caution: "괜한 체면으로 도움을 미루면 되레 기세가 더 꺼질 수 있으니 고집을 세우지 마시오.",
          action: "도움 받을 일은 일찍 말하고, 함께할 사람을 먼저 정하시오.",
          avoid: "혼자 다 감당하려는 버티기를 오래 끌지 마시오.",
        };
      }
      return {
        summary: "비겁이 들어와 사람과 속도를 맞추면 힘을 얻는 날이오.",
        detail: "동료나 가까운 이와 보조를 맞추면 흐름이 매끈해지되, 경계선은 분명히 두는 편이 좋소.",
        caution: "도움을 받더라도 선을 흐리면 소모가 생기니 부탁과 책임은 분명히 나누시오.",
        action: "함께 움직일 일은 짝을 세우고, 내 몫과 상대 몫을 나눠 정하시오.",
        avoid: "의리만 믿고 경계 없는 약속을 늘리지 마시오.",
      };
    case "식상":
      if (params.strengthLevel === "strong") {
        return {
          summary: "식상이 와서 신강 명식의 막힌 기운을 잘 풀어내는 날이오.",
          detail: "말과 실행이 앞으로 나가니 발표, 정리, 전달, 창의 쪽에서 손이 빨라질 수 있소.",
          caution: "기세가 좋다고 말을 너무 앞세우면 빈틈이 드러날 수 있으니 핵심만 또렷이 하시오.",
          action: "쌓인 일은 표현과 실행으로 풀고, 말해야 할 건 오늘 먼저 꺼내시오.",
          avoid: "과한 말과 즉흥적인 약속으로 흐름을 흩뜨리지 마시오.",
        };
      }
      if (params.strengthLevel === "weak") {
        return {
          summary: "식상이 와도 신약 명식에는 기운이 쉽게 새니 무리한 발산은 줄이는 편이 낫소.",
          detail: "표현과 실행은 필요하나, 오늘은 에너지 관리가 먼저라 서두르면 금세 지칠 수 있소.",
          caution: "보여주기 위한 과한 말과 무리한 일정은 체력만 깎기 쉬우니 양을 줄이시오.",
          action: "전달과 실행은 짧고 선명하게 끝내고, 남는 힘은 아끼시오.",
          avoid: "끝없이 설명하거나 일을 여러 갈래로 뻗치지 마시오.",
        };
      }
      return {
        summary: "식상이 드니 표현과 정리가 무난하게 풀리는 날이오.",
        detail: "말을 줄여 핵심만 꺼내면 흐름이 고르게 이어지고, 손대지 못한 일을 정리하기 좋소.",
        caution: "생각나는 대로 벌리면 흐름이 흩어지니 한 갈래씩 마무리하시오.",
        action: "말, 문서, 정리 중 하나를 골라 끝을 보시오.",
        avoid: "여러 일을 한꺼번에 벌여 집중을 흩뜨리지 마시오.",
      };
    case "재성":
      if (params.strengthLevel === "strong") {
        return {
          summary: "재성이 와도 신강 명식에는 감당할 힘이 있으니 기회를 골라 잡기 좋은 날이오.",
          detail: "돈과 성과의 흐름이 움직이되 계산이 선다면 실제 실속으로 붙일 여지가 크오.",
          caution: "이익이 보인다고 한 번에 크게 움직이면 관리가 거칠어질 수 있으니 크기를 조절하시오.",
          action: "작게 회수할 수 있는 일부터 순서대로 챙기시오.",
          avoid: "욕심이 앞서 큰 결제나 무리한 확장을 먼저 누르지 마시오.",
        };
      }
      if (params.strengthLevel === "weak") {
        return {
          summary: "재성이 와도 신약 명식에는 감당할 부담이 먼저 얹히니 지출과 책임을 줄이는 편이 낫소.",
          detail: "돈과 일거리가 동시에 오더라도 오늘은 받아낼 양보다 버틸 양을 먼저 재는 것이 맞소.",
          caution: "괜한 지출과 무리한 약속은 기운을 더 빼가니 손을 짧게 쓰시오.",
          action: "써야 할 것과 미뤄도 될 것을 갈라 보수적으로 움직이시오.",
          avoid: "지갑을 넓게 열거나 일을 욕심껏 더 얹지 마시오.",
        };
      }
      return {
        summary: "재성이 드니 실속과 수지 계산이 중요한 날이오.",
        detail: "들어오고 나가는 흐름을 같이 봐야 손에 남는 날이 되니, 선택과 기준이 중요하오.",
        caution: "이득만 보고 들어가면 뒤 정리가 남으니 조건을 끝까지 확인하시오.",
        action: "돈, 계약, 선택은 남는 몫이 무엇인지부터 따져 보시오.",
        avoid: "기분 따라 지출하거나 당장 이익만 보고 움직이지 마시오.",
      };
    case "관성":
      if (params.strengthLevel === "strong") {
        return {
          summary: "관성이 와도 신강 명식에는 틀을 세우고 책임을 잡아 쓸 힘이 있소.",
          detail: "규칙과 마감, 책임이 오히려 중심을 잡아 주니 흐트러진 일을 정돈하기 좋소.",
          caution: "통제하려는 마음이 앞서면 사람을 압박하기 쉬우니 강약을 조절하시오.",
          action: "미뤄둔 기준과 마감부터 세우고, 책임의 순서를 정하시오.",
          avoid: "옳고 그름을 앞세워 사람을 몰아붙이지 마시오.",
        };
      }
      if (params.strengthLevel === "weak") {
        return {
          summary: "관성이 와도 신약 명식에는 압박이 크게 얹힐 수 있으니 범위를 좁히는 편이 낫소.",
          detail: "책임과 요구가 몰리면 쉽게 눌릴 수 있으니 오늘은 할 수 있는 만큼만 받는 것이 맞소.",
          caution: "무리하게 다 받아내려 하면 기세가 꺾이니 거절과 보류를 분명히 하시오.",
          action: "내가 감당할 수 있는 선을 먼저 정하고, 범위 밖 일은 미루시오.",
          avoid: "죄송한 마음에 책임을 과하게 끌어안지 마시오.",
        };
      }
      return {
        summary: "관성이 드니 기준과 책임을 따라가는 쪽이 무난한 날이오.",
        detail: "급히 새 길을 내기보다 정해진 순서와 약속을 지키면 손실을 줄일 수 있소.",
        caution: "압박을 정면으로 맞받기보다 준비와 확인으로 버티시오.",
        action: "해야 할 순서를 먼저 적고, 급한 것부터 조용히 처리하시오.",
        avoid: "검토 없이 서둘러 답하거나 약속을 가볍게 넘기지 마시오.",
      };
    case "인성":
      if (params.strengthLevel === "strong") {
        return {
          summary: "인성이 와도 신강 명식에는 안으로만 머물면 기세가 눌릴 수 있소.",
          detail: "배움과 정리는 좋으나, 오늘은 생각만 쌓고 움직임이 늦어지지 않게 해야 하오.",
          caution: "안전한 것만 붙잡아 결정과 실행을 늦추지 마시오.",
          action: "정리와 보충을 짧게 끝내고, 바로 작은 실행으로 잇으시오.",
          avoid: "준비만 계속하며 움직일 때를 흘려보내지 마시오.",
        };
      }
      if (params.strengthLevel === "weak") {
        return {
          summary: "인성이 들어와 신약 명식에 숨을 붙여 주니 회복과 도움을 받기 좋은 날이오.",
          detail: "배움, 조언, 휴식, 보충이 실제 힘으로 이어질 수 있으니 오늘은 채우는 쪽이 맞소.",
          caution: "회복이 필요한 날이니 억지로 속도를 끌어올리지 마시오.",
          action: "몸과 마음을 채우는 일부터 하고, 부족한 부분은 도움을 구하시오.",
          avoid: "기운이 붙기 전에 무리해서 일부터 앞세우지 마시오.",
        };
      }
      return {
        summary: "인성이 드니 몸과 마음을 고르게 보충하기 좋은 날이오.",
        detail: "정리, 복습, 회복, 조언 듣기가 잘 맞으니 속도를 잠시 낮추면 흐름이 좋아지오.",
        caution: "쉬는 핑계로 중요한 일을 끝없이 미루지 마시오.",
        action: "쉬어야 할 곳과 챙겨야 할 곳을 나눠 차분히 보충하시오.",
        avoid: "기운을 회복한다며 하루 전체를 늘어지게 보내지 마시오.",
      };
  }
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
    unknown: "참고",
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
  directiveDelta: number;
  branchPenalty: number;
  relationAvoid: string;
}): string[] {
  const avoid = [
    params.directiveDelta <= -3
      ? `오늘은 기신 ${elementLabel(params.giShin)} 흐름이 세지기 쉬우니 ${ELEMENT_RISK_MAP[params.giShin]}을 먼저 경계하시오.`
      : `${ELEMENT_RISK_MAP[params.giShin]}은 오늘 특히 과해지기 쉽습니다.`,
    `${elementLabel(params.weakest)} 기운이 약하니 컨디션 관리 없는 무리수는 피하시오.`,
    params.relationAvoid,
  ];

  if (params.branchPenalty > 0) {
    avoid.push("사람 문제와 일정 문제를 한 번에 처리하려 들면 마찰이 커집니다.");
  }

  if (params.grade === "주의") {
    avoid.unshift("결론을 급히 내리기보다 한 번 더 미루는 편이 낫습니다.");
  }

  return avoid.slice(0, 3);
}

function todayBranchInteractionPriority(pillar: PillarKey): number {
  switch (pillar) {
    case "day":
      return 0;
    case "month":
      return 1;
    case "hour":
      return 2;
    case "year":
      return 3;
  }
}

function sortTodayBranchInteractions(interactions: TodayBranchInteraction[]): TodayBranchInteraction[] {
  return [...interactions].sort((left, right) => {
    const pillarDiff = todayBranchInteractionPriority(left.pillar) - todayBranchInteractionPriority(right.pillar);
    if (pillarDiff !== 0) return pillarDiff;
    return Math.abs(right.weight) - Math.abs(left.weight);
  });
}

function buildTodayBranchSummary(interactions: TodayBranchInteraction[]): string {
  if (interactions.length === 0) {
    return "금일 일지는 원국 지지와 큰 합충형 없이 무난히 흐르오.";
  }

  const sorted = sortTodayBranchInteractions(interactions);
  const primary = sorted[0];
  const extraCount = sorted.length - 1;
  const extraPhrase = extraCount > 0 ? ` 이 밖에도 ${extraCount}건의 지지 작용이 더 감지되오.` : "";

  if (primary.type === "충") {
    return `${primary.description} ${primary.pillarLabel} 자리를 흔들 수 있으니 일정과 감정의 충돌을 먼저 다스리시오.${extraPhrase}`;
  }

  if (primary.type === "형") {
    return `${primary.description} 자책이나 압박이 쌓이기 쉬우니 서두르기보다 순서를 바로 세우는 편이 낫소.${extraPhrase}`;
  }

  return `${primary.description} ${primary.pillarLabel} 흐름이 부드럽게 이어질 수 있으니 만남과 협의를 차분히 이어 가시오.${extraPhrase}`;
}

type BlendedReferenceContext = {
  score: number;
  grade: DailyFortune["grade"];
  elements: FiveElements;
  categoryScores: DailyFortune["categoryScores"];
  strengthLevel: StrengthLevel;
  strengthScore: number;
  strengthSummary: string;
  seasonalSummary: string;
  dominantTenGod: string;
  patternName: string;
  patternSummary: string;
  patternTentative: boolean;
  patternRevealLabel: string;
  patternCandidates: DailyFortune["analysis"]["patternCandidates"];
  yongShin: ElementKey;
  heeShin: ElementKey[];
  giShin: ElementKey;
  guShin: ElementKey[];
  balanceSummary: string;
  directiveDelta: number;
  directiveSummary: string;
  yongShinReason: string;
  giShinReason: string;
  relationStrengthSummary: string;
  relationStrengthDetail: string;
  relationStrengthCaution: string;
  relationStrengthAction: string;
  relationStrengthAvoid: string;
  usefulElements: ElementKey[];
  unfavorableElements: ElementKey[];
  todayGanji: string;
  todayRelation: TodayRelation;
  todayBranchImpact: number;
  todayBranchSummary: string;
  todayBranchInteractions: DailyFortune["analysis"]["todayBranchInteractions"];
  usedNoonFallback: boolean;
  uncertaintyMessage: string;
  dominantElement: ElementKey;
  weakestElement: ElementKey;
};

function rankElementsByWeight(elements: FiveElements, direction: "asc" | "desc"): ElementKey[] {
  return (["wood", "fire", "earth", "metal", "water"] as ElementKey[]).sort((left, right) => {
    const diff = direction === "asc" ? elements[left] - elements[right] : elements[right] - elements[left];
    if (diff !== 0) {
      return diff;
    }

    return 0;
  });
}

function averageFiveElements(items: FiveElements[]): FiveElements {
  if (items.length === 0) {
    return DEFAULT_ELEMENTS;
  }

  return normalizeElements({
    wood: items.reduce((sum, item) => sum + item.wood, 0) / items.length,
    fire: items.reduce((sum, item) => sum + item.fire, 0) / items.length,
    earth: items.reduce((sum, item) => sum + item.earth, 0) / items.length,
    metal: items.reduce((sum, item) => sum + item.metal, 0) / items.length,
    water: items.reduce((sum, item) => sum + item.water, 0) / items.length,
  });
}

function averageCategoryScores(candidates: DailyFortune[]): DailyFortune["categoryScores"] {
  const order: CategoryKey[] = ["work", "money", "relationship", "health"];

  return order.map((key) => {
    const items = candidates
      .map((candidate) => candidate.categoryScores.find((entry) => entry.key === key))
      .filter((entry): entry is DailyFortune["categoryScores"][number] => Boolean(entry));
    const label =
      items[0]?.label ??
      (key === "work" ? "일과" : key === "money" ? "재물" : key === "relationship" ? "관계" : "회복");
    const score = clamp(Math.round(items.reduce((sum, item) => sum + item.score, 0) / Math.max(items.length, 1)), 25, 95);

    return {
      key,
      label,
      score,
      summary: summarizeCategory(score, label),
    };
  });
}

function uniqueOrderedStrings(items: Array<string | undefined | null>): string[] {
  return Array.from(new Set(items.filter((item): item is string => Boolean(item))));
}

function buildBlendedElementRanking(params: {
  candidates: DailyFortune[];
  averagedElements: FiveElements;
}): {
  usefulElements: ElementKey[];
  unfavorableElements: ElementKey[];
  yongShin: ElementKey;
  heeShin: ElementKey[];
  giShin: ElementKey;
  guShin: ElementKey[];
  balanceSummary: string;
  yongShinReason: string;
  giShinReason: string;
} {
  const weights: Record<ElementKey, number> = {
    wood: 0,
    fire: 0,
    earth: 0,
    metal: 0,
    water: 0,
  };
  const weakestRank = rankElementsByWeight(params.averagedElements, "asc");
  const strongestRank = rankElementsByWeight(params.averagedElements, "desc");

  params.candidates.forEach((candidate) => {
    weights[candidate.analysis.yongShin] += 4;
    candidate.analysis.heeShin.forEach((element) => {
      weights[element] += 2;
    });
    weights[candidate.analysis.giShin] -= 4;
    candidate.analysis.guShin.forEach((element) => {
      weights[element] -= 2;
    });
  });

  weights[weakestRank[0] ?? "earth"] += 1;
  weights[strongestRank[0] ?? "earth"] -= 1;

  const supportiveRanking = (["wood", "fire", "earth", "metal", "water"] as ElementKey[]).sort((left, right) => {
    const weightDiff = weights[right] - weights[left];
    if (weightDiff !== 0) {
      return weightDiff;
    }

    const scarcityDiff = params.averagedElements[left] - params.averagedElements[right];
    if (scarcityDiff !== 0) {
      return scarcityDiff;
    }

    return 0;
  });
  const burdenRanking = (["wood", "fire", "earth", "metal", "water"] as ElementKey[]).sort((left, right) => {
    const weightDiff = weights[left] - weights[right];
    if (weightDiff !== 0) {
      return weightDiff;
    }

    const abundanceDiff = params.averagedElements[right] - params.averagedElements[left];
    if (abundanceDiff !== 0) {
      return abundanceDiff;
    }

    return 0;
  });

  const usefulElements = supportiveRanking.filter((element) => weights[element] > 0).slice(0, 3);
  const unfavorableElements = burdenRanking.filter((element) => weights[element] < 0).slice(0, 3);
  const resolvedUsefulElements = usefulElements.length > 0 ? usefulElements : supportiveRanking.slice(0, 3);
  const resolvedUnfavorableElements =
    unfavorableElements.length > 0 ? unfavorableElements : burdenRanking.slice(0, 3);
  const yongShin = resolvedUsefulElements[0] ?? "earth";
  const heeShin = resolvedUsefulElements.slice(1, 3);
  const giShin = resolvedUnfavorableElements[0] ?? strongestRank[0] ?? "earth";
  const guShin = resolvedUnfavorableElements.slice(1, 3);
  const sameYongShin = params.candidates.every((candidate) => candidate.analysis.yongShin === yongShin);
  const sameGiShin = params.candidates.every((candidate) => candidate.analysis.giShin === giShin);

  return {
    usefulElements: resolvedUsefulElements,
    unfavorableElements: resolvedUnfavorableElements,
    yongShin,
    heeShin,
    giShin,
    guShin,
    balanceSummary: `양력·음력 두 가능성의 공통분모로는 ${elementLabel(yongShin)} 기운을 살리고 ${elementLabel(giShin)} 기운이 과해지지 않게 보는 편이 가장 안전하오.`,
    yongShinReason: sameYongShin
      ? `${elementLabel(yongShin)} 기운이 양력·음력 두 가능성에서 공통 보완 축으로 겹치오.`
      : `${elementLabel(yongShin)} 기운이 두 가능성의 공통분모를 가장 안정적으로 받쳐 주는 축으로 모이오.`,
    giShinReason: sameGiShin
      ? `${elementLabel(giShin)} 기운이 양력·음력 두 가능성에서 함께 부담으로 잡히니 참고로 경계하시오.`
      : `${elementLabel(giShin)} 기운은 두 가능성을 함께 보았을 때 과해지면 흐름을 거칠게 만들기 쉬운 축이오.`,
  };
}

function resolveBlendedStrengthLevel(candidates: DailyFortune[], averagedElements: FiveElements): StrengthLevel {
  const levels = uniqueOrderedStrings(candidates.map((candidate) => candidate.analysis.strengthLevel));
  if (levels.length === 1) {
    return levels[0] as StrengthLevel;
  }

  const spread =
    Math.max(averagedElements.wood, averagedElements.fire, averagedElements.earth, averagedElements.metal, averagedElements.water) -
    Math.min(averagedElements.wood, averagedElements.fire, averagedElements.earth, averagedElements.metal, averagedElements.water);
  const averageStrengthScore = Math.round(
    candidates.reduce((sum, candidate) => sum + candidate.analysis.strengthScore, 0) / candidates.length,
  );

  if (spread <= 12) {
    return "balanced";
  }
  if (averageStrengthScore >= 4) {
    return "strong";
  }
  if (averageStrengthScore <= -4) {
    return "weak";
  }

  return spread <= 18 ? "balanced" : averageStrengthScore >= 0 ? "strong" : "weak";
}

function buildBlendedReferenceRelationGuide(params: {
  relation: TodayRelation;
  strengthLevel: StrengthLevel;
  todayGanji: string;
}): {
  summary: string;
  detail: string;
  caution: string;
  action: string;
  avoid: string;
} {
  if (params.relation === "unknown") {
    return {
      summary: `금일 일진 ${params.todayGanji}은 잡히나 양력·음력 두 가능성의 일주 기준이 달라 공통 경향만 참고해야 하오.`,
      detail:
        "오늘 간지는 같지만 원국의 기준축이 갈릴 수 있어, 특정 관계 십신을 확정하지 않고 겹치는 조언만 남겨 참고용으로 풀었소.",
      caution: "달력 기준이 미정인 날에는 결과를 확정 판단처럼 밀어붙이지 말고 중요한 결정은 한 번 더 확인하시오.",
      action: "공통으로 겹치는 조언만 가볍게 반영하고, 큰 결정은 양력이나 음력을 정한 뒤 다시 보시오.",
      avoid: "참고용 풀이를 exact 만세력처럼 받아들이고 큰 결정을 바로 내리지 마시오.",
    };
  }

  const baseGuide = buildStrengthAwareRelationGuide({
    relation: params.relation,
    strengthLevel: params.strengthLevel,
  });

  return {
    summary: `금일 일진 ${params.todayGanji}은 양력·음력 두 가능성 모두 ${params.relation} 흐름으로 겹치오. ${baseGuide.summary}`,
    detail: `달력 기준은 미정이나 공통 관계 축은 ${params.relation}으로 겹치오. ${baseGuide.detail}`,
    caution: `참고용 풀이인 만큼 ${baseGuide.caution}`,
    action: baseGuide.action,
    avoid: baseGuide.avoid,
  };
}

function isExactFortuneCandidate(fortune: DailyFortune): boolean {
  return fortune.analysis.certainty === "exact" && fortune.analysis.referenceMode === "none";
}

function buildSolarLunarBlendContext(params: {
  userId: string;
  birthDate: Date;
  birthTime?: string;
  sajuData: unknown;
  date?: Date;
}): BlendedReferenceContext | null {
  const solarFortune = generateBaseDailyFortune({
    ...params,
    calendarType: "solar",
  });
  const lunarFortune = generateBaseDailyFortune({
    ...params,
    calendarType: "lunar",
  });

  if (!isExactFortuneCandidate(solarFortune) || !isExactFortuneCandidate(lunarFortune)) {
    return null;
  }

  const candidates = [solarFortune, lunarFortune];
  const elements = averageFiveElements(candidates.map((candidate) => candidate.elements));
  const score = clamp(Math.round(candidates.reduce((sum, candidate) => sum + candidate.score, 0) / candidates.length), 5, 98);
  const grade = gradeFromScore(score);
  const categoryScores = averageCategoryScores(candidates);
  const strengthLevel = resolveBlendedStrengthLevel(candidates, elements);
  const strengthScore = Math.round(
    candidates.reduce((sum, candidate) => sum + candidate.analysis.strengthScore, 0) / candidates.length,
  );
  const ranking = buildBlendedElementRanking({
    candidates,
    averagedElements: elements,
  });
  const todayGanji = solarFortune.analysis.todayGanji || lunarFortune.analysis.todayGanji || "미확정";
  const todayRelation =
    solarFortune.analysis.todayRelation === lunarFortune.analysis.todayRelation
      ? solarFortune.analysis.todayRelation
      : "unknown";
  const relationGuide = buildBlendedReferenceRelationGuide({
    relation: todayRelation,
    strengthLevel,
    todayGanji,
  });
  const usedNoonFallback = solarFortune.analysis.usedNoonFallback || lunarFortune.analysis.usedNoonFallback;
  const dominantElementKey = dominantElement(elements);
  const weakestElementKey = weakestElement(elements);
  const strengthSummary =
    solarFortune.analysis.strengthLevel === lunarFortune.analysis.strengthLevel
      ? `양력과 음력 두 가능성 모두 일간 세를 ${strengthLevelLabel(strengthLevel)} 쪽으로 가리키오.`
      : `양력과 음력의 강약 판단은 갈리나, 평균 오행 분포로 보면 ${strengthLevelLabel(strengthLevel)} 쪽 참고 흐름이 더 두드러지오.`;
  const directiveDelta = clamp(
    Math.round(
      candidates.reduce((sum, candidate) => sum + candidate.analysis.directiveDelta, 0) / candidates.length,
    ),
    -12,
    12,
  );
  const sharedYongShin = solarFortune.analysis.yongShin === lunarFortune.analysis.yongShin;
  const sharedGiShin = solarFortune.analysis.giShin === lunarFortune.analysis.giShin;
  const directiveSummary = sharedYongShin && sharedGiShin
    ? `양력·음력 두 가능성 모두 용신 ${elementLabel(ranking.yongShin)}을 살리고 기신 ${elementLabel(ranking.giShin)}은 눌러 두는 편이 좋소.`
    : `양력 기준에선 ${elementLabel(solarFortune.analysis.yongShin)}, 음력 기준에선 ${elementLabel(lunarFortune.analysis.yongShin)} 보완이 눈에 띄었고, 공통분모로는 ${elementLabel(ranking.yongShin)} 기운을 먼저 챙기는 편이 안전하오.`;
  const dominantTenGod =
    solarFortune.analysis.dominantTenGod === lunarFortune.analysis.dominantTenGod
      ? solarFortune.analysis.dominantTenGod
      : "혼합 흐름";

  return {
    score,
    grade,
    elements,
    categoryScores,
    strengthLevel,
    strengthScore,
    strengthSummary,
    seasonalSummary:
      "월령과 격국은 달력 기준에 따라 달라질 수 있어, 양력·음력 두 가능성에서 공통으로 겹치는 오행 균형만 참고용으로 반영했소.",
    dominantTenGod,
    patternName: UNKNOWN_REFERENCE_PATTERN_NAME,
    patternSummary: UNKNOWN_REFERENCE_PATTERN_SUMMARY,
    patternTentative: true,
    patternRevealLabel: UNKNOWN_REFERENCE_PATTERN_REVEAL_LABEL,
    patternCandidates: [],
    yongShin: ranking.yongShin,
    heeShin: ranking.heeShin,
    giShin: ranking.giShin,
    guShin: ranking.guShin,
    balanceSummary: ranking.balanceSummary,
    directiveDelta,
    directiveSummary,
    yongShinReason: ranking.yongShinReason,
    giShinReason: ranking.giShinReason,
    relationStrengthSummary: relationGuide.summary,
    relationStrengthDetail: relationGuide.detail,
    relationStrengthCaution: relationGuide.caution,
    relationStrengthAction: relationGuide.action,
    relationStrengthAvoid: relationGuide.avoid,
    usefulElements: ranking.usefulElements,
    unfavorableElements: ranking.unfavorableElements,
    todayGanji,
    todayRelation,
    todayBranchImpact: 0,
    todayBranchSummary:
      todayRelation === "unknown"
        ? `양력·음력 두 가능성을 함께 비교하는 참고 운세라 원국 지지의 합충형은 확정하지 않았소. 오늘 일진 ${todayGanji}의 공통 흐름만 가볍게 보시오.`
        : `오늘 일진 ${todayGanji}은 양력·음력 두 가능성 모두 ${todayRelation} 흐름으로 겹치오. 다만 원국 지지 상호작용은 달력 기준이 정해진 뒤 다시 보아야 하오.`,
    todayBranchInteractions: [],
    usedNoonFallback,
    uncertaintyMessage: UNKNOWN_REFERENCE_UNCERTAINTY_MESSAGE,
    dominantElement: dominantElementKey,
    weakestElement: weakestElementKey,
  };
}

function blendedReferenceHeadline(grade: DailyFortune["grade"]): string {
  if (grade === "대길") return "양력·음력 공통 흐름으로 보면 크게 밀어도 되는 날이로다.";
  if (grade === "길") return "양력·음력 공통 흐름으로 보면 실천이 성과로 이어지기 쉬운 날이로다.";
  if (grade === "평") return "양력·음력 공통 흐름으로 보면 무난하되 균형을 지키는 편이 나은 날이로다.";
  return "양력·음력 공통 흐름으로 보면 서두르지 말고 보수적으로 다루는 편이 나은 날이로다.";
}

function buildSolarLunarBlendedReferenceFortune(params: {
  userId: string;
  birthDate: Date;
  birthTime?: string;
  sajuData: unknown;
  date?: Date;
}): DailyFortune | null {
  const blended = buildSolarLunarBlendContext(params);
  if (!blended) {
    return null;
  }

  const headline = blendedReferenceHeadline(blended.grade);
  const summary = [
    blended.uncertaintyMessage,
    `양력·음력 두 가능성의 공통 경향을 겹쳐 보니 ${strengthLevelLabel(blended.strengthLevel)} 쪽 흐름이 두드러지오.`,
    blended.relationStrengthSummary,
    blended.directiveSummary,
    `강한 오행은 ${elementLabel(blended.dominantElement)}, 약한 오행은 ${elementLabel(blended.weakestElement)}이니 균형을 먼저 보시오.`,
  ].join(" ");
  const detail = [
    blended.uncertaintyMessage,
    blended.seasonalSummary,
    blended.strengthSummary,
    blended.relationStrengthDetail,
    `${blended.patternSummary} 용신은 ${elementLabel(blended.yongShin)} 쪽 공통분모로 보오.`,
    blended.yongShinReason,
    blended.giShinReason,
    blended.directiveSummary,
    `점수는 ${blended.score}점(${blended.grade})으로, 양력·음력 두 후보의 공통 경향과 평균치를 참고용으로 합성했소.`,
  ].join(" ");
  const caution = `${blended.uncertaintyMessage} ${blended.relationStrengthCaution}`;
  const recommendedActions = uniqueOrderedStrings([
    "양력이나 음력 기준을 정하면 더 정확한 만세력과 운세를 다시 읽을 수 있소.",
    blended.relationStrengthAction,
    `용신 ${elementLabel(blended.yongShin)}을 살리려면 ${ELEMENT_SUPPORT_ACTION_MAP[blended.yongShin]}`,
    ...recommendedActionsByGrade(blended.grade, blended.todayRelation),
    blended.directiveDelta <= -3
      ? `공통분모 기준 기신 ${elementLabel(blended.giShin)}이 과해질 수 있으니 ${ELEMENT_RISK_MAP[blended.giShin]}부터 줄이시오.`
      : undefined,
    blended.usedNoonFallback ? "출생 시간이 미상이라 시주를 정오 기준으로 잡았으니, 가능하면 출생시를 보완하시오." : undefined,
  ]);
  const avoidToday = buildAvoidToday({
    grade: blended.grade,
    weakest: blended.weakestElement,
    giShin: blended.giShin,
    directiveDelta: blended.directiveDelta,
    branchPenalty: 0,
    relationAvoid: blended.relationStrengthAvoid,
  });
  const trimmedAvoidToday = uniqueOrderedStrings([
    "양력·음력 기준이 확정되기 전까지는 참고용 풀이를 exact 만세력처럼 밀어붙이지 마시오.",
    ...avoidToday,
  ]).slice(0, 3);

  return {
    score: blended.score,
    grade: blended.grade,
    headline,
    summary,
    detail,
    caution,
    recommendedActions,
    keywords: buildKeywords({
      grade: blended.grade,
      relation: blended.todayRelation,
      usefulElements: blended.usefulElements,
    }),
    categoryScores: blended.categoryScores,
    avoidToday: trimmedAvoidToday,
    luckyHints: ELEMENT_LUCK_MAP[blended.yongShin],
    elements: blended.elements,
    manse: null,
    analysis: {
      certainty: "calendar-unknown",
      referenceMode: "solar-lunar-blend",
      uncertaintyMessage: blended.uncertaintyMessage,
      strengthLevel: blended.strengthLevel,
      strengthScore: blended.strengthScore,
      strengthSummary: blended.strengthSummary,
      seasonalSummary: blended.seasonalSummary,
      dominantTenGod: blended.dominantTenGod,
      patternName: blended.patternName,
      patternSummary: blended.patternSummary,
      patternTentative: blended.patternTentative,
      patternRevealLabel: blended.patternRevealLabel,
      patternCandidates: blended.patternCandidates,
      yongShin: blended.yongShin,
      heeShin: blended.heeShin,
      giShin: blended.giShin,
      guShin: blended.guShin,
      balanceSummary: blended.balanceSummary,
      directiveDelta: blended.directiveDelta,
      directiveSummary: blended.directiveSummary,
      yongShinReason: blended.yongShinReason,
      giShinReason: blended.giShinReason,
      relationStrengthSummary: blended.relationStrengthSummary,
      relationStrengthDetail: blended.relationStrengthDetail,
      relationStrengthCaution: blended.relationStrengthCaution,
      relationStrengthAction: blended.relationStrengthAction,
      relationStrengthAvoid: blended.relationStrengthAvoid,
      usefulElements: blended.usefulElements,
      unfavorableElements: blended.unfavorableElements,
      todayGanji: blended.todayGanji,
      todayRelation: blended.todayRelation,
      todayBranchImpact: blended.todayBranchImpact,
      todayBranchSummary: blended.todayBranchSummary,
      todayBranchInteractions: blended.todayBranchInteractions,
      usedNoonFallback: blended.usedNoonFallback,
      calendarTypeInput: "unknown",
      calendarTypeResolved: "unknown",
      rootCount: 0,
      branchRelations: [],
      visibleTenGods: [],
    },
  };
}

export function buildUnknownReferenceProfileData(params: {
  birthDate: Date;
  birthTime?: string;
  date?: Date;
}): {
  source: "solar-lunar-reference-v1";
  referenceMode: "solar-lunar-blend";
  uncertaintyMessage: string;
  usedNoonFallback: boolean;
  fiveElements: FiveElements;
  strengthLevel: StrengthLevel;
  yongShin: ElementKey;
  heeShin: ElementKey[];
  giShin: ElementKey;
  guShin: ElementKey[];
} | null {
  const blended = buildSolarLunarBlendContext({
    userId: "unknown-reference",
    birthDate: params.birthDate,
    birthTime: params.birthTime,
    sajuData: {},
    date: params.date,
  });
  if (!blended) {
    return null;
  }

  return {
    source: "solar-lunar-reference-v1",
    referenceMode: "solar-lunar-blend",
    uncertaintyMessage: blended.uncertaintyMessage,
    usedNoonFallback: blended.usedNoonFallback,
    fiveElements: blended.elements,
    strengthLevel: blended.strengthLevel,
    yongShin: blended.yongShin,
    heeShin: blended.heeShin,
    giShin: blended.giShin,
    guShin: blended.guShin,
  };
}

function generateBaseDailyFortune(params: {
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
  let calendarTypeResolved: CalendarType = calendarTypeInput;
  let certainty: ChartCertainty = calendarTypeInput === "unknown" ? "calendar-unknown" : "exact";
  let uncertaintyMessage: string | null =
    calendarTypeInput === "unknown"
      ? "달력 기준이 확정되지 않아 참고용 풀이로만 보아야 하오. 양력이나 음력을 다시 선택하면 만세력과 운세를 더 정확히 읽을 수 있소."
      : null;

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
  let yongShinReason = `${elementLabel(yongShin)} 기운이 지금 명식의 균형을 세워 주는 축이오.`;
  let giShinReason = `${elementLabel(giShin)} 기운이 과해지면 흐름을 거칠게 만들기 쉽소.`;

  try {
    chart = calculateTraditionalSajuChart({
      birthDate: params.birthDate,
      birthTime: params.birthTime,
      calendarType: calendarTypeInput,
    });
    certainty = chart.certainty;
    uncertaintyMessage = chart.uncertaintyMessage;
    usedNoonFallback = chart.usedNoonFallback;
    calendarTypeResolved = chart.calendarTypeResolved;
    if (chart.certainty === "exact" && chart.fiveElements && chart.dayMaster && chart.pillars && chart.analysis) {
      chartElements = chart.fiveElements;
      dayMasterElement = chart.dayMaster.element;
      dayMasterLabel = chart.dayMaster.elementLabel;
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
      yongShinReason = chart.analysis.balanceDirectives.reasons.yongShin;
      giShinReason = chart.analysis.balanceDirectives.reasons.giShin;
    } else {
      pillarSummary = "달력 기준이 미확정이라 정확한 만세력은 아직 열리지 않았소.";
      balanceSummary = "달력 기준이 확정되지 않아 오행 균형은 참고용으로만 풀이하오.";
      yongShinReason = "양력이나 음력을 정해야 용신을 더 정확히 읽을 수 있소.";
      giShinReason = "달력 기준이 미확정인 상태라 기신 작용도 참고용으로만 보아야 하오.";
    }
  } catch {
    // 사주 계산 실패 시 기존 저장 오행으로 안전하게 폴백
  }

  const dominant = dominantElement(chartElements);
  const weakest = weakestElement(chartElements);
  const heeNatalScore = heeShin.reduce((sum, key) => sum + chartElements[key], 0);
  const guNatalScore = guShin.reduce((sum, key) => sum + chartElements[key], 0);

  const exactChart =
    chart &&
    chart.certainty === "exact" &&
    chart.pillars &&
    chart.analysis &&
    chart.dayMaster &&
    chart.fiveElements &&
    chart.auxiliary
      ? {
          ...chart,
          solarDateTime: chart.solarDateTime as string,
          lunarDateKorean: chart.lunarDateKorean as string,
          calendarTypeResolved: chart.calendarTypeResolved as "solar" | "lunar",
          pillars: chart.pillars,
          analysis: chart.analysis,
          dayMaster: chart.dayMaster,
          fiveElements: chart.fiveElements,
          auxiliary: chart.auxiliary,
        }
      : null;
  let todayDayGan = "";
  let todayDayZhi = "";
  let todayElements = DEFAULT_ELEMENTS;
  let heeTodayScore = 0;
  let guTodayScore = 0;
  let todayGanji = "미확정";
  let todayBranchInteractions: TodayBranchInteraction[] = [];
  let prioritizedTodayBranchInteractions: TodayBranchInteraction[] = [];
  let todayBranchImpact = 0;
  let todayBranchSummary = uncertaintyMessage ?? "달력 기준이 미확정이라 오늘 지지 상호작용은 참고용으로만 보아야 하오.";
  let primaryTodayBranchPressure: TodayBranchInteraction | undefined;
  let primaryTodayBranchHarmony: TodayBranchInteraction | undefined;

  if (exactChart) {
    const seoulNow = parseSeoulDateParts(today);
    const todayLunar = Solar.fromYmdHms(
      seoulNow.year,
      seoulNow.month,
      seoulNow.day,
      seoulNow.hour,
      seoulNow.minute,
      0,
    ).getLunar();
    const todayEightChar = todayLunar.getEightChar();
    todayDayGan = String(todayEightChar.getDayGan());
    todayDayZhi = String(todayEightChar.getDayZhi());
    const todayHideGan = ((todayEightChar.getDayHideGan() as string[]) ?? []).map(String);
    todayElements = elementMixFromDay(todayDayGan, todayHideGan);
    heeTodayScore = heeShin.reduce((sum, key) => sum + todayElements[key], 0);
    guTodayScore = guShin.reduce((sum, key) => sum + todayElements[key], 0);
    todayGanji = `${todayDayGan}${todayDayZhi}`;
    todayBranchInteractions = detectTodayBranchInteractions(todayDayZhi, exactChart.pillars);
    prioritizedTodayBranchInteractions = sortTodayBranchInteractions(todayBranchInteractions);
    todayBranchImpact = clamp(
      prioritizedTodayBranchInteractions.reduce((sum, interaction) => sum + interaction.weight, 0),
      -8,
      6,
    );
    todayBranchSummary = buildTodayBranchSummary(prioritizedTodayBranchInteractions);
    primaryTodayBranchPressure = prioritizedTodayBranchInteractions.find(
      (interaction) =>
        (interaction.type === "충" || interaction.type === "형") &&
        (interaction.pillar === "day" || interaction.pillar === "month"),
    );
    primaryTodayBranchHarmony = prioritizedTodayBranchInteractions.find(
      (interaction) => interaction.type === "합" && (interaction.pillar === "day" || interaction.pillar === "month"),
    );
  }

  const spread =
    Math.max(chartElements.wood, chartElements.fire, chartElements.earth, chartElements.metal, chartElements.water) -
    Math.min(chartElements.wood, chartElements.fire, chartElements.earth, chartElements.metal, chartElements.water);

  const relation = exactChart ? fivePhaseRelation(dayMasterElement, elementFromStem(todayDayGan)) : "unknown";
  const relationGuide = buildStrengthAwareRelationGuide({
    relation,
    strengthLevel: dayMasterStrengthLevel,
  });
  const relationBonus =
    relation === "인성" || relation === "비겁"
      ? 6
      : relation === "식상"
        ? 4
        : relation === "재성"
          ? 2
          : relation === "관성"
            ? -4
            : 0;
  const branchPenalty =
    exactChart?.analysis.branchRelations.pairs.reduce((sum, pair) => sum + (pair.type === "충" ? 4 : pair.type === "형" ? 2 : -1), 0) ??
    0;
  const strengthBonus = exactChart ? Math.round(exactChart.analysis.dayMasterStrength.score * 0.18) : fallbackDayMasterStrong ? 3 : -3;

  const balanceBonus = clamp(28 - spread, -12, 18);
  const natalDirectiveBonus = clamp(
    Math.round(
      chartElements[yongShin] * 0.28 +
        heeNatalScore * 0.1 -
        chartElements[giShin] * 0.22 -
        guNatalScore * 0.08,
    ),
    -10,
    10,
  );
  const dailyDirectiveBonus = exactChart
    ? clamp(
        Math.round(
          todayElements[yongShin] * 0.24 +
            heeTodayScore * 0.08 -
            todayElements[giShin] * 0.2 -
            guTodayScore * 0.06,
        ),
        -8,
        8,
      )
    : 0;
  const directiveDelta = clamp(natalDirectiveBonus + dailyDirectiveBonus, -12, 12);
  const yongSupported = exactChart && (todayElements[yongShin] >= 30 || directiveDelta >= 3);
  const giActivated = exactChart && (todayElements[giShin] >= 30 || directiveDelta <= -3);
  const directiveSummary =
    !exactChart && uncertaintyMessage
      ? `${uncertaintyMessage} 용신과 기신 적중도도 참고용으로만 풀이하오.`
      : yongSupported
        ? `오늘은 용신 ${elementLabel(yongShin)} 기운이 받쳐 주어 흐름을 세우기 좋소.`
        : giActivated
          ? `오늘은 기신 ${elementLabel(giShin)} 기운이 올라오니 무리하면 흐름이 거칠어질 수 있소.`
          : `희신 ${formatElementList(heeShin)}이 보조하나 기신 ${elementLabel(giShin)}도 약하게 섞이니 균형을 먼저 보아야 하오.`;
  const score = clamp(
    58 + balanceBonus + relationBonus + strengthBonus - branchPenalty + todayBranchImpact + directiveDelta,
    5,
    98,
  );
  const grade = gradeFromScore(score);

  const headlineByGrade: Record<DailyFortune["grade"], string> = {
    대길: "명식과 일진의 결이 곱게 맞물려 큰 진전이 가능한 날이로다.",
    길: "사주의 중심이 안정되어 실천하면 성과가 쌓이는 날이로다.",
    평: "기운은 무난하나 과속을 삼가면 복이 보전되는 날이로다.",
    주의: "일진과 원국의 충돌이 있어 신중함이 필요한 날이로다.",
  };
  const uncertaintyLead =
    certainty === "calendar-unknown"
      ? uncertaintyMessage ?? "달력 기준이 미확정이라 참고용 풀이로만 보아야 하오."
      : null;

  const summary = [
    uncertaintyLead,
    `일주 주기운은 ${dayMasterLabel}이며, 원국은 ${pillarSummary}로 잡혔소.`,
    strengthSummary,
    relationGuide.summary,
    directiveSummary,
    exactChart && prioritizedTodayBranchInteractions.length > 0 ? todayBranchSummary : undefined,
    `강한 오행은 ${elementLabel(dominant)}, 약한 오행은 ${elementLabel(weakest)}이니 균형을 우선하시오.`,
  ]
    .filter((line): line is string => Boolean(line))
    .join(" ");

  const detailLines = [
    uncertaintyLead,
    seasonalSummary,
    exactChart
      ? `서울 기준 금일 일진은 ${todayDayGan}${todayDayZhi}이며, 일주 대비 ${relation}의 흐름이 감지되오.`
      : "서울 기준 금일 일진과 원국의 정밀 맞물림은 달력 기준이 확정된 뒤 다시 읽어야 하오.",
    `주요 십신 흐름은 ${dominantTenGod}, 일간 세는 ${strengthLevelLabel(dayMasterStrengthLevel)} 쪽으로 읽히오.`,
    relationGuide.detail,
    `${patternSummary} 용신은 ${elementLabel(yongShin)}으로 보오.`,
    yongShinReason,
    giActivated ? giShinReason : undefined,
    directiveSummary,
    exactChart && prioritizedTodayBranchInteractions.length > 0 ? todayBranchSummary : undefined,
    branchRelationSummary.length > 0 ? branchRelationSummary.join(" ") : undefined,
    exactChart
      ? `점수는 ${score}점(${grade})으로, 용신·기신 적중도(${directiveDelta >= 0 ? "+" : ""}${directiveDelta})와 지지 작용을 함께 반영했소.`
      : `점수는 ${score}점(${grade})으로, 저장된 오행과 일반 규칙을 바탕으로 참고용으로만 풀이했소.`,
  ].filter((line): line is string => Boolean(line));
  const detail = detailLines.join(" ");

  const caution =
    certainty === "calendar-unknown"
      ? `${uncertaintyMessage ?? "달력 기준이 미확정인 상태라"} 큰 결정은 확정 결과처럼 밀어붙이지 말고, 가능하면 양력이나 음력을 다시 정한 뒤 한 번 더 보시오.`
      : primaryTodayBranchPressure
        ? `금일 ${primaryTodayBranchPressure.description} ${primaryTodayBranchPressure.pillarLabel} 쪽 마찰이 먼저 드러날 수 있으니 중요한 결정은 한 박자 늦추고 사람과 일정의 충돌부터 풀어내시오.`
        : giActivated
          ? `오늘은 기신 ${elementLabel(giShin)} 흐름이 올라오니 ${giShinReason} ${relationGuide.caution}`
          : grade === "주의"
            ? `${relationGuide.caution} ${elementLabel(weakest)} 보완과 일정 충돌 관리도 함께 챙기시오.`
            : `${relationGuide.caution} ${elementLabel(yongShin)} 쪽 흐름을 살리면 기세가 더 고르게 펴지리다.`;

  const recommendedActions = [
    relationGuide.action,
    `용신 ${elementLabel(yongShin)}을 살리려면 ${ELEMENT_SUPPORT_ACTION_MAP[yongShin]}`,
    ...recommendedActionsByGrade(grade, relation),
  ];
  if (dayMasterStrengthLevel === "weak") {
    recommendedActions.push(`${formatElementList(usefulElements.slice(0, 2))} 기운을 돕는 정리와 보충에 먼저 힘쓰시오.`);
  } else if (dayMasterStrengthLevel === "strong") {
    recommendedActions.push(`${formatElementList(usefulElements.slice(0, 2))} 쪽 실행으로 기운을 풀어내면 답답함이 줄어드오.`);
  }
  if (directiveDelta <= -3) {
    recommendedActions.push(`기신 ${elementLabel(giShin)}이 올라오기 쉬우니 ${ELEMENT_RISK_MAP[giShin]}부터 줄이시오.`);
  }
  if (branchPenalty > 0) {
    recommendedActions.push("사람과 일정 사이의 충돌을 미리 조율해 형충의 마찰을 줄이시오.");
  }
  if (primaryTodayBranchPressure) {
    recommendedActions.push(`${primaryTodayBranchPressure.pillarLabel} 자리와 부딪히는 기운이 있으니 약속과 답변은 한 번 더 조율하고 움직이시오.`);
  } else if (primaryTodayBranchHarmony) {
    recommendedActions.push(`${primaryTodayBranchHarmony.pillarLabel} 자리와 합이 닿으니 만남, 협의, 조율이 필요한 일은 오늘 차분히 풀어 보시오.`);
  }

  if (usedNoonFallback && grade !== "주의") {
    recommendedActions.push("출생 시간이 미상이라 시주를 정오 기준으로 잡았으니, 가능하면 출생시를 보완하시오.");
  }
  if (certainty === "calendar-unknown") {
    recommendedActions.unshift("양력이나 음력 기준을 다시 정해 두면 더 정확한 만세력과 운세를 읽을 수 있소.");
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
    directiveDelta,
    branchPenalty,
    relationAvoid: relationGuide.avoid,
  });
  if (primaryTodayBranchPressure) {
    avoidToday.unshift(`${primaryTodayBranchPressure.pillarLabel} 자리와 얽힌 약속, 감정 반응, 즉답은 서두르지 마시오.`);
  }
  if (certainty === "calendar-unknown") {
    avoidToday.unshift("모름 상태의 운세를 확정 결과처럼 믿고 큰 결정을 바로 내리지 마시오.");
  }
  const trimmedAvoidToday = avoidToday.slice(0, 3);
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
    avoidToday: trimmedAvoidToday,
    luckyHints,
    elements: chartElements,
    manse: exactChart
      ? {
          solarDateTime: exactChart.solarDateTime,
          lunarDateKorean: exactChart.lunarDateKorean,
          calendarTypeResolved: exactChart.calendarTypeResolved,
          usedNoonFallback,
          pillars: (["year", "month", "day", "hour"] as PillarKey[]).map((pillarKey) => {
            const pillar = exactChart.pillars[pillarKey];
            const naYin =
              pillarKey === "year"
                ? exactChart.auxiliary.naYin.year
                : pillarKey === "month"
                  ? exactChart.auxiliary.naYin.month
                  : pillarKey === "day"
                    ? exactChart.auxiliary.naYin.day
                    : exactChart.auxiliary.naYin.hour;

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
    analysis: exactChart
      ? {
          certainty,
          referenceMode: "none",
          uncertaintyMessage,
          strengthLevel: dayMasterStrengthLevel,
          strengthScore: exactChart.analysis.dayMasterStrength.score,
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
          directiveDelta,
          directiveSummary,
          yongShinReason,
          giShinReason,
          relationStrengthSummary: relationGuide.summary,
          relationStrengthDetail: relationGuide.detail,
          relationStrengthCaution: relationGuide.caution,
          relationStrengthAction: relationGuide.action,
          relationStrengthAvoid: relationGuide.avoid,
          usefulElements,
          unfavorableElements,
          todayGanji,
          todayRelation: relation,
          todayBranchImpact,
          todayBranchSummary,
          todayBranchInteractions: prioritizedTodayBranchInteractions,
          usedNoonFallback,
          calendarTypeInput,
          calendarTypeResolved,
          rootCount: exactChart.analysis.dayMasterStrength.roots.length,
          branchRelations: exactChart.analysis.branchRelations.pairs.map((pair) => ({
            pillars: pair.pillars,
            label: pair.label,
            type: pair.type,
            description: pair.description,
          })),
          visibleTenGods: (Object.entries(exactChart.analysis.tenGods.stems) as Array<
            [Exclude<PillarKey, "day">, (typeof exactChart.analysis.tenGods.stems)[keyof typeof exactChart.analysis.tenGods.stems]]
          >).map(([pillar, info]) => ({
            pillar,
            pillarLabel: pillarLabel(pillar),
            stem: info.stem,
            stemKorean: info.stemKorean,
            tenGod: info.tenGod,
          })),
        }
      : {
          certainty,
          referenceMode: "none",
          uncertaintyMessage,
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
          directiveDelta,
          directiveSummary,
          yongShinReason,
          giShinReason,
          relationStrengthSummary: relationGuide.summary,
          relationStrengthDetail: relationGuide.detail,
          relationStrengthCaution: relationGuide.caution,
          relationStrengthAction: relationGuide.action,
          relationStrengthAvoid: relationGuide.avoid,
          usefulElements,
          unfavorableElements,
          todayGanji,
          todayRelation: relation,
          todayBranchImpact,
          todayBranchSummary,
          todayBranchInteractions: prioritizedTodayBranchInteractions,
          usedNoonFallback,
          calendarTypeInput,
          calendarTypeResolved,
          rootCount: 0,
          branchRelations: [],
          visibleTenGods: [],
        },
  };
}

export function generateDailyFortune(params: {
  userId: string;
  birthDate: Date;
  birthTime?: string;
  calendarType?: CalendarType;
  sajuData: unknown;
  date?: Date;
}): DailyFortune {
  if ((params.calendarType ?? "solar") === "unknown") {
    const blendedReference = buildSolarLunarBlendedReferenceFortune(params);
    if (blendedReference) {
      return blendedReference;
    }
  }

  return generateBaseDailyFortune(params);
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
