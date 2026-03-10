import { createHmac } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createFortuneAccessToken,
  createRegisterAccessToken,
  createShareAccessToken,
  verifyFortuneAccessToken,
  verifyRegisterAccessToken,
  verifyShareAccessToken,
} from "../../lib/access-token";

function createLegacyProfileAccessToken(userId: string, exp: number): string {
  const payload = {
    v: 1,
    scope: "profile-access",
    userId,
    exp,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", process.env.APP_SIGNING_SECRET ?? "")
    .update(encodedPayload)
    .digest("base64url");

  return `${encodedPayload}.${signature}`;
}

describe("access tokens", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-10T12:00:00+09:00"));
  });

  it("creates and verifies register tokens", () => {
    const token = createRegisterAccessToken("user-1");
    const result = verifyRegisterAccessToken(token, "user-1");

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.payload.scope).toBe("register-access");
    expect(result.payload.userId).toBe("user-1");
  });

  it("rejects user mismatches and scope mismatches", () => {
    const registerToken = createRegisterAccessToken("user-1");
    const fortuneToken = createFortuneAccessToken("user-1");
    const shareToken = createShareAccessToken("snapshot-1");

    expect(verifyRegisterAccessToken(registerToken, "user-2")).toEqual({
      ok: false,
      reason: "user_mismatch",
    });
    expect(verifyRegisterAccessToken(fortuneToken, "user-1")).toEqual({
      ok: false,
      reason: "scope_mismatch",
    });
    expect(verifyShareAccessToken(shareToken, "snapshot-2")).toEqual({
      ok: false,
      reason: "snapshot_mismatch",
    });
  });

  it("rejects expired tokens", () => {
    const token = createRegisterAccessToken("user-1", { expiresInSeconds: 1 });

    vi.advanceTimersByTime(2_000);

    expect(verifyRegisterAccessToken(token, "user-1")).toEqual({
      ok: false,
      reason: "expired_token",
    });
  });

  it("verifies share and fortune tokens", () => {
    const fortuneToken = createFortuneAccessToken("user-1");
    const shareToken = createShareAccessToken("snapshot-1");

    const fortuneResult = verifyFortuneAccessToken(fortuneToken, "user-1");
    const shareResult = verifyShareAccessToken(shareToken, "snapshot-1");

    expect(fortuneResult.ok).toBe(true);
    expect(shareResult.ok).toBe(true);

    if (fortuneResult.ok) {
      expect(fortuneResult.payload.scope).toBe("fortune-access");
    }

    if (shareResult.ok) {
      expect(shareResult.payload.scope).toBe("share-access");
    }
  });

  it("allows legacy profile access tokens before the cutoff", () => {
    const exp = Math.floor(new Date("2026-03-20T00:00:00+09:00").getTime() / 1000);
    const token = createLegacyProfileAccessToken("legacy-user", exp);
    const result = verifyFortuneAccessToken(token, "legacy-user");

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.payload.scope).toBe("profile-access");
  });

  it("blocks legacy profile access tokens after the cutoff", () => {
    const exp = Math.floor(new Date("2026-03-20T00:00:00+09:00").getTime() / 1000);
    const token = createLegacyProfileAccessToken("legacy-user", exp);

    vi.setSystemTime(new Date("2026-03-17T00:00:01+09:00"));

    expect(verifyFortuneAccessToken(token, "legacy-user")).toEqual({
      ok: false,
      reason: "legacy_token_expired",
    });
  });
});
