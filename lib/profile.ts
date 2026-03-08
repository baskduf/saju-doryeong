import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { calculateTraditionalSajuChart, type CalendarType } from "./saju";

export const PROFILE_SELECT = {
  userId: true,
  name: true,
  birthDate: true,
  birthTime: true,
  calendarType: true,
  sajuData: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.SajuProfileSelect;

export type SajuProfileRecord = Prisma.SajuProfileGetPayload<{ select: typeof PROFILE_SELECT }>;

export type UpsertProfileInput = {
  userId: string;
  name: string;
  birthDate: Date;
  birthTime?: string;
  calendarType: CalendarType;
  sajuData: Prisma.InputJsonValue;
};

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function coerceToText(value: unknown): string | undefined {
  if (isNonEmptyString(value)) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (!value || typeof value !== "object") {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const keys = ["value", "origin", "date", "time", "expression"];
  for (const key of keys) {
    const picked = coerceToText(record[key]);
    if (picked) {
      return picked;
    }
  }

  return undefined;
}

export function hasDatabaseUrl(): boolean {
  return Boolean(process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL);
}

function toIsoDateString(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseBirthDate(value: unknown): { ok: true; date: Date } | { ok: false; message: string } {
  const text = coerceToText(value);
  if (!text) {
    return { ok: false, message: "birthDate는 필수입니다. 예: 1995-10-21 또는 19951021" };
  }

  const raw = text.normalize("NFKC");
  const isValidYmd = (year: number, month: number, day: number): Date | undefined => {
    const date = new Date(Date.UTC(year, month - 1, day));
    const valid =
      date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day;
    return valid ? date : undefined;
  };

  const parts = raw.match(/\d+/g) ?? [];
  for (let i = 0; i + 2 < parts.length; i += 1) {
    const y = parts[i];
    const m = parts[i + 1];
    const d = parts[i + 2];
    if (y.length === 4 && m.length <= 2 && d.length <= 2) {
      const found = isValidYmd(Number(y), Number(m), Number(d));
      if (found) {
        return { ok: true, date: found };
      }
    }
  }

  const digits = raw.replace(/[^\d]/g, "");
  if (digits.length === 8) {
    const found = isValidYmd(Number(digits.slice(0, 4)), Number(digits.slice(4, 6)), Number(digits.slice(6, 8)));
    if (found) {
      return { ok: true, date: found };
    }
  } else if (digits.length > 8) {
    for (let i = 0; i + 8 <= digits.length; i += 1) {
      const chunk = digits.slice(i, i + 8);
      const year = Number(chunk.slice(0, 4));
      const month = Number(chunk.slice(4, 6));
      const day = Number(chunk.slice(6, 8));
      if (year < 1000 || year > 2999) continue;
      const found = isValidYmd(year, month, day);
      if (found) {
        return { ok: true, date: found };
      }
    }
  }

  return { ok: false, message: "birthDate 형식이 올바르지 않습니다. 예: 1995-10-21" };
}

function parseBirthTime(value: unknown): { ok: true; birthTime?: string } | { ok: false; message: string } {
  if (value === undefined || value === null || value === "") {
    return { ok: true, birthTime: undefined };
  }

  const text = coerceToText(value);
  if (!text) {
    return { ok: false, message: "birthTime은 문자열이어야 합니다. 예: 14:30" };
  }

  const normalized = text.normalize("NFKC").toLowerCase();
  if (["unknown", "none", "미상", "없음"].includes(normalized)) {
    return { ok: true, birthTime: undefined };
  }

  const timeMatch = normalized.match(/(\d{1,2}):(\d{2})(?::\d{2})?/);
  if (timeMatch) {
    const hour = Number(timeMatch[1]);
    const minute = Number(timeMatch[2]);
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return { ok: true, birthTime: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}` };
    }
    return { ok: false, message: "birthTime 시간 값이 유효하지 않습니다. 예: 00:00~23:59" };
  }

  const digits = normalized.replace(/[^\d]/g, "");
  if (digits.length === 6) {
    const hour = Number(digits.slice(0, 2));
    const minute = Number(digits.slice(2, 4));
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return { ok: true, birthTime: `${digits.slice(0, 2)}:${digits.slice(2, 4)}` };
    }
    return { ok: false, message: "birthTime 시간 값이 유효하지 않습니다. 예: 00:00~23:59" };
  }

  if (digits.length < 3 || digits.length > 4) {
    return { ok: false, message: "birthTime 형식이 올바르지 않습니다. 예: 14:30 또는 1430" };
  }

  const padded = digits.padStart(4, "0");
  const hour = Number(padded.slice(0, 2));
  const minute = Number(padded.slice(2, 4));
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return { ok: false, message: "birthTime 시간 값이 유효하지 않습니다. 예: 00:00~23:59" };
  }

  return { ok: true, birthTime: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}` };
}

function parseCalendarType(value: unknown): { ok: true; calendarType: CalendarType } | { ok: false; message: string } {
  const text = coerceToText(value);
  if (!text) {
    return { ok: false, message: "calendarType(양력/음력/모른다)는 필수입니다." };
  }

  const normalized = text.normalize("NFKC").toLowerCase();
  if (["solar", "양력", "양"].includes(normalized)) {
    return { ok: true, calendarType: "solar" };
  }
  if (["lunar", "음력", "음"].includes(normalized)) {
    return { ok: true, calendarType: "lunar" };
  }
  if (["unknown", "모른다", "모름", "잘모름", "모르겠음"].includes(normalized)) {
    return { ok: true, calendarType: "unknown" };
  }
  return { ok: false, message: "calendarType은 양력/음력/모른다(또는 solar/lunar/unknown)만 허용됩니다." };
}

export function buildInitialSajuData(params: {
  userId: string;
  birthDate: Date;
  birthTime?: string;
  calendarType: CalendarType;
}): Prisma.InputJsonValue {
  const chart = calculateTraditionalSajuChart({
    birthDate: params.birthDate,
    birthTime: params.birthTime,
    calendarType: params.calendarType,
  });

  return {
    source: chart.source,
    userId: params.userId,
    birthDate: toIsoDateString(params.birthDate),
    birthTime: params.birthTime ?? null,
    calendarType: params.calendarType,
    resolvedCalendarType: chart.calendarTypeResolved,
    solarDateTime: chart.solarDateTime,
    lunarDate: chart.lunarDate,
    lunarDateKorean: chart.lunarDateKorean,
    usedNoonFallback: chart.usedNoonFallback,
    pillars: chart.pillars,
    dayMaster: chart.dayMaster,
    auxiliary: chart.auxiliary,
    fiveElements: chart.fiveElements,
  };
}

export function parseRegistrationFields(input: {
  name?: unknown;
  birthDate?: unknown;
  birthTime?: unknown;
  calendarType?: unknown;
}): { ok: true; data: Omit<UpsertProfileInput, "userId" | "sajuData"> } | { ok: false; message: string } {
  const parsedName = coerceToText(input.name);
  if (!parsedName) {
    return { ok: false, message: "name(이름)은 필수입니다. 예: 홍길동" };
  }

  const parsedBirthDate = parseBirthDate(input.birthDate);
  if (!parsedBirthDate.ok) {
    return parsedBirthDate;
  }

  const parsedBirthTime = parseBirthTime(input.birthTime);
  if (!parsedBirthTime.ok) {
    return parsedBirthTime;
  }

  const parsedCalendarType = parseCalendarType(input.calendarType);
  if (!parsedCalendarType.ok) {
    return parsedCalendarType;
  }

  return {
    ok: true,
    data: {
      name: parsedName,
      birthDate: parsedBirthDate.date,
      birthTime: parsedBirthTime.birthTime,
      calendarType: parsedCalendarType.calendarType,
    },
  };
}

export async function findProfileByUserId(userId: string): Promise<SajuProfileRecord | null> {
  return prisma.sajuProfile.findUnique({
    where: { userId },
    select: PROFILE_SELECT,
  });
}

export async function upsertProfile(input: UpsertProfileInput): Promise<SajuProfileRecord> {
  return prisma.sajuProfile.upsert({
    where: { userId: input.userId },
    update: {
      name: input.name,
      birthDate: input.birthDate,
      birthTime: input.birthTime,
      calendarType: input.calendarType,
      sajuData: input.sajuData,
    },
    create: {
      userId: input.userId,
      name: input.name,
      birthDate: input.birthDate,
      birthTime: input.birthTime,
      calendarType: input.calendarType,
      sajuData: input.sajuData,
    },
    select: PROFILE_SELECT,
  });
}
