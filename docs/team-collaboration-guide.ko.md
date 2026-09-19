# Team11 작업 분담 지침서

이 문서는 세 명이 동시에 작업할 때 Git merge 충돌을 줄이기 위한 소유권과 인터페이스 규칙입니다.
작업 전 `README.ko.md`와 `HACKATHON.ko.md`를 먼저 읽고, DB 변경은 새 migration으로만 추가합니다.

## 역할

| 역할                | 책임                                                                 | 주 작업 폴더                                                                     |
| ------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 학교 공지 수집 담당 | 학교 공지 게시판 크롤링, 공통 Notice 정규화, D1 저장, 전체 공지 제공 | `server/src/features/school-notices/`, `packages/shared/src/school-notices.ts`   |
| 나의 추천 공지 담당 | `Notice[]`를 받아 사용자 프로필/GPT/필터링으로 개인화 공지 제공      | `server/src/features/recommendations/`, `packages/shared/src/recommendations.ts` |
| 메일 연동 담당      | 메일 계정 연결, 메일 목록/본문 조회, 메일 데이터를 다른 기능에 전달  | `server/src/features/mail/`, `packages/shared/src/mail.ts`                       |

## 공통 계약

역할 간 데이터는 `packages/shared/src/*.ts`의 Zod schema와 TypeScript type으로만 주고받습니다.
다른 담당자의 내부 구현 파일을 import하지 말고, public Function 또는 shared type을 사용합니다.

### 공지 수집 담당이 제공하는 데이터

```ts
export const NoticeSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  url: z.string(),
  postedAt: z.string(),
  source: z.string(),
  department: z.string(),
  createdAt: z.string(),
  relevant: z.boolean().optional(),
  category: z.string().nullable().optional(),
  reason: z.string().nullable().optional(),
});

export type Notice = z.infer<typeof NoticeSchema>;
```

추천 담당자는 크롤러 내부를 보지 않고 `schoolNotice.listNotices` 결과의 `notices: Notice[]`부터 사용합니다.

## 담당자별 수정 가능 영역

### 학교 공지 수집 담당

수정 가능:

- `server/src/features/school-notices/**`
- `server/src/notice-crawler.ts`, `server/src/school-notice.store.ts`, `server/src/school-notice-sync.ts`는 re-export wrapper만 유지
- `packages/shared/src/school-notices.ts`
- 공지 저장 스키마가 필요할 때 새 파일로 `cloudflare/migrations/000X_*.sql`
- 수집 계층 테스트: `server/src/*school-notice*.test.ts`

수정 금지 또는 사전 합의 필요:

- `server/src/features/recommendations/**`
- `server/src/features/mail/**`
- `packages/shared/src/recommendations.ts`
- `packages/shared/src/mail.ts`
- `cloudflare/worker.mjs`, `server/src/app.module.ts`의 auth/signature 관련 코드

새 게시판 추가 방법:

1. `server/src/features/school-notices/notice-crawler.ts`에 게시판별 `NoticeSourceAdapter`를 추가합니다.
2. `schoolNoticeAdapters` 배열에 adapter를 추가합니다.
3. `corepack pnpm test`로 URL 중복 upsert가 유지되는지 확인합니다.

### 나의 추천 공지 담당

수정 가능:

- `server/src/features/recommendations/**`
- `packages/shared/src/recommendations.ts`
- 개인화 WAM UI가 필요하면 `wam/src/pages/Send/Send.tsx`의 개인화 섹션만 최소 수정

수정 금지 또는 사전 합의 필요:

- `server/src/features/school-notices/**`
- `packages/shared/src/school-notices.ts`의 `NoticeSchema`
- `notices` 테이블 schema
- 공지 crawler selector, URL, upsert 로직

사용해야 하는 입력:

```ts
const result = await listNotices({});
const notices = result.notices;
```

추천 로직은 `notices: Notice[]`를 받은 뒤 별도 분석 결과를 붙입니다. 크롤러가 추천 여부를 판단하게 만들지 않습니다.

### 메일 연동 담당

수정 가능:

- `server/src/features/mail/**`
- `packages/shared/src/mail.ts`
- 메일 전용 Function 파일을 새로 만들 경우 `server/src/mail.functions.ts`
- 메일 계정 저장이 필요하면 새 migration 추가

수정 금지 또는 사전 합의 필요:

- `server/src/features/school-notices/**`
- `server/src/features/recommendations/**`
- 기존 `schoolNotice.*` Function 이름 변경
- production signature/auth 우회

## 모두가 조심해야 하는 파일

아래 파일은 충돌 가능성이 높으므로 PR 전에 팀 채팅에 변경 의도를 공유합니다.

- `packages/shared/src/index.ts`
- `server/src/app.module.ts`
- `server/src/school-notice.functions.ts`
- `wam/src/pages/Send/Send.tsx`
- `cloudflare/worker.mjs`
- `cloudflare/migrations/**`
- `wrangler.jsonc`, `package.json`, `pnpm-lock.yaml`

## 브랜치 규칙

브랜치 이름은 역할 prefix를 붙입니다.

- `crawler/...`
- `recommend/...`
- `mail/...`
- `shared/...`는 반드시 사전 합의 후 사용

## PR 체크리스트

- 내 담당 폴더 밖 변경이 있으면 PR 설명에 이유를 적었습니다.
- shared schema 변경이 있으면 다른 담당자에게 호출 예시를 남겼습니다.
- DB 변경은 기존 migration 수정이 아니라 새 migration으로 추가했습니다.
- 아래 검증을 가능한 범위에서 실행했습니다.

```sh
corepack pnpm typecheck
corepack pnpm test
corepack pnpm lint
corepack pnpm build:cloudflare
```

## 충돌을 줄이는 원칙

- 다른 담당자의 feature 폴더 내부 구현을 직접 import하지 않습니다.
- 기능 연결은 shared schema와 Channel Function 이름을 통해 합니다.
- facade 파일은 얇게 유지하고 비즈니스 로직을 넣지 않습니다.
- 하나의 PR에서 여러 역할의 기능을 동시에 수정하지 않습니다.
- WAM 화면은 당분간 하나의 파일이므로, UI 변경 전에 담당 섹션을 팀 채팅에 알립니다.
