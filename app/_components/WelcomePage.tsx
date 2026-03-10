import Image from "next/image";
import Link from "next/link";
import styles from "./welcome-page.module.css";

const KAKAO_CHANNEL_URL = "http://pf.kakao.com/_IjiZX";

const guideSteps = [
  "카카오톡에서 QR 안내를 따라 운세도령으로 입장합니다.",
  "채널의 안내에 따라 도령과 대화를 시작합니다.",
  "처음 보는 화면이라면 아래 샘플 운세로 구성을 먼저 둘러볼 수 있습니다.",
];

export function WelcomePage() {
  return (
    <main className={styles.page}>
      <div className={styles.background} />
      <section className={styles.shell}>
        <div className={styles.panel}>
          <section className={styles.hero}>
            <div className={styles.visual}>
              <div className={styles.visualHalo} />
              <Image
                src="/character_welcom.png"
                alt="QR 안내를 들고 있는 운세도령 캐릭터"
                width={501}
                height={576}
                priority
                className={styles.heroImage}
              />
            </div>

            <div className={styles.copy}>
              <p className={styles.eyebrow}>Saju Doryeong</p>
              <h1 className={styles.title}>운세도령</h1>
              <p className={styles.description}>
                캐릭터가 들고 있는 QR 안내 이미지를 기준으로 카카오 채널에 입장한 뒤, 채널의 안내에 따라
                도령과 대화를 시작합니다.
              </p>

              <section className={styles.guideCard}>
                <p className={styles.guideTitle}>이용 흐름</p>
                <ol className={styles.guideList}>
                  {guideSteps.map((step) => (
                    <li key={step} className={styles.guideItem}>
                      {step}
                    </li>
                  ))}
                </ol>
              </section>

              <div className={styles.actionBlock}>
                <a
                  href={KAKAO_CHANNEL_URL}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.mobileChannelAction}
                >
                  카카오 채널로 이동
                </a>
                <Link href="/fortune/sample-user" className={styles.primaryAction}>
                  운세 샘플 보기
                </Link>
                <p className={styles.actionHint}>실제 카카오 진입 전에도 결과 화면 구성을 먼저 확인할 수 있습니다.</p>
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
