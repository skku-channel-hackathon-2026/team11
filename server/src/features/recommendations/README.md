# 추천 공지 담당 구현

이 폴더와 `packages/shared/src/recommendations.ts`만 변경합니다.
기존 Function 이름, 수집 코드, 공용 라우팅/인증, DB 스키마, package.json은 변경하지 않습니다.

## 실행

기존 Node.js 24 / pnpm workspace 환경을 사용합니다. 추가 패키지는 없습니다.

```bash
# 저장소 루트
corepack pnpm --filter @tutorial/shared build
# OPENAI_API_KEY는 환경변수 또는 기존 server/.env에 설정
corepack pnpm --filter @tutorial/server exec tsx src/features/recommendations/main.ts
```

키를 코드/문서에 붙여 넣지 마세요. 이 구현은 키 파일을 생성하지 않습니다.
`OPENAI_MODEL` 기본값은 `gpt-4o-mini`, `PORT` 기본값은 3000입니다.
키 없이도 health check와 입력 검증은 동작하며, 분석은 500을 반환합니다.
분석 전용 서버는 Channel 인증 정보나 DB 없이 실행됩니다.

```bash
curl http://localhost:3000/
# {"status":"ok"}
curl -i http://localhost:3000/analyze-notice \
  -H 'Content-Type: application/json' \
  -d '{"student":{"grade":1,"major":"소프트웨어학과","interests":["장학금","교환학생"],"status":["신입생","학부생"]},"notice":{"title":"신입생 장학금 신청 안내","content":"소프트웨어학과 1학년 신입생을 대상으로 장학금 신청을 받습니다.","url":"https://example.com"}}'
```

```json
{
  "relevant": true,
  "reason": "소프트웨어학과 1학년 신입생으로 신청 대상에 해당합니다.",
  "summary": "소프트웨어학과 1학년 신입생 대상 장학금 신청 안내입니다.",
  "category": "SCHOLARSHIP"
}
```

위 학생을 경영학과 3학년으로 바꾸면 관심사가 같아도 false가 예상됩니다. 설명 문구는 모델에 따라 달라집니다.
`student`, `notice` 또는 내부 필수 필드 누락/잘못된 형식은 400 JSON입니다.
학년은 양의 정수, 학과/제목/본문은 비어 있지 않은 문자열, 관심사/신분은 문자열 배열(빈 배열 가능)입니다.
`notice.url`과 출처 부서 `notice.department`는 선택 문자열입니다. URL은 방문하지 않습니다.
잘못된 JSON은 400, 100KB 초과는 413, OpenAI 오류/거절/미완료/형식 오류는 500 JSON입니다.
호출 타임아웃은 30초이며, 실패를 키워드 추천이나 false 결과로 숨기지 않습니다.

```bash
curl -i http://localhost:3000/analyze-notice -H 'Content-Type: application/json' -d '{}'
```

## 기존 기능과의 연결

`schoolNotice.listPersonalizedNotices` → 기존 root facade → `NoticeRecommendationService` →
수집 public facade의 `{ notices: Notice[] }` → `recommendNotices(student, notices)` 순서입니다.
다른 담당자의 feature 내부 파일/NoticeRow를 직접 import하지 않습니다.
프로필의 `department`는 학생의 `major`로 변환합니다.
DB에서 불러오는 기존 프로필에는 신분 필드가 없으므로 `status: []`를 전달합니다.
1학년을 신입생으로 추정하지 않으며, 필수 신분이 확인되지 않으면 false가 될 수 있습니다.
직접 API 또는 아래 함수에는 알려진 신분을 전달할 수 있습니다.

```ts
import { recommendNotices } from "./notice-recommendation.service.js";
// 수집 Function의 공통 계약 Notice[]를 그대로 전달
const result = await recommendNotices(
  {
    grade: 1,
    major: "소프트웨어학과",
    interests: ["장학금"],
    status: ["신입생", "학부생"],
  },
  notices,
);
```

원본 공지를 수정하지 않고 관련 공지만 반환합니다. GPT가 정한 category/reason과 summary를 붙입니다.
기존 키워드 캐시는 사용하지 않으며 매 조회마다 공지별 OpenAI 호출이 발생합니다.
기존 DB 스키마·프로필 저장 형식은 유지합니다.

**담당 경계에 따른 제한:** 독립 서버의 `/analyze-notice`는 완전한 4개 필드를 반환합니다.
기존 Channel Function의 공용 OutputSchema에는 summary가 없어 직렬화 과정에서 제거될 수 있습니다.
추천 함수는 summary를 반환하지만 공용 `school-notice.functions.ts`/수집 `NoticeSchema`는 수정하지 않았습니다.
또한 공용 서버/Cloudflare 라우터에 새 REST 경로는 등록하지 않았습니다. 기존 맞춤 공지 Function은 즉시 새 분석기를 사용합니다.

## 판단 규칙

명시적 학과·학년·신분 조건과 AND/OR/제외 조건을 관심사보다 우선합니다.
불일치/필수 정보 미확인은 false입니다. 전체 학생 학사 안내 또는 대상 조건이 맞는 직접 안내는 true입니다.
선택적 기회는 전공/관심사와 연결되는지 판단합니다. 게시 부서를 대상 제한으로 추정하지 않습니다.
공지 안의 지시를 실행하지 않고 공지에 없는 사실을 만들지 않도록 프롬프트에 명시했습니다.

category는 ACADEMIC, SCHOLARSHIP, EVENT, CAREER, EXCHANGE, CLUB, OTHER 중 하나입니다.
[OpenAI 공식 Structured Outputs 문서](https://developers.openai.com/api/docs/guides/structured-outputs)에 따라
Responses API의 strict JSON Schema와 Zod 응답 검증을 사용합니다. 스키마 준수는 의미적 정확성을 보장하지 않습니다.

## 테스트

기존 test 스크립트는 루트 테스트만 찾으므로 담당 폴더의 테스트를 명시적으로 실행합니다.

```bash
corepack pnpm --filter @tutorial/shared build
corepack pnpm --filter @tutorial/server exec tsx --test 'src/features/recommendations/*.test.ts'
```

테스트는 가짜 OpenAI 응답으로 API 계약·오류·추천 연동을 검증합니다. 실제 모델 평가는 유효한 키로 curl을 실행하세요.
