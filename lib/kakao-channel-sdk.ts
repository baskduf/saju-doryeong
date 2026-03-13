export const DEFAULT_KAKAO_CHANNEL_PUBLIC_ID = "_IjiZX";
export const KAKAO_SDK_VERSION = "2.8.0";
export const KAKAO_SDK_URL = `https://t1.kakaocdn.net/kakao_js_sdk/${KAKAO_SDK_VERSION}/kakao.min.js`;
export const KAKAO_SDK_INTEGRITY =
  "sha384-OLBgp1GsljhM2TJ+sbHjaiH9txEUvgdDTAzHv2P24donTt6/529l+9Ua0vFImLlb";

type KakaoChannelParams = {
  channelPublicId: string;
};

type KakaoChannelApi = {
  chat?: (params: KakaoChannelParams) => unknown;
  addChannel?: (params: KakaoChannelParams) => unknown;
};

export type KakaoSdk = {
  isInitialized?: () => boolean;
  init?: (jsKey: string) => unknown;
  Channel?: KakaoChannelApi;
};

declare global {
  interface Window {
    Kakao?: KakaoSdk;
  }
}

function hasValue(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function createKakaoChannelUrl(channelPublicId: string): string {
  return `https://pf.kakao.com/${channelPublicId.trim()}`;
}

export function ensureKakaoInitialized(
  kakao: KakaoSdk | null | undefined,
  jsKey: string | null | undefined,
): kakao is KakaoSdk {
  if (!kakao || !hasValue(jsKey)) {
    return false;
  }

  try {
    if (typeof kakao.isInitialized === "function" && kakao.isInitialized()) {
      return true;
    }

    if (typeof kakao.init !== "function") {
      return false;
    }

    kakao.init(jsKey.trim());
    return true;
  } catch {
    return false;
  }
}

export function openKakaoChannelChat(
  kakao: KakaoSdk | null | undefined,
  channelPublicId: string | null | undefined,
): boolean {
  if (!kakao || !hasValue(channelPublicId) || typeof kakao.Channel?.chat !== "function") {
    return false;
  }

  try {
    kakao.Channel.chat({ channelPublicId: channelPublicId.trim() });
    return true;
  } catch {
    return false;
  }
}

export function openKakaoAddChannel(
  kakao: KakaoSdk | null | undefined,
  channelPublicId: string | null | undefined,
): boolean {
  if (!kakao || !hasValue(channelPublicId) || typeof kakao.Channel?.addChannel !== "function") {
    return false;
  }

  try {
    kakao.Channel.addChannel({ channelPublicId: channelPublicId.trim() });
    return true;
  } catch {
    return false;
  }
}
