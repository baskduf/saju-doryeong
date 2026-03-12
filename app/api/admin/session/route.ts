import { NextRequest, NextResponse } from "next/server";
import {
  createAdminSessionToken,
  isAdminDashboardConfigured,
  verifyAdminDashboardSecret,
} from "../../../../lib/admin-auth";
import { buildAdminSessionCookie } from "../../../../lib/admin-session";

async function readSecret(request: NextRequest): Promise<string | undefined> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const payload = (await request.json()) as { secret?: unknown };
    return typeof payload.secret === "string" ? payload.secret : undefined;
  }

  const formData = await request.formData();
  const secret = formData.get("secret");
  return typeof secret === "string" ? secret : undefined;
}

export async function POST(request: NextRequest) {
  const loginUrl = new URL("/admin/login", request.url);

  if (!isAdminDashboardConfigured()) {
    loginUrl.searchParams.set("error", "config");
    return NextResponse.redirect(loginUrl, 303);
  }

  const secret = await readSecret(request);
  if (!verifyAdminDashboardSecret(secret)) {
    loginUrl.searchParams.set("error", "invalid");
    return NextResponse.redirect(loginUrl, 303);
  }

  const response = NextResponse.redirect(new URL("/admin", request.url), 303);
  response.cookies.set(buildAdminSessionCookie(createAdminSessionToken()));
  return response;
}
