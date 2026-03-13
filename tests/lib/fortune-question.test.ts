import { afterEach, describe, expect, it, vi } from "vitest";
import { generateDailyFortune } from "../../lib/fortune";
import type { DailyFortune, FortuneSignalKey } from "../../lib/fortune";
import {
  answerFortuneQuestion,
  isLikelyFortuneQuestion,
} from "../../lib/fortune-question";

const mocks = vi.hoisted(() => ({
  logAdminEventSafe: vi.fn(),
  recordFortuneQuestionHistorySafe: vi.fn(),
}));

vi.mock("../../lib/admin-event-log", () => ({
  logAdminEventSafe: mocks.logAdminEventSafe,
}));

vi.mock("../../lib/fortune-question-history", () => ({
  recordFortuneQuestionHistorySafe: mocks.recordFortuneQuestionHistorySafe,
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

function buildMovementFortune(): DailyFortune {
  const base = buildExactFortune();
  return {
    ...base,
    analysis: {
      ...base.analysis,
      eventOutlook: {
        ...base.analysis.eventOutlook,
        kind: "movement" as const,
        intensity: "notable" as const,
        lead: "오늘은 흐름이 한 번 움직이며 방향이 다시 잡힐 수 있소.",
        reason: "추진과 타이밍이 맞물려 작은 변화가 실제 방향 조정으로 이어지기 쉬운 날이오.",
        basisSignals: ["momentum", "timing"] as FortuneSignalKey[],
      },
    },
  };
}

function buildRecoveryFortune(): DailyFortune {
  const base = buildExactFortune();
  return {
    ...base,
    analysis: {
      ...base.analysis,
      eventOutlook: {
        ...base.analysis.eventOutlook,
        kind: "recovery" as const,
        intensity: "notable" as const,
        lead: "오늘은 흐트러진 리듬을 바로잡는 일이 크게 작용하오.",
        reason: "회복과 정비를 앞세울수록 하루 기세가 고르게 붙기 쉽소.",
        basisSignals: ["recovery"] as FortuneSignalKey[],
      },
    },
  };
}

function buildCautiousWorkFortune(): DailyFortune {
  const base = buildExactFortune();
  return {
    ...base,
    analysis: {
      ...base.analysis,
      eventOutlook: {
        ...base.analysis.eventOutlook,
        kind: "conflict" as const,
        intensity: "notable" as const,
        lead: "?ㅻ뒛? ?덉そ ?뺣컯??留먮쫫??癒쇱? ?붾뱾 ???덉냼.",
        reason: "?댁빞 ???쇱쓽 ?뺣컯??癒쇱? 而ㅼ?湲??ъ슫 ?먮쫫?댁삤.",
        basisSignals: ["friction", "work"] as FortuneSignalKey[],
      },
      signals: base.analysis.signals.map((signal) => {
        if (signal.key === "work") {
          return {
            ...signal,
            score: 52,
            tone: "caution" as const,
            summary: "?쇱? 踰붿쐞瑜?以꾩씠吏 ?딅뒗 ?몄씠 醫뗭냼.",
          };
        }
        if (signal.key === "friction") {
          return {
            ...signal,
            score: 74,
            tone: "caution" as const,
          };
        }
        return signal;
      }),
    },
  };
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
  mocks.recordFortuneQuestionHistorySafe.mockReset();
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
    expect(mocks.recordFortuneQuestionHistorySafe).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "question-user",
        answer: expect.objectContaining({
          title: answer.title,
          description: answer.description,
        }),
      }),
    );
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
    expect(mocks.recordFortuneQuestionHistorySafe).toHaveBeenCalledTimes(2);
  });

  it("keeps question answers aligned when oracle does not overturn the base signal", async () => {
    const fortune = buildCautiousWorkFortune();
    const answer = await answerWithMockedOracle({
      question: "오늘 일 시작해도 될까?",
      fortune,
    });

    expect(answer.decisionBasis.primarySignalKey).toBeTruthy();
    expect(answer.description).toContain(fortune.analysis.eventOutlook.reason);
    expect(answer.conflictResolution.status).toBe("aligned");
    expect(answer.conflictResolution.appliedPolicy).toBeTruthy();
  });

  it("does not persist history when user id is missing", async () => {
    const fortune = buildUnknownFortune();
    const answer = await answerFortuneQuestion({
      question: "?ㅻ뒛 ?곕씫 蹂대궡???좉퉴?",
      fortune,
      date: new Date("2026-03-10T09:00:00+09:00"),
    });

    expect(answer.usedLlm).toBe(false);
    expect(mocks.recordFortuneQuestionHistorySafe).not.toHaveBeenCalled();
  });

  it("keeps returning answers even when question history persistence fails", async () => {
    mocks.recordFortuneQuestionHistorySafe.mockRejectedValueOnce(new Error("history write failed"));

    const answer = await answerWithMockedOracle({
      question: "?ㅻ뒛 ???쒖옉?대룄 ?좉퉴?",
      fortune: buildCautiousWorkFortune(),
    });

    expect(answer.usedLlm).toBe(false);
    expect(answer.title).toBeTruthy();
    expect(answer.description).toContain("?");
  });

  it("does not foreground rest language for non-health fallback answers", async () => {
    const fortune = buildMovementFortune();
    const answer = await answerWithMockedOracle({
      question: "오늘 일 어떻게 풀릴까?",
      fortune,
    });

    expect(answer.usedLlm).toBe(false);
    expect(answer.description.startsWith(fortune.analysis.eventOutlook.lead)).toBe(true);
    expect(answer.description.startsWith("육효")).toBe(false);
    expect(answer.description.slice(0, fortune.analysis.eventOutlook.lead.length + 20)).not.toMatch(/쉬시오|휴식/);
  });

  it("keeps direct timing words as support copy only when timing is foregrounded", async () => {
    const fortune = buildMovementFortune();
    const answer = await answerWithMockedOracle({
      question: "오늘 언제 움직이면 좋을까?",
      fortune,
    });

    expect(answer.usedLlm).toBe(false);
    expect(answer.description.startsWith(fortune.analysis.eventOutlook.lead)).toBe(true);
    expect(answer.description).toContain("오후");
    expect(answer.description.startsWith("오후")).toBe(false);
    expect(answer.description.startsWith("육효")).toBe(false);
  });

  it("keeps recovery wording for health-oriented fallback answers", async () => {
    const fortune = buildRecoveryFortune();
    const answer = await answerWithMockedOracle({
      question: "오늘 컨디션 어떨까?",
      fortune,
    });

    expect(answer.usedLlm).toBe(false);
    expect(answer.description).toContain(fortune.analysis.eventOutlook.lead);
    expect(answer.description).toContain("회복");
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
    expect(mocks.recordFortuneQuestionHistorySafe).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "question-user",
        answer: expect.objectContaining({
          title: answer.title,
          description: answer.description,
        }),
      }),
    );
    expect(mocks.logAdminEventSafe).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "question_answered",
        status: "success",
        source: "fortune-question",
      }),
    );
  });
});
