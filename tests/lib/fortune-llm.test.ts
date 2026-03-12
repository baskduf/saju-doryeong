import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateDailyFortune } from "../../lib/fortune";

const mocks = vi.hoisted(() => ({
  logAdminEventSafe: vi.fn(),
}));

vi.mock("../../lib/admin-event-log", () => ({
  logAdminEventSafe: mocks.logAdminEventSafe,
}));

import { generateFortuneNarrativeOverride } from "../../lib/fortune-llm";

function buildFortune() {
  return generateDailyFortune({
    userId: "fortune-user",
    birthDate: new Date(Date.UTC(1995, 9, 21)),
    birthTime: "14:30",
    calendarType: "solar",
    sajuData: {},
    date: new Date("2026-03-10T09:00:00+09:00"),
  });
}

describe("fortune llm logging", () => {
  beforeEach(() => {
    mocks.logAdminEventSafe.mockReset();
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    vi.unstubAllGlobals();
  });

  it("records a fallback log when no api key is configured", async () => {
    const result = await generateFortuneNarrativeOverride({
      fortune: buildFortune(),
      profileName: "Tester",
      birthDate: new Date(Date.UTC(1995, 9, 21)),
      birthTime: "14:30",
      date: new Date("2026-03-10T09:00:00+09:00"),
    });

    expect(result).toBeNull();
    expect(mocks.logAdminEventSafe).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "openai_fortune_fallback",
        status: "fallback",
        source: "fortune-llm",
      }),
    );
  });

  it("records a fallback log when the openai response payload is invalid", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          output_text: JSON.stringify({
            headline: "missing fields",
          }),
        }),
      }),
    );

    const result = await generateFortuneNarrativeOverride({
      fortune: buildFortune(),
      profileName: "Tester",
      birthDate: new Date(Date.UTC(1995, 9, 21)),
      birthTime: "14:30",
      date: new Date("2026-03-10T09:00:00+09:00"),
    });

    expect(result).toBeNull();
    expect(mocks.logAdminEventSafe).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "openai_fortune_fallback",
        metadata: expect.objectContaining({
          reason: "invalid_payload",
        }),
      }),
    );
  });
});
