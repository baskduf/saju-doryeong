import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20 }}>
      <section
        style={{
          maxWidth: 640,
          width: "100%",
          borderRadius: 20,
          padding: 24,
          border: "1px solid #ccb487",
          background: "rgba(255, 250, 236, 0.9)",
          textAlign: "center"
        }}
      >
        <p style={{ margin: 0, color: "#7d623a" }}>운세도령</p>
        <h1 style={{ marginTop: 8, marginBottom: 12 }}>점괘를 찾지 못했소</h1>
        <p style={{ marginTop: 0, color: "#5e472c", lineHeight: 1.7 }}>
          요청한 사용자 정보가 없거나 링크가 올바르지 않을 수 있소.
        </p>
        <Link
          href="/"
          style={{
            display: "inline-block",
            marginTop: 10,
            padding: "10px 14px",
            borderRadius: 999,
            border: "1px solid #7e6035",
            backgroundColor: "#6c4b1f",
            color: "#fff8ec"
          }}
        >
          첫 화면으로
        </Link>
      </section>
    </main>
  );
}
