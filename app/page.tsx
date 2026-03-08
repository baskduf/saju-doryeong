import Link from "next/link";

export default function HomePage() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20 }}>
      <section
        style={{
          maxWidth: 760,
          width: "100%",
          borderRadius: 20,
          padding: 24,
          border: "1px solid #ccb487",
          background: "rgba(255, 250, 236, 0.9)",
          boxShadow: "0 12px 34px rgba(50, 34, 12, 0.12)"
        }}
      >
        <h1 style={{ margin: "0 0 10px", fontSize: "clamp(30px, 5vw, 44px)" }}>운세도령</h1>
        <p style={{ margin: "0 0 16px", color: "#6b563a", lineHeight: 1.7 }}>
          카카오 챗봇에서 받은 userId 기반으로 오늘의 운세를 상세히 풀이합니다.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <Link
            href="/fortune/sample-user"
            style={{
              padding: "10px 14px",
              borderRadius: 999,
              border: "1px solid #7e6035",
              backgroundColor: "#6c4b1f",
              color: "#fff8ec"
            }}
          >
            샘플 운세 페이지 보기
          </Link>
          <span style={{ padding: "10px 14px", borderRadius: 999, border: "1px solid #d4c29d", color: "#5e472c" }}>
            POST /api/kakao
          </span>
        </div>
      </section>
    </main>
  );
}
