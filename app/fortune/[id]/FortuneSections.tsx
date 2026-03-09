"use client";

import Image from "next/image";
import { useState } from "react";
import type { DailyFortune } from "../../../lib/fortune";
import { FiveElementsChart } from "./FiveElementsChart";
import styles from "./page.module.css";

type Props = {
  fortune: DailyFortune;
};

type TabKey = "fortune" | "analysis";
type AnalysisTabKey = "manse" | "interpretation" | "graph";

type ReadingGuideProps = {
  summary: string;
  intro: string;
  tips: string[];
};

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

function resolvedCalendarLabel(value: "solar" | "lunar"): string {
  return value === "solar" ? "양력 기준" : "음력 기준";
}

function ReadingGuide({ summary, intro, tips }: ReadingGuideProps) {
  return (
    <div className={styles.readingGuide}>
      <p className={styles.readingGuideIntro}>{intro}</p>
      <details className={styles.readingGuideDetails}>
        <summary>{summary}</summary>
        <ul className={styles.readingGuideList}>
          {tips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}

export function FortuneSections({ fortune }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>("fortune");
  const [activeAnalysisTab, setActiveAnalysisTab] = useState<AnalysisTabKey>("manse");

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
              <p>{fortune.headline}</p>
              <p>{fortune.detail}</p>
              <p>{fortune.summary}</p>
              <p>{fortune.caution}</p>
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
                    <h3>{category.label}</h3>
                    <strong>{category.score}</strong>
                  </div>
                  <div className={styles.categoryMeter}>
                    <span className={styles.categoryMeterFill} style={{ width: `${category.score}%` }} />
                  </div>
                  <p>{category.summary}</p>
                </article>
              ))}
            </div>
          </section>

          <section className={`${styles.innerSection} ${styles.fortuneCard}`}>
            <div className={styles.fortuneCardContent}>
              <h2>오늘의 추천 행동</h2>
              <ul className={styles.actions}>
                {fortune.recommendedActions.map((action) => (
                  <li key={action}>{action}</li>
                ))}
              </ul>
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
              <ul className={styles.cautionList}>
                {fortune.avoidToday.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
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
            <h2>행운 포인트</h2>
            <div className={styles.luckyGrid}>
              <article className={styles.luckyCard}>
                <span className={styles.luckyLabel}>행운 색</span>
                <strong>{fortune.luckyHints.color}</strong>
              </article>
              <article className={styles.luckyCard}>
                <span className={styles.luckyLabel}>방향</span>
                <strong>{fortune.luckyHints.direction}</strong>
              </article>
              <article className={styles.luckyCard}>
                <span className={styles.luckyLabel}>장소</span>
                <strong>{fortune.luckyHints.place}</strong>
              </article>
              <article className={styles.luckyCard}>
                <span className={styles.luckyLabel}>시간</span>
                <strong>{fortune.luckyHints.timing}</strong>
              </article>
              <article className={`${styles.luckyCard} ${styles.luckyCardWide}`}>
                <span className={styles.luckyLabel}>숫자</span>
                <strong>{fortune.luckyHints.number}</strong>
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
              aria-selected={activeAnalysisTab === "graph"}
              className={`${styles.analysisTabButton} ${activeAnalysisTab === "graph" ? styles.analysisTabButtonActive : ""}`.trim()}
              onClick={() => setActiveAnalysisTab("graph")}
            >
              그래프
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
                <p className={styles.analysisEmpty}>현재 프로필에는 만세력 표를 만들 수 있는 명식 정보가 부족합니다.</p>
              )}
            </section>
          ) : null}

          {activeAnalysisTab === "interpretation" ? (
            <section className={styles.innerSection}>
              <div className={styles.analysisHeader}>
                <div>
                  <h2>명식 해석</h2>
                </div>
                <p className={styles.analysisCaption}>핵심부터 읽고, 아래에서 세부 근거를 확인할 수 있게 정리했습니다.</p>
              </div>
              <ReadingGuide
                intro="명식은 내 사주의 균형과 작동 방식을 읽는 영역입니다. 강약, 격국 후보, 용신을 먼저 보면 흐름이 잡힙니다."
                summary="명식 읽는 법"
                tips={[
                  "강약은 내가 기운을 감당하는 힘이 어느 정도인지 보는 기준입니다.",
                  "격국 후보는 명식이 어떤 방식으로 움직이는지 읽는 틀이고, 용신은 균형을 잡는 보완 방향입니다.",
                  "합충형은 관계와 사건의 마찰 지점을 보여주므로 세부 해석은 아래 근거 카드와 같이 보는 편이 정확합니다.",
                ]}
              />

              <div className={styles.analysisHero}>
                <article className={styles.analysisSummaryCard}>
                  <p className={styles.analysisEyebrow}>핵심 해석</p>
                  <h3>{fortune.analysis.patternName}</h3>
                  <p>{fortune.analysis.patternSummary}</p>
                  <div className={styles.analysisMetaRow}>
                    <span className={styles.analysisMetaPill}>{strengthLevelLabel(fortune.analysis.strengthLevel)}</span>
                    <span className={styles.analysisMetaPill}>{fortune.analysis.patternRevealLabel}</span>
                    <span className={styles.analysisMetaPill}>일진 {fortune.analysis.todayGanji}</span>
                  </div>
                  <p className={styles.analysisLead}>{fortune.analysis.balanceSummary}</p>
                </article>

                <div className={styles.analysisMetricGrid}>
                  <article className={styles.analysisMetricCard}>
                    <p className={styles.analysisMetricLabel}>일간 세기</p>
                    <strong className={styles.analysisMetricValue}>{strengthLevelLabel(fortune.analysis.strengthLevel)}</strong>
                    <span className={styles.analysisMetricMeta}>강약 점수 {fortune.analysis.strengthScore}</span>
                  </article>
                  <article className={styles.analysisMetricCard}>
                    <p className={styles.analysisMetricLabel}>월령 중심</p>
                    <strong className={styles.analysisMetricValue}>{fortune.analysis.dominantTenGod}</strong>
                    <span className={styles.analysisMetricMeta}>통근 {fortune.analysis.rootCount}개</span>
                  </article>
                  <article className={styles.analysisMetricCard}>
                    <p className={styles.analysisMetricLabel}>오늘 일진</p>
                    <strong className={styles.analysisMetricValue}>{fortune.analysis.todayGanji}</strong>
                    <span className={styles.analysisMetricMeta}>{fortune.analysis.todayRelation}</span>
                  </article>
                  <article className={styles.analysisMetricCard}>
                    <p className={styles.analysisMetricLabel}>용신</p>
                    <strong className={styles.analysisMetricValue}>{elementLabel(fortune.analysis.yongShin)}</strong>
                    <span className={styles.analysisMetricMeta}>보완 중심 오행</span>
                  </article>
                </div>
              </div>

              <div className={styles.analysisGrid}>
                <article className={styles.analysisCard}>
                  <p className={styles.analysisEyebrow}>일간 세기</p>
                  <h3>{strengthLevelLabel(fortune.analysis.strengthLevel)}</h3>
                  <p>{fortune.analysis.strengthSummary}</p>
                  <p className={styles.analysisMeta}>강약 점수 {fortune.analysis.strengthScore}</p>
                </article>

                <article className={styles.analysisCard}>
                  <p className={styles.analysisEyebrow}>월령 작용</p>
                  <h3>{fortune.analysis.dominantTenGod}</h3>
                  <p>{fortune.analysis.seasonalSummary}</p>
                  <p className={styles.analysisMeta}>통근 {fortune.analysis.rootCount}개</p>
                </article>

                <article className={styles.analysisCard}>
                  <p className={styles.analysisEyebrow}>격국 후보</p>
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
                    <p>{fortune.analysis.balanceSummary}</p>
                  </div>
                </article>

                <article className={styles.analysisPanel}>
                  <div className={styles.analysisPanelSection}>
                    <h3 className={styles.subheading}>천간 십신</h3>
                    <ul className={styles.analysisList}>
                      {fortune.analysis.visibleTenGods.map((item) => (
                        <li key={`${item.pillar}-${item.stem}`}>
                          <strong>{item.pillarLabel}</strong> {item.stem}
                          {item.stemKorean} · {item.tenGod}
                        </li>
                      ))}
                    </ul>
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
                      <p className={styles.analysisEmpty}>눈에 띄는 합충형 충돌은 없는 편입니다.</p>
                    )}
                  </div>
                </article>
              </div>
            </section>
          ) : null}

          {activeAnalysisTab === "graph" ? (
            <section className={styles.innerSection}>
              <h2>사주 오행 그래프</h2>
              <ReadingGuide
                intro="그래프는 오행이 어디에 몰리고 비는지 한눈에 보는 요약입니다. 많고 적음보다 전체 균형을 먼저 보는 편이 맞습니다."
                summary="오행 그래프 읽는 법"
                tips={[
                  "특정 오행이 높으면 그 성향이 강하게 드러날 수 있지만, 항상 좋거나 나쁜 뜻은 아닙니다.",
                  "낮은 오행은 부족한 자원이나 보완 포인트로 보고, 용신과 같이 해석하는 것이 안전합니다.",
                  "오늘 운세는 이 기본 분포 위에 오늘 일진이 어떤 자극을 주는지 덧붙여 읽습니다.",
                ]}
              />
              <FiveElementsChart elements={fortune.elements} />
            </section>
          ) : null}
        </div>
      )}
    </section>
  );
}
