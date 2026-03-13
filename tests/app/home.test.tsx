import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: ({
    priority: _priority,
    ...props
  }: React.ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean }) => React.createElement("img", props),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) =>
    React.createElement("a", { ...props, href }, children),
}));

import HomePage from "../../app/page";
import WelcomPage from "../../app/welcom/page";

describe("home page kakao entry", () => {
  it("renders kakao mobile actions, fallback links, and the sample link", () => {
    const markup = renderToStaticMarkup(<HomePage />);

    expect(markup).toContain("카카오톡으로 대화 시작");
    expect(markup).toContain("채널 추가하고 소식 받기");
    expect(markup).toContain("운세 샘플 보기");
    expect(markup).toContain('href="https://pf.kakao.com/_IjiZX/chat"');
    expect(markup).toContain('href="https://pf.kakao.com/_IjiZX/friend"');
    expect(markup).toContain('href="/fortune/sample-user"');
  });

  it("keeps app/page and app/welcom/page aligned on the same welcome markup", () => {
    const homeMarkup = renderToStaticMarkup(<HomePage />);
    const welcomMarkup = renderToStaticMarkup(<WelcomPage />);

    expect(homeMarkup).toBe(welcomMarkup);
  });
});
