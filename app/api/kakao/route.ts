import { NextRequest, NextResponse } from "next/server";
import { generateDailyFortune } from "../../../lib/fortune";
import { prisma } from "../../../lib/prisma";

type KakaoBasicCardResponse = {
  version: "2.0";
  template: {
    outputs: Array<{
      basicCard: {
        title: string;
        description: string;
        buttons?: Array<{
          action: "webLink";
          label: string;
          webLinkUrl: string;
        }>;
      };
    }>;
    quickReplies?: Array<{
      label: string;
      action: "message";
      messageText: string;
    }>;
  };
};

function createBasicCard(params: {
  title: string;
  description: string;
  webLinkUrl?: string;
}): KakaoBasicCardResponse {
  return {
    version: "2.0",
    template: {
      outputs: [
        {
          basicCard: {
            title: params.title,
            description: params.description,
            buttons: params.webLinkUrl
              ? [
                  {
                    action: "webLink",
                    label: "상세 운세 보러가기",
                    webLinkUrl: params.webLinkUrl,
                  },
                ]
              : undefined,
          },
        },
      ],
      quickReplies: [
        {
          label: "운세 다시 보기",
          action: "message",
          messageText: "오늘의 운세",
        },
      ],
    },
  };
}

function getKakaoUserId(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const root = payload as Record<string, unknown>;
  const userRequest = root.userRequest as Record<string, unknown> | undefined;
  const user = userRequest?.user as Record<string, unknown> | undefined;
  const properties = user?.properties as Record<string, unknown> | undefined;

  const candidates = [user?.id, properties?.appUserId, properties?.plusfriendUserKey, properties?.botUserKey];
  for (const id of candidates) {
    if (typeof id === "string" && id.trim().length > 0) {
      return id;
    }
  }
  return undefined;
}

function hasDatabaseUrl(): boolean {
  return Boolean(process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL);
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const userId = getKakaoUserId(payload);

    if (!userId) {
      return NextResponse.json(
        createBasicCard({
          title: "운세도령",
          description: "사용자 식별값을 찾지 못했소. 다시 한 번 호출해 주시오.",
        }),
      );
    }

    if (!hasDatabaseUrl()) {
      return NextResponse.json(
        createBasicCard({
          title: "운세도령",
          description: "사주 서고와의 연결이 아직 준비되지 않았소. 잠시 후 다시 청해 주시오.",
        }),
        { status: 503 },
      );
    }

    const profile = await prisma.sajuProfile.findUnique({
      where: { userId },
      select: {
        userId: true,
        name: true,
        birthDate: true,
        sajuData: true,
      },
    });

    if (!profile) {
      return NextResponse.json(
        createBasicCard({
          title: "운세도령",
          description: "그대의 사주 기록이 아직 없구나. 먼저 사주 정보를 등록해 주시오.",
        }),
      );
    }

    const fortune = generateDailyFortune({
      userId: profile.userId,
      birthDate: profile.birthDate,
      sajuData: profile.sajuData,
    });

    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://your-domain.com").replace(/\/$/, "");
    const detailUrl = `${baseUrl}/fortune/${encodeURIComponent(profile.userId)}`;
    const titleName = profile.name ? `${profile.name} 님` : "그대";

    const description = [
      `${titleName}, ${fortune.headline}`,
      "",
      `운세 점수: ${fortune.score}점 (${fortune.grade})`,
      fortune.summary,
      fortune.caution,
    ].join("\n");

    return NextResponse.json(
      createBasicCard({
        title: "운세도령의 오늘 풀이",
        description,
        webLinkUrl: detailUrl,
      }),
    );
  } catch (error) {
    console.error("[/api/kakao] unexpected error", error);
    return NextResponse.json(
      createBasicCard({
        title: "운세도령",
        description: "점괘를 펴는 중 잠시 먹구름이 끼었소. 잠시 후 다시 청해 주시오.",
      }),
      { status: 500 },
    );
  }
}
