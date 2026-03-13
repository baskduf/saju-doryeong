import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SajuProfileRecord } from "../../lib/profile";
import {
  getQuestionUsageSummary,
  hasPendingQuestionInput,
  parseRegistrationFields,
} from "../../lib/profile";

function buildProfile(overrides: Partial<SajuProfileRecord> = {}): SajuProfileRecord {
  return {
    userId: "user-1",
    name: "홍길동",
    birthDate: new Date(Date.UTC(1995, 9, 21)),
    birthTime: "14:30",
    calendarType: "solar",
    sajuData: {},
    questionUsageDateKey: "2026-03-10",
    questionUsageCount: 2,
    shareRewardDateKey: "2026-03-10",
    shareRewardCount: 3,
    pendingQuestionInput: false,
    pendingQuestionExpiresAt: null,
    createdAt: new Date("2026-03-01T00:00:00Z"),
    updatedAt: new Date("2026-03-10T00:00:00Z"),
    ...overrides,
  };
}

describe("profile policy helpers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-10T09:00:00+09:00"));
  });

  it("parses flexible registration fields", () => {
    const parsed = parseRegistrationFields({
      name: "홍길동",
      birthDate: "생일은 1995/10/21 입니다",
      birthTime: "1430",
      calendarType: "양력",
    });

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }

    expect(parsed.data.name).toBe("홍길동");
    expect(parsed.data.birthDate.toISOString()).toBe("1995-10-21T00:00:00.000Z");
    expect(parsed.data.birthTime).toBe("14:30");
    expect(parsed.data.calendarType).toBe("solar");
  });

  it("treats unknown birth time as optional", () => {
    const parsed = parseRegistrationFields({
      name: "김도령",
      birthDate: "19951021",
      birthTime: "미상",
      calendarType: "모름",
    });

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }

    expect(parsed.data.birthTime).toBeUndefined();
    expect(parsed.data.calendarType).toBe("unknown");
  });

  it("rejects invalid dates and times", () => {
    expect(
      parseRegistrationFields({
        name: "홍길동",
        birthDate: "1995-02-30",
        birthTime: "14:30",
        calendarType: "solar",
      }),
    ).toEqual({
      ok: false,
      message: "birthDate 형식이 올바르지 않습니다. 예: 1995-10-21",
    });

    expect(
      parseRegistrationFields({
        name: "홍길동",
        birthDate: "1995-10-21",
        birthTime: "25:10",
        calendarType: "solar",
      }),
    ).toEqual({
      ok: false,
      message: "birthTime 시간 값이 유효하지 않습니다. 예: 00:00~23:59",
    });
  });

  it("calculates question usage with KST day boundaries", () => {
    const summary = getQuestionUsageSummary(
      buildProfile({
        questionUsageDateKey: "2026-03-10",
        questionUsageCount: 4,
        shareRewardDateKey: "2026-03-10",
        shareRewardCount: 3,
      }),
    );

    expect(summary.usedCount).toBe(4);
    expect(summary.rewardCountToday).toBe(3);
    expect(summary.totalLimitToday).toBe(6);
    expect(summary.remaining).toBe(2);
    expect(summary.isLimited).toBe(false);
  });

  it("resets stale counts and caps daily reward at ten", () => {
    const staleSummary = getQuestionUsageSummary(
      buildProfile({
        questionUsageDateKey: "2026-03-09",
        questionUsageCount: 5,
        shareRewardDateKey: "2026-03-09",
        shareRewardCount: 4,
      }),
    );
    const cappedSummary = getQuestionUsageSummary(
      buildProfile({
        shareRewardDateKey: "2026-03-10",
        shareRewardCount: 99,
      }),
    );

    expect(staleSummary.usedCount).toBe(0);
    expect(staleSummary.rewardCountToday).toBe(0);
    expect(staleSummary.totalLimitToday).toBe(3);

    expect(cappedSummary.rewardCountToday).toBe(10);
    expect(cappedSummary.rewardRemainingToday).toBe(0);
    expect(cappedSummary.totalLimitToday).toBe(13);
  });

  it("expires pending question mode when ttl has passed", () => {
    const activeProfile = buildProfile({
      pendingQuestionInput: true,
      pendingQuestionExpiresAt: new Date("2026-03-10T09:01:00+09:00"),
    });
    const expiredProfile = buildProfile({
      pendingQuestionInput: true,
      pendingQuestionExpiresAt: new Date("2026-03-10T08:58:59+09:00"),
    });

    expect(hasPendingQuestionInput(activeProfile)).toBe(true);
    expect(hasPendingQuestionInput(expiredProfile)).toBe(false);
  });
});
