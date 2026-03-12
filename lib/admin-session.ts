import type { NextRequest, NextResponse } from "next/server";
import type { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";
import { redirect } from "next/navigation";
import {
  ADMIN_SESSION_COOKIE_NAME,
  ADMIN_SESSION_TTL_SECONDS,
  verifyAdminSessionToken,
} from "./admin-auth";

type CookieReader = Pick<ReadonlyRequestCookies, "get"> | Pick<NextRequest["cookies"], "get">;

export function getAdminSessionCookieValue(cookies: CookieReader): string | undefined {
  return cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value;
}

export function isAdminAuthenticated(cookies: CookieReader): boolean {
  return verifyAdminSessionToken(getAdminSessionCookieValue(cookies)).ok;
}

export function requireAdminPageSession(cookies: Pick<ReadonlyRequestCookies, "get">): void {
  if (!isAdminAuthenticated(cookies)) {
    redirect("/admin/login");
  }
}

export function buildAdminSessionCookie(token: string) {
  return {
    name: ADMIN_SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_SESSION_TTL_SECONDS,
  };
}

export function clearAdminSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
