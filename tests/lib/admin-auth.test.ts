import { beforeEach, describe, expect, it } from "vitest";
import {
  ADMIN_SESSION_COOKIE_NAME,
  createAdminSessionToken,
  verifyAdminDashboardSecret,
  verifyAdminSessionToken,
} from "../../lib/admin-auth";

describe("admin auth helpers", () => {
  beforeEach(() => {
    process.env.ADMIN_DASHBOARD_SECRET = "admin-secret";
  });

  it("verifies the configured admin dashboard secret", () => {
    expect(verifyAdminDashboardSecret("admin-secret")).toBe(true);
    expect(verifyAdminDashboardSecret("wrong-secret")).toBe(false);
  });

  it("creates and verifies admin session tokens", () => {
    const token = createAdminSessionToken({ expiresInSeconds: 60 });
    const result = verifyAdminSessionToken(token);

    expect(result.ok).toBe(true);
    expect(ADMIN_SESSION_COOKIE_NAME).toBe("saju_doryeong_admin");
  });

  it("rejects expired admin session tokens", () => {
    const token = createAdminSessionToken({ expiresInSeconds: -1 });
    const result = verifyAdminSessionToken(token);

    expect(result).toEqual({
      ok: false,
      reason: "expired_token",
    });
  });
});
