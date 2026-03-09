import Image from "next/image";
import { notFound } from "next/navigation";
import { generateDailyFortuneWithNarrative } from "../../../lib/fortune";
import { prisma } from "../../../lib/prisma";
import { FiveElementsChart } from "./FiveElementsChart";
import styles from "./page.module.css";

type PageProps = {
  params: { id: string };
};

const SAMPLE_PROFILE = {
  userId: "sample-user",
  name: "홍길동",
  birthDate: new Date(Date.UTC(1995, 9, 21)),
  birthTime: "14:30",
  calendarType: "solar" as const,
  sajuData: {
    source: "local-sample",
    fiveElements: {
      wood: 28,
      fire: 22,
      earth: 18,
      metal: 17,
      water: 15,
    },
  },
};

function formatKoreanDate(date: Date): string {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(date);
}

function formatBirthDate(date: Date): string {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function calendarTypeLabel(value: string): string {
  if (value === "solar") return "양력";
  if (value === "lunar") return "음력";
  return "모름";
}

function strengthLevelLabel(value: "strong" | "balanced" | "weak"): string {
  if (value === "strong") return "신강";
  if (value === "weak") return "신약";
  return "중화";
}

function elementLabel(value: "wood" | "fire" | "earth" | "metal" | "water"): string {
  const labels = {
    wood: "목(木)",
    fire: "화(火)",
    earth: "토(土)",
    metal: "금(金)",
    water: "수(水)",
  };

  return labels[value];
}

export default async function FortuneDetailPage({ params }: PageProps) {
  const { id } = params;
  const storedProfile =
    id === SAMPLE_PROFILE.userId
      ? null
      : await prisma.sajuProfile.findUnique({
          where: { userId: id },
          select: {
            userId: true,
            name: true,
            birthDate: true,
            birthTime: true,
            calendarType: true,
            sajuData: true,
          },
        });

  const isSampleProfile = !storedProfile && id === SAMPLE_PROFILE.userId;
  const profile = storedProfile ?? (isSampleProfile ? SAMPLE_PROFILE : null);

  if (!profile) {
    notFound();
  }

  const today = new Date();
  const fortune = await generateDailyFortuneWithNarrative({
    userId: profile.userId,
    birthDate: profile.birthDate,
    birthTime: profile.birthTime ?? undefined,
    calendarType: profile.calendarType as "solar" | "lunar" | "unknown",
    sajuData: profile.sajuData,
    date: today,
    profileName: profile.name ?? undefined,
  });

  const birthTimeLabel = profile.birthTime ?? "미상";
  const calendarLabel = calendarTypeLabel(profile.calendarType);

  return (
    <main className={styles.container}>
      <section className={styles.paper}>
        <header className={styles.hero}>
          <div className={styles.heroText}>
            <p className={styles.label}>{isSampleProfile ? "운세도령 샘플 풀이" : "운세도령 상세 풀이"}</p>
            <h1 className={styles.title}>{profile.name ? `${profile.name} 님의 금일 점괘` : "금일 점괘"}</h1>
            <p className={styles.date}>{formatKoreanDate(today)}</p>
            <p className={styles.birthMeta}>
              출생 {formatBirthDate(profile.birthDate)} · {birthTimeLabel} · {calendarLabel}
            </p>
            {isSampleProfile ? <p className={styles.birthMeta}>DB 없이 확인할 수 있는 데모 프로필입니다.</p> : null}
          </div>
          <div className={styles.heroVisual}>
            <Image src="/card.png" alt="운세 카드 일러스트" width={360} height={360} className={styles.heroCard} priority />
          </div>
        </header>

        <section className={styles.scoreBox}>
          <p className={styles.scoreLabel}>오늘의 운세 점수</p>
          <p className={styles.scoreValue}>{fortune.score}</p>
          <p className={styles.scoreGrade}>{fortune.grade}</p>
        </section>

        <section className={styles.section}>
          <h2>도령의 한마디</h2>
          <p>{fortune.headline}</p>
          <p>{fortune.detail}</p>
          <p>{fortune.summary}</p>
          <p>{fortune.caution}</p>
        </section>

        <section className={styles.section}>
          <h2>명식 해석</h2>
          <div className={styles.analysisGrid}>
            <article className={styles.analysisCard}>
              <p className={styles.analysisEyebrow}>일간 세</p>
              <h3>{strengthLevelLabel(fortune.analysis.strengthLevel)}</h3>
              <p>{fortune.analysis.strengthSummary}</p>
              <p className={styles.analysisMeta}>강약 점수 {fortune.analysis.strengthScore}</p>
            </article>

            <article className={styles.analysisCard}>
              <p className={styles.analysisEyebrow}>월령 작용</p>
              <h3>{fortune.analysis.dominantTenGod}</h3>
              <p>{fortune.analysis.seasonalSummary}</p>
              <p className={styles.analysisMeta}>통근 {fortune.analysis.rootCount}곳</p>
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

          <div className={styles.analysisColumns}>
            <div>
              <h3 className={styles.subheading}>길한 오행</h3>
              <div className={styles.chips}>
                {fortune.analysis.usefulElements.map((item) => (
                  <span key={`useful-${item}`} className={styles.goodChip}>
                    {elementLabel(item)}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h3 className={styles.subheading}>부담 오행</h3>
              <div className={styles.chips}>
                {fortune.analysis.unfavorableElements.map((item) => (
                  <span key={`unfavorable-${item}`} className={styles.badChip}>
                    {elementLabel(item)}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.analysisColumns}>
            <div>
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

            <div>
              <h3 className={styles.subheading}>천간 십신</h3>
              <ul className={styles.analysisList}>
                {fortune.analysis.visibleTenGods.map((item) => (
                  <li key={`${item.pillar}-${item.stem}`}>
                    <strong>{item.pillarLabel}</strong> {item.stem}{item.stemKorean} · {item.tenGod}
                  </li>
                ))}
              </ul>
            </div>

            <div>
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
                <p className={styles.analysisEmpty}>눈에 띄는 합충형 충돌은 약한 편입니다.</p>
              )}
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <h2>사주 오행 그래프</h2>
          <FiveElementsChart elements={fortune.elements} />
        </section>

        <section className={styles.section}>
          <h2>오늘의 추천 행동</h2>
          <ul className={styles.actions}>
            {fortune.recommendedActions.map((action) => (
              <li key={action}>{action}</li>
            ))}
          </ul>
        </section>
      </section>
    </main>
  );
}
