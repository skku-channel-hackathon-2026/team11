import type { MailAccount, MailMessage } from "@tutorial/shared";
import type { MailProviderAdapter } from "../mail.provider.js";

/**
 * Gmail 제공자 어댑터 골격.
 *
 * 실제 Gmail 연동은 계정별 OAuth access token이 필요하다. 이 클래스는 토큰을
 * 어떻게 얻는지(`AccessTokenResolver`)만 주입받고, Gmail REST API 호출과
 * 통합 스키마(MailMessage) 매핑을 담당한다. 토큰 저장/갱신(refresh token,
 * 만료 처리)은 이 저장소 범위 밖(보안상 서버 비밀·D1 별도 테이블)이며,
 * 해커톤 단계에서는 mock 제공자(`MockMailProvider`)를 기본으로 쓴다.
 *
 * 사용 예:
 * ```ts
 * const gmail = new GmailMailProvider(async (account) => getAccessToken(account));
 * mailService.useProvider(gmail);
 * ```
 */
export type AccessTokenResolver = (account: MailAccount) => Promise<string>;

interface GmailListResponse {
  messages?: Array<{ id: string; threadId: string }>;
}

interface GmailHeader {
  name: string;
  value: string;
}

interface GmailMessageResponse {
  id: string;
  internalDate?: string;
  snippet?: string;
  payload?: {
    headers?: GmailHeader[];
  };
}

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";

export class GmailMailProvider implements MailProviderAdapter {
  constructor(
    private readonly resolveAccessToken: AccessTokenResolver,
    private readonly maxResults = 10,
  ) {}

  async fetchMessages(account: MailAccount): Promise<MailMessage[]> {
    const accessToken = await this.resolveAccessToken(account);
    const authHeader = { Authorization: `Bearer ${accessToken}` };

    const listResponse = await fetch(
      `${GMAIL_API}/messages?maxResults=${this.maxResults}`,
      { headers: authHeader },
    );
    if (!listResponse.ok) {
      throw new Error(
        `Gmail list failed (${listResponse.status}) for ${account.email}`,
      );
    }
    const list = (await listResponse.json()) as GmailListResponse;
    const ids = list.messages?.map((message) => message.id) ?? [];

    const details = await Promise.all(
      ids.map(async (id) => {
        const detailResponse = await fetch(
          `${GMAIL_API}/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
          { headers: authHeader },
        );
        if (!detailResponse.ok) return null;
        return (await detailResponse.json()) as GmailMessageResponse;
      }),
    );

    return details
      .filter((detail): detail is GmailMessageResponse => detail !== null)
      .map((detail) => this.toMailMessage(account, detail));
  }

  private toMailMessage(
    account: MailAccount,
    detail: GmailMessageResponse,
  ): MailMessage {
    const headers = detail.payload?.headers ?? [];
    const header = (name: string): string =>
      headers.find((entry) => entry.name.toLowerCase() === name.toLowerCase())
        ?.value ?? "";

    const receivedAt = detail.internalDate
      ? new Date(Number(detail.internalDate)).toISOString()
      : header("Date") || new Date().toISOString();

    return {
      id: `${account.id}-${detail.id}`,
      accountId: account.id,
      accountEmail: account.email,
      provider: account.provider,
      subject: header("Subject") || "(제목 없음)",
      from: header("From"),
      receivedAt,
      snippet: detail.snippet ?? "",
    };
  }
}
