import Image from "next/image";
import { notFound } from "next/navigation";
import detailStyles from "../../../fortune/[id]/page.module.css";
import { verifyShareAccessToken } from "../../../../lib/access-token";
import {
  findFortuneShareSnapshotById,
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
    (payload.avoidToday === undefined || Array.isArray(payload.avoidToday)) &&
    Array.isArray(payload.recommendedActions) &&
    typeof payload.targetDateKey === "string"
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

        <section className={detailStyles.scoreBox}>
          <p className={detailStyles.scoreLabel}>오늘의 운세 점수</p>
          <p className={detailStyles.scoreValue}>{fortune.score}</p>
          <p className={detailStyles.scoreGrade}>{fortune.grade}</p>
        </section>

        <section className={detailStyles.section}>
          <section className={`${detailStyles.innerSection} ${detailStyles.fortuneCard}`}>
            <div className={detailStyles.fortuneCardContent}>
              <h2>도령의 한마디</h2>
              <p>{fortune.headline}</p>
              <p>{fortune.summary}</p>
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
                      <span className={detailStyles.numberedText}>{item}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p>{fortune.caution}</p>
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
                    <span className={detailStyles.numberedText}>{action}</span>
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
