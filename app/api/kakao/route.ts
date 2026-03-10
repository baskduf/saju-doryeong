import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { generateDailyFortune } from "../../../lib/fortune";
import { answerFortuneQuestion } from "../../../lib/fortune-question";
import {
  DAILY_QUESTION_LIMIT,
  buildInitialSajuData,
  findProfileByUserId,
  getQuestionUsageSummary,
  hasDatabaseUrl,
  hasPendingQuestionInput,
  incrementQuestionUsage,
  isNonEmptyString,
  parseRegistrationFields,
  type SajuProfileRecord,
  setPendingQuestionInput,
  upsertProfile,
} from "../../../lib/profile";
import {
  createFortuneAccessToken,
  createRegisterAccessToken,
} from "../../../lib/access-token";
import { upsertFortuneShareSnapshot } from "../../../lib/fortune-share";

type KakaoCardButton =
  | {
      action: "webLink";
      label: string;
      webLinkUrl: string;
    }
  | {
      action: "message";
      label: string;
      messageText: string;
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
    quickReplies: KakaoQuickReply[];
  };
};

type KakaoProfileLike = {
  userId: string;
  name: string | null;
  birthDate: Date;
  birthTime: string | null;
  calendarType: string;
  sajuData: unknown;
};

const REREGISTER_COMMAND = "정보 재등록";
const FORTUNE_COMMAND = "오늘의 운세";
const QUESTION_COMMAND = "운세 질문";
const SHARE_COMMAND = "친구에게 공유하기";

const DEFAULT_QUICK_REPLIES: KakaoQuickReply[] = [
  { label: REREGISTER_COMMAND, action: "message", messageText: REREGISTER_COMMAND },
  { label: FORTUNE_COMMAND, action: "message", messageText: FORTUNE_COMMAND },
  { label: QUESTION_COMMAND, action: "message", messageText: QUESTION_COMMAND },
];

const QUESTION_EXAMPLE_QUICK_REPLIES: KakaoQuickReply[] = [
  { label: "연애운 질문", action: "message", messageText: "오늘 연애운 어때?" },
  { label: "재물운 질문", action: "message", messageText: "오늘 돈 써도 괜찮아?" },
  { label: "직장운 질문", action: "message", messageText: "오늘 일은 어떻게 풀릴까?" },
  { label: "건강운 질문", action: "message", messageText: "오늘 컨디션 관리는 어떻게 할까?" },
];

function resolveAppBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://saju-doryeong.vercel.app").replace(/\/$/, "");
}

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
  buttons?: KakaoCardButton[];
  thumbnailUrl?: string;
  quickReplies?: KakaoQuickReply[];
}): KakaoBasicCardResponse {
  const baseUrl = resolveAppBaseUrl();

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
            buttons: params.buttons,
          },
        },
      ],
      quickReplies: mergeQuickReplies(params.quickReplies),
    },
  };
}

function createRegistrationUrl(userId?: string): string {
  const url = new URL(`${resolveAppBaseUrl()}/register`);
  if (userId) {
    url.searchParams.set("userId", userId);
    url.searchParams.set("token", createRegisterAccessToken(userId));
  }
  url.searchParams.set("source", "kakao");
  return url.toString();
}

function createFortuneUrl(userId: string): string {
  const url = new URL(`${resolveAppBaseUrl()}/fortune/${encodeURIComponent(userId)}`);
  url.searchParams.set("token", createFortuneAccessToken(userId));
  return url.toString();
}

function createShareUrl(snapshotId: string, token: string): string {
  const url = new URL(`${resolveAppBaseUrl()}/share/fortune/${encodeURIComponent(snapshotId)}`);
  url.searchParams.set("token", token);
  return url.toString();
}

function createFortuneButtons(detailUrl: string): KakaoCardButton[] {
  return [
    {
      action: "webLink",
      label: "상세 운세 보러가기",
      webLinkUrl: detailUrl,
    },
    {
      action: "message",
      label: SHARE_COMMAND,
      messageText: SHARE_COMMAND,
    },
  ];
}

function createSharePromptButtons(shareUrl: string): KakaoCardButton[] {
  return [
    {
      action: "share",
      label: SHARE_COMMAND,
    },
    {
      action: "webLink",
      label: "공유 링크 보기",
      webLinkUrl: shareUrl,
    },
  ];
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
      if (parsed) {
        return parsed;
      }
    }
    return undefined;
  }

  const record = asRecord(value);
  if (!record) {
    return undefined;
  }

  for (const candidate of [record.value, record.origin, record.date, record.time, record.expression]) {
    const parsed = readStringValue(candidate);
    if (parsed) {
      return parsed;
    }
  }

  return undefined;
}

function getKakaoUserId(payload: unknown): string | undefined {
  const root = asRecord(payload);
  if (!root) {
    return undefined;
  }

  const userRequest = asRecord(root.userRequest);
  const user = asRecord(userRequest?.user);
  const properties = asRecord(user?.properties);

  for (const candidate of [user?.id, properties?.appUserId, properties?.plusfriendUserKey, properties?.botUserKey]) {
    if (isNonEmptyString(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

function getKakaoUtterance(payload: unknown): string | undefined {
  const root = asRecord(payload);
  if (!root) {
    return undefined;
  }

  const userRequest = asRecord(root.userRequest);
  return readStringValue(userRequest?.utterance);
}

function pickFirstString(source: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const parsed = readStringValue(source[key]);
    if (parsed) {
      return parsed;
    }
  }

  return undefined;
}

function summarizeForDebug(value: unknown): string {
  const parsed = readStringValue(value);
  if (parsed) {
    return parsed;
  }

  if (value === undefined) {
    return "<undefined>";
  }

  if (value === null) {
    return "<null>";
  }

  try {
    const text = JSON.stringify(value);
    return text.length > 80 ? `${text.slice(0, 80)}...` : text;
  } catch {
    return "<unserializable>";
  }
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
  const requestParams = asRecord(userRequest?.params) ?? {};

  const merged: Record<string, unknown> = {
    ...requestParams,
    ...actionParams,
  };

  if (detailParams) {
    for (const [key, value] of Object.entries(detailParams)) {
      if (merged[key] !== undefined) {
        continue;
      }

      const parsed = readStringValue(value);
      if (parsed) {
        merged[key] = parsed;
      }
    }
  }

  const name = pickFirstString(merged, ["name", "userName", "username", "이름"]);
  const birthDate = pickFirstString(merged, [
    "birthDate",
    "birth_date",
    "birthday",
    "dateOfBirth",
    "생년월일",
  ]);
  const birthTime = pickFirstString(merged, [
    "birthTime",
    "birth_time",
    "timeOfBirth",
    "출생시간",
  ]);
  const calendarType = pickFirstString(merged, [
    "calendarType",
    "calendar_type",
    "calendar",
    "달력기준",
    "음양력",
  ]);

  return {
    hasAny: Boolean(name || birthDate || birthTime || calendarType),
    name,
    birthDate,
    birthTime,
    calendarType,
    debugLines: [
      `name=${summarizeForDebug(name)}`,
      `birthDate=${summarizeForDebug(birthDate)}`,
      `birthTime=${summarizeForDebug(birthTime)}`,
      `calendarType=${summarizeForDebug(calendarType)}`,
    ],
  };
}

function isReservedUtterance(utterance?: string): boolean {
  return (
    utterance === REREGISTER_COMMAND ||
    utterance === FORTUNE_COMMAND ||
    utterance === QUESTION_COMMAND ||
    utterance === SHARE_COMMAND
  );
}

function createUnauthorizedSkillResponse(): KakaoBasicCardResponse {
  return createBasicCard({
    title: "운세도령",
    description: "정상적인 카카오 스킬 요청이 아니어서 응답을 돌려줄 수 없소.",
  });
}

function createRegistrationGuideCard(errorMessage?: string, debugLines?: string[], userId?: string): KakaoBasicCardResponse {
  const description = errorMessage
    ? [
        "사주 정보가 아직 온전히 모이지 않았소.",
        errorMessage,
        ...(debugLines?.length ? ["", "확인한 값:", ...debugLines] : []),
      ].join("\n")
    : [
        "인연의 바람을 타고 운세도령의 처소에 잘 당도하였구려.",
        "자네의 명운(命運)을 서책에 기록하려 하리다.",
      ].join("\n");

  return createBasicCard({
    title: "운세도령",
    description,
    buttons: [
      {
        action: "webLink",
        label: "사주 정보 등록하기",
        webLinkUrl: createRegistrationUrl(userId),
      },
    ],
  });
}

async function createFortuneCard(profile: KakaoProfileLike, notice?: string): Promise<KakaoBasicCardResponse> {
  const now = new Date();
  const fortune = generateDailyFortune({
    userId: profile.userId,
    birthDate: profile.birthDate,
    birthTime: profile.birthTime ?? undefined,
    calendarType: profile.calendarType as "solar" | "lunar" | "unknown",
    sajuData: profile.sajuData,
    date: now,
  });
  const descriptionLines = [
    profile.name ? `${profile.name} 님, ${fortune.headline}` : fortune.headline,
    notice,
    `운세 점수: ${fortune.score}점 (${fortune.grade})`,
    fortune.summary,
    fortune.caution,
  ].filter((line): line is string => Boolean(line));

  return createBasicCard({
    title: "운세도령의 오늘 운세",
    description: descriptionLines.join("\n\n"),
    thumbnailUrl: `${resolveAppBaseUrl()}/character_result.png`,
    buttons: createFortuneButtons(createFortuneUrl(profile.userId)),
  });
}

async function createQuestionAnswerCard(profile: SajuProfileRecord, question: string): Promise<KakaoBasicCardResponse> {
  const now = new Date();
  const fortune = generateDailyFortune({
    userId: profile.userId,
    birthDate: profile.birthDate,
    birthTime: profile.birthTime ?? undefined,
    calendarType: profile.calendarType as "solar" | "lunar" | "unknown",
    sajuData: profile.sajuData,
    date: now,
  });
  const answer = await answerFortuneQuestion({
    question,
    fortune,
    profileName: profile.name ?? undefined,
    date: now,
  });
  const usage = getQuestionUsageSummary(profile);

  return createBasicCard({
    title: answer.title,
    description: [
      answer.description,
      "",
      `오늘의 운세 질문은 하루 ${DAILY_QUESTION_LIMIT}회까지 가능하오. 남은 횟수: ${usage.remaining}회`,
    ].join("\n"),
    buttons: createFortuneButtons(createFortuneUrl(profile.userId)),
    quickReplies: createQuestionQuickReplies(),
  });
}

async function createSharePromptCard(profile: KakaoProfileLike): Promise<KakaoBasicCardResponse> {
  const now = new Date();
  const fortune = generateDailyFortune({
    userId: profile.userId,
    birthDate: profile.birthDate,
    birthTime: profile.birthTime ?? undefined,
    calendarType: profile.calendarType as "solar" | "lunar" | "unknown",
    sajuData: profile.sajuData,
    date: now,
  });
  const shared = await upsertFortuneShareSnapshot({
    userId: profile.userId,
    profileName: profile.name,
    fortune,
    date: now,
  });

  return createBasicCard({
    title: "운세도령의 공유 카드",
    description: [
      profile.name ? `${profile.name} 님의 오늘 운세를 나눌 수 있소.` : "오늘의 운세를 나눌 수 있소.",
      `운세 점수: ${fortune.score}점(${fortune.grade})`,
      fortune.headline,
      fortune.summary,
    ].join("\n\n"),
    thumbnailUrl: `${resolveAppBaseUrl()}/character_result.png`,
    buttons: createSharePromptButtons(createShareUrl(shared.snapshotId, shared.token)),
  });
}

function createQuestionGuideCard(params: {
  hasProfile: boolean;
  remaining?: number;
}): KakaoBasicCardResponse {
  return createBasicCard({
    title: "운세도령",
    description: params.hasProfile
      ? [
          "궁금한 일을 한 문장으로 적어 보시오.",
          "예: 오늘 고백해도 될까 / 오늘 돈 써도 괜찮아?",
          "자네에게는 오늘의 운세를 바탕으로 풀이해 드리겠소.",
          `하루 질문은 ${DAILY_QUESTION_LIMIT}회까지 가능하오${
            typeof params.remaining === "number" ? `. 남은 횟수: ${params.remaining}회` : "."
          }`,
        ].join("\n")
      : [
          "운세 질문을 받기 전에 먼저 사주 정보를 기록해야 하오.",
          '하단의 "정보 재등록"을 누르면 다시 기록을 이어갈 수 있소.',
        ].join("\n"),
    quickReplies: createQuestionQuickReplies(),
  });
}

function createQuestionLimitCard(): KakaoBasicCardResponse {
  return createBasicCard({
    title: "운세도령",
    description: [
      `오늘 운세 질문은 하루 ${DAILY_QUESTION_LIMIT}회까지이오.`,
      "오늘 몫은 모두 마쳤으니, 내일 다시 물어보시오.",
    ].join("\n"),
  });
}

function createFallbackGuideCard(hasProfile: boolean): KakaoBasicCardResponse {
  return createBasicCard({
    title: "운세도령",
    description: hasProfile
      ? [
          "무슨 일인지 바로 집히지 않는구나.",
          '"운세 질문"을 누른 뒤 궁금한 내용을 한 문장으로 적어 보시오.',
          "예: 오늘 고백해도 될까 / 오늘 사람 만나는 건 어때?",
        ].join("\n")
      : [
          "먼저 사주 정보를 기록해야 하오.",
          '"정보 재등록"을 눌러 등록 화면으로 들어가 주시오.',
        ].join("\n"),
    thumbnailUrl: `${resolveAppBaseUrl()}/character_not_question.png`,
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
  const configuredSkillSecret = process.env.KAKAO_SKILL_SHARED_SECRET?.trim();
  const providedSkillSecret = request.nextUrl.searchParams.get("key")?.trim();
  if (!configuredSkillSecret || !providedSkillSecret || providedSkillSecret !== configuredSkillSecret) {
    return NextResponse.json(createUnauthorizedSkillResponse(), { status: 401 });
  }

  try {
    const payload = await request.json();
    const userId = getKakaoUserId(payload);
    const utterance = getKakaoUtterance(payload)?.trim();
    const registrationParams = extractKakaoActionParams(payload);

    if (!userId) {
      return NextResponse.json(
        createBasicCard({
          title: "운세도령",
          description: "사용자 식별값을 찾지 못했소. 다시 한 번 불러 주시오.",
        }),
      );
    }

    if (!hasDatabaseUrl()) {
      return NextResponse.json(
        createBasicCard({
          title: "운세도령",
          description: "사주 서고가 아직 열리지 않았소. 잠시 뒤 다시 청해 주시오.",
        }),
        { status: 503 },
      );
    }

    const profile = await findProfileByUserId(userId);
    const pendingQuestionInput = hasPendingQuestionInput(profile);
    const questionUsage = getQuestionUsageSummary(profile);

    if (!registrationParams.hasAny && utterance === REREGISTER_COMMAND) {
      if (profile && pendingQuestionInput) {
        await setPendingQuestionInput(profile, false);
      }
      return NextResponse.json(createRegistrationGuideCard(undefined, undefined, userId));
    }

    if (!registrationParams.hasAny && utterance === QUESTION_COMMAND) {
      if (profile) {
        if (questionUsage.isLimited) {
          await setPendingQuestionInput(profile, false);
          return NextResponse.json(createQuestionLimitCard());
        }

        await setPendingQuestionInput(profile, true);
      }

      return NextResponse.json(
        createQuestionGuideCard({
          hasProfile: Boolean(profile),
          remaining: profile ? questionUsage.remaining : undefined,
        }),
      );
    }

    if (!registrationParams.hasAny && utterance === SHARE_COMMAND) {
      if (!profile) {
        return NextResponse.json(createRegistrationGuideCard(undefined, undefined, userId));
      }

      if (pendingQuestionInput) {
        await setPendingQuestionInput(profile, false);
      }

      return NextResponse.json(await createSharePromptCard(profile));
    }

    const shouldHandleRegistration = !profile ? registrationParams.hasAny : Boolean(registrationParams.birthDate);
    if (shouldHandleRegistration) {
      if (profile && pendingQuestionInput) {
        await setPendingQuestionInput(profile, false);
      }

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
          profile ? "사주 기록을 다시 바로잡았소." : "사주 정보를 새로 기록했으니 바로 오늘의 운세를 펼치겠소.",
        ),
      );
    }

    if (!profile) {
      return NextResponse.json(createRegistrationGuideCard(undefined, undefined, userId));
    }

    if (!registrationParams.hasAny && utterance === FORTUNE_COMMAND) {
      if (pendingQuestionInput) {
        await setPendingQuestionInput(profile, false);
      }

      return NextResponse.json(await createFortuneCard(profile));
    }

    if (utterance && !registrationParams.hasAny && !isReservedUtterance(utterance) && pendingQuestionInput) {
      if (questionUsage.isLimited) {
        await setPendingQuestionInput(profile, false);
        return NextResponse.json(createQuestionLimitCard());
      }

      await setPendingQuestionInput(profile, false);
      const updatedProfile = await incrementQuestionUsage(profile);
      return NextResponse.json(await createQuestionAnswerCard(updatedProfile, utterance));
    }

    if (utterance && !registrationParams.hasAny && !isReservedUtterance(utterance)) {
      return NextResponse.json(createFallbackGuideCard(true));
    }

    return NextResponse.json(await createFortuneCard(profile));
  } catch (error) {
    console.error("[/api/kakao] unexpected error", error);
    if (isDatabaseConnectionError(error)) {
      return NextResponse.json(
        createBasicCard({
          title: "운세도령",
          description: "사주 서고와의 연결이 잠시 흔들렸소. 잠시 뒤 다시 청해 주시오.",
        }),
        { status: 503 },
      );
    }

    return NextResponse.json(
      createBasicCard({
        title: "운세도령",
        description: "운세를 펼치는 중에 잠시 먹구름이 끼었소. 잠시 뒤 다시 청해 주시오.",
      }),
      { status: 500 },
    );
  }
}
