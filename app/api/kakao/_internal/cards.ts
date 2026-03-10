import {
  BASE_DAILY_QUESTION_LIMIT,
  DAILY_SHARE_REWARD_LIMIT,
  type QuestionUsageSummary,
} from "../../../../lib/profile";
import {
  createFortuneAccessToken,
  createRegisterAccessToken,
} from "../../../../lib/access-token";
import {
  DEFAULT_QUICK_REPLIES,
  QUESTION_EXAMPLE_QUICK_REPLIES,
  SHARE_COMMAND,
} from "./constants";
import type { KakaoBasicCardResponse, KakaoCardButton, KakaoQuickReply } from "./types";

function createDefaultQuestionUsageSummary(): QuestionUsageSummary {
  return {
    count: 0,
    usedCount: 0,
    baseLimit: BASE_DAILY_QUESTION_LIMIT,
    rewardCountToday: 0,
    rewardRemainingToday: DAILY_SHARE_REWARD_LIMIT,
    totalLimitToday: BASE_DAILY_QUESTION_LIMIT,
    remaining: BASE_DAILY_QUESTION_LIMIT,
    isLimited: false,
  };
}

export function resolveAppBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://saju-doryeong.vercel.app").replace(/\/$/, "");
}

export function createDefaultQuickReplies(): KakaoQuickReply[] {
  return DEFAULT_QUICK_REPLIES.map((reply) => ({ ...reply }));
}

export function mergeQuickReplies(extraQuickReplies?: KakaoQuickReply[]): KakaoQuickReply[] {
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

export function createQuestionQuickReplies(): KakaoQuickReply[] {
  return QUESTION_EXAMPLE_QUICK_REPLIES.map((reply) => ({ ...reply }));
}

export function buildQuestionUsageLines(
  usage: QuestionUsageSummary,
  options?: {
    includeShareHint?: boolean;
  },
): string[] {
  const lines = [
    `기본 질문은 하루 ${BASE_DAILY_QUESTION_LIMIT}회까지 가능하오.`,
    `오늘 질문은 총 ${usage.totalLimitToday}회까지 가능하고, 남은 횟수는 ${usage.remaining}회요.`,
  ];

  if (usage.rewardCountToday > 0) {
    lines.push(`오늘 공유 적립은 ${usage.rewardCountToday}/${DAILY_SHARE_REWARD_LIMIT}회이오.`);
  }

  if (options?.includeShareHint && usage.rewardRemainingToday > 0) {
    lines.push(`친구에게 공유하기로 질문 ${usage.rewardRemainingToday}회까지 더 적립할 수 있소.`);
  }

  return lines;
}

export function createBasicCard(params: {
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

export function createRegistrationUrl(userId?: string): string {
  const url = new URL(`${resolveAppBaseUrl()}/register`);
  if (userId) {
    url.searchParams.set("userId", userId);
    url.searchParams.set("token", createRegisterAccessToken(userId));
  }
  url.searchParams.set("source", "kakao");
  return url.toString();
}

export function createFortuneUrl(userId: string): string {
  const url = new URL(`${resolveAppBaseUrl()}/fortune/${encodeURIComponent(userId)}`);
  url.searchParams.set("token", createFortuneAccessToken(userId));
  return url.toString();
}

export function createShareUrl(snapshotId: string, token: string): string {
  const url = new URL(`${resolveAppBaseUrl()}/share/fortune/${encodeURIComponent(snapshotId)}`);
  url.searchParams.set("token", token);
  return url.toString();
}

export function createFortuneButtons(detailUrl: string): KakaoCardButton[] {
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

export function createSharePromptButtons(shareUrl: string): KakaoCardButton[] {
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

export function createUnauthorizedSkillResponse(): KakaoBasicCardResponse {
  return createBasicCard({
    title: "운세도령",
    description: "정상적인 카카오 스킬 요청이 아니어서 응답을 돌려줄 수 없소.",
  });
}

export function createRegistrationGuideCard(
  errorMessage?: string,
  debugLines?: string[],
  userId?: string,
): KakaoBasicCardResponse {
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

export function createQuestionGuideCard(params: {
  hasProfile: boolean;
  usage?: QuestionUsageSummary;
}): KakaoBasicCardResponse {
  const usage = params.usage ?? createDefaultQuestionUsageSummary();

  return createBasicCard({
    title: "운세도령",
    description: params.hasProfile
      ? [
          "궁금한 일을 한 문장으로 적어 보시오.",
          "예: 오늘 고백해도 될까 / 오늘 돈 써도 괜찮아?",
          "자네에게는 오늘의 운세를 바탕으로 풀이해 드리겠소.",
          "",
          ...buildQuestionUsageLines(usage, { includeShareHint: true }),
        ].join("\n")
      : [
          "운세 질문을 받기 전에 먼저 사주 정보를 기록해야 하오.",
          '하단의 "정보 재등록"을 누르면 다시 기록을 이어갈 수 있소.',
        ].join("\n"),
    quickReplies: createQuestionQuickReplies(),
  });
}

export function createQuestionLimitCard(usage: QuestionUsageSummary): KakaoBasicCardResponse {
  return createBasicCard({
    title: "운세도령",
    description:
      usage.rewardRemainingToday > 0
        ? [
            `오늘 질문 ${usage.usedCount}회는 모두 썼소.`,
            `친구에게 공유하기로 질문 ${usage.rewardRemainingToday}회까지 더 적립할 수 있소.`,
            `현재 공유 적립은 ${usage.rewardCountToday}/${DAILY_SHARE_REWARD_LIMIT}회요.`,
          ].join("\n")
        : [
            `오늘 질문 ${usage.usedCount}회는 모두 썼소.`,
            `오늘 공유 적립도 ${DAILY_SHARE_REWARD_LIMIT}회를 모두 채웠으니 내일 다시 물어보시오.`,
          ].join("\n"),
  });
}

export function createFallbackGuideCard(hasProfile: boolean): KakaoBasicCardResponse {
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
