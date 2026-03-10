import { createHmac, timingSafeEqual } from "crypto";

export type AccessTokenScope = "profile-access";

type AccessTokenPayload = {
  v: 1;
  userId: string;
  scope: AccessTokenScope;
  exp: number;
};

const FALLBACK_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 180;

function base64UrlEncode(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function getSigningSecret(): string {
  const secret =
    process.env.APP_SIGNING_SECRET ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL;

  if (!secret) {
    throw new Error("APP_SIGNING_SECRET or database url is required for access tokens.");
  }

  return secret;
}

function signTokenPart(payloadPart: string): string {
  return createHmac("sha256", getSigningSecret()).update(payloadPart).digest("base64url");
}

export function createProfileAccessToken(
  userId: string,
  options?: {
    expiresInSeconds?: number;
  },
): string {
  const payload: AccessTokenPayload = {
    v: 1,
    userId,
    scope: "profile-access",
    exp: Math.floor(Date.now() / 1000) + (options?.expiresInSeconds ?? FALLBACK_TOKEN_TTL_SECONDS),
  };

  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = signTokenPart(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifyProfileAccessToken(
  token: string | undefined,
  expectedUserId: string,
): { ok: true; payload: AccessTokenPayload } | { ok: false; reason: string } {
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
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as Partial<AccessTokenPayload>;
    if (
      payload.v !== 1 ||
      payload.scope !== "profile-access" ||
      typeof payload.userId !== "string" ||
      typeof payload.exp !== "number"
    ) {
      return { ok: false, reason: "invalid_payload" };
    }

    if (payload.userId !== expectedUserId) {
      return { ok: false, reason: "user_mismatch" };
    }

    if (payload.exp <= Math.floor(Date.now() / 1000)) {
      return { ok: false, reason: "expired_token" };
    }

    return { ok: true, payload: payload as AccessTokenPayload };
  } catch {
    return { ok: false, reason: "invalid_payload" };
  }
}
