import {
  buildInitialSajuData,
  findProfileByUserId,
  getQuestionUsageSummary,
  hasDatabaseUrl,
  hasPendingQuestionInput,
  incrementQuestionUsage,
  incrementShareReward,
  parseRegistrationFields,
  setPendingQuestionInput,
  upsertProfile,
} from "../../../../lib/profile";
import {
  createBasicCard,
  createFallbackGuideCard,
  createQuestionGuideCard,
  createQuestionLimitCard,
  createRegistrationGuideCard,
} from "./cards";
import {
  FORTUNE_COMMAND,
  QUESTION_COMMAND,
  REREGISTER_COMMAND,
  SHARE_COMMAND,
} from "./constants";
import {
  createFortuneCard,
  createQuestionAnswerCard,
  createSharePromptCard,
} from "./presenters";
import {
  extractKakaoActionParams,
  getKakaoUserId,
  getKakaoUtterance,
  isReservedUtterance,
} from "./request";
import type { KakaoDispatchResult } from "./types";

export async function handleKakaoSkillPayload(payload: unknown): Promise<KakaoDispatchResult> {
  const userId = getKakaoUserId(payload);
  const utterance = getKakaoUtterance(payload)?.trim();
  const registrationParams = extractKakaoActionParams(payload);

  if (!userId) {
    return {
      body: createBasicCard({
        title: "운세도령",
        description: "사용자 식별값을 찾지 못했소. 다시 한 번 불러 주시오.",
      }),
    };
  }

  if (!hasDatabaseUrl()) {
    return {
      body: createBasicCard({
        title: "운세도령",
        description: "사주 서고가 아직 열리지 않았소. 잠시 뒤 다시 청해 주시오.",
      }),
      status: 503,
    };
  }

  const profile = await findProfileByUserId(userId);
  const pendingQuestionInput = hasPendingQuestionInput(profile);
  const questionUsage = getQuestionUsageSummary(profile);

  if (!registrationParams.hasAny && utterance === REREGISTER_COMMAND) {
    if (profile && pendingQuestionInput) {
      await setPendingQuestionInput(profile, false);
    }

    return {
      body: createRegistrationGuideCard(undefined, undefined, userId),
    };
  }

  if (!registrationParams.hasAny && utterance === QUESTION_COMMAND) {
    if (profile) {
      if (questionUsage.isLimited) {
        await setPendingQuestionInput(profile, false);
        return {
          body: createQuestionLimitCard(questionUsage),
        };
      }

      await setPendingQuestionInput(profile, true);
    }

    return {
      body: createQuestionGuideCard({
        hasProfile: Boolean(profile),
        usage: profile ? questionUsage : undefined,
      }),
    };
  }

  if (!registrationParams.hasAny && utterance === SHARE_COMMAND) {
    if (!profile) {
      return {
        body: createRegistrationGuideCard(undefined, undefined, userId),
      };
    }

    if (pendingQuestionInput) {
      await setPendingQuestionInput(profile, false);
    }

    const rewardResult = await incrementShareReward(profile);
    return {
      body: await createSharePromptCard({
        profile: rewardResult.profile,
        usage: rewardResult.usage,
        rewarded: rewardResult.rewarded,
      }),
    };
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
      return {
        body: createRegistrationGuideCard(parsed.message, registrationParams.debugLines, userId),
      };
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

    return {
      body: await createFortuneCard(
        storedProfile,
        profile ? "사주 기록을 다시 바로잡았소." : "사주 정보를 새로 기록했으니 바로 오늘의 운세를 펼치겠소.",
      ),
    };
  }

  if (!profile) {
    return {
      body: createRegistrationGuideCard(undefined, undefined, userId),
    };
  }

  if (!registrationParams.hasAny && utterance === FORTUNE_COMMAND) {
    if (pendingQuestionInput) {
      await setPendingQuestionInput(profile, false);
    }

    return {
      body: await createFortuneCard(profile),
    };
  }

  if (utterance && !registrationParams.hasAny && !isReservedUtterance(utterance) && pendingQuestionInput) {
    if (questionUsage.isLimited) {
      await setPendingQuestionInput(profile, false);
      return {
        body: createQuestionLimitCard(questionUsage),
      };
    }

    await setPendingQuestionInput(profile, false);
    const updatedProfile = await incrementQuestionUsage(profile);
    return {
      body: await createQuestionAnswerCard(updatedProfile, utterance),
    };
  }

  if (utterance && !registrationParams.hasAny && !isReservedUtterance(utterance)) {
    return {
      body: createFallbackGuideCard(true),
    };
  }

  return {
    body: await createFortuneCard(profile),
  };
}
