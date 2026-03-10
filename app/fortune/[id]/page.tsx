import Image from "next/image";
import { notFound } from "next/navigation";
import { verifyFortuneAccessToken } from "../../../lib/access-token";
import { generateDailyFortuneWithNarrative } from "../../../lib/fortune";
import { formatSeoulDateLabel, formatStoredDate } from "../../../lib/seoul-time";
import { FortuneSections } from "./FortuneSections";
import styles from "./page.module.css";

type PageProps = {
  params: { id: string };
  searchParams?: {
    token?: string;
  };
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

function calendarTypeLabel(value: string): string {
  if (value === "solar") return "양력";
  if (value === "lunar") return "음력";
  return "모름";
}

async function findStoredProfile(userId: string) {
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_PRISMA_URL) {
    return null;
  }

  const { prisma } = await import("../../../lib/prisma");
  return prisma.sajuProfile.findUnique({
    where: { userId },
    select: {
      userId: true,
      name: true,
      birthDate: true,
      birthTime: true,
      calendarType: true,
      sajuData: true,
    },
  });
}

export default async function FortuneDetailPage({ params, searchParams }: PageProps) {
  const { id } = params;
  const accessToken = searchParams?.token?.trim();

  if (id !== SAMPLE_PROFILE.userId) {
    const tokenCheck = verifyFortuneAccessToken(accessToken, id);
    if (!tokenCheck.ok) {
      notFound();
    }
  }

  const storedProfile = id === SAMPLE_PROFILE.userId ? null : await findStoredProfile(id);
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

  return (
    <main className={styles.container}>
      <section className={styles.paper}>
        <header className={styles.hero}>
          <div className={styles.heroText}>
            <p className={styles.label}>{isSampleProfile ? "운세도령 샘플 결과" : "운세도령 상세 결과"}</p>
            <h1 className={styles.title}>{profile.name ? `${profile.name} 님의 금일 운세` : "금일 운세"}</h1>
            <p className={styles.date}>{formatSeoulDateLabel(today)}</p>
            <p className={styles.birthMeta}>
              출생 {formatStoredDate(profile.birthDate)} · {profile.birthTime ?? "미상"} · {calendarTypeLabel(profile.calendarType)}
            </p>
            {isSampleProfile ? (
              <p className={styles.birthMeta}>DB 없이 확인할 수 있는 데모 프로필입니다.</p>
            ) : null}
          </div>
          <div className={styles.heroVisual}>
            <Image src="/card.png" alt="운세 카드 일러스트" width={360} height={360} className={styles.heroCard} priority />
          </div>
        </header>

        <section className={styles.scoreBox}>
          <p className={styles.scoreLabel}>오늘의 운세 점수</p>
          <p className={styles.scoreValue}>{fortune.score}</p>
          <p className={styles.scoreGrade}>{fortune.grade}</p>
          <div className={styles.sourceBadges}>
            {fortune.analysis.hybrid.sources.map((source) => (
              <span key={source.key} className={styles.sourceBadge}>
                {source.label}
              </span>
            ))}
          </div>
        </section>

        <FortuneSections fortune={fortune} userId={profile.userId} referenceDate={today.toISOString()} />
      </section>
    </main>
  );
}
