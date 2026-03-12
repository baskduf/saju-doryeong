import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAdminUsersPage: vi.fn(),
}));

vi.mock("../../../../lib/admin-dashboard", () => ({
  getAdminUsersPage: mocks.getAdminUsersPage,
}));

import { GET } from "../../../../app/api/admin/users/route";
import { createAdminSessionToken } from "../../../../lib/admin-auth";

describe("GET /api/admin/users", () => {
  beforeEach(() => {
    process.env.ADMIN_DASHBOARD_SECRET = "admin-secret";
    process.env.DATABASE_URL = "postgresql://test";
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
  });

  it("rejects unauthenticated requests", async () => {
    const request = new NextRequest("https://test.example.com/api/admin/users", {
      method: "GET",
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toContain("관리자 인증");
  });

  it("returns a safe user list for authenticated requests", async () => {
    const request = new NextRequest("https://test.example.com/api/admin/users?q=user", {
      method: "GET",
      headers: {
        cookie: `saju_doryeong_admin=${createAdminSessionToken({ expiresInSeconds: 60 })}`,
      },
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.items[0].userId).toBe("user-1");
    expect(body.items[0].sajuData).toBeUndefined();
    expect(mocks.getAdminUsersPage).toHaveBeenCalledWith({ q: "user", page: 1 });
  });
});
