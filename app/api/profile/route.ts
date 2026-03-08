import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma";

type ProfilePayload = {
  userId: string;
  name?: string;
  birthDate: string;
  birthTime?: string;
  calendarType?: string;
  sajuData: unknown;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parsePayload(payload: unknown): { ok: true; data: ProfilePayload } | { ok: false; message: string } {
  if (!payload || typeof payload !== "object") {
    return { ok: false, message: "JSON body가 올바르지 않습니다." };
  }

  const raw = payload as Record<string, unknown>;
  const userId = raw.userId;
  const birthDate = raw.birthDate;
  const sajuData = raw.sajuData;

  if (!isNonEmptyString(userId)) {
    return { ok: false, message: "userId는 필수 문자열입니다." };
  }

  if (!isNonEmptyString(birthDate)) {
    return { ok: false, message: "birthDate는 ISO 문자열(예: 1995-10-21)이어야 합니다." };
  }

  const parsedBirthDate = new Date(birthDate);
  if (Number.isNaN(parsedBirthDate.getTime())) {
    return { ok: false, message: "birthDate 형식이 올바르지 않습니다." };
  }

  if (sajuData === undefined) {
    return { ok: false, message: "sajuData는 필수입니다." };
  }

  return {
    ok: true,
    data: {
      userId: userId.trim(),
      name: isNonEmptyString(raw.name) ? raw.name.trim() : undefined,
      birthDate,
      birthTime: isNonEmptyString(raw.birthTime) ? raw.birthTime.trim() : undefined,
      calendarType: isNonEmptyString(raw.calendarType) ? raw.calendarType.trim() : "solar",
      sajuData,
    },
  };
}

function hasDatabaseUrl(): boolean {
  return Boolean(process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL);
}

export async function GET(request: NextRequest) {
  try {
    if (!hasDatabaseUrl()) {
      return NextResponse.json({ error: "DATABASE_URL(또는 POSTGRES_PRISMA_URL)이 설정되지 않았습니다." }, { status: 503 });
    }

    const userId = request.nextUrl.searchParams.get("userId");
    if (!isNonEmptyString(userId)) {
      return NextResponse.json({ error: "query parameter userId가 필요합니다." }, { status: 400 });
    }

    const profile = await prisma.sajuProfile.findUnique({
      where: { userId: userId.trim() },
      select: {
        userId: true,
        name: true,
        birthDate: true,
        birthTime: true,
        calendarType: true,
        sajuData: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!profile) {
      return NextResponse.json({ error: "해당 userId의 사주 프로필이 없습니다." }, { status: 404 });
    }

    return NextResponse.json({ profile });
  } catch (error) {
    console.error("[/api/profile GET] unexpected error", error);
    return NextResponse.json({ error: "프로필 조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!hasDatabaseUrl()) {
      return NextResponse.json({ error: "DATABASE_URL(또는 POSTGRES_PRISMA_URL)이 설정되지 않았습니다." }, { status: 503 });
    }

    const payload = await request.json();
    const parsed = parsePayload(payload);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.message }, { status: 400 });
    }

    const birthDate = new Date(parsed.data.birthDate);
    let sajuData: Prisma.InputJsonValue;
    try {
      sajuData = JSON.parse(JSON.stringify(parsed.data.sajuData)) as Prisma.InputJsonValue;
    } catch {
      return NextResponse.json({ error: "sajuData는 JSON 직렬화 가능한 값이어야 합니다." }, { status: 400 });
    }

    const profile = await prisma.sajuProfile.upsert({
      where: { userId: parsed.data.userId },
      update: {
        name: parsed.data.name,
        birthDate,
        birthTime: parsed.data.birthTime,
        calendarType: parsed.data.calendarType,
        sajuData,
      },
      create: {
        userId: parsed.data.userId,
        name: parsed.data.name,
        birthDate,
        birthTime: parsed.data.birthTime,
        calendarType: parsed.data.calendarType ?? "solar",
        sajuData,
      },
      select: {
        userId: true,
        name: true,
        birthDate: true,
        birthTime: true,
        calendarType: true,
        sajuData: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ profile });
  } catch (error) {
    console.error("[/api/profile POST] unexpected error", error);
    return NextResponse.json({ error: "프로필 저장 중 오류가 발생했습니다." }, { status: 500 });
  }
}
