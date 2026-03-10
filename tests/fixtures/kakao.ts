type KakaoDetailParam = {
  origin?: string;
  value?: string;
};

type BuildKakaoPayloadOptions = {
  userId?: string | null;
  utterance?: string;
  params?: Record<string, unknown>;
  detailParams?: Record<string, KakaoDetailParam | string>;
  requestParams?: Record<string, unknown>;
  userProperties?: Record<string, unknown>;
};

function normalizeDetailParams(
  detailParams: BuildKakaoPayloadOptions["detailParams"],
): Record<string, KakaoDetailParam> {
  return Object.fromEntries(
    Object.entries(detailParams ?? {}).map(([key, value]) => {
      if (typeof value === "string") {
        return [key, { origin: value, value }];
      }

      return [key, value];
    }),
  );
}

export function buildKakaoPayload(options: BuildKakaoPayloadOptions = {}) {
  const user =
    options.userId === null
      ? { properties: options.userProperties ?? {} }
      : {
          id: options.userId ?? "kakao-user-1",
          properties: options.userProperties ?? {},
        };

  return {
    userRequest: {
      user,
      utterance: options.utterance ?? "",
      params: options.requestParams ?? {},
    },
    action: {
      params: options.params ?? {},
      detailParams: normalizeDetailParams(options.detailParams),
    },
  };
}

export type KakaoPayload = ReturnType<typeof buildKakaoPayload>;
