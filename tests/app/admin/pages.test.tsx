import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  hasDatabaseUrl: vi.fn(),
  getAdminOverview: vi.fn(),
  getAdminUsersPage: vi.fn(),
  getAdminUserDetail: vi.fn(),
  getAdminSharesPage: vi.fn(),
  getAdminLogsPage: vi.fn(),
}));

vi.mock("../../../lib/profile", () => ({
  hasDatabaseUrl: mocks.hasDatabaseUrl,
}));

vi.mock("../../../lib/admin-dashboard", () => ({
  getAdminOverview: mocks.getAdminOverview,
  getAdminUsersPage: mocks.getAdminUsersPage,
  getAdminUserDetail: mocks.getAdminUserDetail,
  getAdminSharesPage: mocks.getAdminSharesPage,
  getAdminLogsPage: mocks.getAdminLogsPage,
}));

import OverviewPage from "../../../app/admin/(dashboard)/page";
import LogsPage from "../../../app/admin/(dashboard)/logs/page";
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
      recentLogs: [
        {
          id: "log-1",
          eventType: "question_answered",
          status: "success",
          source: "fortune-question",
          userId: "user-1",
          message: "answered",
          questionText: "hidden in overview",
          metadata: { model: "gpt-4.1-mini" },
          createdAt: new Date("2026-03-12T00:10:00Z"),
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
    mocks.getAdminLogsPage.mockResolvedValue({
      items: [
        {
          id: "log-1",
          eventType: "question_answered",
          status: "success",
          source: "fortune-question",
          userId: "user-1",
          message: "answered",
          questionText: "will it work?",
          metadata: { model: "gpt-4.1-mini" },
          createdAt: new Date("2026-03-12T00:10:00Z"),
        },
      ],
      page: 1,
      hasNext: false,
    });
  });

  it("renders the overview dashboard cards and recent tables", async () => {
    const markup = renderToStaticMarkup(await OverviewPage());

    expect(markup).toContain("question_answered");
    expect(markup).toContain("홍*");
    expect(markup).not.toContain("hidden in overview");
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

    expect(markup).toContain("홍길동");
    expect(markup).toContain("user-1");
  });

  it("renders share rows with status badges", async () => {
    const markup = renderToStaticMarkup(
      await SharesPage({
        searchParams: {
          status: "active",
        },
      }),
    );

    expect(markup).toContain("snapshot-1");
    expect(markup).toContain("active");
  });

  it("renders logs filters, rows, and detail content", async () => {
    const markup = renderToStaticMarkup(
      await LogsPage({
        searchParams: {
          eventType: "question_answered",
          status: "success",
          userId: "user-1",
          logId: "log-1",
        },
      }),
    );

    expect(markup).toContain("question_answered");
    expect(markup).toContain("will it work?");
    expect(markup).toContain("gpt-4.1-mini");
  });
});
