import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateDailyFortune } from "../../lib/fortune";

const mocks = vi.hoisted(() => ({
  upsert: vi.fn(),
  findUnique: vi.fn(),
  createShareAccessToken: vi.fn(),
  logAdminEventSafe: vi.fn(),
}));

vi.mock("../../lib/prisma", () => ({
  prisma: {
    fortuneShareSnapshot: {
      upsert: mocks.upsert,
      findUnique: mocks.findUnique,
    },
  },
}));

vi.mock("../../lib/access-token", () => ({
  createShareAccessToken: mocks.createShareAccessToken,
}));

vi.mock("../../lib/admin-event-log", () => ({
  logAdminEventSafe: mocks.logAdminEventSafe,
}));

import {
  findFortuneShareSnapshotById,
  normalizeFortuneSharePayload,
  shouldRenderSignalCaution,
  upsertFortuneShareSnapshot,
} from "../../lib/fortune-share";

function buildFortune() {
  return generateDailyFortune({
    userId: "share-user",
    birthDate: new Date(Date.UTC(1995, 9, 21)),
    birthTime: "14:30",
    calendarType: "unknown",
    sajuData: {},
    date: new Date("2026-03-09T15:30:00Z"),
  });
}

describe("fortune share snapshots", () => {
  beforeEach(() => {
    mocks.createShareAccessToken.mockReturnValue("share-token");
    mocks.logAdminEventSafe.mockReset();
    mocks.upsert.mockResolvedValue({
      id: "snapshot-1",
      targetDateKey: "2026-03-10",
    });
    mocks.findUnique.mockResolvedValue({
      id: "snapshot-1",
      payload: { displayName: "홍*" },
      expiresAt: new Date("2026-04-09T00:00:00Z"),
    });
  });

  it("serializes a safe share payload and returns a token tuple", async () => {
    const result = await upsertFortuneShareSnapshot({
      userId: "share-user",
      profileName: "홍길동",
      fortune: buildFortune(),
      date: new Date("2026-03-09T15:30:00Z"),
    });

    expect(result).toEqual({
      snapshotId: "snapshot-1",
      targetDateKey: "2026-03-10",
      token: "share-token",
    });

    expect(mocks.createShareAccessToken).toHaveBeenCalledWith("snapshot-1");
    expect(mocks.upsert).toHaveBeenCalledTimes(1);

    const [args] = mocks.upsert.mock.calls[0];
    const createPayload = args.create.payload as Record<string, unknown>;

    expect(args.where).toEqual({
      userId_targetDateKey: {
        userId: "share-user",
        targetDateKey: "2026-03-10",
      },
    });
    expect(createPayload.displayName).toBe("홍**");
    expect(createPayload.targetDateKey).toBe("2026-03-10");
    expect(createPayload.certainty).toBe("calendar-unknown");
    expect(createPayload.uncertaintyMessage).toBeTypeOf("string");
    expect(Array.isArray(createPayload.signals)).toBe(true);
    expect((createPayload.signals as Array<{ key: string }>).length).toBeGreaterThan(0);
    expect((createPayload.recommendedActions as string[]).length).toBeLessThanOrEqual(3);
    expect((createPayload.avoidToday as string[]).length).toBeLessThanOrEqual(3);
    expect(mocks.logAdminEventSafe).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "share_created",
        status: "success",
        userId: "share-user",
      }),
    );
  });

  it("reads share snapshots with the expected select shape", async () => {
    const snapshot = await findFortuneShareSnapshotById("snapshot-1");

    expect(snapshot).toEqual({
      id: "snapshot-1",
      payload: { displayName: "홍*" },
      expiresAt: new Date("2026-04-09T00:00:00Z"),
    });
    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { id: "snapshot-1" },
      select: {
        id: true,
        payload: true,
        expiresAt: true,
      },
    });
  });

  it("normalizes legacy share payloads without signals", () => {
    const normalized = normalizeFortuneSharePayload({
      displayName: "홍*동",
      score: 74,
      grade: "길",
      headline: "실천하면 성과가 쌓이는 날이로다.",
      summary: "오늘은 순서를 세우면 흐름이 반듯하게 이어지오.",
      caution: "서두른 답변은 한 박자 늦추시오.",
      certainty: "exact",
      uncertaintyMessage: null,
      featuredInsight: {
        label: "타이밍 포인트",
        title: "오전에 흐름을 먼저 잡는 편이 좋소.",
        summary: "오전 쪽에 맞춰 순서를 잡으면 오늘 흐름이 더 반듯하게 이어지오.",
        action: "오전에 중요한 연락과 우선순위부터 정하시오.",
        caution: "타이밍을 놓친 뒤 급히 만회하려 들지 마시오.",
      },
      avoidToday: ["서두른 답변은 한 박자 늦추시오."],
      recommendedActions: ["오전에 중요한 연락부터 두시오."],
      targetDateKey: "2026-03-10",
    });

    expect(normalized).not.toBeNull();
    expect(normalized?.signals).toHaveLength(1);
    expect(normalized?.signals[0]).toEqual(
      expect.objectContaining({
        key: "timing",
        label: "타이밍 포인트",
        title: "오전에 흐름을 먼저 잡는 편이 좋소.",
      }),
    );
  });

  it("shows caution only for caution-toned or friction signals", () => {
    expect(shouldRenderSignalCaution({ key: "work", tone: "steady" })).toBe(false);
    expect(shouldRenderSignalCaution({ key: "timing", tone: "push" })).toBe(false);
    expect(shouldRenderSignalCaution({ key: "friction", tone: "steady" })).toBe(true);
    expect(shouldRenderSignalCaution({ key: "money", tone: "caution" })).toBe(true);
  });
});
