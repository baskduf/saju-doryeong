import { NextRequest, NextResponse } from "next/server";
import { clearAdminSessionCookie } from "../../../../../lib/admin-session";

export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/admin/login", request.url), 303);
  return clearAdminSessionCookie(response);
}
