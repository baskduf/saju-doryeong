import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
}));

vi.mock("../../lib/prisma", () => ({
  prisma: {
    adminEventLog: {
      create: mocks.create,
    },
  },
}));

import { logAdminEvent, logAdminEventSafe } from "../../lib/admin-event-log";

describe("admin event logging", () => {
  beforeEach(() => {
    mocks.create.mockReset();
  });

  it("stores sanitized admin event logs", async () => {
    mocks.create.mockResolvedValue({ id: "log-1" });

    await logAdminEvent({
      eventType: "question_answered",
      status: "success",
      source: "fortune-question",
      userId: "  user-1  ",
      message: "  answered  ",
      questionText: "  will it work?  ",
      metadata: {
        reason: "ok",
        route: "/api/kakao",
        ignored: undefined,
      },
    });

    expect(mocks.create).toHaveBeenCalledWith({
      data: {
        eventType: "question_answered",
        status: "success",
        source: "fortune-question",
        userId: "user-1",
        message: "answered",
        questionText: "will it work?",
        metadata: {
          reason: "ok",
          route: "/api/kakao",
        },
      },
    });
  });

  it("swallows persistence errors in safe logging", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.create.mockRejectedValue(new Error("db down"));

    await expect(
      logAdminEventSafe({
        eventType: "openai_question_fallback",
        status: "fallback",
        source: "fortune-question",
        message: "fallback",
      }),
    ).resolves.toBeUndefined();

    expect(consoleError).toHaveBeenCalled();
  });
});
