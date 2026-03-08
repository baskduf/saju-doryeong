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

## 9) 2026-03-08 최신 진행 내역 (현재 기준)

- 저장소/배포 상태:
  - 로컬은 Git 저장소로 초기화되어 있음.
  - 원격 `origin`은 `https://github.com/baskduf/saju-doryeong`에 연결되어 있음.
  - 최근 커밋이 `main`에 push된 상태.

- Vercel:
  - `saju-doryeong` 프로젝트를 CLI로 재연결 후 프로덕션 재배포 완료.
  - 프로덕션 도메인 alias:
    - `https://saju-doryeong.vercel.app`
  - 환경변수 재설정 완료(Production/Preview/Development):
    - `DATABASE_URL`
    - `DATABASE_URL_UNPOOLED`
    - `POSTGRES_PRISMA_URL`
    - `NEXT_PUBLIC_APP_URL`

- API 실검증(프로덕션):
  - `GET /api/profile?userId=kakao-test-1` → `404` (DB 연결 정상, 데이터 미존재)
  - `POST /api/profile`로 테스트 유저 생성 가능 확인
  - `POST /api/kakao` 응답 정상 확인(BasicCard + 상세 링크)

- 카카오 테스트 payload 연동:
  - 사용자가 전달한 payload에서 `userRequest.user.id = "465203"` 확인.
  - `userId: 465203` 프로필 등록 완료.
  - 동일 payload로 `/api/kakao` 재호출 시 운세 카드 정상 반환 확인.
  - 상세 링크 예시:
    - `https://saju-doryeong.vercel.app/fortune/465203`

- 코드/동작 관련 참고:
  - `lib/prisma.ts`는 `DATABASE_URL`이 없고 `POSTGRES_PRISMA_URL`이 있으면 fallback 매핑하도록 보강돼 있음.
  - `/api/profile`는 GET 조회/POST upsert 구현 완료.
  - `/api/kakao`는 프로필 미등록 시 안내 카드, 등록 시 운세 카드 반환.

- 현재 로컬 워크트리 주의사항:
  - `.gitignore`가 `vercel link` 과정에서 수정됨 (`.vercel` 관련 항목 추가).
  - 민감정보가 포함된 임시 env pull 파일(`.env.vercel.production`)은 정리 완료.

- 즉시 다음 작업(운영 전):
  1. 카카오 관리자센터에서 해당 블록 저장/배포(개발 채널 → 운영 채널) 완료 확인
  2. 실제 사용자별 사주 데이터 등록 플로우 설계
     - 현재는 `/api/profile` 직접 호출로 등록
  3. 임시 등록된 테스트 사용자 데이터(`465203`, `kakao-test-1`)를 운영 정책에 맞게 정리
  4. 보안상 DB 자격증명(노출된 값) 회전 권장

## 10) 2026-03-08 추가 진행 내역 (카카오 등록 플로우 구현/배포)

- 기능 구현:
  - 카카오 대화형 등록 플로우 구현 완료.
  - `/api/kakao`에서 아래 3가지 분기 처리:
    1. 프로필 없음 + 등록 파라미터 없음: 등록 유도 카드 반환
    2. 프로필 없음 + 등록 파라미터 있음: 프로필 저장 후 즉시 운세 카드 반환
    3. 프로필 있음: 기존처럼 즉시 운세 카드 반환
  - 카카오 파라미터 추출 대상:
    - `action.params`
    - `action.detailParams`
    - `userRequest.params`
  - 지원 파라미터 키:
    - `birthDate`, `birthTime`, `calendarType`, `name`

- 공통 유틸 분리:
  - 신규 파일: `/lib/profile.ts`
  - 포함 내용:
    - 프로필 검증 파서(`birthDate`, `birthTime`, `calendarType`)
    - DB URL 존재 확인
    - 프로필 조회/업서트 공통 함수
    - 초기 `sajuData` 생성(`kakao-onboarding-v1`, 오행 비율 생성)
  - `/app/api/profile/route.ts`는 공통 유틸을 사용하도록 리팩터링.

- 오류 처리 보강:
  - `/api/kakao`, `/api/profile`에 DB 오류 503 처리 추가:
    - 연결 오류(`P1001`)
    - 테이블 미생성(`P2021`)
  - 사용자에게 일반 500 대신 서비스 준비/일시 오류 안내 메시지 반환.

- DB/스키마 운영 반영:
  - 기존 `public` 스키마 데이터 손실 위험을 피하기 위해 DB URL을 스키마 분리:
    - `schema=saju_doryeong` 적용
    - 대상: `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `POSTGRES_PRISMA_URL`
  - `npm run prisma:push` 성공:
    - datasource: PostgreSQL `schema "saju_doryeong"`

- Vercel 반영:
  - 환경변수(Production/Preview/Development) 3종 DB URL 모두 `schema=saju_doryeong` 적용 완료.
  - 배포 차단 이슈 확인:
    - 에러: `COMMIT_AUTHOR_REQUIRED` / "no git user associated with the commit"
    - 원인: 기존 커밋 작성자 이메일 `wb@MacBook-Air.local` 미매핑
  - 해결:
    - 작성자 이메일이 Vercel 계정과 매핑되는 빈 커밋 생성
      - 커밋: `3f99105 chore: deploy trigger for vercel author check`
    - 이후 프로덕션 배포 성공 및 alias 반영:
      - `https://saju-doryeong.vercel.app`

- 프로덕션 E2E 검증:
  - 미등록 호출:
    - 등록 유도 카드 + `사주 등록` quick reply 확인
  - 등록 파라미터 호출:
    - 저장 즉시 운세 카드 반환 확인
  - 재호출:
    - 등록 단계 없이 즉시 운세 카드 반환 확인
  - 입력 오류 호출:
    - 유효성 오류 안내 카드 반환 확인
  - 상세 링크:
    - `webLinkUrl`이 실제 도메인(`https://saju-doryeong.vercel.app/fortune/{userId}`)으로 생성됨 확인

- 테스트 데이터 정리:
  - 삭제 완료 userId:
    - `kakao-flow-20260308`
    - `kakao-flow-20260308-b`
    - `prod-onboard-20260308-z`
  - 확인 결과: `remaining=0`

- Git 상태:
  - 기능 커밋 완료:
    - `6726e3a feat: add kakao onboarding profile registration flow`
  - 원격 반영:
    - `origin/main` push 완료
  - 참고:
    - 로컬에 여전히 별도 변경 파일 존재(`.gitignore`, `HANDOFF.md`)

- 카카오 관리자센터 등록 시 체크포인트:
  1. 스킬 서버 URL: `https://saju-doryeong.vercel.app/api/kakao`
  2. 등록 블록 파라미터 키: `birthDate`, `birthTime`, `calendarType`, `name`
  3. 블록 저장/배포 후 실제 채널에서 미등록→등록→재호출 순으로 검증
