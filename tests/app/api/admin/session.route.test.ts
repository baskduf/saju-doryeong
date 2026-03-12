import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";
import { POST as login } from "../../../../app/api/admin/session/route";
import { POST as logout } from "../../../../app/api/admin/session/logout/route";
import { ADMIN_SESSION_COOKIE_NAME } from "../../../../lib/admin-auth";

describe("admin session routes", () => {
  beforeEach(() => {
    process.env.ADMIN_DASHBOARD_SECRET = "admin-secret";
  });

  it("redirects back to login when the secret is invalid", async () => {
    const request = new NextRequest("https://test.example.com/api/admin/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ secret: "wrong-secret" }),
    });

    const response = await login(request);

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://test.example.com/admin/login?error=invalid");
  });

  it("creates an admin session cookie when the secret is valid", async () => {
    const request = new NextRequest("https://test.example.com/api/admin/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ secret: "admin-secret" }),
    });

    const response = await login(request);
    const cookie = response.cookies.get(ADMIN_SESSION_COOKIE_NAME);

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://test.example.com/admin");
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.value).toBeTruthy();
  });

  it("clears the admin session cookie on logout", async () => {
    const request = new NextRequest("https://test.example.com/api/admin/session/logout", {
      method: "POST",
    });

    const response = await logout(request);
    const cookie = response.cookies.get(ADMIN_SESSION_COOKIE_NAME);

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://test.example.com/admin/login");
    expect(cookie?.maxAge).toBe(0);
  });
});
