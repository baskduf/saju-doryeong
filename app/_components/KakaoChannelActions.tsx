import React from "react";
import Link from "next/link";
import styles from "./welcome-page.module.css";

export function KakaoChannelActions() {
  return (
    <div className={styles.actionBlock}>
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
