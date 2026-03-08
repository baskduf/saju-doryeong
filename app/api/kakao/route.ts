import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { generateDailyFortune } from "../../../lib/fortune";
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
        buttons?: Array<{
          action: "webLink";
          label: string;
          webLinkUrl: string;
        }>;
      };
    }>;
    quickReplies?: KakaoQuickReply[];
  };
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
  sajuData: unknown;
};

function createBasicCard(params: {
  title: string;
  description: string;
  webLinkUrl?: string;
  quickReplies?: KakaoQuickReply[];
}): KakaoBasicCardResponse {
  return {
    version: "2.0",
    template: {
      outputs: [
        {
          basicCard: {
            title: params.title,
            description: params.description,
            buttons: params.webLinkUrl
              ? [
                  {
                    action: "webLink",
                    label: "상세 운세 보러가기",
                    webLinkUrl: params.webLinkUrl,
                  },
                ]
              : undefined,
          },
        },
      ],
      quickReplies: params.quickReplies ?? [
        {
          label: "운세 다시 보기",
          action: "message",
          messageText: "오늘의 운세",
        },
      ],
    },
  };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  return value as Record<string, unknown>;
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

function pickFirstString(source: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = source[key];
    if (isNonEmptyString(value)) {
      return value.trim();
    }
  }
  return undefined;
}

function extractKakaoActionParams(payload: unknown): {
  hasAny: boolean;
  name?: string;
  birthDate?: string;
  birthTime?: string;
  calendarType?: string;
} {
  const root = asRecord(payload);
  if (!root) {
    return { hasAny: false };
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
      const detailParam = asRecord(value);
      if (isNonEmptyString(detailParam?.value)) {
        merged[key] = detailParam.value;
      }
    }
  }

  const name = pickFirstString(merged, ["name", "userName", "username", "이름"]);
  const birthDate = pickFirstString(merged, ["birthDate", "birth_date", "birthday", "dateOfBirth", "생년월일"]);
  const birthTime = pickFirstString(merged, ["birthTime", "birth_time", "timeOfBirth", "출생시간"]);
  const calendarType = pickFirstString(merged, ["calendarType", "calendar_type", "calendar", "음양력", "력"]);

  return {
    hasAny: Boolean(name || birthDate || birthTime || calendarType),
    name,
    birthDate,
    birthTime,
    calendarType,
  };
}

function createRegistrationGuideCard(errorMessage?: string): KakaoBasicCardResponse {
  const lines = errorMessage
    ? [
        "사주 정보를 읽는 중 막힌 부분이 있소.",
        errorMessage,
        "",
        "입력 예시: 생년월일 1995-10-21, 출생시간 14:30, 달력 양력",
      ]
    : [
        "그대의 사주 기록이 아직 없구나.",
        "사주 등록 블록에서 생년월일/출생시간/양력·음력을 입력해 주시오.",
        "예: 1995-10-21 / 14:30 / 양력",
      ];

  return createBasicCard({
    title: "운세도령",
    description: lines.join("\n"),
    quickReplies: [
      {
        label: "사주 등록",
        action: "message",
        messageText: "사주 등록",
      },
      {
        label: "오늘의 운세",
        action: "message",
        messageText: "오늘의 운세",
      },
    ],
  });
}

function createFortuneCard(profile: KakaoProfileLike, notice?: string): KakaoBasicCardResponse {
  const fortune = generateDailyFortune({
    userId: profile.userId,
    birthDate: profile.birthDate,
    sajuData: profile.sajuData,
  });

  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://your-domain.com").replace(/\/$/, "");
  const detailUrl = `${baseUrl}/fortune/${encodeURIComponent(profile.userId)}`;
  const titleName = profile.name ? `${profile.name} 님` : "그대";

  const descriptionLines = [
    `${titleName}, ${fortune.headline}`,
    notice,
    `운세 점수: ${fortune.score}점 (${fortune.grade})`,
    fortune.summary,
    fortune.caution,
  ].filter((line): line is string => Boolean(line));

  return createBasicCard({
    title: "운세도령의 오늘 풀이",
    description: descriptionLines.join("\n\n"),
    webLinkUrl: detailUrl,
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
    const shouldHandleRegistration = !profile ? registrationParams.hasAny : Boolean(registrationParams.birthDate);

    if (shouldHandleRegistration) {
      const parsed = parseRegistrationFields({
        name: registrationParams.name,
        birthDate: registrationParams.birthDate,
        birthTime: registrationParams.birthTime,
        calendarType: registrationParams.calendarType,
      });
      if (!parsed.ok) {
        return NextResponse.json(createRegistrationGuideCard(parsed.message));
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
        createFortuneCard(
          storedProfile,
          profile ? "사주 기록을 새로 바로잡았소." : "사주 정보를 서고에 등록했으니, 바로 오늘 점괘를 펼치겠소.",
        ),
      );
    }

    if (!profile) {
      return NextResponse.json(
        createRegistrationGuideCard(),
      );
    }

    return NextResponse.json(createFortuneCard(profile));
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
