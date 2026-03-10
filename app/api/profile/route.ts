import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import {
  buildInitialSajuData,
  findProfileByUserId,
  hasDatabaseUrl,
  isNonEmptyString,
  parseRegistrationFields,
  upsertProfile,
} from "../../../lib/profile";
import { verifyProfileAccessToken } from "../../../lib/access-token";

type ProfilePayload = {
  accessToken?: string;
  userId: string;
  name: string;
  birthDate: Date;
  birthTime?: string;
  calendarType: "solar" | "lunar" | "unknown";
  sajuData?: unknown;
};

function parsePayload(payload: unknown): { ok: true; data: ProfilePayload } | { ok: false; message: string } {
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
      sajuData:
        raw.sajuData ??
        buildInitialSajuData({
          userId: userId.trim(),
          birthDate: parsedRegistration.data.birthDate,
          birthTime: parsedRegistration.data.birthTime,
          calendarType: parsedRegistration.data.calendarType,
        }),
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
  return NextResponse.json({ error: "유효한 접근 토큰이 필요합니다." }, { status: 401 });
}

export async function GET(request: NextRequest) {
  try {
    if (!hasDatabaseUrl()) {
      return NextResponse.json(
        { error: "DATABASE_URL 또는 POSTGRES_PRISMA_URL이 설정되지 않았습니다." },
        { status: 503 },
      );
    }

    const userId = request.nextUrl.searchParams.get("userId");
    if (!isNonEmptyString(userId)) {
      return NextResponse.json({ error: "query parameter userId가 필요합니다." }, { status: 400 });
    }

    const tokenCheck = verifyProfileAccessToken(
      request.nextUrl.searchParams.get("token")?.trim(),
      userId.trim(),
    );
    if (!tokenCheck.ok) {
      return createUnauthorizedResponse();
    }

    const profile = await findProfileByUserId(userId.trim());
    if (!profile) {
      return NextResponse.json({ error: "해당 userId의 사주 프로필이 없습니다." }, { status: 404 });
    }

    return NextResponse.json({ profile });
  } catch (error) {
    console.error("[/api/profile GET] unexpected error", error);
    if (isDatabaseConnectionError(error)) {
      return NextResponse.json(
        { error: "데이터베이스 연결이 일시적으로 불안정합니다. 잠시 후 다시 시도해 주세요." },
        { status: 503 },
      );
    }

    return NextResponse.json({ error: "프로필 조회 중 오류가 발생했습니다." }, { status: 500 });
  }
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

    const tokenCheck = verifyProfileAccessToken(parsed.data.accessToken, parsed.data.userId);
    if (!tokenCheck.ok) {
      return createUnauthorizedResponse();
    }

    let sajuData: Prisma.InputJsonValue;
    try {
      sajuData = JSON.parse(JSON.stringify(parsed.data.sajuData)) as Prisma.InputJsonValue;
    } catch {
      return NextResponse.json({ error: "sajuData는 JSON 직렬화가 가능한 값이어야 합니다." }, { status: 400 });
    }

    const profile = await upsertProfile({
      userId: parsed.data.userId,
      name: parsed.data.name,
      birthDate: parsed.data.birthDate,
      birthTime: parsed.data.birthTime,
      calendarType: parsed.data.calendarType,
      sajuData,
    });

    return NextResponse.json({ profile });
  } catch (error) {
    console.error("[/api/profile POST] unexpected error", error);
    if (isDatabaseConnectionError(error)) {
      return NextResponse.json(
        { error: "데이터베이스 연결이 일시적으로 불안정합니다. 잠시 후 다시 시도해 주세요." },
        { status: 503 },
      );
    }

    return NextResponse.json({ error: "프로필 저장 중 오류가 발생했습니다." }, { status: 500 });
  }
}
