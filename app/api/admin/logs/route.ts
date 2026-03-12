import { NextRequest, NextResponse } from "next/server";
import { getAdminLogsPage } from "../../../../lib/admin-dashboard";
import { isAdminAuthenticated } from "../../../../lib/admin-session";
import { hasDatabaseUrl } from "../../../../lib/profile";

type AdminLogsPageParams = NonNullable<Parameters<typeof getAdminLogsPage>[0]>;

function parsePage(searchParams: URLSearchParams): number {
  const value = Number(searchParams.get("page") ?? "1");
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
}

export async function GET(request: NextRequest) {
  if (!isAdminAuthenticated(request.cookies)) {
    return NextResponse.json({ error: "관리자 인증이 필요합니다." }, { status: 401 });
  }

  if (!hasDatabaseUrl()) {
    return NextResponse.json({ error: "DATABASE_URL이 설정되지 않았습니다." }, { status: 503 });
  }

  const eventType = request.nextUrl.searchParams.get("eventType")?.trim() ?? "all";
  const status = request.nextUrl.searchParams.get("status")?.trim() ?? "all";
  const userId = request.nextUrl.searchParams.get("userId")?.trim() ?? "";
  const page = parsePage(request.nextUrl.searchParams);

  const result = await getAdminLogsPage({
    eventType: eventType as AdminLogsPageParams["eventType"],
    status: status as AdminLogsPageParams["status"],
    userId,
    page,
  });

  return NextResponse.json(result);
}
