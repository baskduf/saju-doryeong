export const SEOUL_TIME_ZONE = "Asia/Seoul";

type DateFormatOptions = Intl.DateTimeFormatOptions;

function readNumberPart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): number {
  const value = parts.find((item) => item.type === type)?.value;
  return Number(value ?? "0");
}

export function getSeoulNow(): Date {
  return new Date();
}

export function getSeoulDateKey(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SEOUL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function getSeoulDateTimeParts(date: Date = new Date()): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
} {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SEOUL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  return {
    year: readNumberPart(parts, "year"),
    month: readNumberPart(parts, "month"),
    day: readNumberPart(parts, "day"),
    hour: readNumberPart(parts, "hour"),
    minute: readNumberPart(parts, "minute"),
  };
}

export function formatSeoulDate(
  date: Date = new Date(),
  options: DateFormatOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  },
): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: SEOUL_TIME_ZONE,
    ...options,
  }).format(date);
}

export function formatSeoulDateLabel(date: Date = new Date()): string {
  return formatSeoulDate(date, {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
}

export function formatStoredDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function formatStoredDate(
  date: Date,
  options: DateFormatOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  },
): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "UTC",
    ...options,
  }).format(date);
}
