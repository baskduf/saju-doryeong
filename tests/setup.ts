import { afterAll, afterEach, beforeEach, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.APP_SIGNING_SECRET = "test-signing-secret";
  process.env.KAKAO_SKILL_SHARED_SECRET = "test-kakao-secret";
  process.env.NEXT_PUBLIC_APP_URL = "https://test.example.com";
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_FORTUNE_MODEL;
  delete process.env.OPENAI_QUESTION_MODEL;
  delete process.env.DATABASE_URL;
  delete process.env.POSTGRES_PRISMA_URL;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_FORTUNE_MODEL;
  delete process.env.OPENAI_QUESTION_MODEL;
});

afterAll(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) {
      delete process.env[key];
    }
  }

  Object.assign(process.env, ORIGINAL_ENV);
});
