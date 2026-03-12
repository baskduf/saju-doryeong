import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export const ADMIN_EVENT_TYPES = [
  "question_answered",
  "share_created",
  "profile_registration_failed",
  "kakao_request_failed",
  "openai_question_fallback",
  "openai_fortune_fallback",
] as const;

export const ADMIN_EVENT_STATUSES = ["success", "fallback", "error"] as const;

export const ADMIN_EVENT_SOURCES = [
  "kakao",
  "profile-api",
  "admin",
  "fortune-question",
  "fortune-llm",
] as const;

export type AdminEventType = (typeof ADMIN_EVENT_TYPES)[number];
export type AdminEventStatus = (typeof ADMIN_EVENT_STATUSES)[number];
export type AdminEventSource = (typeof ADMIN_EVENT_SOURCES)[number];

export type AdminEventMetadata = Record<string, string | number | boolean | null | undefined>;

export type AdminEventLogInput = {
  eventType: AdminEventType;
  status: AdminEventStatus;
  source: AdminEventSource;
  message: string;
  userId?: string | null;
  questionText?: string | null;
  metadata?: AdminEventMetadata;
};

type AdminEventLogModel = {
  create(args: {
    data: {
      eventType: string;
      status: string;
      source: string;
      message: string;
      userId: string | null;
      questionText: string | null;
      metadata?: Prisma.InputJsonObject;
    };
  }): Promise<unknown>;
};

function getAdminEventLogModel(): AdminEventLogModel | null {
  return (prisma as unknown as { adminEventLog?: AdminEventLogModel }).adminEventLog ?? null;
}

function sanitizeText(value: string | undefined | null): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function sanitizeMetadata(metadata?: AdminEventMetadata): Prisma.InputJsonObject | undefined {
  if (!metadata) {
    return undefined;
  }

  const entries = Object.entries(metadata).filter(([, value]) => value !== undefined);
  if (entries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(entries) as Prisma.InputJsonObject;
}

function sanitizeEventLogInput(input: AdminEventLogInput) {
  return {
    eventType: input.eventType,
    status: input.status,
    source: input.source,
    message: input.message.trim(),
    userId: sanitizeText(input.userId),
    questionText: sanitizeText(input.questionText),
    metadata: sanitizeMetadata(input.metadata),
  };
}

export async function logAdminEvent(input: AdminEventLogInput): Promise<void> {
  const sanitized = sanitizeEventLogInput(input);
  const model = getAdminEventLogModel();
  if (!model) {
    return;
  }

  await model.create({
    data: {
      eventType: sanitized.eventType,
      status: sanitized.status,
      source: sanitized.source,
      message: sanitized.message,
      userId: sanitized.userId,
      questionText: sanitized.questionText,
      metadata: sanitized.metadata,
    },
  });
}

export async function logAdminEventSafe(input: AdminEventLogInput): Promise<void> {
  try {
    await logAdminEvent(input);
  } catch (error) {
    console.error("[admin-event-log] failed to persist log", error);
  }
}
