import type { KakaoQuickReply } from "./types";

export const REREGISTER_COMMAND = "정보 재등록";
export const FORTUNE_COMMAND = "오늘의 운세";
export const QUESTION_COMMAND = "운세 질문";
export const SHARE_COMMAND = "친구에게 공유하기";

export const DEFAULT_QUICK_REPLIES: KakaoQuickReply[] = [
  { label: REREGISTER_COMMAND, action: "message", messageText: REREGISTER_COMMAND },
  { label: FORTUNE_COMMAND, action: "message", messageText: FORTUNE_COMMAND },
  { label: QUESTION_COMMAND, action: "message", messageText: QUESTION_COMMAND },
];

export const QUESTION_EXAMPLE_QUICK_REPLIES: KakaoQuickReply[] = [
  { label: "연애운 질문", action: "message", messageText: "오늘 연애운 어때?" },
  { label: "재물운 질문", action: "message", messageText: "오늘 돈 써도 괜찮아?" },
  { label: "직장운 질문", action: "message", messageText: "오늘 일은 어떻게 풀릴까?" },
  { label: "건강운 질문", action: "message", messageText: "오늘 컨디션 관리는 어떻게 할까?" },
];
