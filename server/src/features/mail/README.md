# Mail Feature Ownership

메일 계정 연동과 메일 내용 조회 담당자는 이 폴더를 기본 작업 영역으로 사용합니다.

## 담당 범위

- 메일 계정 연결/해제 및 연결 상태 조회
- 여러 메일 계정을 하나의 통합 수신함으로 묶어 메시지 조회
- OAuth 또는 외부 메일 API 연동(현재는 mock 제공자)
- 메일 데이터를 WAM 또는 GPT 추천 계층에 전달하는 서버 함수

## 현재 구현 (통합 수신함)

여러 메일 계정을 연결한 뒤, 연결된 모든 계정의 메시지를 최신순으로 **하나로 묶어** 돌려줍니다.

| 파일                                                       | 역할                                                                   |
| ---------------------------------------------------------- | ---------------------------------------------------------------------- |
| `mail.store.ts`                                            | D1 `mail_accounts` 테이블 접근(계정 목록/추가/삭제, 이메일 중복 방지)  |
| `mail.provider.ts`                                         | 메시지 제공자 추상화 + 외부 연동 없이 동작하는 `MockMailProvider`      |
| `providers/gmail.provider.ts`                              | 실제 Gmail 연동 어댑터 골격(OAuth 토큰 resolver 주입, Gmail REST 매핑) |
| `mail.service.ts`                                          | 계정 연결/해제/조회, 계정별 메시지를 통합·정렬하는 핵심 로직           |
| `../../mail.functions.ts`                                  | 위 서비스를 노출하는 Channel App Function                              |
| `../../../../cloudflare/migrations/0004_mail_accounts.sql` | `mail_accounts` 스키마                                                 |
| `../../../../wam/src/pages/Mail/Mail.tsx`                  | 메일 계정 추가·연결 목록·통합 수신함 WAM 화면 (App.tsx의 '메일' 탭)    |

Function 이름은 `packages/shared/src/mail.ts`의 `MAIL_FUNCTIONS`에 정의되어 있습니다.

- `mail.getConnectionStatus` → `{ connected, email, accountCount }`
- `mail.listAccounts` → `{ accounts: MailAccount[] }`
- `mail.connectAccount` (`{ provider, email, displayName? }`) → `MailAccount`
- `mail.disconnectAccount` (`{ accountId }`) → `{ disconnected }`
- `mail.listMessages` (`{ accountId? }`) → `{ messages: MailMessage[] }` (accountId 없으면 전체 통합)

### 다른 담당자용 호출 예시 (WAM / 추천)

```ts
// 계정 연결
await connectAccount({ provider: "gmail", email: "me@gmail.com" });
// 통합 수신함 조회 (모든 계정 최신순)
const { messages } = await listMessages({});
// 특정 계정만
const one = await listMessages({ accountId });
```

`MailMessage`에는 출처 계정 정보(`accountId`, `accountEmail`, `provider`)가 포함되어 통합 목록에서 어느 계정 메일인지 구분할 수 있습니다.

## 제공자(mock) → 실제 연동 전환

`MockMailProvider`는 외부 자격 증명 없이 흐름을 검증하기 위한 것입니다. 실제 배포에서는
`MailProviderAdapter`를 구현한 Gmail/Outlook 어댑터를 만들고 `MailService.useProvider(...)`로 교체합니다.
채널톡 네이티브 방식으로 수신함에 직접 태우려면 별도 Messaging Extension(`@Extension("messaging")`의
`inbox.onMediumMessageCreated` 등)이 필요하며, 이는 medium 제품 설정과 운영진 등록이 함께 있어야 합니다.

## 공유 계약 위치

- 메일 관련 shared schema는 `packages/shared/src/mail.ts`에 추가합니다.
- Channel App Function은 `server/src/mail.functions.ts`에 두고 `server/src/app.module.ts`에는 provider 추가만 최소로 반영합니다.

## 건드리지 않는 영역

- 학교 공지 크롤러: `server/src/features/school-notices/`
- 공지 추천/GPT 분석: `server/src/features/recommendations/`
- 기존 Channel signature/auth 흐름: `server/src/app.module.ts`, `cloudflare/worker.mjs`
