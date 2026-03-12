import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  profileCount: vi.fn(),
  profileGroupBy: vi.fn(),
  profileFindMany: vi.fn(),
  profileFindUnique: vi.fn(),
  shareCount: vi.fn(),
  shareFindMany: vi.fn(),
}));

vi.mock("../../lib/prisma", () => ({
  prisma: {
    sajuProfile: {
      count: mocks.profileCount,
      groupBy: mocks.profileGroupBy,
      findMany: mocks.profileFindMany,
      findUnique: mocks.profileFindUnique,
    },
    fortuneShareSnapshot: {
      count: mocks.shareCount,
      findMany: mocks.shareFindMany,
    },
  },
}));

import {
  getAdminOverview,
  getAdminSharesPage,
  getAdminUserDetail,
  getAdminUsersPage,
} from "../../lib/admin-dashboard";

describe("admin dashboard queries", () => {
  beforeEach(() => {
    mocks.profileCount.mockReset();
    mocks.profileGroupBy.mockReset();
    mocks.profileFindMany.mockReset();
    mocks.profileFindUnique.mockReset();
    mocks.shareCount.mockReset();
    mocks.shareFindMany.mockReset();
  });

  it("builds overview stats with KST day windows and safe recent payloads", async () => {
    mocks.profileCount
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(7)
      .mockResolvedValueOnce(2);
    mocks.shareCount
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(9)
      .mockResolvedValueOnce(1);
    mocks.profileGroupBy.mockResolvedValue([
      { calendarType: "solar", _count: { _all: 5 } },
      { calendarType: "unknown", _count: { _all: 2 } },
    ]);
    mocks.profileFindMany.mockResolvedValue([
      {
        userId: "user-1",
        name: "홍길동",
        calendarType: "solar",
        createdAt: new Date("2026-03-12T00:00:00Z"),
        updatedAt: new Date("2026-03-12T03:00:00Z"),
        questionUsageDateKey: "2026-03-12",
        questionUsageCount: 2,
        shareRewardDateKey: "2026-03-12",
        shareRewardCount: 1,
        pendingQuestionInput: true,
        pendingQuestionExpiresAt: new Date("2026-03-12T08:10:00Z"),
      },
    ]);
    mocks.shareFindMany.mockResolvedValue([
      {
        id: "snapshot-1",
        userId: "user-1",
        targetDateKey: "2026-03-12",
        createdAt: new Date("2026-03-12T01:00:00Z"),
        expiresAt: new Date("2026-03-13T01:00:00Z"),
        payload: { displayName: "홍*" },
      },
    ]);

    const overview = await getAdminOverview(new Date("2026-03-12T01:30:00Z"));

    expect(overview.registrationsToday).toBe(3);
    expect(overview.calendarTypeCounts).toEqual({
      solar: 5,
      lunar: 0,
      unknown: 2,
      other: 0,
    });
    expect(overview.recentUsers[0].questionUsageCountToday).toBe(2);
    expect(overview.recentShares[0].displayName).toBe("홍*");

    expect(mocks.profileCount.mock.calls[0][0]).toEqual({
      where: {
        createdAt: {
          gte: new Date("2026-03-12T00:00:00+09:00"),
          lt: new Date("2026-03-13T00:00:00+09:00"),
        },
      },
    });
  });

  it("supports paged user search without exposing raw saju data", async () => {
    mocks.profileFindMany.mockResolvedValue([
      {
        userId: "search-user",
        name: "검색자",
        calendarType: "unknown",
        createdAt: new Date("2026-03-10T00:00:00Z"),
        updatedAt: new Date("2026-03-12T00:00:00Z"),
        questionUsageDateKey: "2026-03-12",
        questionUsageCount: 1,
        shareRewardDateKey: "2026-03-12",
        shareRewardCount: 3,
        pendingQuestionInput: false,
        pendingQuestionExpiresAt: null,
      },
    ]);

    const result = await getAdminUsersPage({
      q: "search",
      page: 1,
      pageSize: 10,
      date: new Date("2026-03-12T01:30:00Z"),
    });

    expect(result.items[0]).toEqual({
      userId: "search-user",
      name: "검색자",
      calendarType: "unknown",
      createdAt: new Date("2026-03-10T00:00:00Z"),
      updatedAt: new Date("2026-03-12T00:00:00Z"),
      questionUsageCountToday: 1,
      shareRewardCountToday: 3,
      pendingQuestionInput: false,
      todayQuestionUsed: true,
    });
    expect(mocks.profileFindMany.mock.calls[0][0].where).toEqual({
      OR: [
        { userId: { contains: "search", mode: "insensitive" } },
        { name: { contains: "search", mode: "insensitive" } },
      ],
    });
  });

  it("returns a minimal user detail payload", async () => {
    mocks.profileFindUnique.mockResolvedValue({
      userId: "detail-user",
      name: "상세",
      birthDate: new Date(Date.UTC(1990, 0, 1)),
      birthTime: "14:30",
      calendarType: "solar",
      createdAt: new Date("2026-03-10T00:00:00Z"),
      updatedAt: new Date("2026-03-12T00:00:00Z"),
      questionUsageDateKey: "2026-03-12",
      questionUsageCount: 2,
      shareRewardDateKey: "2026-03-12",
      shareRewardCount: 4,
      pendingQuestionInput: true,
      pendingQuestionExpiresAt: new Date("2026-03-12T08:10:00Z"),
      _count: {
        shareSnapshots: 6,
      },
    });

    const detail = await getAdminUserDetail("detail-user", new Date("2026-03-12T01:30:00Z"));

    expect(detail?.hasBirthTime).toBe(true);
    expect(detail?.shareSnapshotCount).toBe(6);
    expect("sajuData" in (detail ?? {})).toBe(false);
  });

  it("filters share snapshots by status", async () => {
    mocks.shareFindMany.mockResolvedValue([
      {
        id: "snapshot-active",
        userId: "user-1",
        targetDateKey: "2026-03-12",
        createdAt: new Date("2026-03-12T00:00:00Z"),
        expiresAt: new Date("2026-03-13T00:00:00Z"),
        payload: { displayName: "홍*" },
      },
      {
        id: "snapshot-extra",
        userId: "user-2",
        targetDateKey: "2026-03-12",
        createdAt: new Date("2026-03-12T00:00:00Z"),
        expiresAt: new Date("2026-03-13T00:00:00Z"),
        payload: { displayName: "김*" },
      },
    ]);

    const result = await getAdminSharesPage({
      status: "active",
      page: 1,
      pageSize: 1,
      date: new Date("2026-03-12T01:30:00Z"),
    });

    expect(result.items[0].status).toBe("active");
    expect(result.hasNext).toBe(true);
    expect(mocks.shareFindMany.mock.calls[0][0].where).toEqual({
      expiresAt: {
        gt: new Date("2026-03-12T01:30:00Z"),
      },
    });
  });
});
