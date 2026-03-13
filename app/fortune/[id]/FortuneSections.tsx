"use client";

import Image from "next/image";
import { Fragment, useState, type ReactNode } from "react";
import { selectTopFortuneSignals, shouldRenderSignalCaution, type DailyFortune } from "../../../lib/fortune";
import { kuseongFocusLabel, kuseongToneLabel } from "../../../lib/kuseong-labels";
import { FiveElementsChart } from "./FiveElementsChart";
import { KuseongChartSection, YukhyoChartSection } from "./HybridCharts";
import styles from "./page.module.css";

type Props = {
  fortune: DailyFortune;
  userId: string;
  referenceDate: string;
};

type TabKey = "fortune" | "analysis";
type AnalysisTabKey = "manse" | "interpretation" | "elements" | "kuseong" | "yukhyo";

type ReadingGuideProps = {
  summary: string;
  intro: string;
  tips: string[];
};

const EMPHASIS_TERMS = [
  "속도 조절",
  "지출 점검",
  "무리 금지",
  "회복 집중",
  "유연 대응",
  "보수 운용",
  "안정 운영",
  "주도권 확보",
  "수익 흐름 우세",
  "호감 상승",
  "회복력 상승",
  "휴식 우선",
  "거리 조절",
  "감정 절제",
  "지갑 단속",
  "정리",
  "기회",
  "관계",
  "재물",
  "연애",
  "건강",
  "일과",
  "회복",
  "집중",
  "휴식",
  "지출",
  "금전",
  "대화",
  "약속",
  "충돌",
  "컨디션",
  "균형",
  "변화",
  "안정",
  "성과",
];

const EMPHASIS_TERM_SET = new Set(EMPHASIS_TERMS);
const EMPHASIS_PATTERN = new RegExp(
  `(${EMPHASIS_TERMS.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
  "g",
);

function strengthLevelLabel(value: "strong" | "balanced" | "weak"): string {
  if (value === "strong") return "신강";
  if (value === "weak") return "신약";
  return "중화";
}

function elementLabel(value: "wood" | "fire" | "earth" | "metal" | "water"): string {
  const labels = {
    wood: "목",
    fire: "화",
    earth: "토",
    metal: "금",
    water: "수",
  };

  return labels[value];
}

function resolvedCalendarLabel(value: "solar" | "lunar" | "unknown"): string {
  if (value === "solar") return "양력 기준";
  if (value === "lunar") return "음력 기준";
  return "달력 기준 미확정";
}

function kuseongReasonText(fortune: DailyFortune): string {
  const kuseong = fortune.analysis.hybrid.kuseong;
  if (!kuseong) {
    return "";
  }

  return `본명성 ${kuseong.natalYearStar}, 당월성 ${kuseong.currentMonthStar}, 일성 ${kuseong.currentDayStar} / 중점: ${kuseongFocusLabel(kuseong.focusCategories)} / 톤: ${kuseongToneLabel(kuseong.narrativeTone)}`;
}

function renderHighlightedText(text: string): ReactNode {
  const parts = text.split(EMPHASIS_PATTERN).filter(Boolean);

  return parts.map((part, index) =>
    EMPHASIS_TERM_SET.has(part) ? (
      <strong key={`${part}-${index}`} className={styles.inlineHighlight}>
        {part}
      </strong>
    ) : (
      <Fragment key={`${part}-${index}`}>{part}</Fragment>
    ),
  );
}

function categoryToneLabel(
  key: DailyFortune["categoryScores"][number]["key"],
  score: number,
): string {
  if (score >= 85) {
    if (key === "work") return "주도권 확보";
    if (key === "money") return "수익 흐름 우세";
    if (key === "relationship") return "호감 상승";
    return "회복력 상승";
  }

  if (score >= 70) {
    if (key === "work") return "안정 운영";
    if (key === "money") return "보수 운용";
    if (key === "relationship") return "유연 대응";
    return "리듬 회복";
  }

  if (score >= 55) {
    if (key === "work") return "속도 조절";
    if (key === "money") return "지출 점검";
    if (key === "relationship") return "거리 조절";
    return "휴식 우선";
  }

  if (key === "work") return "무리 금지";
  if (key === "money") return "지갑 단속";
  if (key === "relationship") return "감정 절제";
  return "회복 집중";
}

function ReadingGuide({ summary, intro, tips }: ReadingGuideProps) {
  return (
    <div className={styles.readingGuide}>
      <details className={styles.readingGuideDetails}>
        <summary>{summary}</summary>
        <p className={styles.readingGuideIntro}>{intro}</p>
        <ul className={styles.readingGuideList}>
          {tips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}

export function FortuneSections({ fortune, userId, referenceDate }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>("fortune");
  const [activeAnalysisTab, setActiveAnalysisTab] = useState<AnalysisTabKey>("manse");
  const topSignals = selectTopFortuneSignals(fortune.analysis.signals);
  const isCalendarUncertain = fortune.analysis.certainty === "calendar-unknown";
  const isBlendedReference = fortune.analysis.referenceMode === "solar-lunar-blend";
  const uncertaintyMessage =
    fortune.analysis.uncertaintyMessage ??
    "달력 기준이 확정되지 않아 참고용 풀이로만 보아야 하오.";
  const uncertaintySectionText = isBlendedReference
    ? "양력·음력 두 가능성을 함께 살핀 참고 운세이오."
    : uncertaintyMessage;
  const todayReasonText = isCalendarUncertain
    ? fortune.analysis.relationStrengthSummary
    : `오늘 일진 ${fortune.analysis.todayGanji}은 ${fortune.analysis.todayRelation} 흐름으로 들어오며, ${fortune.analysis.relationStrengthSummary}`;
  const fortuneLeadParagraphs = [fortune.headline, fortune.summary];

  return (
    <section className={styles.section}>
      <div className={styles.sectionTabs} role="tablist" aria-label="운세 상세 섹션">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "fortune"}
          className={`${styles.tabButton} ${activeTab === "fortune" ? styles.tabButtonActive : ""}`.trim()}
          onClick={() => setActiveTab("fortune")}
        >
          운세
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "analysis"}
          className={`${styles.tabButton} ${activeTab === "analysis" ? styles.tabButtonActive : ""}`.trim()}
          onClick={() => setActiveTab("analysis")}
        >
          분석
        </button>
      </div>

      {activeTab === "fortune" ? (
        <div className={styles.tabPanel}>
          <section className={`${styles.innerSection} ${styles.fortuneCard}`}>
            <div className={styles.fortuneCardContent}>
              <h2>도령의 한마디</h2>
              {fortuneLeadParagraphs.map((paragraph) => (
                <p key={paragraph}>{renderHighlightedText(paragraph)}</p>
              ))}
            </div>
            <div className={`${styles.fortuneCharacterOverlay} ${styles.fortuneCharacterPointer}`}>
              <Image
                src="/character_pointer.png"
                alt="도령 포인터 캐릭터"
                width={180}
                height={180}
                className={styles.fortuneCharacter}
                priority
              />
            </div>
          </section>

          {isCalendarUncertain ? (
            <section className={styles.innerSection}>
              <h2>달력 기준 미확정</h2>
              <div className={styles.reasonCard}>
                <div className={styles.reasonRow}>
                  <span className={styles.reasonLabel}>현재 안내</span>
                  <p className={styles.reasonText}>{uncertaintySectionText}</p>
                </div>
                <div className={styles.reasonRow}>
                  <span className={styles.reasonLabel}>정확히 보려면</span>
                  <p className={styles.reasonText}>
                    양력이나 음력을 다시 선택하면 만세력과 운세를 더 정확히 읽을 수 있소.
                  </p>
                </div>
              </div>
            </section>
          ) : null}

          <section className={styles.innerSection}>
            <h2>오늘의 신호</h2>
            <div className={styles.analysisGrid}>
              {topSignals.map((signal) => (
                <div key={signal.key} className={`${styles.reasonCard} ${styles.pointCard}`}>
                  <div className={styles.reasonRow}>
                    <span className={styles.reasonLabel}>{signal.label}</span>
                    <p className={styles.reasonText}>
                      <strong className={styles.inlineHighlight}>{signal.title}</strong>{" "}
                      {renderHighlightedText(signal.summary)}
                    </p>
                  </div>
                  <div className={styles.reasonRow}>
                    <span className={styles.reasonLabel}>움직임</span>
                    <p className={styles.reasonText}>{renderHighlightedText(signal.action)}</p>
                  </div>
                  {shouldRenderSignalCaution(signal) ? (
                    <div className={styles.reasonRow}>
                      <span className={styles.reasonLabel}>주의</span>
                      <p className={styles.reasonText}>{renderHighlightedText(signal.caution)}</p>
                    </div>
                  ) : null}
                  {signal.reasons.length > 0 ? (
                    <details className={styles.analysisExpand}>
                      <summary>근거 더 보기</summary>
                      <p className={styles.reasonText}>{renderHighlightedText(signal.reasons.join(" "))}</p>
                    </details>
                  ) : null}
                </div>
              ))}
            </div>
          </section>

          <section className={styles.innerSection}>
            <h2>오늘 풀이의 근거</h2>
            <details className={styles.analysisExpand}>
              <summary>핵심 근거 펼쳐 보기</summary>
              <div className={`${styles.reasonCard} ${styles.pointCard}`}>
                <div className={styles.reasonRow}>
                  <span className={styles.reasonLabel}>오늘 일진 작용</span>
                  <p className={styles.reasonText}>{renderHighlightedText(todayReasonText)}</p>
                </div>
                <div className={styles.reasonRow}>
                  <span className={styles.reasonLabel}>용신·기신 흐름</span>
                  <p className={styles.reasonText}>{renderHighlightedText(fortune.analysis.directiveSummary)}</p>
                </div>
                {fortune.analysis.hybrid.kuseong ? (
                  <div className={styles.reasonRow}>
                    <span className={styles.reasonLabel}>구성 보정</span>
                    <p className={styles.reasonText}>{renderHighlightedText(kuseongReasonText(fortune))}</p>
                  </div>
                ) : null}
                {fortune.analysis.todayBranchInteractions.length > 0 ? (
                  <div className={styles.reasonRow}>
                    <span className={styles.reasonLabel}>지지 상호작용</span>
                    <p className={styles.reasonText}>{renderHighlightedText(fortune.analysis.todayBranchSummary)}</p>
                  </div>
                ) : null}
                <div className={styles.pointFlowerOverlay} aria-hidden="true">
                  <Image
                    src="/flower.png"
                    alt=""
                    width={180}
                    height={180}
                    className={styles.pointFlower}
                  />
                </div>
              </div>
            </details>
          </section>

          <section className={`${styles.innerSection} ${styles.fortuneCard}`}>
            <div className={styles.fortuneCardContent}>
              <h2>오늘의 추천 행동</h2>
              <ol className={styles.numberedList}>
                {fortune.recommendedActions.map((action, index) => (
                  <li key={action} className={styles.numberedItem}>
                    <span className={styles.numberBadge} aria-hidden="true">
                      {index + 1}
                    </span>
                    <span className={styles.numberedText}>{renderHighlightedText(action)}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div className={`${styles.fortuneCharacterOverlay} ${styles.fortuneCharacterConcern}`}>
              <Image
                src="/character_concern.png"
                alt="고민하는 도령 캐릭터"
                width={180}
                height={180}
                className={styles.fortuneCharacter}
                priority
              />
            </div>
          </section>

          <section className={`${styles.innerSection} ${styles.fortuneCard}`}>
            <div className={styles.fortuneCardContent}>
              <h2>오늘 조심할 것</h2>
              <ol className={styles.numberedList}>
                {fortune.avoidToday.map((item, index) => (
                  <li key={item} className={styles.numberedItem}>
                    <span className={styles.numberBadge} aria-hidden="true">
                      {index + 1}
                    </span>
                    <span className={styles.numberedText}>{renderHighlightedText(item)}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div className={`${styles.fortuneCharacterOverlay} ${styles.fortuneWarningOverlay}`}>
              <Image
                src="/character_warning.png"
                alt="주의하는 도령 캐릭터"
                width={180}
                height={180}
                className={`${styles.fortuneCharacter} ${styles.fortuneCharacterWarningImage}`}
                priority
              />
            </div>
          </section>

          <section className={styles.innerSection}>
            <h2>오늘의 키워드</h2>
            <div className={styles.keywordChips}>
              {fortune.keywords.map((keyword) => (
                <span key={keyword} className={styles.keywordChip}>
                  {keyword}
                </span>
              ))}
            </div>
          </section>

          <section className={styles.innerSection}>
            <h2>영역별 흐름</h2>
            <div className={styles.categoryCards}>
              {fortune.categoryScores.map((category) => (
                <article key={category.key} className={styles.categoryCard}>
                  <div className={styles.categoryCardTop}>
                    <h3>{renderHighlightedText(category.label)}</h3>
                    <strong>{category.score}</strong>
                  </div>
                  <div className={styles.categoryMeter}>
                    <span className={styles.categoryMeterFill} style={{ width: `${category.score}%` }} />
                  </div>
                  <span className={styles.categoryTone}>
                    {renderHighlightedText(categoryToneLabel(category.key, category.score))}
                  </span>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.innerSection}>
            <h2>행운 포인트</h2>
            <div className={styles.luckyGrid}>
              <article className={styles.luckyCard}>
                <span className={styles.luckyLabel}>행운 색</span>
                <span className={styles.luckyValue}>{fortune.luckyHints.color}</span>
              </article>
              <article className={styles.luckyCard}>
                <span className={styles.luckyLabel}>방향</span>
                <span className={styles.luckyValue}>{fortune.luckyHints.direction}</span>
              </article>
              <article className={styles.luckyCard}>
                <span className={styles.luckyLabel}>장소</span>
                <span className={styles.luckyValue}>{fortune.luckyHints.place}</span>
              </article>
              <article className={styles.luckyCard}>
                <span className={styles.luckyLabel}>시간</span>
                <span className={styles.luckyValue}>{fortune.luckyHints.timing}</span>
              </article>
              <article className={`${styles.luckyCard} ${styles.luckyCardWide}`}>
                <span className={styles.luckyLabel}>숫자</span>
                <span className={styles.luckyValue}>{fortune.luckyHints.number}</span>
              </article>
            </div>
          </section>
        </div>
      ) : (
        <div className={styles.tabPanel}>
          <div className={styles.analysisTabs} role="tablist" aria-label="분석 세부 섹션">
            <button
              type="button"
              role="tab"
              aria-selected={activeAnalysisTab === "manse"}
              className={`${styles.analysisTabButton} ${activeAnalysisTab === "manse" ? styles.analysisTabButtonActive : ""}`.trim()}
              onClick={() => setActiveAnalysisTab("manse")}
            >
              만세력
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeAnalysisTab === "interpretation"}
              className={`${styles.analysisTabButton} ${activeAnalysisTab === "interpretation" ? styles.analysisTabButtonActive : ""}`.trim()}
              onClick={() => setActiveAnalysisTab("interpretation")}
            >
              명식
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeAnalysisTab === "elements"}
              className={`${styles.analysisTabButton} ${activeAnalysisTab === "elements" ? styles.analysisTabButtonActive : ""}`.trim()}
              onClick={() => setActiveAnalysisTab("elements")}
            >
              오행
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeAnalysisTab === "kuseong"}
              className={`${styles.analysisTabButton} ${activeAnalysisTab === "kuseong" ? styles.analysisTabButtonActive : ""}`.trim()}
              onClick={() => setActiveAnalysisTab("kuseong")}
            >
              구성
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeAnalysisTab === "yukhyo"}
              className={`${styles.analysisTabButton} ${activeAnalysisTab === "yukhyo" ? styles.analysisTabButtonActive : ""}`.trim()}
              onClick={() => setActiveAnalysisTab("yukhyo")}
            >
              육효
            </button>
          </div>

          {activeAnalysisTab === "manse" ? (
            <section className={styles.innerSection}>
              <h2>만세력 표</h2>
              <ReadingGuide
                intro="연·월·일·시 네 기둥에서 일주를 중심으로 나머지 기둥이 어떤 배경을 주는지 읽는 표입니다."
                summary="만세력 읽는 법"
                tips={[
                  "일주는 본인 성향의 중심으로 보고, 월주는 계절감과 생활 환경의 영향으로 읽습니다.",
                  "천간은 겉으로 드러나는 기운, 지지는 바탕과 관계 흐름으로 보면 됩니다.",
                  "지장간은 지지 안에 숨은 기운이라 겉보다 속의 동기나 잠재 성향을 볼 때 참고합니다.",
                ]}
              />
              {fortune.manse ? (
                <>
                  <div className={styles.manseMeta}>
                    <span className={styles.birthMeta}>양력 시각 {fortune.manse.solarDateTime}</span>
                    <span className={styles.birthMeta}>음력 {fortune.manse.lunarDateKorean}</span>
                    <span className={styles.birthMeta}>{resolvedCalendarLabel(fortune.manse.calendarTypeResolved)}</span>
                    {fortune.manse.usedNoonFallback ? <span className={styles.birthMeta}>출생시 미상으로 정오 기준</span> : null}
                  </div>

                  <div className={styles.manseMobileCards}>
                    {fortune.manse.pillars.map((pillar) => (
                      <article key={`mobile-${pillar.key}`} className={styles.manseCard}>
                        <div className={styles.manseCardHeader}>
                          <span>{pillar.label}</span>
                          <strong>{pillar.ganji}</strong>
                        </div>
                        <div className={styles.manseCardBody}>
                          <div className={styles.manseCardRow}>
                            <span className={styles.manseCardLabel}>천간</span>
                            <div className={styles.manseCardValue}>
                              <strong>{pillar.stem}</strong>
                              <span>{pillar.stemKorean}</span>
                            </div>
                          </div>
                          <div className={styles.manseCardRow}>
                            <span className={styles.manseCardLabel}>지지</span>
                            <div className={styles.manseCardValue}>
                              <strong>{pillar.branch}</strong>
                              <span>{pillar.branchKorean}</span>
                            </div>
                          </div>
                          <div className={styles.manseCardRow}>
                            <span className={styles.manseCardLabel}>지장간</span>
                            <div className={styles.manseCardValue}>
                              <span>{pillar.hiddenStems.join(" ") || "-"}</span>
                              <span>{pillar.hiddenStemsKorean.join(", ") || "없음"}</span>
                            </div>
                          </div>
                          <div className={styles.manseCardRow}>
                            <span className={styles.manseCardLabel}>납음</span>
                            <div className={styles.manseCardValue}>
                              <span>{pillar.naYin ?? "-"}</span>
                            </div>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>

                  <div className={styles.manseTableWrap}>
                    <table className={styles.manseTable}>
                      <thead>
                        <tr>
                          <th>구분</th>
                          {fortune.manse.pillars.map((pillar) => (
                            <th key={`head-${pillar.key}`}>{pillar.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <th>간지</th>
                          {fortune.manse.pillars.map((pillar) => (
                            <td key={`ganji-${pillar.key}`}>
                              <strong>{pillar.ganji}</strong>
                              <span>{pillar.ganjiKorean}</span>
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <th>천간</th>
                          {fortune.manse.pillars.map((pillar) => (
                            <td key={`stem-${pillar.key}`}>
                              <strong>{pillar.stem}</strong>
                              <span>{pillar.stemKorean}</span>
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <th>지지</th>
                          {fortune.manse.pillars.map((pillar) => (
                            <td key={`branch-${pillar.key}`}>
                              <strong>{pillar.branch}</strong>
                              <span>{pillar.branchKorean}</span>
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <th>지장간</th>
                          {fortune.manse.pillars.map((pillar) => (
                            <td key={`hidden-${pillar.key}`}>
                              <span>{pillar.hiddenStems.join(" ") || "-"}</span>
                              <span>{pillar.hiddenStemsKorean.join(", ") || "없음"}</span>
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <th>납음</th>
                          {fortune.manse.pillars.map((pillar) => (
                            <td key={`nayin-${pillar.key}`}>
                              <span>{pillar.naYin ?? "-"}</span>
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <p className={styles.analysisEmpty}>
                  {isCalendarUncertain
                    ? "달력 기준이 미확정이라 만세력 표를 확정 결과처럼 보여줄 수 없소. 양력이나 음력을 다시 정하면 정확한 표가 열리오."
                    : "현재 프로필에는 만세력 표를 만들 수 있는 명식 정보가 부족합니다."}
                </p>
              )}
            </section>
          ) : null}

          {activeAnalysisTab === "interpretation" ? (
            <section className={styles.innerSection}>
              <div className={styles.analysisHeader}>
                <div>
                  <h2>{isBlendedReference ? "양력·음력 공통 경향" : "명식 해석"}</h2>
                </div>
              </div>
              <ReadingGuide
                intro={
                  isBlendedReference
                    ? "이 영역은 양력과 음력 두 가능성에서 함께 남는 오행 흐름과 보완 방향을 읽는 참고 해석입니다."
                    : "명식은 내 사주의 균형과 작동 방식을 읽는 영역입니다. 강약, 격국 후보, 용신을 먼저 보면 흐름이 잡힙니다."
                }
                summary={isBlendedReference ? "공통 경향 읽는 법" : "명식 읽는 법"}
                tips={
                  isBlendedReference
                    ? [
                        "양력과 음력에서 함께 겹치는 흐름만 추려 보여줍니다.",
                        "큰 결정은 달력 기준을 정한 뒤 다시 보는 편이 안전합니다.",
                      ]
                    : [
                        "강약은 내가 기운을 감당하는 힘이 어느 정도인지 보는 기준입니다.",
                        "격국 후보는 명식이 어떤 방식으로 움직이는지 읽는 틀이고, 용신은 균형을 잡는 보완 방향입니다.",
                        "합충형은 관계와 사건의 마찰 지점을 보여주므로 세부 해석은 아래 근거 카드와 같이 보는 편이 정확합니다.",
                      ]
                }
              />

              <div className={styles.analysisHero}>
                <article className={styles.analysisSummaryCard}>
                  <p className={styles.analysisEyebrow}>{isBlendedReference ? "공통 참고 해석" : "핵심 해석"}</p>
                  <h3>{fortune.analysis.patternName}</h3>
                  <p>{fortune.analysis.patternSummary}</p>
                  <div className={styles.analysisMetaRow}>
                    <span className={styles.analysisMetaPill}>{strengthLevelLabel(fortune.analysis.strengthLevel)}</span>
                    <span className={styles.analysisMetaPill}>{fortune.analysis.patternRevealLabel}</span>
                    <span className={styles.analysisMetaPill}>일진 {fortune.analysis.todayGanji}</span>
                  </div>
                  <p className={styles.analysisLead}>{fortune.analysis.balanceSummary}</p>
                  <div className={styles.analysisInsightList}>
                    {isCalendarUncertain && !isBlendedReference ? (
                      <div className={styles.analysisInsightItem}>
                        <span className={styles.analysisInsightLabel}>달력 기준 상태</span>
                        <p className={styles.analysisInsightText}>{uncertaintyMessage}</p>
                      </div>
                    ) : null}
                    <div className={styles.analysisInsightItem}>
                      <span className={styles.analysisInsightLabel}>오늘 일진 해석</span>
                      <p className={styles.analysisInsightText}>{fortune.analysis.relationStrengthSummary}</p>
                    </div>
                    <div className={styles.analysisInsightItem}>
                      <span className={styles.analysisInsightLabel}>용신·기신 적중</span>
                      <p className={styles.analysisInsightText}>{fortune.analysis.directiveSummary}</p>
                    </div>
                  </div>
                </article>

                <div className={styles.analysisMetricGrid}>
                  <article className={styles.analysisMetricCard}>
                    <p className={styles.analysisMetricLabel}>일간 세기</p>
                    <strong className={styles.analysisMetricValue}>{strengthLevelLabel(fortune.analysis.strengthLevel)}</strong>
                    <span className={styles.analysisMetricMeta}>강약 점수 {fortune.analysis.strengthScore}</span>
                  </article>
                  <article className={styles.analysisMetricCard}>
                    <p className={styles.analysisMetricLabel}>용신</p>
                    <strong className={styles.analysisMetricValue}>{elementLabel(fortune.analysis.yongShin)}</strong>
                    <span className={styles.analysisMetricMeta}>{fortune.analysis.todayRelation}</span>
                  </article>
                </div>
              </div>

              <details className={styles.analysisExpand}>
                <summary>세부 근거 더 보기</summary>
                <div className={styles.analysisGrid}>
                <article className={styles.analysisCard}>
                  <p className={styles.analysisEyebrow}>일간 세기</p>
                  <h3>{strengthLevelLabel(fortune.analysis.strengthLevel)}</h3>
                  <p>{fortune.analysis.strengthSummary}</p>
                  <p className={styles.analysisMeta}>강약 점수 {fortune.analysis.strengthScore}</p>
                </article>

                <article className={styles.analysisCard}>
                  <p className={styles.analysisEyebrow}>{isBlendedReference ? "공통 참고 축" : "월령 작용"}</p>
                  <h3>{fortune.analysis.dominantTenGod}</h3>
                  <p>{fortune.analysis.seasonalSummary}</p>
                  <p className={styles.analysisMeta}>통근 {fortune.analysis.rootCount}개</p>
                </article>

                <article className={styles.analysisCard}>
                  <p className={styles.analysisEyebrow}>{isBlendedReference ? "공통 흐름" : "격국 후보"}</p>
                  <h3>{fortune.analysis.patternName}</h3>
                  <p>{fortune.analysis.patternSummary}</p>
                  <p className={styles.analysisMeta}>
                    {fortune.analysis.patternRevealLabel}
                    {fortune.analysis.patternTentative ? " · 보수적 추정" : " · 투간 확인"}
                  </p>
                  {fortune.analysis.patternCandidates.length > 0 ? (
                    <ul className={styles.analysisList}>
                      {fortune.analysis.patternCandidates.map((item) => (
                        <li key={`${item.stem}-${item.tenGod}`}>
                          <strong>
                            {item.stem}
                            {item.stemKorean}
                          </strong>{" "}
                          · {item.tenGod} · 비중 {item.weight}
                          {item.revealed ? " · 투간" : ""}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </article>
                </div>

                <div className={styles.analysisBoard}>
                <article className={styles.analysisPanel}>
                  <div className={styles.analysisPanelSection}>
                    <h3 className={styles.subheading}>길한 오행</h3>
                    <div className={styles.chips}>
                      {fortune.analysis.usefulElements.map((item) => (
                        <span key={`useful-${item}`} className={styles.goodChip}>
                          {elementLabel(item)}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className={styles.analysisPanelSection}>
                    <h3 className={styles.subheading}>부담 오행</h3>
                    <div className={styles.chips}>
                      {fortune.analysis.unfavorableElements.map((item) => (
                        <span key={`unfavorable-${item}`} className={styles.badChip}>
                          {elementLabel(item)}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className={styles.analysisPanelSection}>
                    <h3 className={styles.subheading}>용신과 희기</h3>
                    <details className={styles.analysisDetails}>
                      <summary>용신·희신·기신·구신 자세히 보기</summary>
                      <div className={styles.directiveStack}>
                        <div className={styles.directiveRow}>
                          <p className={styles.analysisMeta}>용신</p>
                          <div className={styles.chips}>
                            <span className={styles.goodChip}>{elementLabel(fortune.analysis.yongShin)}</span>
                          </div>
                        </div>

                        <div className={styles.directiveRow}>
                          <p className={styles.analysisMeta}>희신</p>
                          <div className={styles.chips}>
                            {fortune.analysis.heeShin.length > 0 ? (
                              fortune.analysis.heeShin.map((item) => (
                                <span key={`hee-${item}`} className={styles.goodChip}>
                                  {elementLabel(item)}
                                </span>
                              ))
                            ) : (
                              <span className={styles.analysisEmpty}>보조 오행은 상황 따라 달라집니다.</span>
                            )}
                          </div>
                        </div>

                        <div className={styles.directiveRow}>
                          <p className={styles.analysisMeta}>기신</p>
                          <div className={styles.chips}>
                            <span className={styles.badChip}>{elementLabel(fortune.analysis.giShin)}</span>
                          </div>
                        </div>

                        <div className={styles.directiveRow}>
                          <p className={styles.analysisMeta}>구신</p>
                          <div className={styles.chips}>
                            {fortune.analysis.guShin.length > 0 ? (
                              fortune.analysis.guShin.map((item) => (
                                <span key={`gu-${item}`} className={styles.badChip}>
                                  {elementLabel(item)}
                                </span>
                              ))
                            ) : (
                              <span className={styles.analysisEmpty}>구신은 유동적이라 보수적으로 비워 두었습니다.</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </details>
                  </div>
                </article>

                <article className={styles.analysisPanel}>
                  <div className={styles.analysisPanelSection}>
                    <h3 className={styles.subheading}>{isBlendedReference ? "십신 표시" : "천간 십신"}</h3>
                    {fortune.analysis.visibleTenGods.length > 0 ? (
                      <ul className={styles.analysisList}>
                        {fortune.analysis.visibleTenGods.map((item) => (
                          <li key={`${item.pillar}-${item.stem}`}>
                            <strong>{item.pillarLabel}</strong> {item.stem}
                            {item.stemKorean} · {item.tenGod}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className={styles.analysisEmpty}>
                        {isBlendedReference
                          ? "공통 참고 해석이라 천간 십신 표는 생략했소."
                          : "표시할 천간 십신 정보가 없습니다."}
                      </p>
                    )}
                  </div>

                  <div className={styles.analysisPanelSection}>
                    <h3 className={styles.subheading}>지지 합충형</h3>
                    {fortune.analysis.branchRelations.length > 0 ? (
                      <ul className={styles.analysisList}>
                        {fortune.analysis.branchRelations.map((item) => (
                          <li key={`${item.label}-${item.type}`}>
                            <strong>{item.label}</strong> {item.description}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className={styles.analysisEmpty}>
                        {isBlendedReference
                          ? "공통 참고 해석이라 지지 합충형은 생략했소."
                          : "눈에 띄는 합충형 충돌은 없는 편입니다."}
                      </p>
                    )}
                  </div>
                </article>
                </div>
              </details>
            </section>
          ) : null}

          {activeAnalysisTab === "elements" ? (
            <section className={styles.innerSection}>
              <h2>오행 분석</h2>
              <ReadingGuide
                intro="오행 분포를 먼저 보고, 강한 기운과 비어 있는 기운을 함께 읽는 섹션입니다."
                summary="오행 읽는 법"
                tips={[
                  "많고 적음보다 전체 균형을 먼저 봅니다.",
                  "용신과 오늘의 일진 해석을 함께 연결해서 읽는 편이 좋습니다.",
                  "구성 보정은 다음 탭에서 별도로 확인합니다.",
                ]}
              />
              <div className={`${styles.graphCard} ${styles.graphCardPadded}`}>
                <div className={styles.graphHeader}>
                  <div>
                    <p className={styles.graphEyebrow}>Five Elements</p>
                    <h3>사주 오행 그래프</h3>
                  </div>
                </div>
                <p className={styles.graphCopy}>
                  오행이 어디에 몰리고 비는지 한눈에 보는 요약입니다. 많고 적음보다 전체 균형을 먼저 보는 편이 맞습니다.
                </p>
                <FiveElementsChart elements={fortune.elements} />
              </div>
            </section>
          ) : null}

          {activeAnalysisTab === "kuseong" ? (
            <section className={styles.innerSection}>
              <h2>구성 분석</h2>
              <ReadingGuide
                intro="구성은 오늘의 보정 흐름과 방위 배치를 보는 보조 해석입니다."
                summary="구성 읽는 법"
                tips={[
                  "모바일에서는 3x3 전체 배치를 한 번에 보고, 그다음 각 궁의 토큰을 읽는 편이 좋습니다.",
                  "본명성, 월성, 일성을 함께 봐야 오늘의 보정이 선명해집니다.",
                  "과한 단정 대신 방향성과 타이밍 참고에 쓰는 편이 맞습니다.",
                ]}
              />
              <KuseongChartSection fortune={fortune} />
            </section>
          ) : null}

          {activeAnalysisTab === "yukhyo" ? (
            <section className={styles.innerSection}>
              <h2>육효 분석</h2>
              <ReadingGuide
                intro="질문형 육효를 따로 떼어, 괘상과 관계망을 집중해서 볼 수 있게 한 섹션입니다."
                summary="육효 읽는 법"
                tips={[
                  "질문 문장이 바뀌면 결과도 함께 달라집니다.",
                  "본괘, 변괘, 동효를 분리하지 말고 같이 읽어야 합니다.",
                  "이 탭은 결정문보다 방향 참고에 가깝습니다.",
                ]}
              />
              <YukhyoChartSection userId={userId} referenceDate={referenceDate} />
            </section>
          ) : null}
        </div>
      )}
    </section>
  );
}

