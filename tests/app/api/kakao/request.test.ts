import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { buildKakaoPayload } from "../../../fixtures/kakao";
import {
  extractKakaoActionParams,
  getKakaoUserId,
  getKakaoUtterance,
  isAuthorizedKakaoSkillRequest,
  isReservedUtterance,
} from "../../../../app/api/kakao/_internal/request";

describe("kakao request helpers", () => {
  it("prefers userRequest.user.id and falls back to user properties", () => {
    expect(getKakaoUserId(buildKakaoPayload({ userId: "primary-id" }))).toBe("primary-id");
    expect(
      getKakaoUserId(
        buildKakaoPayload({
          userId: null,
          userProperties: {
            appUserId: "fallback-id",
          },
        }),
      ),
    ).toBe("fallback-id");
    expect(
      getKakaoUserId(
        buildKakaoPayload({
          userId: null,
          userProperties: {
            plusfriendUserKey: "plusfriend-id",
          },
        }),
      ),
    ).toBe("plusfriend-id");
  });

  it("reads utterance as trimmed text", () => {
    expect(getKakaoUtterance(buildKakaoPayload({ utterance: "  오늘 운세  " }))).toBe("오늘 운세");
  });

  it("merges action params, request params, and detail params without overwriting existing values", () => {
    const params = extractKakaoActionParams(
      buildKakaoPayload({
        params: {
          name: "홍길동",
          birthDate: "1995-10-21",
        },
        requestParams: {
          birthTime: "14:30",
        },
        detailParams: {
          birthDate: "2000-01-01",
          음양력: "음력",
        },
      }),
    );

    expect(params).toMatchObject({
      hasAny: true,
      name: "홍길동",
      birthDate: "1995-10-21",
      birthTime: "14:30",
      calendarType: "음력",
    });
    expect(params.debugLines[0]).toBe("name=홍길동");
  });

  it("supports Korean aliases in detail params", () => {
    const params = extractKakaoActionParams(
      buildKakaoPayload({
        detailParams: {
          이름: "김도령",
          생년월일: "19951021",
          출생시간: "1430",
          달력기준: "양력",
        },
      }),
    );

    expect(params).toMatchObject({
      hasAny: true,
      name: "김도령",
      birthDate: "19951021",
      birthTime: "1430",
      calendarType: "양력",
    });
  });

  it("recognizes reserved utterances", () => {
    expect(isReservedUtterance("정보 재등록")).toBe(true);
    expect(isReservedUtterance("오늘의 운세")).toBe(true);
    expect(isReservedUtterance("운세 질문")).toBe(true);
    expect(isReservedUtterance("친구에게 공유하기")).toBe(true);
    expect(isReservedUtterance("그냥 잡담")).toBe(false);
  });

  it("validates kakao shared secret requests", () => {
    const good = new NextRequest("https://test.example.com/api/kakao?key=test-kakao-secret");
    const bad = new NextRequest("https://test.example.com/api/kakao?key=wrong-secret");

    expect(isAuthorizedKakaoSkillRequest(good)).toBe(true);
    expect(isAuthorizedKakaoSkillRequest(bad)).toBe(false);
  });
});
