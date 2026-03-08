# 운세도령 (Next.js App Router)

카카오 오픈빌더 스킬 요청을 받아 오늘의 운세를 반환하고, 웹 상세 페이지(`/fortune/[id]`)를 제공하는 풀스택 예제입니다.

## 스택

- Next.js (App Router) + TypeScript
- Prisma + PostgreSQL
- Recharts
- 배포 대상: Vercel

## 시작하기

1. 의존성 설치

```bash
npm install
```

2. 환경 변수 설정

```bash
cp .env.example .env.local
```

3. Prisma Client 생성 + 스키마 반영

```bash
npm run prisma:generate
npm run prisma:push
```

4. 개발 서버 실행

```bash
npm run dev
```

## Vercel DB (Prisma) 설정

1. Vercel 프로젝트에 Postgres Storage를 연결합니다.
2. Vercel 환경변수의 `POSTGRES_PRISMA_URL` 값을 앱의 `DATABASE_URL`로 사용합니다.
3. 로컬에서는 `cp .env.example .env.local` 후 `DATABASE_URL`에 같은 값을 넣습니다.
4. 이후 스키마 반영:

```bash
npm run prisma:generate
npm run prisma:push
```

## 주요 경로

- 카카오 스킬 API: `/app/api/kakao/route.ts`
- 프로필 등록/조회 API: `/app/api/profile/route.ts`
- 운세 상세 웹뷰: `/app/fortune/[id]/page.tsx`
- 운세 계산 로직: `/lib/fortune.ts`
- Prisma 스키마: `/prisma/schema.prisma`

## 카카오 스킬 요청 포인트

- `POST /api/kakao`
- `userRequest.user.id` 기반으로 사용자 조회
- BasicCard 응답에 상세 페이지 버튼 포함
  - `webLinkUrl`: `${NEXT_PUBLIC_APP_URL}/fortune/${userId}`

## 프로필 API (테스트 데이터 등록용)

- `POST /api/profile`: 프로필 생성/수정(upsert)
- `GET /api/profile?userId={id}`: 프로필 조회

예시:

```bash
curl -X POST http://localhost:3000/api/profile \
  -H "content-type: application/json" \
  -d '{
    "userId": "test-user-1",
    "name": "홍길동",
    "birthDate": "1995-10-21",
    "birthTime": "14:30",
    "calendarType": "solar",
    "sajuData": {
      "fiveElements": { "wood": 30, "fire": 20, "earth": 20, "metal": 15, "water": 15 }
    }
  }'
```
