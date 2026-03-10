import { describe, expect, it } from "vitest";
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

describe("fortune question fallback", () => {
  it("detects likely fortune questions", () => {
    expect(isLikelyFortuneQuestion("오늘 고백해도 될까?")).toBe(true);
    expect(isLikelyFortuneQuestion("오늘 돈 써도 괜찮아?")).toBe(true);
    expect(isLikelyFortuneQuestion("안녕")).toBe(false);
  });

  it("returns fallback work advice without llm", async () => {
    const answer = await answerFortuneQuestion({
      question: "오늘 일은 어떻게 풀릴까?",
      fortune: buildUnknownFortune(),
      date: new Date("2026-03-10T09:00:00+09:00"),
    });

    expect(answer.usedLlm).toBe(false);
    expect(answer.topic).toBe("work");
    expect(answer.title).toBe("도령의 일풀이");
    expect(answer.description).toContain("참고 운세");
  });

  it("maps relationship and health questions to the right topics", async () => {
    const fortune = buildUnknownFortune();
    const relationship = await answerFortuneQuestion({
      question: "오늘 연애운 어때?",
      fortune,
      date: new Date("2026-03-10T09:00:00+09:00"),
    });
    const health = await answerFortuneQuestion({
      question: "오늘 컨디션 관리는 어떻게 할까?",
      fortune,
      date: new Date("2026-03-10T09:00:00+09:00"),
    });

    expect(relationship.topic).toBe("relationship");
    expect(relationship.title).toBe("도령의 연정풀이");
    expect(health.topic).toBe("health");
    expect(health.title).toBe("도령의 기력풀이");
  });
});
