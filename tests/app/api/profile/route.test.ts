import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const profileMocks = vi.hoisted(() => ({
  buildInitialSajuData: vi.fn(),
  hasDatabaseUrl: vi.fn(),
  isNonEmptyString: vi.fn((value: unknown) => typeof value === "string" && value.trim().length > 0),
  parseRegistrationFields: vi.fn(),
  upsertProfile: vi.fn(),
}));

const accessTokenMocks = vi.hoisted(() => ({
  createFortuneAccessToken: vi.fn(),
  verifyRegisterAccessToken: vi.fn(),
}));

const adminLogMocks = vi.hoisted(() => ({
  logAdminEventSafe: vi.fn(),
}));

vi.mock("../../../../lib/profile", () => ({
  buildInitialSajuData: profileMocks.buildInitialSajuData,
  hasDatabaseUrl: profileMocks.hasDatabaseUrl,
  isNonEmptyString: profileMocks.isNonEmptyString,
  parseRegistrationFields: profileMocks.parseRegistrationFields,
  upsertProfile: profileMocks.upsertProfile,
}));

vi.mock("../../../../lib/access-token", () => ({
  createFortuneAccessToken: accessTokenMocks.createFortuneAccessToken,
  verifyRegisterAccessToken: accessTokenMocks.verifyRegisterAccessToken,
}));

vi.mock("../../../../lib/admin-event-log", () => ({
  logAdminEventSafe: adminLogMocks.logAdminEventSafe,
}));

import { POST } from "../../../../app/api/profile/route";

async function callRoute(payload: unknown) {
  const request = new NextRequest("https://test.example.com/api/profile", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return POST(request);
}

describe("POST /api/profile", () => {
  beforeEach(() => {
    adminLogMocks.logAdminEventSafe.mockReset();
    profileMocks.hasDatabaseUrl.mockReturnValue(true);
    profileMocks.parseRegistrationFields.mockReturnValue({
      ok: true,
      data: {
        name: "홍길동",
        birthDate: new Date(Date.UTC(1995, 9, 21)),
        birthTime: "14:30",
        calendarType: "solar",
      },
    });
    profileMocks.buildInitialSajuData.mockReturnValue({ built: true });
    profileMocks.upsertProfile.mockResolvedValue({
      userId: "kakao-user-1",
      name: "홍길동",
      birthDate: new Date(Date.UTC(1995, 9, 21)),
      birthTime: "14:30",
      calendarType: "solar",
      sajuData: { built: true },
    });
    accessTokenMocks.verifyRegisterAccessToken.mockReturnValue({
      ok: true,
      payload: {
        v: 2,
        scope: "register-access",
        userId: "kakao-user-1",
        exp: 9_999_999_999,
      },
    });
    accessTokenMocks.createFortuneAccessToken.mockReturnValue("fortune-token");
  });

  it("rebuilds saju data on the server even when the client sends sajuData", async () => {
    const maliciousSajuData = {
      forged: true,
      score: 999,
      nested: {
        anything: "goes",
      },
    };

    const response = await callRoute({
      accessToken: "register-token",
      userId: "kakao-user-1",
      name: "홍길동",
      birthDate: "1995-10-21",
      birthTime: "14:30",
      calendarType: "solar",
      sajuData: maliciousSajuData,
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(profileMocks.buildInitialSajuData).toHaveBeenCalledWith({
      userId: "kakao-user-1",
      birthDate: new Date(Date.UTC(1995, 9, 21)),
      birthTime: "14:30",
      calendarType: "solar",
    });
    expect(profileMocks.upsertProfile).toHaveBeenCalledWith({
      userId: "kakao-user-1",
      name: "홍길동",
      birthDate: new Date(Date.UTC(1995, 9, 21)),
      birthTime: "14:30",
      calendarType: "solar",
      sajuData: { built: true },
    });
    expect(profileMocks.upsertProfile).not.toHaveBeenCalledWith(
      expect.objectContaining({ sajuData: maliciousSajuData }),
    );
    expect(body.fortuneAccessToken).toBe("fortune-token");
  });

  it("does not build or store saju data when the register token is invalid", async () => {
    accessTokenMocks.verifyRegisterAccessToken.mockReturnValue({
      ok: false,
      reason: "expired_token",
    });

    const response = await callRoute({
      accessToken: "bad-token",
      userId: "kakao-user-1",
      name: "홍길동",
      birthDate: "1995-10-21",
      birthTime: "14:30",
      calendarType: "solar",
      sajuData: { forged: true },
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toContain("?좏슚???깅줉 ?좏겙");
    expect(profileMocks.buildInitialSajuData).not.toHaveBeenCalled();
    expect(profileMocks.upsertProfile).not.toHaveBeenCalled();
    expect(adminLogMocks.logAdminEventSafe).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "profile_registration_failed",
        userId: "kakao-user-1",
        metadata: expect.objectContaining({
          reason: "expired_token",
        }),
      }),
    );
  });

  it("logs profile registration failures when the database url is missing", async () => {
    profileMocks.hasDatabaseUrl.mockReturnValue(false);

    const response = await callRoute({
      accessToken: "register-token",
      userId: "kakao-user-1",
      name: "홍길동",
      birthDate: "1995-10-21",
      birthTime: "14:30",
      calendarType: "solar",
    });

    expect(response.status).toBe(503);
    expect(adminLogMocks.logAdminEventSafe).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "profile_registration_failed",
        metadata: expect.objectContaining({
          reason: "missing_database_url",
        }),
      }),
    );
  });
});
