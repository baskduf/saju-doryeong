import { createHmac, timingSafeEqual } from "crypto";

export type AccessTokenScope =
  | "register-access"
  | "fortune-access"
  | "share-access"
  | "profile-access";

type BasePayload = {
  exp: number;
};

type RegisterAccessPayload = BasePayload & {
  v: 2;
  scope: "register-access";
  userId: string;
};

type FortuneAccessPayload = BasePayload & {
  v: 2;
  scope: "fortune-access";
  userId: string;
};

type ShareAccessPayload = BasePayload & {
  v: 2;
  scope: "share-access";
  snapshotId: string;
};

type LegacyProfileAccessPayload = BasePayload & {
  v: 1;
  scope: "profile-access";
  userId: string;
};

type KnownAccessTokenPayload =
  | RegisterAccessPayload
  | FortuneAccessPayload
  | ShareAccessPayload
  | LegacyProfileAccessPayload;

type TokenVerificationResult<T extends KnownAccessTokenPayload> =
  | { ok: true; payload: T }
  | { ok: false; reason: string };

const REGISTER_TOKEN_TTL_SECONDS = 60 * 10;
const FORTUNE_TOKEN_TTL_SECONDS = 60 * 60 * 24;
const SHARE_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;
const LEGACY_PROFILE_ACCESS_READ_ONLY_UNTIL_SECONDS = Math.floor(
  new Date("2026-03-17T00:00:00+09:00").getTime() / 1000,
);

function getUnixNowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function getSigningSecret(): string {
  const secret = process.env.APP_SIGNING_SECRET?.trim();
  if (!secret) {
    throw new Error("APP_SIGNING_SECRET is required for access tokens.");
  }

  return secret;
}

function base64UrlEncode(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signTokenPart(payloadPart: string): string {
  return createHmac("sha256", getSigningSecret()).update(payloadPart).digest("base64url");
}

function verifySignature(
  encodedPayload: string,
  signature: string,
): TokenVerificationResult<KnownAccessTokenPayload> | null {
  const expectedSignature = signTokenPart(encodedPayload);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return { ok: false, reason: "invalid_signature" };
  }

  return null;
}

function parseTokenPayload(token: string | undefined): TokenVerificationResult<KnownAccessTokenPayload> {
  if (!token) {
    return { ok: false, reason: "missing_token" };
  }

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) {
    return { ok: false, reason: "malformed_token" };
  }

  const signatureError = verifySignature(encodedPayload, signature);
  if (signatureError) {
    return signatureError;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as Partial<KnownAccessTokenPayload>;
    if (typeof payload.exp !== "number") {
      return { ok: false, reason: "invalid_payload" };
    }

    if (payload.exp <= getUnixNowSeconds()) {
      return { ok: false, reason: "expired_token" };
    }

    if (
      payload.v === 2 &&
      payload.scope === "register-access" &&
      typeof payload.userId === "string"
    ) {
      return { ok: true, payload: payload as RegisterAccessPayload };
    }

    if (
      payload.v === 2 &&
      payload.scope === "fortune-access" &&
      typeof payload.userId === "string"
    ) {
      return { ok: true, payload: payload as FortuneAccessPayload };
    }

    if (
      payload.v === 2 &&
      payload.scope === "share-access" &&
      typeof payload.snapshotId === "string"
    ) {
      return { ok: true, payload: payload as ShareAccessPayload };
    }

    if (
      payload.v === 1 &&
      payload.scope === "profile-access" &&
      typeof payload.userId === "string"
    ) {
      return { ok: true, payload: payload as LegacyProfileAccessPayload };
    }

    return { ok: false, reason: "invalid_payload" };
  } catch {
    return { ok: false, reason: "invalid_payload" };
  }
}

function createUserAccessToken(
  scope: "register-access" | "fortune-access",
  userId: string,
  expiresInSeconds: number,
): string {
  const payload: RegisterAccessPayload | FortuneAccessPayload = {
    v: 2,
    scope,
    userId,
    exp: getUnixNowSeconds() + expiresInSeconds,
  };

  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  return `${encodedPayload}.${signTokenPart(encodedPayload)}`;
}

export function createRegisterAccessToken(
  userId: string,
  options?: { expiresInSeconds?: number },
): string {
  return createUserAccessToken(
    "register-access",
    userId,
    options?.expiresInSeconds ?? REGISTER_TOKEN_TTL_SECONDS,
  );
}

export function createFortuneAccessToken(
  userId: string,
  options?: { expiresInSeconds?: number },
): string {
  return createUserAccessToken(
    "fortune-access",
    userId,
    options?.expiresInSeconds ?? FORTUNE_TOKEN_TTL_SECONDS,
  );
}

export function createShareAccessToken(
  snapshotId: string,
  options?: { expiresInSeconds?: number },
): string {
  const payload: ShareAccessPayload = {
    v: 2,
    scope: "share-access",
    snapshotId,
    exp: getUnixNowSeconds() + (options?.expiresInSeconds ?? SHARE_TOKEN_TTL_SECONDS),
  };

  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  return `${encodedPayload}.${signTokenPart(encodedPayload)}`;
}

export function verifyRegisterAccessToken(
  token: string | undefined,
  expectedUserId: string,
): TokenVerificationResult<RegisterAccessPayload> {
  const parsed = parseTokenPayload(token);
  if (!parsed.ok) {
    return parsed;
  }

  if (parsed.payload.scope !== "register-access") {
    return { ok: false, reason: "scope_mismatch" };
  }

  if (parsed.payload.userId !== expectedUserId) {
    return { ok: false, reason: "user_mismatch" };
  }

  return { ok: true, payload: parsed.payload };
}

export function verifyFortuneAccessToken(
  token: string | undefined,
  expectedUserId: string,
): TokenVerificationResult<FortuneAccessPayload | LegacyProfileAccessPayload> {
  const parsed = parseTokenPayload(token);
  if (!parsed.ok) {
    return parsed;
  }

  if ("userId" in parsed.payload && parsed.payload.userId !== expectedUserId) {
    return { ok: false, reason: "user_mismatch" };
  }

  if (parsed.payload.scope === "fortune-access") {
    return { ok: true, payload: parsed.payload };
  }

  if (parsed.payload.scope === "profile-access") {
    if (getUnixNowSeconds() > LEGACY_PROFILE_ACCESS_READ_ONLY_UNTIL_SECONDS) {
      return { ok: false, reason: "legacy_token_expired" };
    }
    return { ok: true, payload: parsed.payload };
  }

  return { ok: false, reason: "scope_mismatch" };
}

export function verifyShareAccessToken(
  token: string | undefined,
  expectedSnapshotId: string,
): TokenVerificationResult<ShareAccessPayload> {
  const parsed = parseTokenPayload(token);
  if (!parsed.ok) {
    return parsed;
  }

  if (parsed.payload.scope !== "share-access") {
    return { ok: false, reason: "scope_mismatch" };
  }

  if (parsed.payload.snapshotId !== expectedSnapshotId) {
    return { ok: false, reason: "snapshot_mismatch" };
  }

  return { ok: true, payload: parsed.payload };
}
