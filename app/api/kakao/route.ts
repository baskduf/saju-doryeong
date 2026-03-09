import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { generateDailyFortune } from "../../../lib/fortune";
import { answerFortuneQuestion, isLikelyFortuneQuestion } from "../../../lib/fortune-question";
import {
  buildInitialSajuData,
  findProfileByUserId,
  hasDatabaseUrl,
  isNonEmptyString,
  parseRegistrationFields,
  upsertProfile,
} from "../../../lib/profile";

type KakaoBasicCardResponse = {
  version: "2.0";
  template: {
    outputs: Array<{
      basicCard: {
        title: string;
        description: string;
        thumbnail: {
          imageUrl: string;
        };
        buttons?: KakaoCardButton[];
      };
    }>;
    quickReplies?: KakaoQuickReply[];
  };
};

type KakaoCardButton =
  | {
      action: "webLink";
      label: string;
      webLinkUrl: string;
    }
  | {
      action: "share";
      label: string;
    };

type KakaoQuickReply = {
  label: string;
  action: "message";
  messageText: string;
};

type KakaoProfileLike = {
  userId: string;
  name: string | null;
  birthDate: Date;
  birthTime: string | null;
  calendarType: string;
  sajuData: unknown;
};

const DEFAULT_QUICK_REPLIES: KakaoQuickReply[] = [
  {
    label: "\uC815\uBCF4 \uC7AC\uB4F1\uB85D",
    action: "message",
    messageText: "\uC815\uBCF4 \uC7AC\uB4F1\uB85D",
  },
  {
    label: "\uC624\uB298\uC758 \uC6B4\uC138",
    action: "message",
    messageText: "\uC624\uB298\uC758 \uC6B4\uC138",
  },
  {
    label: "\uC6B4\uC138 \uC9C8\uBB38",
    action: "message",
    messageText: "\uC6B4\uC138 \uC9C8\uBB38",
  },
];

const QUESTION_EXAMPLE_QUICK_REPLIES: KakaoQuickReply[] = [
  {
    label: "연애운 질문",
    action: "message",
    messageText: "오늘 연애운 어때?",
  },
  {
    label: "재물운 질문",
    action: "message",
    messageText: "오늘 돈 쓰는 거 괜찮아?",
  },
  {
    label: "직장운 질문",
    action: "message",
    messageText: "오늘 일은 어떻게 풀릴까?",
  },
  {
    label: "건강운 질문",
    action: "message",
    messageText: "오늘 컨디션 관리는 어떻게 할까?",
  },
];

function createDefaultQuickReplies(): KakaoQuickReply[] {
  return DEFAULT_QUICK_REPLIES.map((reply) => ({ ...reply }));
}

function mergeQuickReplies(extraQuickReplies?: KakaoQuickReply[]): KakaoQuickReply[] {
  const merged = [...createDefaultQuickReplies(), ...(extraQuickReplies ?? [])];
  const seen = new Set<string>();

  return merged.filter((reply) => {
    const key = `${reply.label}:${reply.messageText}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function createQuestionQuickReplies(): KakaoQuickReply[] {
  return QUESTION_EXAMPLE_QUICK_REPLIES.map((reply) => ({ ...reply }));
}

function createBasicCard(params: {
  title: string;
  description: string;
  webLinkUrl?: string;
  buttons?: KakaoCardButton[];
  thumbnailUrl?: string;
  quickReplies?: KakaoQuickReply[];
}): KakaoBasicCardResponse {
  const baseUrl = resolveAppBaseUrl();
  const buttons =
    params.buttons ??
    (params.webLinkUrl
      ? [
          {
            action: "webLink" as const,
            label: "\uC0C1\uC138 \uC6B4\uC138 \uBCF4\uB7EC\uAC00\uAE30",
            webLinkUrl: params.webLinkUrl,
          },
        ]
      : undefined);

  return {
    version: "2.0",
    template: {
      outputs: [
        {
          basicCard: {
            title: params.title,
            description: params.description,
            thumbnail: {
              imageUrl: params.thumbnailUrl ?? `${baseUrl}/character_card.png`,
            },
            buttons,
          },
        },
      ],
      quickReplies: mergeQuickReplies(params.quickReplies),
    },
  };
}

function resolveAppBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://saju-doryeong.vercel.app").replace(/\/$/, "");
}

function createRegistrationUrl(userId?: string): string {
  const url = new URL(`${resolveAppBaseUrl()}/register`);
  if (userId) {
    url.searchParams.set("userId", userId);
  }
  url.searchParams.set("source", "kakao");
  return url.toString();
}

function createFortuneButtons(detailUrl: string): KakaoCardButton[] {
  const buttons: KakaoCardButton[] = [
    {
      action: "webLink",
      label: "\uC0C1\uC138 \uC6B4\uC138 \uBCF4\uB7EC\uAC00\uAE30",
      webLinkUrl: detailUrl,
    },
    {
      action: "share",
      label: "\uCE5C\uAD6C\uC5D0\uAC8C \uACF5\uC720\uD558\uAE30",
    },
  ];

  return buttons;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function readStringValue(value: unknown): string | undefined {
  if (isNonEmptyString(value)) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const parsed = readStringValue(entry);
      if (parsed) return parsed;
    }
    return undefined;
  }

  const record = asRecord(value);
  if (!record) return undefined;

  const candidates = [record.value, record.origin, record.date, record.time, record.expression];
  for (const candidate of candidates) {
    const parsed = readStringValue(candidate);
    if (parsed) return parsed;
  }

  return undefined;
}

function summarizeForCard(value: unknown): string {
  const parsed = readStringValue(value);
  if (parsed) return parsed;

  if (value === undefined) return "<undefined>";
  if (value === null) return "<null>";

  try {
    const text = JSON.stringify(value);
    return text.length > 80 ? `${text.slice(0, 80)}...` : text;
  } catch {
    return "<unserializable>";
  }
}

function getKakaoUserId(payload: unknown): string | undefined {
  const root = asRecord(payload);
  if (!root) return undefined;

  const userRequest = asRecord(root.userRequest);
  const user = asRecord(userRequest?.user);
  const properties = asRecord(user?.properties);

  const candidates = [user?.id, properties?.appUserId, properties?.plusfriendUserKey, properties?.botUserKey];
  for (const id of candidates) {
    if (isNonEmptyString(id)) {
      return id;
    }
  }
  return undefined;
}

function getKakaoUtterance(payload: unknown): string | undefined {
  const root = asRecord(payload);
  if (!root) return undefined;

  const userRequest = asRecord(root.userRequest);
  return readStringValue(userRequest?.utterance);
}

function pickFirstString(source: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const parsed = readStringValue(source[key]);
    if (parsed) return parsed;
  }
  return undefined;
}

function extractKakaoActionParams(payload: unknown): {
  hasAny: boolean;
  name?: string;
  birthDate?: string;
  birthTime?: string;
  calendarType?: string;
  debugLines: string[];
} {
  const root = asRecord(payload);
  if (!root) {
    return { hasAny: false, debugLines: ["payload=<empty>"] };
  }

  const action = asRecord(root.action);
  const actionParams = asRecord(action?.params) ?? {};
  const detailParams = asRecord(action?.detailParams);
  const userRequest = asRecord(root.userRequest);
  const requestParams = asRecord(userRequest?.params);

  const merged: Record<string, unknown> = {
    ...requestParams,
    ...actionParams,
  };

  if (detailParams) {
    for (const [key, value] of Object.entries(detailParams)) {
      if (merged[key] !== undefined) continue;
      const parsed = readStringValue(value);
      if (parsed) {
        merged[key] = parsed;
      }
    }
  }

  const name = pickFirstString(merged, ["name", "userName", "username", "이름"]);
  const birthDate = pickFirstString(merged, ["birthDate", "birth_date", "birthday", "dateOfBirth", "생년월일"]);
  const birthTime = pickFirstString(merged, ["birthTime", "birth_time", "timeOfBirth", "출생시간"]);
  const calendarType = pickFirstString(merged, ["calendarType", "calendar_type", "calendar", "음양력", "력"]);
  const debugLines = [
    `birthDate=${summarizeForCard(actionParams.birthDate ?? requestParams?.birthDate ?? detailParams?.birthDate)}`,
    `birthTime=${summarizeForCard(actionParams.birthTime ?? requestParams?.birthTime ?? detailParams?.birthTime)}`,
    `calendarType=${summarizeForCard(actionParams.calendarType ?? requestParams?.calendarType ?? detailParams?.calendarType)}`,
    `name=${summarizeForCard(actionParams.name ?? requestParams?.name ?? detailParams?.name)}`,
  ];

  return {
    hasAny: Boolean(name || birthDate || birthTime || calendarType),
    name,
    birthDate,
    birthTime,
    calendarType,
    debugLines,
  };
}

function createRegistrationGuideCard(errorMessage?: string, debugLines?: string[], userId?: string): KakaoBasicCardResponse {
  const registrationUrl = createRegistrationUrl(userId);
  const lines = errorMessage
    ? [
        "사주 정보를 읽는 중 막힌 부분이 있소.",
        errorMessage,
        "",
        "수신값 확인:",
        ...(debugLines ?? []),
        "",
        "입력 예시: 이름 홍길동, 생년월일 1995-10-21, 출생시간 14:30, 양력 여부(또는 모른다)",
      ]
    : [
        "인연의 바람을 타고 운세도령의 처소에 잘 당도하였구려.",
        "자네의 명운(命運)을 서책에 기록하려 하리다.",
        "예: 홍길동 / 1995-10-21 / 14:30 / 양력(또는 모른다)",
      ];

  return createBasicCard({
    title: "운세도령",
    description: lines.join("\n"),
    buttons: [
      {
        action: "webLink",
        label: "사주 정보 등록하기",
        webLinkUrl: registrationUrl,
      },
    ],
  });
}

async function createFortuneCard(profile: KakaoProfileLike, notice?: string): Promise<KakaoBasicCardResponse> {
  const fortune = generateDailyFortune({
    userId: profile.userId,
    birthDate: profile.birthDate,
    birthTime: profile.birthTime ?? undefined,
    calendarType: profile.calendarType as "solar" | "lunar" | "unknown",
    sajuData: profile.sajuData,
  });

  const baseUrl = resolveAppBaseUrl();
  const detailUrl = `${baseUrl}/fortune/${encodeURIComponent(profile.userId)}`;
  const titleName = profile.name ? `${profile.name}님` : "그대";

  const descriptionLines = [
    `${titleName}, ${fortune.headline}`,
    notice,
    `운세 점수: ${fortune.score}점 (${fortune.grade})`,
    fortune.summary,
    fortune.caution,
  ].filter((line): line is string => Boolean(line));

  return createBasicCard({
    title: "운세도령의 오늘 운세",
    description: descriptionLines.join("\n\n"),
    buttons: createFortuneButtons(detailUrl),
  });
}

async function createQuestionAnswerCard(profile: KakaoProfileLike, question: string): Promise<KakaoBasicCardResponse> {
  const fortune = generateDailyFortune({
    userId: profile.userId,
    birthDate: profile.birthDate,
    birthTime: profile.birthTime ?? undefined,
    calendarType: profile.calendarType as "solar" | "lunar" | "unknown",
    sajuData: profile.sajuData,
  });

  const answer = await answerFortuneQuestion({
    question,
    fortune,
    profileName: profile.name ?? undefined,
  });

  const baseUrl = resolveAppBaseUrl();
  const detailUrl = `${baseUrl}/fortune/${encodeURIComponent(profile.userId)}`;

  return createBasicCard({
    title: answer.title,
    description: answer.description,
    buttons: createFortuneButtons(detailUrl),
    quickReplies: createQuestionQuickReplies(),
  });
}

function createQuestionGuideCard(hasProfile: boolean): KakaoBasicCardResponse {
  return createBasicCard({
    title: "운세도령",
    description: hasProfile
      ? [
          "궁금한 운세 질문을 짧게 입력해 주시오.",
          "예: 오늘 대인관계 운 어때? / 오늘 재물운 포인트는?",
          "현재는 오늘 운세 중심으로 안내합니다.",
        ].join("\n")
      : [
          "운세 질문 전에 먼저 사주 정보를 등록해 주시오.",
          '하단의 "정보 재등록"을 누르면 다시 등록을 진행할 수 있습니다.',
        ].join("\n"),
    quickReplies: createQuestionQuickReplies(),
  });
}

function isDatabaseConnectionError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && ["P1001", "P2021"].includes(error.code)) {
    return true;
  }
  return error instanceof Error && /can't reach database server|p1001|table .* does not exist/i.test(error.message);
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const userId = getKakaoUserId(payload);
    const utterance = getKakaoUtterance(payload)?.trim();
    const registrationParams = extractKakaoActionParams(payload);

    if (!userId) {
      return NextResponse.json(
        createBasicCard({
          title: "운세도령",
          description: "사용자 식별값을 찾지 못했소. 다시 한 번 호출해 주시오.",
        }),
      );
    }

    if (!hasDatabaseUrl()) {
      return NextResponse.json(
        createBasicCard({
          title: "운세도령",
          description: "사주 서고와의 연결이 아직 준비되지 않았소. 잠시 후 다시 청해 주시오.",
        }),
        { status: 503 },
      );
    }

    const profile = await findProfileByUserId(userId);

    if (!registrationParams.hasAny && utterance === "\uC815\uBCF4 \uC7AC\uB4F1\uB85D") {
      return NextResponse.json(createRegistrationGuideCard(undefined, undefined, userId));
    }

    if (!registrationParams.hasAny && utterance === "\uC6B4\uC138 \uC9C8\uBB38") {
      return NextResponse.json(createQuestionGuideCard(Boolean(profile)));
    }

    const shouldHandleRegistration = !profile ? registrationParams.hasAny : Boolean(registrationParams.birthDate);

    if (shouldHandleRegistration) {
      const parsed = parseRegistrationFields({
        name: registrationParams.name,
        birthDate: registrationParams.birthDate,
        birthTime: registrationParams.birthTime,
        calendarType: registrationParams.calendarType,
      });
      if (!parsed.ok) {
        return NextResponse.json(createRegistrationGuideCard(parsed.message, registrationParams.debugLines, userId));
      }

      const storedProfile = await upsertProfile({
        userId,
        name: parsed.data.name,
        birthDate: parsed.data.birthDate,
        birthTime: parsed.data.birthTime,
        calendarType: parsed.data.calendarType,
        sajuData: buildInitialSajuData({
          userId,
          birthDate: parsed.data.birthDate,
          birthTime: parsed.data.birthTime,
          calendarType: parsed.data.calendarType,
        }),
      });

      return NextResponse.json(
        await createFortuneCard(
          storedProfile,
          profile ? "사주 기록을 새로 바로잡았소." : "사주 정보를 서고에 등록했으니, 바로 오늘 점괘를 펼치겠소.",
        ),
      );
    }

    if (!profile) {
      return NextResponse.json(
        createRegistrationGuideCard(undefined, undefined, userId),
      );
    }

    if (
      utterance &&
      utterance !== "\uC624\uB298\uC758 \uC6B4\uC138" &&
      utterance !== "\uC6B4\uC138 \uC9C8\uBB38" &&
      utterance !== "\uC815\uBCF4 \uC7AC\uB4F1\uB85D" &&
      isLikelyFortuneQuestion(utterance)
    ) {
      return NextResponse.json(await createQuestionAnswerCard(profile, utterance));
    }

    return NextResponse.json(await createFortuneCard(profile));
  } catch (error) {
    console.error("[/api/kakao] unexpected error", error);
    if (isDatabaseConnectionError(error)) {
      return NextResponse.json(
        createBasicCard({
          title: "운세도령",
          description: "사주 서고와의 연결이 잠시 흔들리는구나. 잠시 뒤 다시 청해 주시오.",
        }),
        { status: 503 },
      );
    }

    return NextResponse.json(
      createBasicCard({
        title: "운세도령",
        description: "점괘를 펴는 중 잠시 먹구름이 끼었소. 잠시 후 다시 청해 주시오.",
      }),
      { status: 500 },
    );
  }
}
