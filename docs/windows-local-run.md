# Windows Local Run Notes

이 문서는 Windows 환경에서 이 프로젝트를 로컬 실행/검증할 때 실제로 발생한 이슈와 해결 방법을 기록한다.

## 1. PowerShell에서 `npm`이 바로 실행되지 않음

- 증상:
  - `npm run lint`
  - `npm run build`
  - `npm install`
  - 위 명령이 `npm.ps1 파일을 로드할 수 없습니다`로 실패할 수 있음.
- 원인:
  - PowerShell Execution Policy 때문에 `npm.ps1` 실행이 차단됨.
- 해결:
  - PowerShell에서는 `npm ...` 대신 `cmd /c npm ...`로 실행.
- 예시:

```powershell
cmd /c npm install
cmd /c npm run lint
cmd /c npm run build
```

## 2. `npm install` 중 `Exit handler never called!`

- 증상:
  - `cmd /c npm install` 실행 중 npm이 `Exit handler never called!`로 종료될 수 있음.
  - 로그에 `EACCES`가 섞여 있으면 네트워크/샌드박스 제한 가능성이 높음.
- 확인 로그:
  - `.npm-cache/_logs/...-debug-0.log`
- 해결:
  - 네트워크 제한이 있는 환경에서는 권한 상승 후 재시도.
  - 로컬 캐시 경로를 프로젝트 내부로 강제하면 로그 확인이 쉬움.
- 권장 명령:

```powershell
cmd /c npm install --cache .npm-cache --no-audit --no-fund
```

- 참고:
  - 이 프로젝트에서는 위 명령을 권한 상승 후 다시 실행했을 때 정상 설치됨.

## 3. `prisma generate`가 엔진 다운로드에서 실패함

- 증상:
  - `npm run prisma:generate` 실행 시 Prisma engine 다운로드 실패.
- 원인:
  - Prisma가 `binaries.prisma.sh`에서 엔진 바이너리를 받아야 함.
- 해결:
  - 네트워크 접근 가능한 환경에서 실행.
  - 검증용으로는 임시 `DATABASE_URL`을 주입해도 generate 자체는 가능.
- 예시:

```powershell
cmd /c "set DATABASE_URL=postgresql://user:pass@localhost:5432/db?schema=public&& npm run prisma:generate"
```

## 4. `next build`가 `spawn EPERM`으로 실패함

- 증상:
  - `npm run build` 실행 시 `Error: spawn EPERM`
- 원인:
  - Next.js build가 worker process를 spawn하는데, 제한된 실행 환경에서는 차단될 수 있음.
- 해결:
  - 제한이 없는 로컬 셸에서 실행하거나 권한 상승 후 실행.
- 예시:

```powershell
cmd /c "set DATABASE_URL=postgresql://user:pass@localhost:5432/db?schema=public&& set NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000&& npm run build"
```

## 5. 포트 충돌 (`EADDRINUSE`)

- 증상:
  - `npm run dev -- --hostname 127.0.0.1 --port 3000`
  - 또는 다른 포트에서 `listen EADDRINUSE`
- 원인:
  - 이미 다른 Next.js dev server 또는 다른 프로세스가 해당 포트를 사용 중임.
- 해결:
  - 기존 서버가 이미 떠 있으면 새로 띄우지 말고 그대로 사용.
  - 꼭 새로 띄워야 하면 포트를 바꿔서 실행.
- 예시:

```powershell
cmd /c "set NEXT_PUBLIC_APP_URL=http://127.0.0.1:3210&& npm run dev -- --hostname 127.0.0.1 --port 3210"
```

## 6. DB 없이 확인 가능한 로컬 경로

- 홈: `http://127.0.0.1:3000/`
- 샘플 상세: `http://127.0.0.1:3000/fortune/sample-user`

참고:
- `/fortune/sample-user`는 DB가 없어도 확인 가능하도록 샘플 프로필을 사용함.
- 실제 `/api/profile`, `/api/kakao`, `/fortune/{realUserId}` 검증에는 `.env.local`의 실제 DB 설정이 필요함.

## 7. 실제 검증 순서

1. PowerShell이면 `cmd /c npm ...` 형식 사용
2. 의존성 설치
3. `prisma generate`
4. `npm run lint`
5. `npm run build`
6. 이미 떠 있는 dev server가 있으면 그 서버 사용
7. 우선 `/fortune/sample-user`로 UI 확인
8. 이후 실제 `.env.local`을 넣고 DB/API 검증

## 8. 권장 `.env.local`

최소 필요 값:

```env
DATABASE_URL="postgresql://..."
NEXT_PUBLIC_APP_URL="http://127.0.0.1:3000"
```

Vercel Postgres를 그대로 쓰는 경우:

```env
POSTGRES_PRISMA_URL="postgresql://..."
DATABASE_URL="postgresql://..."
NEXT_PUBLIC_APP_URL="http://127.0.0.1:3000"
```
