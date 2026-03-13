import React from "react";
import Image from "next/image";
import { notFound } from "next/navigation";
import { verifyFortuneAccessToken } from "../../../lib/access-token";
import { generateDailyFortuneWithNarrative } from "../../../lib/fortune";
import {
  findRecentQuestionHistoryByUserId,
  type QuestionHistoryItem,
} from "../../../lib/fortune-question-history";
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

const SAMPLE_QUESTION_HISTORY: QuestionHistoryItem[] = [
  {
    id: "sample-history-1",
    questionText: "오늘 먼저 연락을 넣어도 괜찮을까?",
    title: "도령의 관계 판단",
    description:
      "관계 흐름은 열려 있으나 말이 너무 길어지면 타이밍이 흐트러질 수 있소. 짧은 안부로 시작해 반응을 보고 다음 말을 잇는 편이 낫소.",
    askedDateKey: "2026-03-10",
    source: "kakao",
    createdAtLabel: "03. 10. 08:40",
    primarySignalKey: "relationship",
    secondarySignalKey: "timing",
    conflictResolutionStatus: "aligned",
    conflictResolutionPolicy: null,
  },
  {
    id: "sample-history-2",
    questionText: "오늘 계약 이야기를 바로 꺼내도 될까?",
    title: "도령의 계약 판단",
    description:
      "재물 쪽 기회는 있으나 마찰 신호도 함께 올라오는 날이오. 성급히 결론을 밀기보다 조건표와 순서를 먼저 세우는 편이 꼬임을 줄이오.",
    askedDateKey: "2026-03-09",
    source: "kakao",
    createdAtLabel: "03. 09. 19:20",
    primarySignalKey: "money",
    secondarySignalKey: "friction",
    conflictResolutionStatus: "question-signal-conflict",
    conflictResolutionPolicy: "기회가 보여도 오늘은 속도를 앞세우기보다 확인과 정리를 먼저 두는 쪽이 맞는 날이오.",
  },
  {
    id: "sample-history-3",
    questionText: "오늘 할 일을 강하게 밀어붙여도 될까?",
    title: "도령의 일운 판단",
    description:
      "일과 흐름과 추진 신호가 같이 살아 있어 추진은 가능하오. 다만 중간 점검 없이 밀어붙이면 피로가 빨리 올라오니 한 번씩 호흡을 끊어 가며 가는 편이 좋소.",
    askedDateKey: "2026-03-08",
    source: "kakao",
    createdAtLabel: "03. 08. 14:05",
    primarySignalKey: "work",
    secondarySignalKey: "momentum",
    conflictResolutionStatus: "aligned",
    conflictResolutionPolicy: null,
  },
];

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
  const questionHistory = isSampleProfile
    ? SAMPLE_QUESTION_HISTORY
    : await findRecentQuestionHistoryByUserId(profile.userId);
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

        <FortuneSections
          fortune={fortune}
          userId={profile.userId}
          referenceDate={today.toISOString()}
          questionHistory={questionHistory}
        />
      </section>
    </main>
  );
}
