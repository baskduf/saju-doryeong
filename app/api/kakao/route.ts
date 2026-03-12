import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { logAdminEventSafe } from "../../../lib/admin-event-log";
import { createBasicCard, createUnauthorizedSkillResponse } from "./_internal/cards";
import { handleKakaoSkillPayload } from "./_internal/dispatch";
import { isAuthorizedKakaoSkillRequest } from "./_internal/request";

function isDatabaseConnectionError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && ["P1001", "P2021"].includes(error.code)) {
    return true;
  }

  return error instanceof Error && /can't reach database server|p1001|table .* does not exist/i.test(error.message);
}

export async function POST(request: NextRequest) {
  if (!isAuthorizedKakaoSkillRequest(request)) {
    return NextResponse.json(createUnauthorizedSkillResponse(), { status: 401 });
  }

  try {
    const payload = await request.json();
    const result = await handleKakaoSkillPayload(payload);

    return NextResponse.json(result.body, result.status ? { status: result.status } : undefined);
  } catch (error) {
    console.error("[/api/kakao] unexpected error", error);
    void logAdminEventSafe({
      eventType: "kakao_request_failed",
      status: "error",
      source: "kakao",
      message: "카카오 요청 처리 중 예외가 발생했습니다.",
      metadata: {
        reason: isDatabaseConnectionError(error) ? "database_error" : "unexpected_error",
        route: "/api/kakao",
      },
    });
    if (isDatabaseConnectionError(error)) {
      return NextResponse.json(
        createBasicCard({
          title: "운세도령",
          description: "사주 서고와의 연결이 잠시 흔들렸소. 잠시 뒤 다시 청해 주시오.",
        }),
        { status: 503 },
      );
    }

    return NextResponse.json(
      createBasicCard({
        title: "운세도령",
        description: "운세를 펼치는 중에 잠시 먹구름이 끼었소. 잠시 뒤 다시 청해 주시오.",
      }),
      { status: 500 },
    );
  }
}
