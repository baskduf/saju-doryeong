"use client";

import React, { type MouseEvent } from "react";
import Link from "next/link";
import Script from "next/script";
import {
  createKakaoChannelUrl,
  DEFAULT_KAKAO_CHANNEL_PUBLIC_ID,
  ensureKakaoInitialized,
  KAKAO_SDK_INTEGRITY,
  KAKAO_SDK_URL,
  openKakaoAddChannel,
  openKakaoChannelChat,
} from "../../lib/kakao-channel-sdk";
import styles from "./welcome-page.module.css";

function getKakaoChannelPublicId(): string {
  return process.env.NEXT_PUBLIC_KAKAO_CHANNEL_PUBLIC_ID?.trim() || DEFAULT_KAKAO_CHANNEL_PUBLIC_ID;
}

function getKakaoJsKey(): string {
  return process.env.NEXT_PUBLIC_KAKAO_JS_KEY?.trim() || "";
}

type ChannelActionKind = "chat" | "add";

export function KakaoChannelActions() {
  const channelPublicId = getKakaoChannelPublicId();
  const kakaoJsKey = getKakaoJsKey();
  const channelUrl = createKakaoChannelUrl(channelPublicId);
  const shouldLoadSdk = kakaoJsKey.length > 0;

  function handleChannelAction(action: ChannelActionKind) {
    return (event: MouseEvent<HTMLAnchorElement>) => {
      const kakao = typeof window === "undefined" ? undefined : window.Kakao;
      if (!ensureKakaoInitialized(kakao, kakaoJsKey)) {
        return;
      }

      event.preventDefault();
      const fallbackUrl = event.currentTarget.href;
      const didOpen =
        action === "chat"
          ? openKakaoChannelChat(kakao, channelPublicId)
          : openKakaoAddChannel(kakao, channelPublicId);

      if (!didOpen) {
        window.location.assign(fallbackUrl);
      }
    };
  }

  return (
    <div className={styles.actionBlock}>
      {shouldLoadSdk ? (
        <Script
          src={KAKAO_SDK_URL}
          strategy="afterInteractive"
          integrity={KAKAO_SDK_INTEGRITY}
          crossOrigin="anonymous"
        />
      ) : null}

      <div className={styles.mobileChannelActions}>
        <a href={channelUrl} className={styles.mobilePrimaryAction} onClick={handleChannelAction("chat")}>
          카카오톡으로 대화 시작
        </a>
        <a href={channelUrl} className={styles.mobileSecondaryAction} onClick={handleChannelAction("add")}>
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
