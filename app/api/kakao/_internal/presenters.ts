import { generateDailyFortune } from "../../../../lib/fortune";
import type { FortuneSignalKey } from "../../../../lib/fortune";
import { answerFortuneQuestion } from "../../../../lib/fortune-question";
import type { FortuneQuestionAnswer } from "../../../../lib/fortune-question";
import { upsertFortuneShareSnapshot } from "../../../../lib/fortune-share";
import {
  DAILY_SHARE_REWARD_LIMIT,
  getQuestionUsageSummary,
  type QuestionUsageSummary,
  type SajuProfileRecord,
} from "../../../../lib/profile";
import {
  createBasicCard,
  createFortuneButtons,
  createFortuneUrl,
  createQuestionQuickReplies,
  createSharePromptButtons,
  createShareUrl,
  resolveAppBaseUrl,
} from "./cards";
import type { KakaoBasicCardResponse, KakaoProfileLike } from "./types";

const SIGNAL_LABELS: Record<FortuneSignalKey, string> = {
  momentum: "추진 신호",
  friction: "마찰 신호",
  timing: "타이밍 신호",
  work: "일과 흐름",
  money: "재물 흐름",
  relationship: "관계 흐름",
  recovery: "회복 흐름",
};

function buildDailySourceLine(fortune: ReturnType<typeof generateDailyFortune>): string {
  const delta = fortune.analysis?.hybrid?.scoreBreakdown?.kuseongDelta ?? 0;
  const deltaLabel = `${delta > 0 ? "+" : ""}${delta}`;
  return `판단 근거: 사주 기본 + 구성 보정(${deltaLabel})`;
}

function buildQuestionDecisionBasisLine(answer: FortuneQuestionAnswer): string {
  const primary =
    SIGNAL_LABELS[answer.decisionBasis.primarySignalKey] ?? answer.decisionBasis.primarySignalKey;
  const secondary =
    SIGNAL_LABELS[answer.decisionBasis.secondarySignalKey] ?? answer.decisionBasis.secondarySignalKey;
  return `판단 신호: ${primary}, ${secondary}`;
}

function buildQuestionReferenceLine(answer: FortuneQuestionAnswer): string | null {
  if (answer.conflictResolution.status === "aligned") {
    return null;
  }

  return `참고: ${answer.conflictResolution.appliedPolicy}`;
}

export async function createFortuneCard(
  profile: KakaoProfileLike,
  notice?: string,
): Promise<KakaoBasicCardResponse> {
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
    `운세 점수: ${fortune.score}점(${fortune.grade})`,
    fortune.summary,
    fortune.caution,
    buildDailySourceLine(fortune),
  ].filter((line): line is string => Boolean(line));

  return createBasicCard({
    title: "운세도령의 오늘 운세",
    description: descriptionLines.join("\n\n"),
    thumbnailUrl: `${resolveAppBaseUrl()}/character_result.png`,
    buttons: createFortuneButtons(createFortuneUrl(profile.userId)),
  });
}

export async function createQuestionAnswerCard(
  profile: SajuProfileRecord,
  question: string,
): Promise<KakaoBasicCardResponse> {
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
    userId: profile.userId,
    profileName: profile.name ?? undefined,
    date: now,
  });
  const usage = getQuestionUsageSummary(profile);
  const metaLines = [
    buildQuestionDecisionBasisLine(answer),
    buildQuestionReferenceLine(answer),
    `남은 질문 ${usage.remaining}회`,
  ].filter((line): line is string => Boolean(line));

  return createBasicCard({
    title: answer.title,
    description: [answer.description, "", ...metaLines].join("\n"),
    buttons: createFortuneButtons(createFortuneUrl(profile.userId)),
    quickReplies: createQuestionQuickReplies(),
  });
}

export async function createSharePromptCard(params: {
  profile: KakaoProfileLike;
  usage: QuestionUsageSummary;
  rewarded: boolean;
}): Promise<KakaoBasicCardResponse> {
  const now = new Date();
  const fortune = generateDailyFortune({
    userId: params.profile.userId,
    birthDate: params.profile.birthDate,
    birthTime: params.profile.birthTime ?? undefined,
    calendarType: params.profile.calendarType as "solar" | "lunar" | "unknown",
    sajuData: params.profile.sajuData,
    date: now,
  });
  const shared = await upsertFortuneShareSnapshot({
    userId: params.profile.userId,
    profileName: params.profile.name,
    fortune,
    date: now,
  });

  return createBasicCard({
    title: "운세도령 공유 카드",
    description: [
      params.profile.name
        ? `${params.profile.name} 님의 오늘 운세를 공유할 수 있소.`
        : "오늘의 운세를 공유할 수 있소.",
      params.rewarded
        ? `질문 1개를 추가로 받으며 오늘 공유 보상 ${params.usage.rewardCountToday}/${DAILY_SHARE_REWARD_LIMIT}회를 채웠소.`
        : `오늘 공유 보상은 이미 ${DAILY_SHARE_REWARD_LIMIT}회를 채웠소.`,
      `오늘 질문은 총 ${params.usage.totalLimitToday}회까지 가능하고 남은 횟수는 ${params.usage.remaining}회요.`,
      `운세 점수: ${fortune.score}점(${fortune.grade})`,
      fortune.headline,
    ].join("\n\n"),
    thumbnailUrl: `${resolveAppBaseUrl()}/character_result.png`,
    buttons: createSharePromptButtons(createShareUrl(shared.snapshotId, shared.token)),
  });
}
