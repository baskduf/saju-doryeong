import { createHmac, timingSafeEqual } from "crypto";

export const ADMIN_SESSION_COOKIE_NAME = "saju_doryeong_admin";
export const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 12;

type AdminSessionPayload = {
  v: 1;
  scope: "admin-session";
  exp: number;
};

type AdminSessionVerificationResult =
  | { ok: true; payload: AdminSessionPayload }
  | { ok: false; reason: string };

function getUnixNowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export function getAdminDashboardSecret(): string | null {
  const secret = process.env.ADMIN_DASHBOARD_SECRET?.trim();
  return secret ? secret : null;
}

export function isAdminDashboardConfigured(): boolean {
  return Boolean(getAdminDashboardSecret());
}

export function verifyAdminDashboardSecret(input: string | undefined): boolean {
  const configured = getAdminDashboardSecret();
  if (!configured || !input) {
    return false;
  }

  const providedBuffer = Buffer.from(input.trim());
  const expectedBuffer = Buffer.from(configured);
  return (
    providedBuffer.length === expectedBuffer.length && timingSafeEqual(providedBuffer, expectedBuffer)
  );
}

function base64UrlEncode(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signTokenPart(payloadPart: string): string {
  const secret = getAdminDashboardSecret();
  if (!secret) {
    throw new Error("ADMIN_DASHBOARD_SECRET is required for admin session tokens.");
  }

  return createHmac("sha256", secret).update(payloadPart).digest("base64url");
}

export function createAdminSessionToken(options?: { expiresInSeconds?: number }): string {
  const payload: AdminSessionPayload = {
    v: 1,
    scope: "admin-session",
    exp: getUnixNowSeconds() + (options?.expiresInSeconds ?? ADMIN_SESSION_TTL_SECONDS),
  };

  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  return `${encodedPayload}.${signTokenPart(encodedPayload)}`;
}

export function verifyAdminSessionToken(token: string | undefined): AdminSessionVerificationResult {
  if (!token) {
    return { ok: false, reason: "missing_token" };
  }

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) {
    return { ok: false, reason: "malformed_token" };
  }

  const expectedSignature = signTokenPart(encodedPayload);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return { ok: false, reason: "invalid_signature" };
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as Partial<AdminSessionPayload>;
    if (
      payload.v !== 1 ||
      payload.scope !== "admin-session" ||
      typeof payload.exp !== "number"
    ) {
      return { ok: false, reason: "invalid_payload" };
    }

    if (payload.exp <= getUnixNowSeconds()) {
      return { ok: false, reason: "expired_token" };
    }

    return { ok: true, payload: payload as AdminSessionPayload };
  } catch {
    return { ok: false, reason: "invalid_payload" };
  }
}
