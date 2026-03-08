# Handoff for Next Agent

## 1) 현재 상태 요약

- 요청 명세(운세도령 Next.js + Kakao Skill API + 상세 웹뷰) 기준으로 초기 구현 완료.
- 워크스페이스는 Git 저장소가 아님 (`git status` 불가).
- 코드 파일은 생성되어 있으나, 의존성 설치/실행 검증은 미완료.

## 2) 구현 완료 항목

- Kakao OpenBuilder 스킬 API:
  - `POST /api/kakao` 처리
  - `userRequest.user.id` 중심 userId 추출
  - Prisma로 `sajuProfile` 조회
  - 운세 점수 기반 메시지 분기(도령 말투)
  - `BasicCard` + `webLinkUrl` 버튼 응답
  - 파일: `/app/api/kakao/route.ts`

- 운세 도메인 로직:
  - 오행 추출/정규화
  - score/grade 산출
  - 메시지/추천행동 생성
  - 파일: `/lib/fortune.ts`

- Prisma 연동:
  - PrismaClient singleton 유틸
  - `SajuProfile` 모델 스키마
  - 파일: `/lib/prisma.ts`, `/prisma/schema.prisma`

- 상세 웹뷰:
  - `/fortune/[id]` 페이지
  - 오행 바 차트(Recharts)
  - 한지풍 배경 + 도령 캐릭터(간단 CSS 애니메이션)
  - 파일: `/app/fortune/[id]/page.tsx`, `/app/fortune/[id]/FiveElementsChart.tsx`

- 프로젝트 부트스트랩 파일:
  - `/package.json`, `/tsconfig.json`, `/next.config.mjs`, `/next-env.d.ts`
  - `/app/layout.tsx`, `/app/page.tsx`, `/app/not-found.tsx`, `/app/globals.css`
  - `/.env.example`, `/.eslintrc.json`, `/README.md`

## 3) 주요 의사결정/가정

- DB는 Prisma + PostgreSQL 가정.
- 카카오 userId는 여러 후보 필드에서 순차 탐색:
  - `userRequest.user.id`
  - `userRequest.user.properties.appUserId`
  - `plusfriendUserKey`, `botUserKey`
- 상세 링크 base URL:
  - `NEXT_PUBLIC_APP_URL` 우선 사용
  - 미설정 시 `https://your-domain.com`
- import는 alias 의존을 줄이기 위해 상대 경로 기반으로 작성됨.

## 4) 미완료/검증 필요 항목 (우선순위 순)

1. 의존성 설치 및 빌드/런타임 검증
   - `npm install`
   - `npm run prisma:generate`
   - `npm run build`
   - `npm run dev`

2. 실제 카카오 요청 페이로드로 API 응답 검증
   - `POST /api/kakao`에 샘플 payload 전송
   - BasicCard 필드/버튼 렌더 확인

3. DB 시드/등록 경로 부재
   - 현재 `sajuProfile` 생성 API 없음
   - 테스트용 레코드를 DB에 수동 insert 하거나 `/api/profile` 추가 필요

4. Lottie 미적용
   - 명세의 "Lottie 활용 가능"은 현재 CSS 애니메이션으로 대체됨
   - 필요 시 `lottie-react` 도입하여 캐릭터 교체

## 5) 알려진 이슈/주의사항

- `npm install` 시도 결과:
  - 세션이 장시간 진행되었고 출력 확인 불가 상태였음
  - 실제 설치 성공 여부 불명확 (현재 `node_modules` 없음)
- zsh에서 대괄호 경로는 반드시 quote 필요:
  - 예: `cat 'app/fortune/[id]/page.tsx'`
- 타입/린트/빌드 결과는 아직 확인되지 않음.

## 6) 다음 에이전트 권장 작업 순서

1. 설치/실행 환경 정상화
   - `npm install` 재시도
   - 실패 시 네트워크/레지스트리 접근 확인

2. Prisma 준비
   - `.env.local`에 `DATABASE_URL`, `NEXT_PUBLIC_APP_URL` 설정
   - `npm run prisma:generate && npm run prisma:push`
   - 테스트 데이터 1건 삽입 (`userId`, `birthDate`, `sajuData`)

3. API/페이지 E2E 점검
   - `/api/kakao` 응답 JSON 검증
   - `/fortune/[userId]` 렌더 확인

4. 필요 시 기능 보강
   - `/api/profile` 추가 (등록/수정)
   - Lottie 애니메이션 적용
   - 카카오 payload 스키마 타입 정교화

## 7) 파일 인덱스

- `/app/api/kakao/route.ts`
- `/app/api/profile/route.ts`
- `/app/fortune/[id]/page.tsx`
- `/app/fortune/[id]/page.module.css`
- `/app/fortune/[id]/FiveElementsChart.tsx`
- `/lib/fortune.ts`
- `/lib/prisma.ts`
- `/prisma/schema.prisma`
- `/app/layout.tsx`
- `/app/page.tsx`
- `/app/not-found.tsx`
- `/app/globals.css`
- `/package.json`
- `/tsconfig.json`
- `/next.config.mjs`
- `/next-env.d.ts`
- `/.env.example`
- `/.eslintrc.json`
- `/README.md`

## 8) 2026-03-08 추가 진행 내역

- 설치/검증:
  - `npm install` 완료 (초기 샌드박스에서는 네트워크 `ENOTFOUND`, 권한 확장 후 해결)
  - `npm run prisma:generate` 성공
  - `npm run lint` 성공
  - `npm run build` 성공

- 빌드 이슈 해결:
  - `app/fortune/[id]/page.tsx`의 `styled-jsx` 제거 후 CSS Module 분리
    - 추가 파일: `/app/fortune/[id]/page.module.css`
  - `next/font/google`로 인한 오프라인 빌드 실패 해결
    - `/app/layout.tsx`에서 Google font import 제거
    - `/app/globals.css`를 폴백 폰트 스택으로 조정

- API 보강:
  - `/api/profile` 신규 추가 (GET 조회, POST upsert)
  - `/api/kakao`에 `DATABASE_URL` 미설정 시 503 + 안내 카드 반환 추가

- 런타임 검증 결과:
  - `POST /api/kakao` (userId 누락): 200 + 식별값 누락 안내 카드
  - `POST /api/kakao` (userId 포함, DB 미설정): 503 + DB 연결 준비 안내 카드
  - `POST /api/profile` (DB 미설정): 503 + `DATABASE_URL` 미설정 메시지

- 남은 작업:
  1. `.env.local` 생성 후 `DATABASE_URL`, `NEXT_PUBLIC_APP_URL` 실제값 설정
  2. `npm run prisma:push`
  3. `/api/profile`로 테스트 계정 1건 등록
  4. `POST /api/kakao`에서 프로필 존재 시 BasicCard + 상세 링크 정상 응답 확인
