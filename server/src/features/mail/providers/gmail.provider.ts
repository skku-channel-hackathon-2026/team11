import type { MailAccount, MailMessage } from "@tutorial/shared";
import type { MailProviderAdapter } from "../mail.provider.js";
import { classifySchoolMail } from "../school-mail-classifier.js";

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

interface GmailMessagePart {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailMessagePart[];
}

interface GmailMessageResponse {
  id: string;
  threadId?: string;
  internalDate?: string;
  snippet?: string;
  payload?: GmailMessagePart & {
    headers?: GmailHeader[];
  };
}

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";

function normalizeRfc822MessageId(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.replace(/^<|>$/g, "");
}

function gmailSearchUrl(accountEmail: string, rfc822MessageId: string): string {
  const query = `rfc822msgid:${rfc822MessageId}`;
  const params = new URLSearchParams({ authuser: accountEmail });
  return `https://mail.google.com/mail/u/0/?${params.toString()}#search/${encodeURIComponent(query)}`;
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function extractText(part: GmailMessagePart | undefined): string {
  if (!part) return "";
  const nested = part.parts?.map(extractText).filter(Boolean).join("\n") ?? "";
  const data = part.body?.data;
  if (!data) return nested;
  try {
    const decoded = decodeBase64Url(data);
    if (part.mimeType === "text/html") {
      return `${nested}\n${decoded.replace(/<[^>]+>/g, " ")}`.trim();
    }
    if (!part.mimeType || part.mimeType.startsWith("text/")) {
      return `${nested}\n${decoded}`.trim();
    }
  } catch {
    return nested;
  }
  return nested;
}

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
      console.error("Gmail message list failed", {
        status: listResponse.status,
        accountId: account.id,
        provider: account.provider,
      });
      throw new Error(
        `Gmail list failed (${listResponse.status}) for ${account.email}`,
      );
    }
    const list = (await listResponse.json()) as GmailListResponse;
    const ids = list.messages?.map((message) => message.id) ?? [];

    const details = await Promise.all(
      ids.map(async (id) => {
        const detailResponse = await fetch(
          `${GMAIL_API}/messages/${id}?format=full`,
          { headers: authHeader },
        );
        if (!detailResponse.ok) {
          console.error("Gmail message detail failed", {
            status: detailResponse.status,
            accountId: account.id,
            provider: account.provider,
          });
          return null;
        }
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
    const rfc822MessageId = normalizeRfc822MessageId(header("Message-ID"));
    const bodyText = extractText(detail.payload);
    const classification = classifySchoolMail({
      id: `${account.id}-${detail.id}`,
      from: header("From"),
      subject: header("Subject") || "(제목 없음)",
      snippet: detail.snippet ?? "",
      bodyText,
    });

    return {
      id: `${account.id}-${detail.id}`,
      accountId: account.id,
      accountEmail: account.email,
      provider: account.provider,
      subject: header("Subject") || "(제목 없음)",
      from: header("From"),
      receivedAt,
      snippet: detail.snippet ?? "",
      isSchoolRelated: classification.isSchoolRelated,
      gmailMessageId: detail.id,
      gmailThreadId: detail.threadId ?? null,
      rfc822MessageId,
      externalUrl: rfc822MessageId ? gmailSearchUrl(account.email, rfc822MessageId) : null,
    };
  }
}
