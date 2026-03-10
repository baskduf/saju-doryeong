"use client";

import { useDeferredValue, useState } from "react";
import type { DailyFortune } from "../../../lib/fortune";
import { kuseongFocusLabel, kuseongToneLabel } from "../../../lib/kuseong-labels";
import {
  buildYukhyoReading,
  type YukhyoNetworkEdge,
  type YukhyoTrigramNode,
} from "../../../lib/yukhyo";
import styles from "./page.module.css";

type Props = {
  fortune: DailyFortune;
  userId: string;
  referenceDate: string;
};

type PalaceCode = "乾" | "坎" | "艮" | "兑" | "中" | "震" | "坤" | "离" | "巽";

type PalaceToken = {
  key: string;
  label: string;
  meta: string;
  tone: "natal" | "month" | "day";
};

const KUSEONG_PALACES: Array<Array<{ code: PalaceCode; label: string; hanja: string }>> = [
  [
    { code: "乾", label: "서북", hanja: "건궁" },
    { code: "坎", label: "정북", hanja: "감궁" },
    { code: "艮", label: "동북", hanja: "간궁" },
  ],
  [
    { code: "兑", label: "정서", hanja: "태궁" },
    { code: "中", label: "중앙", hanja: "중궁" },
    { code: "震", label: "정동", hanja: "진궁" },
  ],
  [
    { code: "坤", label: "서남", hanja: "곤궁" },
    { code: "离", label: "정남", hanja: "리궁" },
    { code: "巽", label: "동남", hanja: "손궁" },
  ],
];

const CATEGORY_REACTION_ORDER = [
  { key: "work", label: "일과" },
  { key: "money", label: "재물" },
  { key: "relationship", label: "관계" },
  { key: "health", label: "회복" },
] as const;

const ELEMENT_LABELS = {
  wood: "목",
  fire: "화",
  earth: "토",
  metal: "금",
  water: "수",
} as const;

const YUKHYO_QUESTIONS = [
  "오늘 연락 보내도 될까?",
  "오늘 계약해도 될까?",
  "오늘 쉬어야 할까?",
];

const NETWORK_NODE_POSITIONS: Record<YukhyoTrigramNode["id"], { x: number; y: number }> = {
  "primary-upper": { x: 110, y: 56 },
  "primary-lower": { x: 110, y: 204 },
  "changed-upper": { x: 290, y: 56 },
  "changed-lower": { x: 290, y: 204 },
};

function signedValue(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

function trendLabel(value: "positive" | "neutral" | "negative"): string {
  if (value === "positive") return "긍정";
  if (value === "negative") return "신중";
  return "보류";
}

function trendClassName(value: "positive" | "neutral" | "negative"): string {
  if (value === "positive") return styles.graphTrendPositive;
  if (value === "negative") return styles.graphTrendNegative;
  return styles.graphTrendNeutral;
}

function lineLabel(lineNumber: number): string {
  if (lineNumber === 1) return "초효";
  if (lineNumber === 6) return "상효";
  return `${lineNumber}효`;
}

function edgeClassName(relation: YukhyoNetworkEdge["relation"]): string {
  if (relation === "support" || relation === "same") {
    return styles.networkEdgeSupport;
  }

  if (relation === "control") {
    return styles.networkEdgeControl;
  }

  return styles.networkEdgeManaged;
}

function buildPalaceTokens(fortune: DailyFortune): Map<PalaceCode, PalaceToken[]> {
  const tokenMap = new Map<PalaceCode, PalaceToken[]>();
  const kuseong = fortune.analysis.hybrid.kuseong;

  if (!kuseong) {
    return tokenMap;
  }

  for (const star of kuseong.stars.natalYear) {
    if (!star.position) {
      continue;
    }
    const code = star.position as PalaceCode;
    tokenMap.set(code, [
      ...(tokenMap.get(code) ?? []),
      {
        key: `natal-${star.label}-${star.position}`,
        label: `본명 ${star.number}`,
        meta: star.positionLabel,
        tone: "natal",
      },
    ]);
  }

  tokenMap.set(kuseong.stars.currentMonth.position as PalaceCode, [
    ...(tokenMap.get(kuseong.stars.currentMonth.position as PalaceCode) ?? []),
    {
      key: `month-${kuseong.stars.currentMonth.label}`,
      label: `월성 ${kuseong.stars.currentMonth.number}`,
      meta: kuseong.stars.currentMonth.gate,
      tone: "month",
    },
  ]);

  tokenMap.set(kuseong.stars.currentDay.position as PalaceCode, [
    ...(tokenMap.get(kuseong.stars.currentDay.position as PalaceCode) ?? []),
    {
      key: `day-${kuseong.stars.currentDay.label}`,
      label: `일성 ${kuseong.stars.currentDay.number}`,
      meta: kuseong.stars.currentDay.gate,
      tone: "day",
    },
  ]);

  return tokenMap;
}

function HexagramTower(props: {
  title: string;
  bits: string;
  movingLines: number[];
}) {
  const rows = props.bits
    .split("")
    .map((bit, index) => ({ bit, lineNumber: index + 1 }))
    .reverse();

  return (
    <div className={styles.hexagramTower}>
      <p className={styles.graphSectionTitle}>{props.title}</p>
      <div className={styles.hexagramRows}>
        {rows.map((row) => {
          const moving = props.movingLines.includes(row.lineNumber);
          return (
            <div key={row.lineNumber} className={styles.hexagramRow}>
              <span className={styles.hexagramLineLabel}>{lineLabel(row.lineNumber)}</span>
              <div className={`${styles.hexagramLine} ${moving ? styles.hexagramLineMoving : ""}`.trim()}>
                {row.bit === "1" ? (
                  <span className={styles.hexagramSolid} />
                ) : (
                  <>
                    <span className={styles.hexagramBroken} />
                    <span className={styles.hexagramBrokenGap} />
                    <span className={styles.hexagramBroken} />
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function YukhyoNetwork(props: {
  nodes: YukhyoTrigramNode[];
  edges: YukhyoNetworkEdge[];
  hasChanged: boolean;
}) {
  const visibleNodes = props.nodes.filter(
    (node) => props.hasChanged || !node.id.startsWith("changed"),
  );
  const visibleEdges = props.edges.filter(
    (edge) =>
      visibleNodes.some((node) => node.id === edge.from) &&
      visibleNodes.some((node) => node.id === edge.to),
  );

  return (
    <div className={styles.networkWrap}>
      <svg
        viewBox={props.hasChanged ? "0 0 400 260" : "0 0 220 260"}
        className={styles.networkSvg}
        aria-label="육효 오행 관계망"
      >
        <defs>
          <marker
            id="yukhyo-arrow"
            markerWidth="10"
            markerHeight="10"
            refX="8"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L8,3 L0,6 Z" fill="currentColor" />
          </marker>
        </defs>
        {visibleEdges.map((edge) => {
          const from = NETWORK_NODE_POSITIONS[edge.from];
          const to = NETWORK_NODE_POSITIONS[edge.to];
          const labelX = (from.x + to.x) / 2;
          const labelY = (from.y + to.y) / 2 - 10;

          return (
            <g key={`${edge.from}-${edge.to}-${edge.label}`} className={edgeClassName(edge.relation)}>
              <line
                x1={from.x}
                y1={from.y + 26}
                x2={to.x}
                y2={to.y - 26}
                className={styles.networkLine}
                markerEnd="url(#yukhyo-arrow)"
              />
              <text x={labelX} y={labelY} textAnchor="middle" className={styles.networkEdgeLabel}>
                {edge.label}
              </text>
            </g>
          );
        })}
        {props.hasChanged ? (
          <>
            <line
              x1={NETWORK_NODE_POSITIONS["primary-upper"].x + 38}
              y1={NETWORK_NODE_POSITIONS["primary-upper"].y}
              x2={NETWORK_NODE_POSITIONS["changed-upper"].x - 38}
              y2={NETWORK_NODE_POSITIONS["changed-upper"].y}
              className={styles.networkTransition}
            />
            <line
              x1={NETWORK_NODE_POSITIONS["primary-lower"].x + 38}
              y1={NETWORK_NODE_POSITIONS["primary-lower"].y}
              x2={NETWORK_NODE_POSITIONS["changed-lower"].x - 38}
              y2={NETWORK_NODE_POSITIONS["changed-lower"].y}
              className={styles.networkTransition}
            />
          </>
        ) : null}
      </svg>

      {visibleNodes.map((node) => {
        const position = NETWORK_NODE_POSITIONS[node.id];
        const leftPercent = props.hasChanged
          ? `${(position.x / 400) * 100}%`
          : "50%";
        const topPercent = `${(position.y / 260) * 100}%`;
        return (
          <div
            key={node.id}
            className={styles.networkNode}
            style={{ left: leftPercent, top: topPercent }}
          >
            <span className={styles.networkNodeTitle}>
              {node.label} {node.hanja}
            </span>
            <span className={styles.networkNodeMeta}>
              {ELEMENT_LABELS[node.element]} / {node.keyword}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function HybridCharts({ fortune, userId, referenceDate }: Props) {
  const [question, setQuestion] = useState(YUKHYO_QUESTIONS[0]);
  const deferredQuestion = useDeferredValue(question);
  const normalizedQuestion = deferredQuestion.trim() || YUKHYO_QUESTIONS[0];
  const oracle = buildYukhyoReading({
    userId,
    question: normalizedQuestion,
    date: new Date(referenceDate),
  });

  const kuseong = fortune.analysis.hybrid.kuseong;
  const palaceTokens = buildPalaceTokens(fortune);

  return (
    <div className={styles.graphStack}>
      {kuseong ? (
        <article className={styles.graphCard}>
          <div className={styles.graphHeader}>
            <div>
              <p className={styles.graphEyebrow}>Kuseong</p>
              <h3>구성 구궁도</h3>
            </div>
            <div className={styles.graphBadgeRow}>
              <span className={styles.graphBadge}>중점: {kuseongFocusLabel(kuseong.focusCategories)}</span>
              <span className={styles.graphBadge}>톤: {kuseongToneLabel(kuseong.narrativeTone)}</span>
              <span className={styles.graphBadge}>길문: {kuseong.stars.currentDay.gate}</span>
            </div>
          </div>
          <p className={styles.graphCopy}>
            구성은 방위의 흐름을 보는 지도이니, 본명성은 바탕을 깔고 당월성과 일성은 오늘의 길을 점합니다.
          </p>
          <div className={styles.graphSubsection}>
            <p className={styles.graphSectionTitle}>3x3 구궁도</p>
            <div className={styles.kuseongBoard}>
              {KUSEONG_PALACES.flat().map((palace) => (
                <div key={palace.code} className={styles.kuseongCell}>
                  <div className={styles.kuseongCellHeader}>
                    <span>{palace.label}</span>
                    <span>{palace.hanja}</span>
                  </div>
                  <div className={styles.kuseongCellBody}>
                    {(palaceTokens.get(palace.code) ?? []).map((token) => (
                      <div
                        key={token.key}
                        className={`${styles.kuseongToken} ${styles[`kuseongToken${token.tone[0].toUpperCase()}${token.tone.slice(1)}`]}`.trim()}
                      >
                        <span>{token.label}</span>
                        <small>{token.meta}</small>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className={styles.graphSubsection}>
            <p className={styles.graphSectionTitle}>흐름 해석</p>
            <div className={styles.graphMetricGrid}>
              <div className={styles.graphMetricCard}>
                <span>본명성 관계</span>
                <strong>{signedValue(kuseong.breakdown.natalRelationScore)}</strong>
              </div>
              <div className={styles.graphMetricCard}>
                <span>당월성 관계</span>
                <strong>{signedValue(kuseong.breakdown.monthRelationScore)}</strong>
              </div>
              <div className={styles.graphMetricCard}>
                <span>기문운</span>
                <strong>
                  {kuseong.qiMenLuckLabel} / {signedValue(kuseong.breakdown.qiMenLuckScore)}
                </strong>
              </div>
              <div className={styles.graphMetricCard}>
                <span>비성 흐름</span>
                <strong>
                  {kuseong.stars.currentMonth.number} {kuseong.stars.currentMonth.positionLabel} -&gt;{" "}
                  {kuseong.stars.currentDay.number} {kuseong.stars.currentDay.positionLabel}
                </strong>
              </div>
            </div>
            <div className={styles.reactionRow}>
              {CATEGORY_REACTION_ORDER.map((item) => {
                const value = kuseong.categoryAdjustments[item.key];
                return (
                  <div
                    key={item.key}
                    className={`${styles.reactionChip} ${value >= 0 ? styles.reactionChipPositive : styles.reactionChipNegative}`.trim()}
                  >
                    <span>{item.label}</span>
                    <strong>{signedValue(value)}</strong>
                  </div>
                );
              })}
            </div>
          </div>
        </article>
      ) : null}

      <article className={styles.graphCard}>
        <div className={styles.graphHeader}>
          <div>
            <p className={styles.graphEyebrow}>Yukhyo</p>
            <h3>육효 구조도와 관계망</h3>
          </div>
          <span className={`${styles.graphTrendBadge} ${trendClassName(oracle.answerTrend)}`}>{trendLabel(oracle.answerTrend)}</span>
        </div>
        <p className={styles.graphCopy}>
          육효는 아래에서 위로 쌓인 효의 흐름과, 내괘와 외괘가 서로 돕는지 막는지를 함께 봐야 하오.
        </p>
        <div className={styles.graphQuestionRow}>
          {YUKHYO_QUESTIONS.map((item) => (
            <button
              key={item}
              type="button"
              className={`${styles.graphQuestionChip} ${question === item ? styles.graphQuestionChipActive : ""}`.trim()}
              onClick={() => setQuestion(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <label className={styles.graphInputLabel} htmlFor="yukhyo-question-input">
          질문 직접 입력
        </label>
        <input
          id="yukhyo-question-input"
          className={styles.graphInput}
          value={question}
          maxLength={60}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="예: 오늘 연락 보내도 될까?"
        />
        <div className={styles.graphSubsection}>
          <p className={styles.graphSectionTitle}>괘상 구조도</p>
          <div className={styles.towerRow}>
            <HexagramTower title={oracle.primaryHexagram} bits={oracle.primaryBits} movingLines={oracle.movingLines} />
            {oracle.changedBits ? (
              <HexagramTower title={oracle.changedHexagram ?? "변괘"} bits={oracle.changedBits} movingLines={oracle.movingLines} />
            ) : (
              <div className={styles.hexagramStableCard}>
                <p className={styles.graphSectionTitle}>변화 없음</p>
                <p>동효가 적어 본괘의 흐름이 그대로 이어지는 편이오.</p>
              </div>
            )}
          </div>
        </div>
        <div className={styles.graphSubsection}>
          <p className={styles.graphSectionTitle}>내·외괘 오행 관계망</p>
          <YukhyoNetwork
            nodes={oracle.network.nodes}
            edges={oracle.network.edges}
            hasChanged={Boolean(oracle.changedBits)}
          />
        </div>
        <div className={styles.graphMetricGrid}>
          <div className={styles.graphMetricCard}>
            <span>괘 관계</span>
            <strong>{signedValue(oracle.breakdown.relationScore)}</strong>
          </div>
          <div className={styles.graphMetricCard}>
            <span>동효 보정</span>
            <strong>{signedValue(oracle.breakdown.movingModifier)}</strong>
          </div>
          <div className={styles.graphMetricCard}>
            <span>적용 점수</span>
            <strong>{signedValue(oracle.breakdown.appliedScore)}</strong>
          </div>
          <div className={styles.graphMetricCard}>
            <span>움직이는 효</span>
            <strong>{oracle.movingLines.length > 0 ? oracle.movingLines.join(", ") : "없음"}</strong>
          </div>
        </div>
        <p className={styles.graphFootnote}>{oracle.sourceLine}</p>
      </article>
    </div>
  );
}
