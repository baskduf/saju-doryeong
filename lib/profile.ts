import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { calculateTraditionalSajuChart, type CalendarType } from "./saju";

export const PROFILE_SELECT = {
  userId: true,
  name: true,
  birthDate: true,
  birthTime: true,
  calendarType: true,
  sajuData: true,
  questionUsageDateKey: true,
  questionUsageCount: true,
  pendingQuestionInput: true,
  pendingQuestionExpiresAt: true,
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

export const DAILY_QUESTION_LIMIT = 10;
const QUESTION_MODE_TTL_MS = 90 * 1000;

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
  for (const key of ["value", "origin", "date", "time", "expression"]) {
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

export function getSeoulDateKey(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
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
  const asValidDate = (year: number, month: number, day: number): Date | undefined => {
    const date = new Date(Date.UTC(year, month - 1, day));
    const valid =
      date.getUTCFullYear() === year &&
      date.getUTCMonth() + 1 === month &&
      date.getUTCDate() === day;
    return valid ? date : undefined;
  };

  const parts = raw.match(/\d+/g) ?? [];
  for (let index = 0; index + 2 < parts.length; index += 1) {
    const year = parts[index];
    const month = parts[index + 1];
    const day = parts[index + 2];
    if (year.length === 4 && month.length <= 2 && day.length <= 2) {
      const parsed = asValidDate(Number(year), Number(month), Number(day));
      if (parsed) {
        return { ok: true, date: parsed };
      }
    }
  }

  const digits = raw.replace(/[^\d]/g, "");
  if (digits.length === 8) {
    const parsed = asValidDate(
      Number(digits.slice(0, 4)),
      Number(digits.slice(4, 6)),
      Number(digits.slice(6, 8)),
    );
    if (parsed) {
      return { ok: true, date: parsed };
    }
  }

  return { ok: false, message: "birthDate 형식이 올바르지 않습니다. 예: 1995-10-21" };
}

function parseBirthTime(
  value: unknown,
): { ok: true; birthTime?: string } | { ok: false; message: string } {
  if (value === undefined || value === null || value === "") {
    return { ok: true, birthTime: undefined };
  }

  const text = coerceToText(value);
  if (!text) {
    return { ok: false, message: "birthTime은 14:30 같은 형식이어야 합니다." };
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
      return {
        ok: true,
        birthTime: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
      };
    }

    return { ok: false, message: "birthTime 시간 값이 유효하지 않습니다. 예: 00:00~23:59" };
  }

  const digits = normalized.replace(/[^\d]/g, "");
  if (digits.length >= 3 && digits.length <= 4) {
    const padded = digits.padStart(4, "0");
    const hour = Number(padded.slice(0, 2));
    const minute = Number(padded.slice(2, 4));
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return { ok: true, birthTime: `${padded.slice(0, 2)}:${padded.slice(2, 4)}` };
    }
  }

  return { ok: false, message: "birthTime 형식이 올바르지 않습니다. 예: 14:30 또는 1430" };
}

function parseCalendarType(
  value: unknown,
): { ok: true; calendarType: CalendarType } | { ok: false; message: string } {
  const text = coerceToText(value);
  if (!text) {
    return { ok: false, message: "calendarType(양력/음력/모름)는 필수입니다." };
  }

  const normalized = text.normalize("NFKC").toLowerCase();
  if (["solar", "양력"].includes(normalized)) {
    return { ok: true, calendarType: "solar" };
  }
  if (["lunar", "음력"].includes(normalized)) {
    return { ok: true, calendarType: "lunar" };
  }
  if (["unknown", "모른다", "모름", "잘모름"].includes(normalized)) {
    return { ok: true, calendarType: "unknown" };
  }

  return { ok: false, message: "calendarType는 양력/음력/모름 또는 solar/lunar/unknown만 허용합니다." };
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
    analysis: chart.analysis,
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

export function hasPendingQuestionInput(profile: SajuProfileRecord | null): boolean {
  if (!profile?.pendingQuestionInput || !profile.pendingQuestionExpiresAt) {
    return false;
  }

  return profile.pendingQuestionExpiresAt.getTime() > Date.now();
}

export function getQuestionUsageSummary(profile: SajuProfileRecord | null): {
  count: number;
  remaining: number;
  isLimited: boolean;
} {
  const today = getSeoulDateKey();
  const count =
    profile?.questionUsageDateKey === today && Number.isFinite(profile.questionUsageCount)
      ? Math.max(0, profile.questionUsageCount)
      : 0;

  return {
    count,
    remaining: Math.max(0, DAILY_QUESTION_LIMIT - count),
    isLimited: count >= DAILY_QUESTION_LIMIT,
  };
}

export async function setPendingQuestionInput(
  profile: SajuProfileRecord,
  enabled: boolean,
): Promise<SajuProfileRecord> {
  return prisma.sajuProfile.update({
    where: { userId: profile.userId },
    data: {
      pendingQuestionInput: enabled,
      pendingQuestionExpiresAt: enabled ? new Date(Date.now() + QUESTION_MODE_TTL_MS) : null,
    },
    select: PROFILE_SELECT,
  });
}

export async function incrementQuestionUsage(profile: SajuProfileRecord): Promise<SajuProfileRecord> {
  const dateKey = getSeoulDateKey();

  await prisma.$queryRaw<{ userId: string }[]>(Prisma.sql`
    UPDATE "SajuProfile"
    SET
      "questionUsageDateKey" = ${dateKey},
      "questionUsageCount" = CASE
        WHEN "questionUsageDateKey" = ${dateKey}
          THEN LEAST(${DAILY_QUESTION_LIMIT}, COALESCE("questionUsageCount", 0) + 1)
        ELSE 1
      END
    WHERE "userId" = ${profile.userId}
    RETURNING "userId"
  `);

  const updatedProfile = await findProfileByUserId(profile.userId);
  if (!updatedProfile) {
    throw new Error(`Profile not found after question usage update: ${profile.userId}`);
  }

  return updatedProfile;
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
