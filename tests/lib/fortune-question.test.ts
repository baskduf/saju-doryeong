import { afterEach, describe, expect, it, vi } from "vitest";
import { generateDailyFortune } from "../../lib/fortune";
import {
  answerFortuneQuestion,
  isLikelyFortuneQuestion,
} from "../../lib/fortune-question";

const mocks = vi.hoisted(() => ({
  logAdminEventSafe: vi.fn(),
}));

vi.mock("../../lib/admin-event-log", () => ({
  logAdminEventSafe: mocks.logAdminEventSafe,
}));

function buildUnknownFortune() {
  return generateDailyFortune({
    userId: "question-user",
    birthDate: new Date(Date.UTC(1995, 9, 21)),
    birthTime: "14:30",
    calendarType: "unknown",
    sajuData: {},
    date: new Date("2026-03-10T09:00:00+09:00"),
  });
}

function buildExactFortune() {
  return generateDailyFortune({
    userId: "question-user",
    birthDate: new Date(Date.UTC(1995, 9, 21)),
    birthTime: "14:30",
    calendarType: "solar",
    sajuData: {},
    date: new Date("2026-03-10T09:00:00+09:00"),
  });
}

async function answerWithMockedOracle(params: {
  question: string;
  fortune: ReturnType<typeof generateDailyFortune>;
  usedLlm?: boolean;
}) {
  vi.resetModules();
  vi.doMock("../../lib/yukhyo", async () => {
    const actual = await vi.importActual<typeof import("../../lib/yukhyo")>("../../lib/yukhyo");
    return {
      ...actual,
      buildYukhyoReading: () => ({
        primaryHexagram: "건상 곤하",
        changedHexagram: "진상 건하",
        movingLines: [1, 3, 6],
        answerTrend: "positive" as const,
        lines: [6, 7, 8, 9, 7, 8] as const,
        primaryBits: "101010",
        changedBits: "010101",
        summary: "육효는 급하게 밀기보다 박자를 조절하라 하오.",
        action: "움직임은 줄이고 순서를 다시 세우시오.",
        caution: "서두르거나 억지 확장은 피하시오.",
        timingHint: "오후",
        sourceLine: "육효 괘상 건상 곤하 -> 진상 건하",
        network: {
          nodes: [],
          edges: [],
        },
        breakdown: {
          relationScore: -2,
          movingModifier: -1,
          primaryScore: -3,
          changedScore: -2,
          appliedScore: -3,
        },
      }),
    };
  });

  const mod = await import("../../lib/fortune-question");
  if (params.usedLlm) {
    process.env.OPENAI_API_KEY = "test-key";
  }

  try {
    return await mod.answerFortuneQuestion({
      question: params.question,
      fortune: params.fortune,
      userId: "question-user",
      date: new Date("2026-03-10T09:00:00+09:00"),
    });
  } finally {
    delete process.env.OPENAI_API_KEY;
    vi.resetModules();
    vi.doUnmock("../../lib/yukhyo");
  }
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  mocks.logAdminEventSafe.mockReset();
});

describe("fortune question fallback", () => {
  it("detects likely fortune questions", () => {
    expect(isLikelyFortuneQuestion("오늘 고백해도 좋을까?")).toBe(true);
    expect(isLikelyFortuneQuestion("오늘 시험도 괜찮을까?")).toBe(true);
    expect(isLikelyFortuneQuestion("안녕")).toBe(false);
  });

  it("returns fallback advice with signal metadata when llm is unavailable", async () => {
    const fortune = buildUnknownFortune();
    const answer = await answerFortuneQuestion({
      question: "오늘 일 어떻게 풀릴까?",
      fortune,
      userId: "question-user",
      date: new Date("2026-03-10T09:00:00+09:00"),
    });

    expect(answer.usedLlm).toBe(false);
    expect(answer.sources).toEqual(["daily", "yukhyo"]);
    expect(answer.oracleMeta).toBeDefined();
    expect(answer.description).toContain(fortune.analysis.eventOutlook.lead);
    expect(answer.decisionBasis.primarySignalKey).toBeTruthy();
    expect(answer.decisionBasis.secondarySignalKey).toBeTruthy();
    expect(answer.oracleInfluence.channels).not.toContain("caution");
    expect(answer.conflictResolution.status).toBe("reference-priority");
    expect(mocks.logAdminEventSafe).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "openai_question_fallback",
        questionText: "오늘 일 어떻게 풀릴까?",
      }),
    );
  });

  it("keeps explanation metadata deterministic for the same user and date", async () => {
    const fortune = buildUnknownFortune();
    const params = {
      question: "오늘 연락 보내도 될까?",
      fortune,
      userId: "question-user",
      date: new Date("2026-03-10T09:00:00+09:00"),
    };

    const first = await answerFortuneQuestion(params);
    const second = await answerFortuneQuestion(params);

    expect(first.sources).toEqual(["daily", "yukhyo"]);
    expect(first.oracleMeta).toEqual(second.oracleMeta);
    expect(first.decisionBasis).toEqual(second.decisionBasis);
    expect(first.oracleInfluence).toEqual(second.oracleInfluence);
    expect(first.conflictResolution).toEqual(second.conflictResolution);
  });

  it("records question signal conflicts when oracle opposes the base signal", async () => {
    const fortune = buildExactFortune();
    const answer = await answerWithMockedOracle({
      question: "오늘 일 시작해도 될까?",
      fortune,
    });

    expect(answer.decisionBasis.primarySignalKey).toBeTruthy();
    expect(answer.description).toContain(fortune.analysis.eventOutlook.reason);
    expect(answer.conflictResolution.status).toBe("question-signal-conflict");
    expect(answer.conflictResolution.appliedPolicy).toBe("가능성은 보되 속도는 늦춤");
  });

  it("adds caution channel only for caution-oriented questions on the llm path", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          output_text: JSON.stringify({
            title: "도령의 조언",
            description: "무리하지 말고 박자를 먼저 고르시오. 중요한 결정은 한 번 더 확인하시오.",
          }),
        }),
      }),
    );

    const answer = await answerWithMockedOracle({
      question: "오늘 연애에서 뭘 조심해야 할까?",
      fortune: buildExactFortune(),
      usedLlm: true,
    });

    expect(answer.usedLlm).toBe(true);
    expect(answer.decisionBasis.primarySignalKey).toBe("friction");
    expect(answer.oracleInfluence.channels).toContain("caution");
    expect(mocks.logAdminEventSafe).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "question_answered",
        status: "success",
        source: "fortune-question",
      }),
    );
  });
});
