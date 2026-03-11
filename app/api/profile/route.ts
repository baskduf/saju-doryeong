import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
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
    return { ok: false, message: "JSON body가 올바르지 않습니다." };
  }

  const raw = payload as Record<string, unknown>;
  const userId = raw.userId;
  if (!isNonEmptyString(userId)) {
    return { ok: false, message: "userId는 필수 문자열입니다." };
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
  return NextResponse.json({ error: "유효한 등록 토큰이 필요합니다." }, { status: 401 });
}

export async function POST(request: NextRequest) {
  try {
    if (!hasDatabaseUrl()) {
      return NextResponse.json(
        { error: "DATABASE_URL 또는 POSTGRES_PRISMA_URL이 설정되지 않았습니다." },
        { status: 503 },
      );
    }

    const payload = await request.json();
    const parsed = parsePayload(payload);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.message }, { status: 400 });
    }

    const tokenCheck = verifyRegisterAccessToken(parsed.data.accessToken, parsed.data.userId);
    if (!tokenCheck.ok) {
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
      return NextResponse.json(
        { error: "사주 계산 데이터를 생성하는 중 오류가 발생했습니다." },
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
      return NextResponse.json(
        { error: "데이터베이스 연결이 일시적으로 불안정합니다. 잠시 뒤 다시 시도해 주세요." },
        { status: 503 },
      );
    }

    return NextResponse.json({ error: "프로필 저장 중 오류가 발생했습니다." }, { status: 500 });
  }
}
