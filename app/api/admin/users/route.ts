import { NextRequest, NextResponse } from "next/server";
import { getAdminUsersPage } from "../../../../lib/admin-dashboard";
import { isAdminAuthenticated } from "../../../../lib/admin-session";
import { hasDatabaseUrl } from "../../../../lib/profile";

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

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const page = parsePage(request.nextUrl.searchParams);
  const result = await getAdminUsersPage({ q, page });

  return NextResponse.json(result);
}
