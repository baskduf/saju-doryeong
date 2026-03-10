import { describe, expect, it } from "vitest";
import { buildYukhyoReading } from "../../lib/yukhyo";

describe("buildYukhyoReading", () => {
  it("returns the same hexagram for the same user, question, and KST date", () => {
    const params = {
      userId: "oracle-user",
      question: "오늘 연락 보내도 될까?",
      date: new Date("2026-03-10T09:00:00+09:00"),
    };

    const first = buildYukhyoReading(params);
    const second = buildYukhyoReading(params);

    expect(first).toEqual(second);
    expect(first.lines).toHaveLength(6);
    expect(first.primaryBits).toHaveLength(6);
    expect(first.network.nodes.length).toBeGreaterThanOrEqual(2);
    expect(first.network.edges.length).toBeGreaterThanOrEqual(1);
  });

  it("changes the reading when the question or date changes", () => {
    const base = buildYukhyoReading({
      userId: "oracle-user",
      question: "오늘 연락 보내도 될까?",
      date: new Date("2026-03-10T09:00:00+09:00"),
    });
    const changedQuestion = buildYukhyoReading({
      userId: "oracle-user",
      question: "오늘 투자해도 될까?",
      date: new Date("2026-03-10T09:00:00+09:00"),
    });
    const changedDate = buildYukhyoReading({
      userId: "oracle-user",
      question: "오늘 연락 보내도 될까?",
      date: new Date("2026-03-11T09:00:00+09:00"),
    });

    expect({
      primaryHexagram: changedQuestion.primaryHexagram,
      changedHexagram: changedQuestion.changedHexagram,
      movingLines: changedQuestion.movingLines,
    }).not.toEqual({
      primaryHexagram: base.primaryHexagram,
      changedHexagram: base.changedHexagram,
      movingLines: base.movingLines,
    });

    expect({
      primaryHexagram: changedDate.primaryHexagram,
      changedHexagram: changedDate.changedHexagram,
      movingLines: changedDate.movingLines,
    }).not.toEqual({
      primaryHexagram: base.primaryHexagram,
      changedHexagram: base.changedHexagram,
      movingLines: base.movingLines,
    });
  });

  it("reflects moving-line pressure in the answer trend", () => {
    const stable = buildYukhyoReading({
      userId: "oracle-user",
      question: "오늘 계약해도 될까?",
      date: new Date("2026-03-10T09:00:00+09:00"),
    });
    const volatile = buildYukhyoReading({
      userId: "oracle-user",
      question: "오늘 쉬어야 할까?",
      date: new Date("2026-03-10T09:00:00+09:00"),
    });

    expect(stable.movingLines).toHaveLength(0);
    expect(stable.answerTrend).toBe("positive");
    expect(stable.breakdown.appliedScore).toBe(stable.breakdown.primaryScore);
    expect(stable.changedBits).toBeNull();
    expect(volatile.movingLines.length).toBeGreaterThanOrEqual(4);
    expect(volatile.answerTrend).toBe("neutral");
    expect(volatile.breakdown.changedScore).not.toBeNull();
    expect(volatile.changedBits).not.toBeNull();
    expect(volatile.sourceLine).toContain("육효 괘상:");
  });
});
