import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export type CalendarType = "solar" | "lunar" | "unknown";

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

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) % 2147483647;
  }
  return hash;
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
  const parts = raw.match(/\d+/g) ?? [];

  let year: number;
  let month: number;
  let day: number;

  const [first, second, third] = parts;
  if (first && second && third && first.length === 4) {
    year = Number(first);
    month = Number(second);
    day = Number(third);
  } else {
    const digits = raw.replace(/[^\d]/g, "");
    if (digits.length !== 8) {
      return { ok: false, message: "birthDate 형식이 올바르지 않습니다. 예: 1995-10-21" };
    }

    year = Number(digits.slice(0, 4));
    month = Number(digits.slice(4, 6));
    day = Number(digits.slice(6, 8));
  }

  const date = new Date(Date.UTC(year, month - 1, day));

  const isValid =
    date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day;
  if (!isValid) {
    return { ok: false, message: "birthDate 날짜 값이 유효하지 않습니다." };
  }

  return { ok: true, date };
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

function normalizeToPercent(values: number[]): number[] {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total <= 0) {
    return [20, 20, 20, 20, 20];
  }

  const scaled = values.map((value) => (value / total) * 100);
  const floored = scaled.map((value) => Math.floor(value));
  let remainder = 100 - floored.reduce((sum, value) => sum + value, 0);

  const byRemainder = scaled
    .map((value, index) => ({ index, rem: value - floored[index] }))
    .sort((a, b) => b.rem - a.rem);

  for (let i = 0; i < byRemainder.length && remainder > 0; i += 1) {
    floored[byRemainder[i].index] += 1;
    remainder -= 1;
  }

  return floored;
}

export function buildInitialSajuData(params: {
  userId: string;
  birthDate: Date;
  birthTime?: string;
  calendarType: CalendarType;
}): Prisma.InputJsonValue {
  const seedBase = `${params.userId}:${toIsoDateString(params.birthDate)}:${params.birthTime ?? "unknown"}:${params.calendarType}`;
  const rawValues = [
    (hashString(`${seedBase}:wood`) % 41) + 10,
    (hashString(`${seedBase}:fire`) % 41) + 10,
    (hashString(`${seedBase}:earth`) % 41) + 10,
    (hashString(`${seedBase}:metal`) % 41) + 10,
    (hashString(`${seedBase}:water`) % 41) + 10,
  ];
  const [wood, fire, earth, metal, water] = normalizeToPercent(rawValues);

  return {
    source: "kakao-onboarding-v1",
    birthDate: toIsoDateString(params.birthDate),
    birthTime: params.birthTime ?? null,
    calendarType: params.calendarType,
    fiveElements: { wood, fire, earth, metal, water },
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
