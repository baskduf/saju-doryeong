# Signal Fortune Refactor Review Checklist

이 문서는 `signal 기반 운세 개편` 구현을 다른 에이전트가 검토할 때 참고하는 리뷰 문서다.
목표는 `featuredInsight` 중심 구조를 제거하고, `analysis.signals` 기반의 동적 카드/질문 응답/공유 흐름으로 전환한 변경을 빠르게 검증하는 것이다.

## 1. 변경 목표

- 기존 구조
  - `score -> insights[] -> featuredInsight`
- 현재 구조
  - `evidence -> analysis.signals[] -> top 3 signals`
- 핵심 의도
  - 반복적인 고정 슬롯 출력 완화
  - `주의/caution` 상시 노출 축소
  - 공유, 질문 응답, 카카오 메타까지 같은 신호 모델 사용

## 2. 주요 구현 파일

- 운세 엔진
  - `lib/fortune.ts`
- 질문 응답
  - `lib/fortune-question.ts`
- 운세 LLM 내러티브
  - `lib/fortune-llm.ts`
- 공유 payload / 조회
  - `lib/fortune-share.ts`
  - `app/share/fortune/[id]/page.tsx`
- 상세 UI
  - `app/fortune/[id]/FortuneSections.tsx`
- 카카오 presenter
  - `app/api/kakao/_internal/presenters.ts`
- 테스트
  - `tests/lib/fortune-question.test.ts`
  - `tests/lib/fortune-unknown.test.ts`
  - `tests/lib/fortune-share.test.ts`
  - `tests/app/api/kakao/presenters.test.ts`
  - `tests/app/api/kakao/route.test.ts`

## 3. 구현 요약

### 3.1 `lib/fortune.ts`

- `DailyFortune.analysis.signals: FortuneSignal[]` 추가
- 제거 대상
  - `insights`
  - `featuredInsight`
- 추가 타입
  - `FortuneSignalKey`
  - `FortuneSignalTone`
  - `PublicFortuneSignal`
  - `FortuneSignal`
- 주요 함수
  - `buildFortuneSignals(...)`
  - `selectTopFortuneSignals(...)`
  - `attachFortuneSignals(...)`
  - `toPublicFortuneSignal(...)`
  - `shouldRenderSignalCaution(...)`
- 파생 규칙
  - `recommendedActions`는 상위 3개 신호의 `action` 중복 제거 결과
  - `avoidToday`는 `friction`, 약한 오행, branch pressure 기반 파생 결과
  - 카드의 `주의` 행은 `friction` 또는 `tone === "caution"` 일 때만 노출

### 3.2 `lib/fortune-question.ts`

- 질문 메타가 `primaryInsightKey/secondaryInsightKey`에서 `primarySignalKey/secondarySignalKey`로 변경됨
- 내부 선택 단위가 `selectedInsights`가 아니라 `selectedSignals`
- `caution` 채널은 기본 강제가 아님
- caution 채널이 붙는 조건
  - 질문 intent가 `caution`
  - 선택 신호 중 `friction` 포함
  - 선택 신호 중 `tone === "caution"` 이고 강도가 높은 경우

### 3.3 `lib/fortune-llm.ts`

- 내러티브 프롬프트에 `analysis.signals` 포함
- 경고 문구를 항상 강하게 쓰지 않도록 프롬프트 수정
- 상위 신호를 중심으로 문장 강조점을 잡도록 변경

### 3.4 UI / 공유 / 카카오

- 상세 페이지는 `featuredInsight` 카드 1개가 아니라 `topSignals` 기반 카드 렌더링
- 공유 payload는 `signals` 배열을 저장/전달
- 공유 페이지도 `signals` 기반 렌더링
- 카카오 presenter는 `SIGNAL_LABELS`를 사용해 질문 메타를 출력

### 3.5 신호기반 모델 원칙

- 이 모델의 목적은 명리 해석 엔진을 바꾸는 것이 아니라, `analysis.signals`를 공통 표현 계층으로 두어 UI / 질문 응답 / 공유 / 외부 소비처가 같은 언어로 결과를 다루게 하는 것이다.
- 해석의 기준 순서는 유지되어야 한다.
  - `원국/일진/용신·기신/지지 작용 -> score/category/analysis -> signals`
  - `signals -> 명리 해석` 순서로 역전되면 안 된다.
- `signal`은 서비스 친화적 추상화이므로, 반복적인 고정 슬롯을 줄이고 소비처별 표현을 통일하는 데는 유리하지만 명리학적 세부 맥락은 일부 압축될 수 있다.
- 따라서 `signal` 점수 임계값, 질문 topic-to-signal 매핑, caution 노출 규칙이 사주 기본 해석보다 더 강하게 결과를 좌우하지 않는지 계속 점검해야 한다.
- `summary`, `reasons`, `sources`, 상세 풀이 섹션은 신호가 어떤 근거에서 나왔는지 되짚을 수 있게 유지하는 편이 좋다.
- `unknown calendar` 같은 불확실 경로에서는 신호도 확정 판단이 아니라 참고용이라는 성격을 유지해야 한다.

## 4. 후속 수정 사항

초기 신호 개편 이후 리뷰에서 두 가지 문제가 발견되었고, 추가 수정이 들어갔다.

### 4.1 레거시 공유 링크 호환

- 문제
  - 이전 `featuredInsight` 기반 공유 payload는 새 코드에서 `signals`가 없어서 바로 `404`가 날 수 있었음
- 수정
  - `lib/fortune-share.ts`에 `normalizeFortuneSharePayload(...)` 추가
  - 레거시 `featuredInsight` payload를 읽어서 `signals` 형태로 복구
  - `app/share/fortune/[id]/page.tsx`는 `notFound()` 전에 이 정규화를 먼저 수행
- 리뷰 포인트
  - 30일 TTL 안의 기존 공유 URL이 계속 열리는지 확인
  - `featuredInsight` 참조는 정규화 레이어에서만 남아 있는지 확인

### 4.2 `주의` 행 과다 노출

- 문제
  - 이전 조건에 `score >= 65` 가 포함돼서 `push/steady` 카드도 `주의` 행이 자주 노출됐음
- 수정
  - 공용 helper `shouldRenderSignalCaution(...)`로 조건 통일
  - 현재 규칙은 아래 두 경우만 `true`
    - `signal.key === "friction"`
    - `signal.tone === "caution"`
- 영향 파일
  - `lib/fortune.ts`
  - `app/fortune/[id]/FortuneSections.tsx`
  - `app/share/fortune/[id]/page.tsx`

## 5. 리뷰 체크리스트

### 5.1 데이터 모델

- [ ] `DailyFortune` 타입에서 `featuredInsight` / `insights` 참조가 완전히 제거되었는지 확인
- [ ] `analysis.signals`가 exact/unknown calendar 양쪽 경로에서 항상 채워지는지 확인
- [ ] `selectTopFortuneSignals(...)` 규칙이 아래와 일치하는지 확인
- [ ] `timing.score < 60` 이면 메인 카드 후보에서 제외되는지 확인
- [ ] `friction.score < 55` 이면 메인 카드 후보에서 제외되는지 확인
- [ ] `momentum`과 `work`가 점수 차 `<= 8` 이고 tone이 같을 때 하나를 suppress 하는지 확인

### 5.2 행동/주의 파생

- [ ] `recommendedActions`가 독립 문구 생성 대신 상위 신호 `action` 파생인지 확인
- [ ] `avoidToday`가 `friction` 및 약한 오행 / branch pressure 기반 파생인지 확인
- [ ] 최종 `fortune.caution`이 `avoidToday[0]` 기반으로 내려오는지 확인
- [ ] 카드 `주의` 행이 `friction` 또는 `tone === "caution"`일 때만 보이는지 확인

### 5.3 질문 응답

- [ ] `FortuneQuestionDecisionBasis`가 signal key 기준인지 확인
- [ ] non-caution 질문에서 `oracleInfluence.channels`에 `caution`이 자동 포함되지 않는지 확인
- [ ] caution 질문 또는 `friction` 선택 시에만 경고 중심 응답으로 기울어지는지 확인
- [ ] fallback과 llm path 모두 동일한 signal metadata를 유지하는지 확인

### 5.4 UI / 공유

- [ ] 상세 페이지가 상위 3개 신호를 렌더링하는지 확인
- [ ] non-caution 카드에서 `주의` 행이 숨겨지는지 확인
- [ ] 공유 payload에 `signals`가 포함되는지 확인
- [ ] 기존 공유 snapshot이 `normalizeFortuneSharePayload(...)`를 통해 복구 가능한지 확인
- [ ] 공유 페이지가 레거시 payload에서도 `404` 없이 열리는지 확인

### 5.5 카카오 / 외부 소비처

- [ ] 카카오 질문 카드가 `판단 신호: ...` 형식으로 출력되는지 확인
- [ ] signal label 매핑이 `momentum/friction/timing/work/money/relationship/recovery` 모두 커버하는지 확인
- [ ] 레거시 `Insight` 키 이름이 외부 응답/테스트에 남아 있지 않은지 확인

## 6. grep 체크

아래 검색 결과는 비어 있어야 한다.

```powershell
rg -n "primaryInsightKey|secondaryInsightKey|DailyFortuneInsightKey|selectedInsights|insights\\b" lib app tests
```

아래 검색은 `lib/fortune-share.ts` 와 `tests/lib/fortune-share.test.ts` 에만 남아 있어야 한다.
이유는 레거시 공유 payload 복구 레이어를 유지하기 때문이다.

```powershell
rg -n "featuredInsight" lib app tests
```

기대 위치:

- `lib/fortune-share.ts`
- `tests/lib/fortune-share.test.ts`

## 7. 검증 명령

### 7.1 타입체크

```powershell
npx.cmd tsc --noEmit
```

### 7.2 핵심 회귀 테스트

```powershell
npm.cmd test -- tests/lib/fortune-question.test.ts tests/lib/fortune-unknown.test.ts tests/lib/fortune-share.test.ts tests/app/api/kakao/presenters.test.ts tests/app/api/kakao/route.test.ts
```

## 8. 현재 검증 결과

- `npx.cmd tsc --noEmit` 통과
- 아래 테스트 묶음 `28/28` 통과

```powershell
npm.cmd test -- tests/lib/fortune-question.test.ts tests/lib/fortune-unknown.test.ts tests/lib/fortune-share.test.ts tests/app/api/kakao/presenters.test.ts tests/app/api/kakao/route.test.ts
```

## 9. 리뷰 시 특히 볼 부분

- `lib/fortune.ts`에서 score 기반 로직과 signal 파생 로직이 충돌하지 않는지
- `unknown calendar` 경로에서도 signal summary/reasons 문구가 reference 성격을 유지하는지
- `app/fortune/[id]/FortuneSections.tsx`에서 UI만 바뀌고 해석 근거 섹션은 회귀가 없는지
- `lib/fortune-question.ts`에서 signal 선택 기준이 질문 topic/intent와 자연스럽게 맞는지
- `lib/fortune-llm.ts` 프롬프트가 다시 과도한 경고 톤으로 돌아가게 만들 여지가 없는지
- `lib/fortune-share.ts`의 레거시 정규화가 너무 넓어서 잘못된 payload까지 통과시키지 않는지
- `analysis.signals`가 명리 해석의 공통 표현 레이어로만 머무르고, 임계값/매핑 휴리스틱이 사주 기본 해석을 사실상 대체하지 않는지

## 10. 리뷰 후 남길 코멘트 포맷 권장

- 문제 없음 / 우려 있음 여부
- 파일 경로 + 라인 기준 근거
- 재현 조건
- 실제 영향
- 수정 권장안
