"use client";

import { useEffect } from "react";

const MOBILE_VIEWPORT_HEIGHT_VAR = "--mobile-viewport-height";

function setMobileViewportHeight() {
  document.documentElement.style.setProperty(MOBILE_VIEWPORT_HEIGHT_VAR, `${window.innerHeight}px`);
}

export function MobileViewportHeight() {
  useEffect(() => {
    const updateViewportHeight = () => {
      window.requestAnimationFrame(setMobileViewportHeight);
    };

    updateViewportHeight();

    window.addEventListener("resize", updateViewportHeight);
    window.addEventListener("orientationchange", updateViewportHeight);
    window.visualViewport?.addEventListener("resize", updateViewportHeight);
    window.visualViewport?.addEventListener("scroll", updateViewportHeight);

    return () => {
      window.removeEventListener("resize", updateViewportHeight);
      window.removeEventListener("orientationchange", updateViewportHeight);
      window.visualViewport?.removeEventListener("resize", updateViewportHeight);
      window.visualViewport?.removeEventListener("scroll", updateViewportHeight);
      document.documentElement.style.removeProperty(MOBILE_VIEWPORT_HEIGHT_VAR);
    };
  }, []);

  return null;
}
