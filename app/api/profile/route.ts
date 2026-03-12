import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { logAdminEventSafe } from "../../../lib/admin-event-log";
import {
  buildInitialSajuData,
  hasDatabaseUrl,
  isNonEmptyString,
  parseRegistrationFields,
  upsertProfile,
} from "../../../lib/profile";
import { createFortuneAccessToken, verifyRegisterAccessToken } from "../../../lib/access-token";

type ProfilePayload = {
  accessToken?: string;
  userId: string;
  name: string;
  birthDate: Date;
  birthTime?: string;
  calendarType: "solar" | "lunar" | "unknown";
};

function parsePayload(
  payload: unknown,
): { ok: true; data: ProfilePayload } | { ok: false; message: string } {
  if (!payload || typeof payload !== "object") {
    return { ok: false, message: "JSON body媛 ?щ컮瑜댁? ?딆뒿?덈떎." };
  }

  const raw = payload as Record<string, unknown>;
  const userId = raw.userId;
  if (!isNonEmptyString(userId)) {
    return { ok: false, message: "userId???꾩닔 臾몄옄?댁엯?덈떎." };
  }

  const parsedRegistration = parseRegistrationFields({
    name: raw.name,
    birthDate: raw.birthDate,
    birthTime: raw.birthTime,
    calendarType: raw.calendarType,
  });
  if (!parsedRegistration.ok) {
    return { ok: false, message: parsedRegistration.message };
  }

  return {
    ok: true,
    data: {
      accessToken: isNonEmptyString(raw.accessToken) ? raw.accessToken.trim() : undefined,
      userId: userId.trim(),
      name: parsedRegistration.data.name,
      birthDate: parsedRegistration.data.birthDate,
      birthTime: parsedRegistration.data.birthTime,
      calendarType: parsedRegistration.data.calendarType,
    },
  };
}

function isDatabaseConnectionError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && ["P1001", "P2021"].includes(error.code)) {
    return true;
  }

  return error instanceof Error && /can't reach database server|p1001|table .* does not exist/i.test(error.message);
}

function createUnauthorizedResponse() {
  return NextResponse.json({ error: "?좏슚???깅줉 ?좏겙???꾩슂?⑸땲??" }, { status: 401 });
}

export async function POST(request: NextRequest) {
  try {
    if (!hasDatabaseUrl()) {
      void logAdminEventSafe({
        eventType: "profile_registration_failed",
        status: "error",
        source: "profile-api",
        message: "DATABASE_URL???ㅼ젙?섏? ?딆븘 ?꾨줈????μ뿉 ?ㅽ뙣?덉뒿?덈떎.",
        metadata: {
          reason: "missing_database_url",
          route: "/api/profile",
        },
      });
      return NextResponse.json(
        { error: "DATABASE_URL ?먮뒗 POSTGRES_PRISMA_URL???ㅼ젙?섏? ?딆븯?듬땲??" },
        { status: 503 },
      );
    }

    const payload = await request.json();
    const parsed = parsePayload(payload);
    if (!parsed.ok) {
      const payloadUserId =
        payload && typeof payload === "object" && isNonEmptyString((payload as Record<string, unknown>).userId)
          ? String((payload as Record<string, unknown>).userId)
          : undefined;
      void logAdminEventSafe({
        eventType: "profile_registration_failed",
        status: "error",
        source: "profile-api",
        userId: payloadUserId,
        message: "?꾨줈???깅줉 payload 寃利앹뿉 ?ㅽ뙣?덉뒿?덈떎.",
        metadata: {
          reason: "invalid_payload",
          route: "/api/profile",
        },
      });
      return NextResponse.json({ error: parsed.message }, { status: 400 });
    }

    const tokenCheck = verifyRegisterAccessToken(parsed.data.accessToken, parsed.data.userId);
    if (!tokenCheck.ok) {
      void logAdminEventSafe({
        eventType: "profile_registration_failed",
        status: "error",
        source: "profile-api",
        userId: parsed.data.userId,
        message: "?깅줉 ?좏겙 寃利앹뿉 ?ㅽ뙣?덉뒿?덈떎.",
        metadata: {
          reason: tokenCheck.reason,
          route: "/api/profile",
        },
      });
      return createUnauthorizedResponse();
    }

    let sajuData: Prisma.InputJsonValue;
    try {
      sajuData = JSON.parse(
        JSON.stringify(
          buildInitialSajuData({
            userId: parsed.data.userId,
            birthDate: parsed.data.birthDate,
            birthTime: parsed.data.birthTime,
            calendarType: parsed.data.calendarType,
          }),
        ),
      ) as Prisma.InputJsonValue;
    } catch {
      void logAdminEventSafe({
        eventType: "profile_registration_failed",
        status: "error",
        source: "profile-api",
        userId: parsed.data.userId,
        message: "?ъ＜ 怨꾩궛 ?곗씠???앹꽦???ㅽ뙣?덉뒿?덈떎.",
        metadata: {
          reason: "saju_build_failed",
          route: "/api/profile",
        },
      });
      return NextResponse.json(
        { error: "?ъ＜ 怨꾩궛 ?곗씠?곕? ?앹꽦?섎뒗 以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎." },
        { status: 400 },
      );
    }

    const profile = await upsertProfile({
      userId: parsed.data.userId,
      name: parsed.data.name,
      birthDate: parsed.data.birthDate,
      birthTime: parsed.data.birthTime,
      calendarType: parsed.data.calendarType,
      sajuData,
    });

    return NextResponse.json({
      profile,
      fortuneAccessToken: createFortuneAccessToken(profile.userId),
    });
  } catch (error) {
    console.error("[/api/profile POST] unexpected error", error);
    if (isDatabaseConnectionError(error)) {
      void logAdminEventSafe({
        eventType: "profile_registration_failed",
        status: "error",
        source: "profile-api",
        message: "?꾨줈?????以??곗씠?곕쿋?댁뒪 ?ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.",
        metadata: {
          reason: "database_error",
          route: "/api/profile",
        },
      });
      return NextResponse.json(
        { error: "?곗씠?곕쿋?댁뒪 ?곌껐???쇱떆?곸쑝濡?遺덉븞?뺥빀?덈떎. ?좎떆 ???ㅼ떆 ?쒕룄??二쇱꽭??" },
        { status: 503 },
      );
    }

    void logAdminEventSafe({
      eventType: "profile_registration_failed",
      status: "error",
      source: "profile-api",
      message: "?꾨줈?????以??덉쇅媛 諛쒖깮?덉뒿?덈떎.",
      metadata: {
        reason: "unexpected_error",
        route: "/api/profile",
      },
    });
    return NextResponse.json({ error: "?꾨줈?????以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎." }, { status: 500 });
  }
}
