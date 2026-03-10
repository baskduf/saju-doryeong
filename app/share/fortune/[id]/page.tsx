import { notFound } from "next/navigation";
import { verifyShareAccessToken } from "../../../../lib/access-token";
import {
  findFortuneShareSnapshotById,
  type FortuneShareSnapshotPayload,
} from "../../../../lib/fortune-share";
import { ShareActions } from "./ShareActions";

type PageProps = {
  params: { id: string };
  searchParams?: {
    token?: string;
  };
};

function isSharePayload(value: unknown): value is FortuneShareSnapshotPayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Record<string, unknown>;
  return (
    typeof payload.displayName === "string" &&
    typeof payload.score === "number" &&
    typeof payload.grade === "string" &&
    typeof payload.headline === "string" &&
    typeof payload.summary === "string" &&
    typeof payload.caution === "string" &&
    Array.isArray(payload.recommendedActions) &&
    typeof payload.targetDateKey === "string"
  );
}

export default async function SharedFortunePage({ params, searchParams }: PageProps) {
  const token = searchParams?.token?.trim();
  const tokenCheck = verifyShareAccessToken(token, params.id);
  if (!tokenCheck.ok) {
    notFound();
  }

  const snapshot = await findFortuneShareSnapshotById(params.id);
  if (!snapshot || snapshot.expiresAt.getTime() <= Date.now() || !isSharePayload(snapshot.payload)) {
    notFound();
  }

  const fortune = snapshot.payload;

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "24px 16px 48px",
        background:
          "radial-gradient(circle at top left, rgba(255, 221, 161, 0.32), transparent 38%), linear-gradient(180deg, #f7efe2 0%, #f4ead7 50%, #efe4cf 100%)",
      }}
    >
      <section
        style={{
          width: "min(100%, 760px)",
          margin: "0 auto",
          padding: "24px 18px",
          borderRadius: 28,
          border: "1px solid rgba(117, 80, 34, 0.16)",
          background: "rgba(255, 251, 243, 0.92)",
          boxShadow: "0 24px 50px rgba(69, 44, 16, 0.12)",
        }}
      >
        <p style={{ margin: 0, color: "#9e6a24", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>
          Shared Fortune
        </p>
        <h1 style={{ margin: "8px 0 10px", fontSize: "clamp(28px, 6vw, 42px)", color: "#2e1c11" }}>
          {fortune.displayName} 님의 오늘 운세
        </h1>
        <p style={{ margin: 0, color: "#6d5236", lineHeight: 1.7 }}>
          {fortune.targetDateKey} 기준으로 저장된 공유용 운세입니다. 출생 정보와 분석 원문은 공개하지 않습니다.
        </p>

        <section
          style={{
            marginTop: 18,
            padding: "18px 16px",
            borderRadius: 22,
            background: "linear-gradient(135deg, rgba(125, 83, 28, 0.16), rgba(125, 83, 28, 0.04))",
            border: "1px solid rgba(117, 80, 34, 0.12)",
          }}
        >
          <p style={{ margin: 0, color: "#7b5523", fontWeight: 700 }}>오늘의 운세 점수</p>
          <p style={{ margin: "10px 0 4px", fontSize: 56, fontWeight: 800, color: "#4a3119" }}>{fortune.score}</p>
          <p style={{ margin: 0, color: "#6d5236", fontWeight: 700 }}>{fortune.grade}</p>
        </section>

        <section style={{ marginTop: 18, display: "grid", gap: 14 }}>
          <article
            style={{
              padding: "18px 16px",
              borderRadius: 22,
              background: "rgba(255, 255, 255, 0.7)",
              border: "1px solid rgba(117, 80, 34, 0.12)",
            }}
          >
            <h2 style={{ margin: 0, color: "#2e1c11", fontSize: "1.1rem" }}>도령의 한마디</h2>
            <p style={{ margin: "10px 0 0", color: "#5b4125", lineHeight: 1.8 }}>{fortune.headline}</p>
            <p style={{ margin: "10px 0 0", color: "#6d5236", lineHeight: 1.8 }}>{fortune.summary}</p>
          </article>

          <article
            style={{
              padding: "18px 16px",
              borderRadius: 22,
              background: "rgba(255, 255, 255, 0.7)",
              border: "1px solid rgba(117, 80, 34, 0.12)",
            }}
          >
            <h2 style={{ margin: 0, color: "#2e1c11", fontSize: "1.1rem" }}>오늘 조심할 것</h2>
            <p style={{ margin: "10px 0 0", color: "#6d5236", lineHeight: 1.8 }}>{fortune.caution}</p>
          </article>

          <article
            style={{
              padding: "18px 16px",
              borderRadius: 22,
              background: "rgba(255, 255, 255, 0.7)",
              border: "1px solid rgba(117, 80, 34, 0.12)",
            }}
          >
            <h2 style={{ margin: 0, color: "#2e1c11", fontSize: "1.1rem" }}>오늘의 추천 행동</h2>
            <ol style={{ margin: "12px 0 0", paddingLeft: 18, color: "#6d5236", lineHeight: 1.8 }}>
              {fortune.recommendedActions.map((action: string) => (
                <li key={action}>{action}</li>
              ))}
            </ol>
          </article>
        </section>

        <section style={{ marginTop: 18 }}>
          <ShareActions title={`${fortune.displayName} 님의 오늘 운세`} />
        </section>
      </section>
    </main>
  );
}
