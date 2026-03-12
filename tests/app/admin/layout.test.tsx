import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookiesGet: vi.fn(),
  redirect: vi.fn((href: string) => {
    throw new Error(`redirect:${href}`);
  }),
}));

vi.mock("next/headers", () => ({
  cookies: () => ({
    get: mocks.cookiesGet,
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

import Layout from "../../../app/admin/(dashboard)/layout";
import { createAdminSessionToken } from "../../../lib/admin-auth";

describe("admin dashboard layout", () => {
  beforeEach(() => {
    process.env.ADMIN_DASHBOARD_SECRET = "admin-secret";
    mocks.cookiesGet.mockReset();
    mocks.redirect.mockClear();
  });

  it("redirects unauthenticated visitors to the login page", () => {
    mocks.cookiesGet.mockReturnValue(undefined);

    expect(() =>
      renderToStaticMarkup(
        Layout({
          children: <div>child</div>,
        }),
      ),
    ).toThrow("redirect:/admin/login");
  });

  it("renders protected content when a valid admin cookie is present", () => {
    mocks.cookiesGet.mockReturnValue({
      value: createAdminSessionToken({ expiresInSeconds: 60 }),
    });

    const markup = renderToStaticMarkup(
      Layout({
        children: <div>dashboard child</div>,
      }),
    );

    expect(markup).toContain("관리자 대시보드");
    expect(markup).toContain("dashboard child");
  });
});
