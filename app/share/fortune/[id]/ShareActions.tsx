"use client";

import { useState } from "react";

type Props = {
  title: string;
};

const buttonStyle: React.CSSProperties = {
  minHeight: 44,
  padding: "0 14px",
  borderRadius: 14,
  border: "1px solid rgba(117, 80, 34, 0.18)",
  background: "rgba(255, 255, 255, 0.78)",
  color: "#5f4018",
  fontWeight: 700,
  cursor: "pointer",
};

export function ShareActions({ title }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  async function handleShare() {
    if (!navigator.share) {
      await handleCopy();
      return;
    }

    try {
      await navigator.share({
        title,
        url: window.location.href,
      });
    } catch {
      // user cancelled share sheet
    }
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
      <button type="button" style={buttonStyle} onClick={handleShare}>
        공유하기
      </button>
      <button type="button" style={buttonStyle} onClick={handleCopy}>
        {copied ? "링크 복사됨" : "링크 복사"}
      </button>
    </div>
  );
}
