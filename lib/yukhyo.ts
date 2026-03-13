import type { ElementKey } from "./saju";
import { selectDeterministicVariant } from "./fortune-guidance";
import { getSeoulDateKey } from "./seoul-time";

export type YukhyoAnswerTrend = "positive" | "neutral" | "negative";
export type YukhyoRelationType = "support" | "same" | "drain" | "control" | "managed";

export type YukhyoTrigramNode = {
  id: "primary-lower" | "primary-upper" | "changed-lower" | "changed-upper";
  label: string;
  hanja: string;
  element: ElementKey;
  keyword: string;
  timing: string;
};

export type YukhyoNetworkEdge = {
  from: YukhyoTrigramNode["id"];
  to: YukhyoTrigramNode["id"];
  relation: YukhyoRelationType;
  label: string;
};

export type YukhyoOracleMeta = {
  primaryHexagram: string;
  changedHexagram: string | null;
  movingLines: number[];
  answerTrend: YukhyoAnswerTrend;
};

export type YukhyoReading = YukhyoOracleMeta & {
  lines: LineValue[];
  primaryBits: string;
  changedBits: string | null;
  summary: string;
  action: string;
  caution: string;
  timingHint: string;
  sourceLine: string;
  network: {
    nodes: YukhyoTrigramNode[];
    edges: YukhyoNetworkEdge[];
  };
  breakdown: {
    relationScore: number;
    movingModifier: number;
    primaryScore: number;
    changedScore: number | null;
    appliedScore: number;
  };
};

type LineValue = 6 | 7 | 8 | 9;

type TrigramDefinition = {
  bits: string;
  label: string;
  hanja: string;
  element: ElementKey;
  timing: string;
  action: string;
  caution: string;
  keyword: string;
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

const TRIGRAMS: Record<string, TrigramDefinition> = {
  "111": {
    bits: "111",
    label: "건",
    hanja: "乾",
    element: "metal",
    timing: "오전 초반",
    action: "힘이 모였을 때 핵심 결정을 먼저 꺼내시오.",
    caution: "기세가 좋더라도 강하게 밀어붙이며 상대를 누르지 마시오.",
    keyword: "주도",
  },
  "110": {
    bits: "110",
    label: "태",
    hanja: "兌",
    element: "metal",
    timing: "해질 무렵",
    action: "대화와 설득, 확인 연락을 가볍게 먼저 열어 보시오.",
    caution: "기분 좋게 보이려다 가벼운 약속을 남발하지 마시오.",
    keyword: "교류",
  },
  "101": {
    bits: "101",
    label: "리",
    hanja: "離",
    element: "fire",
    timing: "점심 이후",
    action: "드러내야 할 입장과 감정은 숨기지 말고 또렷이 밝히시오.",
    caution: "보여주기 위해 말을 키우면 실속이 빠질 수 있소.",
    keyword: "표현",
  },
  "100": {
    bits: "100",
    label: "진",
    hanja: "震",
    element: "wood",
    timing: "이른 오전",
    action: "첫 발을 떼야 하는 일은 미루지 말고 작게라도 시작하시오.",
    caution: "놀란 마음으로 성급히 반응하면 흐름이 흔들리오.",
    keyword: "시작",
  },
  "011": {
    bits: "011",
    label: "손",
    hanja: "巽",
    element: "wood",
    timing: "오전 후반",
    action: "상대와 속도를 맞추며 조율할 일은 유연하게 풀어 가시오.",
    caution: "남의 흐름에만 맞추다 내 기준을 잃지 마시오.",
    keyword: "조율",
  },
  "010": {
    bits: "010",
    label: "감",
    hanja: "坎",
    element: "water",
    timing: "늦은 저녁",
    action: "리스크가 엮인 일은 확인을 더하고 안전판을 먼저 세우시오.",
    caution: "불안에 끌려 판단을 급히 뒤집지 마시오.",
    keyword: "심연",
  },
  "001": {
    bits: "001",
    label: "간",
    hanja: "艮",
    element: "earth",
    timing: "새벽 또는 초반",
    action: "멈춰야 할 선과 지켜야 할 경계부터 정하고 움직이시오.",
    caution: "버티기만 하며 흐름을 막아 세우면 오히려 답답해질 수 있소.",
    keyword: "정지",
  },
  "000": {
    bits: "000",
    label: "곤",
    hanja: "坤",
    element: "earth",
    timing: "오후",
    action: "받아들이고 준비할 일은 조용히 다져 두는 편이 유리하오.",
    caution: "수동적으로만 버티며 기회를 놓치지 마시오.",
    keyword: "수용",
  },
};

function normalizeQuestion(question: string): string {
  return question.trim().replace(/\s+/g, " ").toLowerCase();
}

function fnv1a32(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) || 1;
}

function xorshift32(seed: number): number {
  let value = seed || 1;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return (value >>> 0) || 1;
}

function generateLines(seed: number): LineValue[] {
  let state = seed || 1;
  const lines: LineValue[] = [];

  for (let lineIndex = 0; lineIndex < 6; lineIndex += 1) {
    let sum = 0;
    for (let toss = 0; toss < 3; toss += 1) {
      state = xorshift32(state);
      sum += state % 2 === 0 ? 2 : 3;
    }
    lines.push(sum as LineValue);
  }

  return lines;
}

function lineToBit(value: LineValue): "0" | "1" {
  return value === 7 || value === 9 ? "1" : "0";
}

function changedLineToBit(value: LineValue): "0" | "1" {
  if (value === 6) return "1";
  if (value === 9) return "0";
  return lineToBit(value);
}

function relationScore(upper: ElementKey, lower: ElementKey): number {
  if (upper === lower) return 1;
  if (GENERATES[upper] === lower) return 2;
  if (GENERATES[lower] === upper) return 0;
  if (CONTROLS[upper] === lower) return -2;
  return 1;
}

function relationType(upper: ElementKey, lower: ElementKey): YukhyoRelationType {
  if (upper === lower) return "same";
  if (GENERATES[upper] === lower) return "support";
  if (GENERATES[lower] === upper) return "drain";
  if (CONTROLS[upper] === lower) return "control";
  return "managed";
}

function relationLabel(value: YukhyoRelationType): string {
  switch (value) {
    case "support":
      return "상생";
    case "same":
      return "동질";
    case "drain":
      return "소모";
    case "control":
      return "상극";
    case "managed":
      return "제어";
  }
}

function movingModifier(movingLineCount: number): number {
  if (movingLineCount === 0) return 1;
  if (movingLineCount <= 2) return 0;
  if (movingLineCount <= 4) return -1;
  return -2;
}

function trendFromScore(score: number): YukhyoAnswerTrend {
  if (score >= 2) return "positive";
  if (score <= -2) return "negative";
  return "neutral";
}

function describeHexagram(bits: string): {
  lower: TrigramDefinition;
  upper: TrigramDefinition;
  label: string;
} {
  const lowerBits = bits.slice(0, 3);
  const upperBits = bits.slice(3, 6);
  const lower = TRIGRAMS[lowerBits] ?? TRIGRAMS["000"];
  const upper = TRIGRAMS[upperBits] ?? TRIGRAMS["000"];

  return {
    lower,
    upper,
    label: `${upper.label}상 ${lower.label}하`,
  };
}

function toNode(
  id: YukhyoTrigramNode["id"],
  trigram: TrigramDefinition,
): YukhyoTrigramNode {
  return {
    id,
    label: trigram.label,
    hanja: trigram.hanja,
    element: trigram.element,
    keyword: trigram.keyword,
    timing: trigram.timing,
  };
}

function describeTrendSentence(params: {
  label: string;
  trend: YukhyoAnswerTrend;
  upper: TrigramDefinition;
  lower: TrigramDefinition;
}): string {
  if (params.trend === "positive") {
    return selectDeterministicVariant([params.label, params.upper.keyword, params.lower.keyword, params.trend], [
      `본괘 ${params.label}는 ${params.upper.keyword}의 바깥 흐름이 ${params.lower.keyword}의 안쪽 움직임을 떠밀어 주니, 작게 밀어도 반응이 붙기 쉬운 형세이오.`,
      `본괘 ${params.label}는 ${params.upper.keyword}의 결이 ${params.lower.keyword}를 받쳐 주니, 판을 여는 쪽으로 기세가 모이오.`,
    ]);
  }
  if (params.trend === "negative") {
    return selectDeterministicVariant([params.label, params.upper.keyword, params.lower.keyword, params.trend], [
      `본괘 ${params.label}는 ${params.upper.keyword}의 바깥 흐름이 ${params.lower.keyword}를 눌러, 조급히 밀수록 판이 거칠어질 수 있소.`,
      `본괘 ${params.label}는 ${params.upper.keyword}의 압박이 ${params.lower.keyword}를 흔드니, 급히 결론을 내리면 불리해지기 쉽소.`,
    ]);
  }

  return selectDeterministicVariant([params.label, params.upper.keyword, params.lower.keyword, params.trend], [
    `본괘 ${params.label}는 ${params.upper.keyword}와 ${params.lower.keyword}가 팽팽하니, 앞머리만 가볍게 열고 반응을 더 보는 편이 낫소.`,
    `본괘 ${params.label}는 ${params.upper.keyword}와 ${params.lower.keyword}가 맞서는 결이 있어, 한꺼번에 밀기보다 판을 나눠 보는 편이 무난하오.`,
  ]);
}

function describeShiftSentence(params: {
  changedLabel: string;
  changedTrend: YukhyoAnswerTrend;
}): string {
  if (params.changedTrend === "positive") {
    return `후반 흐름은 ${params.changedLabel}로 변하니 갈수록 기회가 붙을 수 있소.`;
  }
  if (params.changedTrend === "negative") {
    return `후반 흐름은 ${params.changedLabel}로 변하니 뒤로 갈수록 무리수를 더 줄이는 편이 안전하오.`;
  }

  return `후반 흐름은 ${params.changedLabel}로 변하니 마무리 쪽에서 판을 다시 고르는 편이 무난하오.`;
}

function buildOracleAction(params: {
  lower: TrigramDefinition;
  upper: TrigramDefinition;
  answerTrend: YukhyoAnswerTrend;
  movingLineCount: number;
  changedTrend: YukhyoAnswerTrend;
}): string {
  const volatile = params.movingLineCount >= 3;
  if (params.answerTrend === "positive" && !volatile) {
    return selectDeterministicVariant(
      [params.lower.label, params.upper.label, params.answerTrend, params.movingLineCount],
      [
        `${params.lower.keyword} 쪽 판을 먼저 열고 반응이 붙는 선에서 한 걸음 더 내보시오.`,
        `${params.lower.keyword} 흐름이 살아 있으니 작은 움직임부터 실제로 붙여 보시오.`,
      ],
    );
  }

  if (params.answerTrend === "positive") {
    return selectDeterministicVariant(
      [params.lower.label, params.upper.label, params.answerTrend, params.movingLineCount],
      [
        `${params.lower.keyword} 쪽 움직임은 살리되 판이 흔들릴 수 있으니 가볍게 시험하듯 먼저 두시오.`,
        `${params.lower.keyword} 흐름은 열리나 변동도 함께 있으니 범위를 좁혀 먼저 붙여 보시오.`,
      ],
    );
  }

  if (params.answerTrend === "negative" || params.changedTrend === "negative") {
    return selectDeterministicVariant(
      [params.lower.label, params.upper.label, params.answerTrend, params.movingLineCount],
      [
        `${params.lower.keyword} 쪽은 크게 벌리지 말고 작게 확인하듯 두시오.`,
        `${params.lower.keyword} 흐름은 시험하듯 짧게 보고 큰 결정은 뒤로 미루시오.`,
      ],
    );
  }

  return selectDeterministicVariant(
    [params.lower.label, params.upper.label, params.answerTrend, params.movingLineCount],
    [
      `${params.lower.keyword} 쪽 판부터 가볍게 열고 반응을 본 뒤 다음 수를 정하시오.`,
      `${params.lower.keyword} 흐름은 작게 먼저 두고 붙는 반응을 보며 이어 가시오.`,
    ],
  );
}

function buildOracleCaution(params: {
  upper: TrigramDefinition;
  answerTrend: YukhyoAnswerTrend;
  movingLineCount: number;
  changedTrend: YukhyoAnswerTrend;
}): string {
  if (params.changedTrend === "negative" || params.movingLineCount >= 4) {
    return selectDeterministicVariant(
      [params.upper.label, params.answerTrend, params.movingLineCount, params.changedTrend],
      [
        `${params.upper.keyword} 쪽 바깥 압박이 커질 수 있으니 즉답과 무리수는 피하시오.`,
        `${params.upper.keyword} 흐름이 흔들리기 쉬우니 급한 확답과 과한 밀어붙임은 금하시오.`,
      ],
    );
  }

  if (params.answerTrend === "positive") {
    return selectDeterministicVariant(
      [params.upper.label, params.answerTrend, params.movingLineCount, params.changedTrend],
      [
        `${params.upper.keyword} 기세가 살아도 한 번에 판을 키우지 마시오.`,
        `${params.upper.keyword} 흐름이 좋더라도 욕심으로 범위를 넓히지 마시오.`,
      ],
    );
  }

  if (params.answerTrend === "negative") {
    return selectDeterministicVariant(
      [params.upper.label, params.answerTrend, params.movingLineCount, params.changedTrend],
      [
        `${params.upper.keyword} 쪽 압박에 끌려 판단을 급히 뒤집지 마시오.`,
        `${params.upper.keyword} 바깥 흐름이 거칠 수 있으니 반응 속도로 승부 보지 마시오.`,
      ],
    );
  }

  return selectDeterministicVariant(
    [params.upper.label, params.answerTrend, params.movingLineCount, params.changedTrend],
    [
      `${params.upper.keyword} 쪽 반응이 팽팽하니 거리를 너무 급히 좁히지 마시오.`,
      `${params.upper.keyword} 흐름이 맞서는 결이라 한 번에 결론을 밀어붙이지 마시오.`,
    ],
  );
}

export function buildYukhyoReading(params: {
  userId?: string;
  question: string;
  date?: Date;
}): YukhyoReading {
  const normalizedQuestion = normalizeQuestion(params.question);
  const dateKey = getSeoulDateKey(params.date);
  const seed = fnv1a32(`${params.userId ?? "anonymous"}|${normalizedQuestion}|${dateKey}`);
  const lines = generateLines(seed);
  const movingLines = lines
    .map((line, index) => (line === 6 || line === 9 ? index + 1 : 0))
    .filter((lineNumber) => lineNumber > 0);
  const primaryBits = lines.map(lineToBit).join("");
  const changedBits = lines.map(changedLineToBit).join("");
  const primary = describeHexagram(primaryBits);
  const changed = changedBits === primaryBits ? null : describeHexagram(changedBits);
  const relation = relationScore(primary.upper.element, primary.lower.element);
  const primaryRelation = relationType(primary.upper.element, primary.lower.element);
  const moving = movingModifier(movingLines.length);
  const primaryScore = relation + moving;
  const primaryTrend = trendFromScore(primaryScore);
  const changedScore = changed ? relationScore(changed.upper.element, changed.lower.element) + moving : null;
  const changedTrend = changed ? trendFromScore(changedScore ?? primaryScore) : primaryTrend;
  const changedRelation = changed ? relationType(changed.upper.element, changed.lower.element) : null;
  const networkNodes: YukhyoTrigramNode[] = [
    toNode("primary-upper", primary.upper),
    toNode("primary-lower", primary.lower),
  ];
  const networkEdges: YukhyoNetworkEdge[] = [
    {
      from: "primary-lower",
      to: "primary-upper",
      relation: primaryRelation,
      label: relationLabel(primaryRelation),
    },
  ];

  if (changed) {
    networkNodes.push(toNode("changed-upper", changed.upper), toNode("changed-lower", changed.lower));
    if (changedRelation) {
      networkEdges.push({
        from: "changed-lower",
        to: "changed-upper",
        relation: changedRelation,
        label: relationLabel(changedRelation),
      });
    }
  }

  const summary = [
    describeTrendSentence({
      label: primary.label,
      trend: primaryTrend,
      upper: primary.upper,
      lower: primary.lower,
    }),
    changed ? describeShiftSentence({ changedLabel: changed.label, changedTrend }) : null,
  ]
    .filter((line): line is string => Boolean(line))
    .join(" ");

  const answerTrend =
    changed && changedTrend !== primaryTrend && movingLines.length >= 3 ? changedTrend : primaryTrend;
  const appliedScore = changed && changedTrend !== primaryTrend && movingLines.length >= 3 ? (changedScore ?? primaryScore) : primaryScore;
  const action = buildOracleAction({
    lower: primary.lower,
    upper: primary.upper,
    answerTrend,
    movingLineCount: movingLines.length,
    changedTrend,
  });
  const caution = buildOracleCaution({
    upper: changed?.upper ?? primary.upper,
    answerTrend,
    movingLineCount: movingLines.length,
    changedTrend,
  });

  return {
    primaryHexagram: primary.label,
    changedHexagram: changed?.label ?? null,
    movingLines,
    answerTrend,
    lines,
    primaryBits,
    changedBits: changed ? changedBits : null,
    summary,
    action,
    caution,
    timingHint: changed?.upper.timing ?? primary.upper.timing,
    sourceLine: changed ? `육효 괘상: ${primary.label} -> ${changed.label}` : `육효 괘상: ${primary.label}`,
    network: {
      nodes: networkNodes,
      edges: networkEdges,
    },
    breakdown: {
      relationScore: relation,
      movingModifier: moving,
      primaryScore,
      changedScore,
      appliedScore,
    },
  };
}
