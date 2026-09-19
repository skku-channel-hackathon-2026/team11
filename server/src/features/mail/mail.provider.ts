import type { MailAccount, MailMessage } from "@tutorial/shared";

/**
 * 메일 제공자 추상화.
 *
 * 실제 배포에서는 Gmail/Outlook OAuth 토큰으로 각 제공자 API를 호출해
 * 메시지를 가져오는 어댑터를 구현한다. 해커톤 로컬/데모 단계에서는 외부
 * 자격 증명 없이 흐름을 검증할 수 있도록 결정적(deterministic) mock 제공자를 사용한다.
 */
export interface MailProviderAdapter {
  /** 한 계정의 최근 메시지를 통합 스키마(MailMessage)로 반환한다. */
  fetchMessages(account: MailAccount): Promise<MailMessage[]>;
}

/** 이메일 문자열을 안정적인 숫자 seed로 바꿔 계정마다 다른 샘플을 만든다. */
function seedFromEmail(email: string): number {
  let seed = 0;
  for (const char of email) {
    seed = (seed * 31 + char.charCodeAt(0)) % 1_000_000;
  }
  return seed;
}

const sampleSubjects = [
  "[성균관대] 장학금 신청 결과 안내",
  "면접 일정 확정 안내드립니다",
  "이번 주 스터디 자료 공유",
  "결제 영수증이 도착했습니다",
  "뉴스레터: 이번 달 주요 소식",
];

const sampleFromNames = [
  "학생지원팀",
  "채용 담당자",
  "스터디 그룹",
  "billing",
  "newsletter",
];

/**
 * 외부 연동 없이 동작하는 mock 제공자.
 * 계정 이메일을 seed로 사용해 계정별로 서로 다른, 그러나 실행마다 동일한
 * 샘플 메시지를 생성한다. 통합 수신함 UI/추천 연동을 검증하기 위한 용도.
 */
export class MockMailProvider implements MailProviderAdapter {
  constructor(private readonly messagesPerAccount = 3) {}

  async fetchMessages(account: MailAccount): Promise<MailMessage[]> {
    const seed = seedFromEmail(account.email);
    const domain = account.email.split("@")[1] ?? "example.com";
    const messages: MailMessage[] = [];

    for (let index = 0; index < this.messagesPerAccount; index += 1) {
      const pick = (seed + index) % sampleSubjects.length;
      // 계정마다, 메시지마다 서로 다른 수신 시각(최근에서 과거로).
      const minutesAgo = (seed % 47) * (index + 1) + index * 13;
      const receivedAt = new Date(
        Date.UTC(2026, 8, 19, 9, 0, 0) - minutesAgo * 60 * 1000,
      ).toISOString();

      messages.push({
        id: `${account.id}-${index + 1}`,
        accountId: account.id,
        accountEmail: account.email,
        provider: account.provider,
        subject: sampleSubjects[pick],
        from: `${sampleFromNames[pick]} <${sampleFromNames[pick].replace(/\s+/g, "").toLowerCase()}@${domain}>`,
        receivedAt,
        snippet: `${sampleSubjects[pick]} — ${account.email} 계정으로 수신된 미리보기 내용입니다.`,
      });
    }

    return messages;
  }
}

export const defaultMailProvider: MailProviderAdapter = new MockMailProvider();
