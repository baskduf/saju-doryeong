import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  hasDatabaseUrl: vi.fn(),
  getAdminOverview: vi.fn(),
  getAdminUsersPage: vi.fn(),
  getAdminUserDetail: vi.fn(),
  getAdminSharesPage: vi.fn(),
}));

vi.mock("../../../lib/profile", () => ({
  hasDatabaseUrl: mocks.hasDatabaseUrl,
}));

vi.mock("../../../lib/admin-dashboard", () => ({
  getAdminOverview: mocks.getAdminOverview,
  getAdminUsersPage: mocks.getAdminUsersPage,
  getAdminUserDetail: mocks.getAdminUserDetail,
  getAdminSharesPage: mocks.getAdminSharesPage,
}));

import OverviewPage from "../../../app/admin/(dashboard)/page";
import UsersPage from "../../../app/admin/(dashboard)/users/page";
import SharesPage from "../../../app/admin/(dashboard)/shares/page";

describe("admin pages", () => {
  beforeEach(() => {
    mocks.hasDatabaseUrl.mockReturnValue(true);
    mocks.getAdminOverview.mockResolvedValue({
      todayKey: "2026-03-12",
      todayLabel: "2026년 3월 12일 목요일",
      registrationsToday: 3,
      updatesToday: 4,
      sharesToday: 5,
      activeShares: 6,
      expiredShares: 1,
      pendingQuestionUsers: 2,
      calendarTypeCounts: {
        solar: 8,
        lunar: 1,
        unknown: 2,
        other: 0,
      },
      recentUsers: [
        {
          userId: "user-1",
          name: "홍길동",
          calendarType: "solar",
          createdAt: new Date("2026-03-10T00:00:00Z"),
          updatedAt: new Date("2026-03-12T00:00:00Z"),
          questionUsageCountToday: 2,
          shareRewardCountToday: 1,
          pendingQuestionInput: false,
          todayQuestionUsed: true,
        },
      ],
      recentShares: [
        {
          snapshotId: "snapshot-1",
          userId: "user-1",
          displayName: "홍*",
          targetDateKey: "2026-03-12",
          createdAt: new Date("2026-03-12T00:00:00Z"),
          expiresAt: new Date("2026-03-13T00:00:00Z"),
          status: "active",
        },
      ],
    });
    mocks.getAdminUsersPage.mockResolvedValue({
      items: [
        {
          userId: "user-1",
          name: "홍길동",
          calendarType: "solar",
          createdAt: new Date("2026-03-10T00:00:00Z"),
          updatedAt: new Date("2026-03-12T00:00:00Z"),
          questionUsageCountToday: 2,
          shareRewardCountToday: 1,
          pendingQuestionInput: false,
          todayQuestionUsed: true,
        },
      ],
      page: 1,
      hasNext: false,
    });
    mocks.getAdminUserDetail.mockResolvedValue({
      userId: "user-1",
      name: "홍길동",
      birthDate: new Date(Date.UTC(1995, 9, 21)),
      hasBirthTime: true,
      calendarType: "solar",
      createdAt: new Date("2026-03-10T00:00:00Z"),
      updatedAt: new Date("2026-03-12T00:00:00Z"),
      questionUsageCountToday: 2,
      shareRewardCountToday: 1,
      pendingQuestionInput: false,
      pendingQuestionExpiresAt: null,
      shareSnapshotCount: 3,
      todayQuestionUsed: true,
    });
    mocks.getAdminSharesPage.mockResolvedValue({
      items: [
        {
          snapshotId: "snapshot-1",
          userId: "user-1",
          displayName: "홍*",
          targetDateKey: "2026-03-12",
          createdAt: new Date("2026-03-12T00:00:00Z"),
          expiresAt: new Date("2026-03-13T00:00:00Z"),
          status: "active",
        },
      ],
      page: 1,
      hasNext: false,
    });
  });

  it("renders the overview dashboard cards and recent tables", async () => {
    const markup = renderToStaticMarkup(await OverviewPage());

    expect(markup).toContain("오늘 핵심 지표");
    expect(markup).toContain("최근 사용자");
    expect(markup).toContain("홍*");
  });

  it("renders users list and selected detail panel", async () => {
    const markup = renderToStaticMarkup(
      await UsersPage({
        searchParams: {
          q: "user",
          userId: "user-1",
        },
      }),
    );

    expect(markup).toContain("사용자 조회");
    expect(markup).toContain("홍길동");
    expect(markup).toContain("공유 스냅샷 수");
  });

  it("renders share rows with status badges", async () => {
    const markup = renderToStaticMarkup(
      await SharesPage({
        searchParams: {
          status: "active",
        },
      }),
    );

    expect(markup).toContain("공유 스냅샷");
    expect(markup).toContain("snapshot-1");
    expect(markup).toContain("active");
  });
});
