import Image from "next/image";
import { notFound } from "next/navigation";
import { Fragment, type ReactNode } from "react";
import detailStyles from "../../../fortune/[id]/page.module.css";
import { verifyShareAccessToken } from "../../../../lib/access-token";
import {
  findFortuneShareSnapshotById,
  type FortuneShareInsightPayload,
  type FortuneShareSnapshotPayload,
} from "../../../../lib/fortune-share";
import { ShareActions } from "./ShareActions";

type PageProps = {
  params: { id: string };
  searchParams?: {
    token?: string;
  };
};

const DEMO_SHARE_ID = "demo";

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

const DEMO_SHARE_PAYLOAD: FortuneShareSnapshotPayload = {
  displayName: "홍*동",
  score: 74,
  grade: "길",
  headline: "실천하면 성과가 쌓이는 날이로다.",
  summary:
    "오늘은 마음만 앞세우기보다 순서를 세우고 움직일수록 흐름이 반듯하게 이어지는 날이오. 사람과 약속은 부드럽게 조율하되, 중요한 일은 기준을 먼저 세워야 하오.",
  caution:
    "기세가 좋은 날이라도 말과 일정이 겹치면 흐름이 거칠어질 수 있으니 서두른 답변과 즉흥 결정은 한 박자 늦추시오.",
  avoidToday: [
    "서두른 답변과 즉흥 결정은 한 박자 늦추시오.",
    "약속과 일정이 겹칠 때는 먼저 우선순위를 정하시오.",
    "기세만 믿고 사람을 몰아붙이는 말투는 피하시오.",
  ],
  certainty: "exact",
  uncertaintyMessage: null,
  featuredInsight: {
    label: "타이밍 포인트",
    title: "오전에 흐름을 먼저 잡는 편이 좋소.",
    summary: "오전 쪽에 맞춰 순서를 잡으면 오늘 흐름이 더 반듯하게 이어지오.",
    action: "오전에 중요한 연락과 우선순위부터 정하시오.",
    caution: "타이밍을 놓친 뒤 급히 만회하려 들지 마시오.",
  },
  recommendedActions: [
    "중요한 일은 오전에 우선순위를 먼저 적어 두시오.",
    "만남과 협의는 차분히 조율하며 속도를 고르게 맞추시오.",
    "오늘은 작은 실천 하나를 끝까지 밀어 성과를 남기시오.",
  ],
  targetDateKey: "2026-03-10",
};

function isSharePayload(value: unknown): value is FortuneShareSnapshotPayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Record<string, unknown>;
  return (
    typeof payload.displayName === "string" &&
    typeof payload.score === "number" &&
    typeof payload.grade === "string" &&
    typeof payload.headline === "string" &&
    typeof payload.summary === "string" &&
    typeof payload.caution === "string" &&
    (payload.certainty === "exact" || payload.certainty === "calendar-unknown") &&
    (payload.uncertaintyMessage === null ||
      payload.uncertaintyMessage === undefined ||
      typeof payload.uncertaintyMessage === "string") &&
    (payload.featuredInsight === undefined ||
      payload.featuredInsight === null ||
      (typeof payload.featuredInsight === "object" &&
        typeof (payload.featuredInsight as Record<string, unknown>).label === "string" &&
        typeof (payload.featuredInsight as Record<string, unknown>).title === "string" &&
        typeof (payload.featuredInsight as Record<string, unknown>).summary === "string" &&
        typeof (payload.featuredInsight as Record<string, unknown>).action === "string" &&
        typeof (payload.featuredInsight as Record<string, unknown>).caution === "string")) &&
    (payload.avoidToday === undefined || Array.isArray(payload.avoidToday)) &&
    Array.isArray(payload.recommendedActions) &&
    typeof payload.targetDateKey === "string"
  );
}

function buildFallbackFeaturedInsight(fortune: FortuneShareSnapshotPayload): FortuneShareInsightPayload {
  return {
    label: "오늘의 포인트",
    title: "공유용 대표 흐름을 먼저 보시오.",
    summary: fortune.summary,
    action: fortune.recommendedActions[0] ?? "지금 할 수 있는 일부터 차분히 움직이시오.",
    caution: fortune.avoidToday?.[0] ?? fortune.caution,
  };
}

function renderHighlightedText(text: string): ReactNode {
  const parts = text.split(EMPHASIS_PATTERN).filter(Boolean);

  return parts.map((part, index) =>
    EMPHASIS_TERM_SET.has(part) ? (
      <strong key={`${part}-${index}`} className={detailStyles.inlineHighlight}>
        {part}
      </strong>
    ) : (
      <Fragment key={`${part}-${index}`}>{part}</Fragment>
    ),
  );
}

export default async function SharedFortunePage({ params, searchParams }: PageProps) {
  const fortune =
    params.id === DEMO_SHARE_ID
      ? DEMO_SHARE_PAYLOAD
      : await (async () => {
          const token = searchParams?.token?.trim();
          const tokenCheck = verifyShareAccessToken(token, params.id);
          if (!tokenCheck.ok) {
            notFound();
          }

          const snapshot = await findFortuneShareSnapshotById(params.id);
          if (!snapshot || snapshot.expiresAt.getTime() <= Date.now() || !isSharePayload(snapshot.payload)) {
            notFound();
          }

          return snapshot.payload;
        })();
  const featuredInsight = fortune.featuredInsight ?? buildFallbackFeaturedInsight(fortune);

  return (
    <main className={detailStyles.container}>
      <section className={detailStyles.paper} style={{ maxWidth: 860 }}>
        <section className={detailStyles.hero} style={{ gridTemplateColumns: "1fr" }}>
          <div className={detailStyles.heroText}>
            <p className={detailStyles.label}>Shared Fortune</p>
            <h1 className={detailStyles.title}>{fortune.displayName} 님의 오늘 운세</h1>
            <p className={detailStyles.date}>
              {fortune.targetDateKey} 기준으로 저장된 공유용 운세입니다. 출생 정보와 분석 전문은 공개되지 않습니다.
            </p>
          </div>
        </section>

        {fortune.certainty === "calendar-unknown" ? (
          <section className={`${detailStyles.section} ${detailStyles.uncertaintyCard}`}>
            <p className={detailStyles.uncertaintyEyebrow}>달력 기준 미확정</p>
            <p className={detailStyles.uncertaintyText}>
              {renderHighlightedText(
                fortune.uncertaintyMessage ??
                  "달력 기준이 확정되지 않아 양력·음력 두 가능성을 함께 본 참고용 운세이오.",
              )}
            </p>
          </section>
        ) : null}

        <section className={detailStyles.scoreBox}>
          <p className={detailStyles.scoreLabel}>오늘의 운세 점수</p>
          <p className={detailStyles.scoreValue}>{fortune.score}</p>
          <p className={detailStyles.scoreGrade}>{fortune.grade}</p>
        </section>

        <section className={detailStyles.section}>
          <section className={`${detailStyles.innerSection} ${detailStyles.fortuneCard}`}>
            <div className={detailStyles.fortuneCardContent}>
              <h2>도령의 한마디</h2>
              <p>{renderHighlightedText(fortune.headline)}</p>
              <p>{renderHighlightedText(fortune.summary)}</p>
            </div>
            <div className={`${detailStyles.fortuneCharacterOverlay} ${detailStyles.fortuneCharacterPointer}`}>
              <Image
                src="/character_pointer.png"
                alt="도령 포인터 캐릭터"
                width={180}
                height={180}
                className={detailStyles.fortuneCharacter}
                priority
              />
            </div>
          </section>

          <section className={detailStyles.innerSection}>
            <h2>오늘의 포인트</h2>
            <div className={`${detailStyles.reasonCard} ${detailStyles.pointCard}`}>
              <div className={detailStyles.reasonRow}>
                <span className={detailStyles.reasonLabel}>{featuredInsight.label}</span>
                <p className={detailStyles.reasonText}>
                  <strong className={detailStyles.inlineHighlight}>{featuredInsight.title}</strong>{" "}
                  {renderHighlightedText(featuredInsight.summary)}
                </p>
              </div>
              <div className={detailStyles.reasonRow}>
                <span className={detailStyles.reasonLabel}>움직임</span>
                <p className={detailStyles.reasonText}>{renderHighlightedText(featuredInsight.action)}</p>
              </div>
              <div className={detailStyles.reasonRow}>
                <span className={detailStyles.reasonLabel}>주의</span>
                <p className={detailStyles.reasonText}>{renderHighlightedText(featuredInsight.caution)}</p>
              </div>
              <div className={detailStyles.pointFlowerOverlay} aria-hidden="true">
                <Image
                  src="/flower.png"
                  alt=""
                  width={180}
                  height={180}
                  className={detailStyles.pointFlower}
                />
              </div>
            </div>
          </section>

          <section className={`${detailStyles.innerSection} ${detailStyles.fortuneCard}`}>
            <div className={detailStyles.fortuneCardContent}>
              <h2>오늘 조심할 것</h2>
              {fortune.avoidToday && fortune.avoidToday.length > 0 ? (
                <ol className={detailStyles.numberedList}>
                  {fortune.avoidToday.map((item, index) => (
                    <li key={item} className={detailStyles.numberedItem}>
                      <span className={detailStyles.numberBadge} aria-hidden="true">
                        {index + 1}
                      </span>
                      <span className={detailStyles.numberedText}>{renderHighlightedText(item)}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p>{renderHighlightedText(fortune.caution)}</p>
              )}
            </div>
            <div className={`${detailStyles.fortuneCharacterOverlay} ${detailStyles.fortuneWarningOverlay}`}>
              <Image
                src="/character_warning.png"
                alt="도령 주의 캐릭터"
                width={180}
                height={180}
                className={`${detailStyles.fortuneCharacter} ${detailStyles.fortuneCharacterWarningImage}`}
                priority
              />
            </div>
          </section>

          <section className={`${detailStyles.innerSection} ${detailStyles.fortuneCard}`}>
            <div className={detailStyles.fortuneCardContent}>
              <h2>오늘의 추천 행동</h2>
              <ol className={detailStyles.numberedList}>
                {fortune.recommendedActions.map((action, index) => (
                  <li key={action} className={detailStyles.numberedItem}>
                    <span className={detailStyles.numberBadge} aria-hidden="true">
                      {index + 1}
                    </span>
                    <span className={detailStyles.numberedText}>{renderHighlightedText(action)}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div className={`${detailStyles.fortuneCharacterOverlay} ${detailStyles.fortuneCharacterConcern}`}>
              <Image
                src="/character_concern.png"
                alt="도령 고민 캐릭터"
                width={180}
                height={180}
                className={detailStyles.fortuneCharacter}
                priority
              />
            </div>
          </section>
        </section>

        <section className={detailStyles.section}>
          <ShareActions title={`${fortune.displayName} 님의 오늘 운세`} />
        </section>
      </section>
    </main>
  );
}
