import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateDailyFortune } from "../../lib/fortune";

const mocks = vi.hoisted(() => ({
  upsert: vi.fn(),
  findUnique: vi.fn(),
  createShareAccessToken: vi.fn(),
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

import {
  findFortuneShareSnapshotById,
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
    mocks.upsert.mockResolvedValue({
      id: "snapshot-1",
      targetDateKey: "2026-03-10",
    });
    mocks.findUnique.mockResolvedValue({
      id: "snapshot-1",
      payload: { displayName: "홍**" },
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
    expect((createPayload.recommendedActions as string[]).length).toBeLessThanOrEqual(3);
    expect((createPayload.avoidToday as string[]).length).toBeLessThanOrEqual(3);
  });

  it("reads share snapshots with the expected select shape", async () => {
    const snapshot = await findFortuneShareSnapshotById("snapshot-1");

    expect(snapshot).toEqual({
      id: "snapshot-1",
      payload: { displayName: "홍**" },
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
});
