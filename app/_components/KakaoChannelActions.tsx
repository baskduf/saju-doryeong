import React from "react";
import Link from "next/link";
import styles from "./welcome-page.module.css";

const KAKAO_CHANNEL_PUBLIC_ID = "_IjiZX";
const KAKAO_CHAT_URL = `https://pf.kakao.com/${KAKAO_CHANNEL_PUBLIC_ID}/chat`;
const KAKAO_FRIEND_URL = `https://pf.kakao.com/${KAKAO_CHANNEL_PUBLIC_ID}/friend`;

export function KakaoChannelActions() {
  return (
    <div className={styles.actionBlock}>
      <div className={styles.mobileChannelActions}>
        <a href={KAKAO_CHAT_URL} className={styles.mobilePrimaryAction}>
          카카오톡으로 대화 시작
        </a>
        <a href={KAKAO_FRIEND_URL} className={styles.mobileSecondaryAction}>
          채널 추가하고 소식 받기
        </a>
      </div>

      <Link href="/fortune/sample-user" className={styles.sampleAction}>
        운세 샘플 보기
      </Link>
      <p className={styles.actionHint}>
        모바일에서는 버튼으로 바로 카카오로 이어지고, 데스크톱에서는 샘플 운세로 화면 구성을 먼저 살필 수
        있습니다.
      </p>
    </div>
  );
}
