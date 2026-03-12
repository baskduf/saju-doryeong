import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAdminLogsPage: vi.fn(),
}));

vi.mock("../../../../lib/admin-dashboard", () => ({
  getAdminLogsPage: mocks.getAdminLogsPage,
}));

import { GET } from "../../../../app/api/admin/logs/route";
import { createAdminSessionToken } from "../../../../lib/admin-auth";

describe("GET /api/admin/logs", () => {
  beforeEach(() => {
    process.env.ADMIN_DASHBOARD_SECRET = "admin-secret";
    process.env.DATABASE_URL = "postgresql://test";
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
          createdAt: new Date("2026-03-12T00:00:00Z"),
        },
      ],
      page: 1,
      hasNext: false,
    });
  });

  it("rejects unauthenticated requests", async () => {
    const request = new NextRequest("https://test.example.com/api/admin/logs", {
      method: "GET",
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toContain("관리자");
  });

  it("returns filtered logs for authenticated requests", async () => {
    const request = new NextRequest(
      "https://test.example.com/api/admin/logs?eventType=question_answered&status=success&userId=user&page=2",
      {
        method: "GET",
        headers: {
          cookie: `saju_doryeong_admin=${createAdminSessionToken({ expiresInSeconds: 60 })}`,
        },
      },
    );

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.items[0].id).toBe("log-1");
    expect(mocks.getAdminLogsPage).toHaveBeenCalledWith({
      eventType: "question_answered",
      status: "success",
      userId: "user",
      page: 2,
    });
  });
});
