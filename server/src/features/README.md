# Server Feature Layout

서버 기능은 담당자별 충돌을 줄이기 위해 `features` 아래에 둡니다.

| 폴더 | 담당 |
| --- | --- |
| `school-notices/` | 학교 공지 크롤링, 정규화, D1 저장, 전체 공지 조회 |
| `recommendations/` | 사용자 프로필, 공지 추천, GPT 관련성 분석 |
| `mail/` | 메일 계정 연동, 메일 목록/본문 조회 |

루트의 `school-notice.service.ts`, `school-notice.functions.ts`는 Channel Function 호환을 위한 facade입니다.
기능 구현은 각 feature 폴더 안에서 먼저 변경하고, facade는 연결 코드만 최소 수정합니다.
