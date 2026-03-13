# 사주도령

카카오톡 챗봇과 웹 페이지를 연결해 오늘의 운세를 제공하는 Next.js 앱입니다. 사용자는 카카오에서 사주 정보를 등록하고, 비공개 상세 운세 페이지를 열고, 공유용 운세 카드를 만들고, 자유 문장으로 운세 질문까지 할 수 있습니다.

## 주요 기능

- 카카오 스킬 요청 수신 및 응답
- 사용자 사주 등록 및 갱신
- 오늘의 운세 계산
- 비공개 상세 운세 페이지 제공
- 공유용 운세 스냅샷 생성
- 자유 문장 기반 운세 질문 응답
- `solar`, `lunar`, `unknown` 달력 기준 지원

## 달력 기준 정책

### `solar`

입력한 날짜를 양력으로 계산합니다.

### `lunar`

입력한 날짜를 음력으로 보고 양력 변환 후 계산합니다.

### `unknown`

정확한 달력 기준을 확정하지 않고, 양력/음력 두 가능성을 함께 본 참고용 blended reference 운세로 처리합니다.

- `certainty`는 `calendar-unknown`으로 유지됩니다.
- exact 만세력, 지지 합충형, 정밀 해석은 감춥니다.
- UI에서는 "양력·음력 공통 흐름"으로 안내합니다.

## 사용자 흐름

### 1. 등록

카카오 스킬이 사용자별 등록 링크를 발급합니다.

- 경로: `/register?userId=...&token=...&source=kakao`
- 등록 토큰이 있어야 저장할 수 있습니다.
- 이름, 생년월일, 출생시간, 달력 기준을 입력합니다.

### 2. 상세 운세

등록 후 비공개 상세 페이지로 이동합니다.

- 경로: `/fortune/[userId]?token=...`
- `fortune-access` 토큰이 있어야 접근할 수 있습니다.
- 운세 점수, 해설, 오행, 하이브리드 분석, 공유 진입을 제공합니다.

샘플 페이지:

- `/fortune/sample-user`

### 3. 공유

카카오에서 `친구에게 공유하기`를 누르면 공유용 스냅샷을 생성합니다.

- 경로: `/share/fortune/[snapshotId]?token=...`
- 이름은 마스킹됩니다.
- 출생 정보와 상세 분석 전문은 공개하지 않습니다.
- 공유카드 생성 시 질문권이 적립됩니다.

데모 페이지:

- `/share/fortune/demo`

### 4. 질문하기

카카오 챗봇에서 `운세 질문`을 입력한 뒤 자유 문장으로 질문합니다.

- 질문 응답은 해당 사용자의 오늘 운세 객체를 기반으로 생성됩니다.
- OpenAI API 키가 없으면 규칙 기반 fallback 응답으로 동작합니다.

## 질문/공유 정책

- 기본 질문 가능 횟수: 하루 5회
- 공유 적립: 공유카드 생성 시 +1
- 공유 적립 상한: 하루 10회
- 총 질문 가능 횟수: `5 + 오늘 적립분`
- 날짜 기준: 모두 KST
- 보너스 이월: 없음

중요:

- 적립 시점은 "실제 공유 완료 시점"이 아니라 "공유카드를 생성한 시점"입니다.
- 카카오 share 완료 콜백을 서버에서 받지 못하기 때문에 이렇게 구현되어 있습니다.

## 기술 스택

- Next.js 14 App Router
- TypeScript
- React 18
- Prisma
- PostgreSQL
- `lunar-javascript`
- Recharts
- Vitest

## 프로젝트 구조

```text
app/
  api/
    kakao/route.ts              # 카카오 스킬 진입점
    profile/route.ts            # 등록 API
  fortune/[id]/                 # 비공개 상세 운세 페이지
  register/                     # 등록 페이지
  share/fortune/[id]/           # 공개 공유 페이지
  _components/                  # 홈/온보딩 UI
lib/
  access-token.ts               # register/fortune/share 토큰 발급 및 검증
  fortune.ts                    # 일일 운세 생성
  fortune-llm.ts                # 상세 운세 서술 보강
  fortune-question.ts           # 질문 응답 생성
  fortune-share.ts              # 공유 스냅샷 저장/조회
  profile.ts                    # 프로필 저장, 질문 사용량, 공유 적립
  saju.ts                       # 전통 사주 계산
  kuseong.ts                    # 구성 보정 분석
  yukhyo.ts                     # 질문용 유효 해석
  seoul-time.ts                 # KST 날짜 유틸
prisma/
  schema.prisma                 # 데이터 모델
tests/
  app/api/                      # API 테스트
  lib/                          # 도메인 로직 테스트
```

## 데이터 모델

### `SajuProfile`

- 사용자 기본 정보
- 저장된 `sajuData`
- 질문 사용량
- 공유 적립 사용량
- 질문 입력 대기 상태

### `FortuneShareSnapshot`

- 하루 단위 공유용 운세 payload
- 만료 시각
- 공유 토큰과 함께 public 페이지에서 사용

## 토큰 구조

모든 private/public 링크는 HMAC 서명 토큰을 사용합니다.

- `register-access`
- `fortune-access`
- `share-access`

기본 TTL:

- 등록 링크: 10분
- 상세 운세 링크: 24시간
- 공유 링크: 30일

## 환경 변수

### 필수

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DB_NAME?schema=public"
APP_SIGNING_SECRET="your-signing-secret"
KAKAO_SKILL_SHARED_SECRET="your-kakao-skill-secret"
NEXT_PUBLIC_APP_URL="http://127.0.0.1:3000"
```

### 선택

```env
POSTGRES_PRISMA_URL=""
OPENAI_API_KEY=""
OPENAI_FORTUNE_MODEL="gpt-4.1-mini"
OPENAI_QUESTION_MODEL="gpt-4.1-mini"
NEXT_PUBLIC_KAKAO_JS_KEY="your-kakao-javascript-key"
NEXT_PUBLIC_KAKAO_CHANNEL_PUBLIC_ID="_IjiZX"
```

메모:

- `POSTGRES_PRISMA_URL`이 있으면 런타임에서 `DATABASE_URL`로 fallback 됩니다.
- `OPENAI_API_KEY`가 없으면 질문/서술은 fallback 문구로 동작합니다.
- `NEXT_PUBLIC_KAKAO_JS_KEY`가 있으면 모바일 홈에서 카카오 JS SDK로 채널 대화 시작/채널 추가 버튼을 사용합니다.
- `NEXT_PUBLIC_KAKAO_CHANNEL_PUBLIC_ID`는 `pf.kakao.com` 링크와 SDK 브리지 호출에 같이 사용합니다.

## 로컬 실행

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

`.env.example`를 기준으로 `.env.local`을 만듭니다.

```bash
cp .env.example .env.local
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

### 3. Prisma Client 생성

```bash
npm run prisma:generate
```

### 4. 스키마 반영

```bash
npm run prisma:push
```

### 5. 개발 서버 실행

```bash
npm run dev
```

기본 주소:

- 홈: `http://127.0.0.1:3000`
- 등록: `http://127.0.0.1:3000/register`
- 샘플 상세: `http://127.0.0.1:3000/fortune/sample-user`
- 데모 공유: `http://127.0.0.1:3000/share/fortune/demo`

## 스크립트

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run test
npm run test:watch
npm run test:coverage
npm run prisma:generate
npm run prisma:push
npm run prisma:studio
```

## API

### `POST /api/profile`

사주 정보를 저장하거나 갱신합니다.

요청 body 예시:

```json
{
  "accessToken": "register token",
  "userId": "kakao-user-id",
  "name": "홍길동",
  "birthDate": "1995-10-21",
  "birthTime": "14:30",
  "calendarType": "solar"
}
```

응답:

- 저장된 프로필
- 상세 페이지 접근용 `fortuneAccessToken`

주의:

- `GET /api/profile`은 없습니다.
- 등록 토큰이 없거나 잘못되면 `401`입니다.

### `POST /api/kakao?key=...`

카카오 스킬 요청 진입점입니다.

대표 utterance:

- `정보 재등록`
- `오늘의 운세`
- `운세 질문`
- `친구에게 공유하기`

동작:

- 프로필이 없으면 등록 카드 반환
- 프로필이 있으면 운세 카드, 질문 카드, 공유 카드 반환
- `key` 쿼리값이 `KAKAO_SKILL_SHARED_SECRET`와 일치해야 합니다

## 테스트

Vitest 기반 테스트가 포함되어 있습니다.

- lib 도메인 로직 테스트
- 카카오 API 라우트/프레젠터 테스트
- 등록 API 테스트

실행:

```bash
npm run test
```

## 배포

권장 조합:

- Vercel
- Vercel Postgres 또는 Neon/Postgres

배포 순서:

1. 환경 변수 등록
2. `DATABASE_URL` 또는 `POSTGRES_PRISMA_URL` 확인
3. `npm run prisma:generate`
4. `npm run prisma:push` 또는 마이그레이션 적용
5. `npm run build`

## 운영 체크리스트

- `APP_SIGNING_SECRET` 설정 여부
- `KAKAO_SKILL_SHARED_SECRET` 설정 여부
- `NEXT_PUBLIC_KAKAO_JS_KEY` 설정 여부
- Kakao Developers JavaScript 키 허용 도메인에 실제 배포 도메인 등록 여부
- `NEXT_PUBLIC_KAKAO_CHANNEL_PUBLIC_ID`가 실제 채널 public id와 일치하는지 여부
- DB 연결 확인
- OpenAI API 키 설정 여부
- 카카오 스킬 endpoint와 query key 일치 여부
- 등록 링크와 상세 링크가 실제 도메인으로 생성되는지 확인

## 알려진 제약

- 공유 적립은 실제 공유 완료가 아니라 공유카드 생성 시점 기준입니다.
- `calendarType=unknown`은 참고용 blended reference이며 exact 해석이 아닙니다.
- 질문/서술은 런타임 환경에 따라 표현이 달라질 수 있습니다.

## 라이선스

별도 라이선스는 아직 명시되어 있지 않습니다.
