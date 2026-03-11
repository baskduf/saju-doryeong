import { afterEach, describe, expect, it, vi } from "vitest";
import { generateDailyFortune } from "../../lib/fortune";
import {
  answerFortuneQuestion,
  isLikelyFortuneQuestion,
} from "../../lib/fortune-question";

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
        answerTrend: "negative" as const,
        lines: [6, 7, 8, 9, 7, 8] as const,
        primaryBits: "101010",
        changedBits: "010101",
        summary: "육효는 급하게 밀기보다 한 박자 늦추라 하오.",
        action: "움직임을 줄이고 순서를 다시 세우시오.",
        caution: "서두른 판단과 과한 확장은 피하시오.",
        timingHint: "오후",
        sourceLine: "육효 관상: 건상 곤하 -> 진상 건하",
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
});

describe("fortune question fallback", () => {
  it("detects likely fortune questions", () => {
    expect(isLikelyFortuneQuestion("오늘 고백해도 될까?")).toBe(true);
    expect(isLikelyFortuneQuestion("오늘 돈 써도 괜찮아?")).toBe(true);
    expect(isLikelyFortuneQuestion("안녕")).toBe(false);
  });

  it("returns fallback advice with explanation metadata when llm is unavailable", async () => {
    const answer = await answerFortuneQuestion({
      question: "오늘 일은 어떻게 풀릴까?",
      fortune: buildUnknownFortune(),
      userId: "question-user",
      date: new Date("2026-03-10T09:00:00+09:00"),
    });

    expect(answer.usedLlm).toBe(false);
    expect(answer.sources).toEqual(["daily", "yukhyo"]);
    expect(answer.oracleMeta).toBeDefined();
    expect(answer.decisionBasis.primaryInsightKey).toBeTruthy();
    expect(answer.decisionBasis.secondaryInsightKey).toBeTruthy();
    expect(answer.oracleInfluence.channels).toContain("caution");
    expect(answer.conflictResolution.status).toBe("reference-priority");
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

  it("records question signal conflicts when oracle opposes the base insight", async () => {
    const answer = await answerWithMockedOracle({
      question: "오늘 일은 어떻게 풀릴까?",
      fortune: buildExactFortune(),
    });

    expect(answer.decisionBasis.primaryInsightKey).toBeTruthy();
    expect(answer.conflictResolution.status).toBe("question-signal-conflict");
    expect(answer.conflictResolution.appliedPolicy).toBe("기회는 있으나 무리 금지");
  });

  it("keeps explanation metadata consistent on the llm path", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          output_text: JSON.stringify({
            title: "도령의 한마디",
            description: "가능성은 있되 속도를 조절하시오. 무리만 피하면 흐름이 이어지오.",
          }),
        }),
      }),
    );

    const answer = await answerWithMockedOracle({
      question: "오늘 일은 어떻게 풀릴까?",
      fortune: buildExactFortune(),
      usedLlm: true,
    });

    expect(answer.usedLlm).toBe(true);
    expect(answer.decisionBasis.primaryInsightKey).toBeTruthy();
    expect(answer.oracleInfluence.channels).toContain("caution");
    expect(answer.conflictResolution.status).toBe("question-signal-conflict");
  });
});
