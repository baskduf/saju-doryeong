import { NextRequest } from "next/server";
import { isNonEmptyString } from "../../../../lib/profile";
import {
  FORTUNE_COMMAND,
  QUESTION_COMMAND,
  REREGISTER_COMMAND,
  SHARE_COMMAND,
} from "./constants";
import type { KakaoActionParams } from "./types";

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function readStringValue(value: unknown): string | undefined {
  if (isNonEmptyString(value)) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const parsed = readStringValue(entry);
      if (parsed) {
        return parsed;
      }
    }
    return undefined;
  }

  const record = asRecord(value);
  if (!record) {
    return undefined;
  }

  for (const candidate of [record.value, record.origin, record.date, record.time, record.expression]) {
    const parsed = readStringValue(candidate);
    if (parsed) {
      return parsed;
    }
  }

  return undefined;
}

function pickFirstString(source: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const parsed = readStringValue(source[key]);
    if (parsed) {
      return parsed;
    }
  }

  return undefined;
}

function summarizeForDebug(value: unknown): string {
  const parsed = readStringValue(value);
  if (parsed) {
    return parsed;
  }

  if (value === undefined) {
    return "<undefined>";
  }

  if (value === null) {
    return "<null>";
  }

  try {
    const text = JSON.stringify(value);
    return text.length > 80 ? `${text.slice(0, 80)}...` : text;
  } catch {
    return "<unserializable>";
  }
}

export function getKakaoUserId(payload: unknown): string | undefined {
  const root = asRecord(payload);
  if (!root) {
    return undefined;
  }

  const userRequest = asRecord(root.userRequest);
  const user = asRecord(userRequest?.user);
  const properties = asRecord(user?.properties);

  for (const candidate of [user?.id, properties?.appUserId, properties?.plusfriendUserKey, properties?.botUserKey]) {
    if (isNonEmptyString(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

export function getKakaoUtterance(payload: unknown): string | undefined {
  const root = asRecord(payload);
  if (!root) {
    return undefined;
  }

  const userRequest = asRecord(root.userRequest);
  return readStringValue(userRequest?.utterance);
}

export function extractKakaoActionParams(payload: unknown): KakaoActionParams {
  const root = asRecord(payload);
  if (!root) {
    return { hasAny: false, debugLines: ["payload=<empty>"] };
  }

  const action = asRecord(root.action);
  const actionParams = asRecord(action?.params) ?? {};
  const detailParams = asRecord(action?.detailParams);
  const userRequest = asRecord(root.userRequest);
  const requestParams = asRecord(userRequest?.params) ?? {};

  const merged: Record<string, unknown> = {
    ...requestParams,
    ...actionParams,
  };

  if (detailParams) {
    for (const [key, value] of Object.entries(detailParams)) {
      if (merged[key] !== undefined) {
        continue;
      }

      const parsed = readStringValue(value);
      if (parsed) {
        merged[key] = parsed;
      }
    }
  }

  const name = pickFirstString(merged, ["name", "userName", "username", "이름"]);
  const birthDate = pickFirstString(merged, [
    "birthDate",
    "birth_date",
    "birthday",
    "dateOfBirth",
    "생년월일",
  ]);
  const birthTime = pickFirstString(merged, [
    "birthTime",
    "birth_time",
    "timeOfBirth",
    "출생시간",
  ]);
  const calendarType = pickFirstString(merged, [
    "calendarType",
    "calendar_type",
    "calendar",
    "달력기준",
    "음양력",
  ]);

  return {
    hasAny: Boolean(name || birthDate || birthTime || calendarType),
    name,
    birthDate,
    birthTime,
    calendarType,
    debugLines: [
      `name=${summarizeForDebug(name)}`,
      `birthDate=${summarizeForDebug(birthDate)}`,
      `birthTime=${summarizeForDebug(birthTime)}`,
      `calendarType=${summarizeForDebug(calendarType)}`,
    ],
  };
}

export function isReservedUtterance(utterance?: string): boolean {
  return (
    utterance === REREGISTER_COMMAND ||
    utterance === FORTUNE_COMMAND ||
    utterance === QUESTION_COMMAND ||
    utterance === SHARE_COMMAND
  );
}

export function isAuthorizedKakaoSkillRequest(request: NextRequest): boolean {
  const configuredSkillSecret = process.env.KAKAO_SKILL_SHARED_SECRET?.trim();
  const providedSkillSecret = request.nextUrl.searchParams.get("key")?.trim();

  return Boolean(configuredSkillSecret && providedSkillSecret && providedSkillSecret === configuredSkillSecret);
}
