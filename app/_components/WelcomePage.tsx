import React from "react";
import Image from "next/image";
import { KakaoChannelActions } from "./KakaoChannelActions";
import styles from "./welcome-page.module.css";

const KAKAO_CHAT_URL = "https://pf.kakao.com/_IjiZX/chat";
const HOME_VIDEO_SRC = "/home.mp4";

const guideSteps = [
  "모바일에서는 아래 버튼으로 곧장 카카오톡 채널 대화를 시작할 수 있습니다.",
  "채널에 입장한 뒤 도령의 안내에 따라 사주 정보를 기록합니다.",
  "처음 보는 화면이라면 샘플 운세로 화면 구성을 먼저 둘러볼 수 있습니다.",
];

export function WelcomePage() {
  return (
    <main className={styles.page}>
      <section className={styles.mobileHero} aria-label="운세도령 모바일 시작 화면">
        <video
          className={styles.mobileHeroVideo}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster="/background.png"
          aria-hidden="true"
        >
          <source src={HOME_VIDEO_SRC} type="video/mp4" />
        </video>
        <div className={styles.mobileHeroOverlay} />
        <div className={styles.mobileHeroContent}>
          <div className={styles.mobileHeroBrand}>
            <h1 className={styles.mobileHeroWordmark}>운세도령</h1>
          </div>
          <a href={KAKAO_CHAT_URL} className={styles.mobileHeroAction}>
            운세도령과 이야기
          </a>
        </div>
      </section>
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
                모바일에서는 아래 버튼으로 바로 카카오톡 채널에 들어갈 수 있고, 데스크톱에서는 화면 구성을 먼저
                둘러본 뒤 카카오에서 같은 흐름으로 이어갈 수 있습니다.
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

              <KakaoChannelActions />
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
