import Image from "next/image";
import { notFound } from "next/navigation";
import { generateDailyFortune } from "../../../lib/fortune";
import { prisma } from "../../../lib/prisma";
import { FiveElementsChart } from "./FiveElementsChart";
import styles from "./page.module.css";

type PageProps = {
  params: { id: string };
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

export default async function FortuneDetailPage({ params }: PageProps) {
  const { id } = params;
  const profile = await prisma.sajuProfile.findUnique({
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

  if (!profile) {
    notFound();
  }

  const today = new Date();
  const fortune = generateDailyFortune({
    userId: profile.userId,
    birthDate: profile.birthDate,
    birthTime: profile.birthTime ?? undefined,
    calendarType: profile.calendarType as "solar" | "lunar" | "unknown",
    sajuData: profile.sajuData,
    date: today,
  });

  const birthTimeLabel = profile.birthTime ?? "미상";
  const calendarLabel = calendarTypeLabel(profile.calendarType);

  return (
    <main className={styles.container}>
      <section className={styles.paper}>
        <header className={styles.hero}>
          <div className={styles.heroText}>
            <p className={styles.label}>운세도령 상세 풀이</p>
            <h1 className={styles.title}>{profile.name ? `${profile.name} 님의 금일 점괘` : "금일 점괘"}</h1>
            <p className={styles.date}>{formatKoreanDate(today)}</p>
            <p className={styles.birthMeta}>
              출생 {formatBirthDate(profile.birthDate)} · {birthTimeLabel} · {calendarLabel}
            </p>
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
