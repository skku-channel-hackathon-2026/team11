import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import type { MailAccount, MailMessage } from "@tutorial/shared";
import { withDatabase, type AppDatabase } from "./database.js";
import {
  insertMailAccount,
  type MailAccountRow,
} from "./features/mail/mail.store.js";
import { MailService } from "./features/mail/mail.service.js";
import type { MailProviderAdapter } from "./features/mail/mail.provider.js";

function createMailAccountDatabase(): AppDatabase {
  const rows: MailAccountRow[] = [];
  function all(sql: string): MailAccountRow[] {
    if (sql.includes("FROM mail_accounts") && sql.includes("ORDER BY")) {
      return [...rows].sort((a, b) =>
        a.connected_at < b.connected_at
          ? -1
          : a.connected_at > b.connected_at
            ? 1
            : 0,
      );
    }
    throw new Error(`Unexpected all SQL: ${sql}`);
  }
  return {
    prepare(sql: string) {
      return {
        bind(...values: (string | number | null)[]) {
          return {
            async run() {
              if (sql.startsWith("INSERT INTO mail_accounts")) {
                const [
                  id,
                  channelId,
                  userId,
                  provider,
                  email,
                  displayName,
                  connectedAt,
                ] = values as [
                  string,
                  string,
                  string,
                  string,
                  string,
                  string | null,
                  string,
                ];
                rows.push({
                  id,
                  channel_id: channelId,
                  user_id: userId,
                  provider,
                  email,
                  display_name: displayName,
                  connected_at: connectedAt,
                });
                return {};
              }
              throw new Error(`Unexpected run SQL: ${sql}`);
            },
            async first<T>() {
              if (sql.includes("AND email = ?")) {
                const [channelId, userId, email] = values as [
                  string,
                  string,
                  string,
                ];
                return (rows.find(
                  (row) =>
                    row.channel_id === channelId &&
                    row.user_id === userId &&
                    row.email === email,
                ) ?? null) as T | null;
              }
              throw new Error(`Unexpected first SQL: ${sql}`);
            },
            async all<T>() {
              return { results: all(sql) as T[] };
            },
          };
        },
        async first<T>() {
          throw new Error(`Unexpected first SQL: ${sql}`);
        },
        async all<T>() {
          return { results: all(sql) as T[] };
        },
      };
    },
  };
}

/** 계정마다 서로 다른 수신 시각의 메시지 2개를 돌려주는 테스트용 제공자. */
const fakeProvider: MailProviderAdapter = {
  async fetchMessages(account: MailAccount): Promise<MailMessage[]> {
    const base = account.email === "a@gmail.com" ? 10 : 20;
    return [1, 2].map((n) => ({
      id: `${account.id}-${n}`,
      accountId: account.id,
      accountEmail: account.email,
      provider: account.provider,
      subject: `s${base + n}`,
      from: "from",
      receivedAt: new Date(Date.UTC(2026, 8, 19, base + n, 0, 0)).toISOString(),
      snippet: "snippet",
      isSchoolRelated: false,
      gmailMessageId: null,
      gmailThreadId: null,
      rfc822MessageId: null,
      externalUrl: null,
    }));
  },
};

test("unified inbox merges all accounts newest-first", async () => {
  await withDatabase(createMailAccountDatabase(), async () => {
    await insertMailAccount("ch", "user", {
      id: "acc-a",
      provider: "gmail",
      email: "a@gmail.com",
      displayName: null,
      connectedAt: "2026-09-01T00:00:00.000Z",
    });
    await insertMailAccount("ch", "user", {
      id: "acc-b",
      provider: "outlook",
      email: "b@outlook.com",
      displayName: null,
      connectedAt: "2026-09-02T00:00:00.000Z",
    });

    const service = new MailService();
    service.useProvider(fakeProvider);

    const status = await service.getConnectionStatus("ch", "user");
    assert.deepEqual(status, {
      connected: true,
      email: "a@gmail.com",
      accountCount: 2,
    });

    const { messages } = await service.listMessages("ch", "user");
    // 두 계정 합쳐 4건, 수신 시각 최신순.
    assert.equal(messages.length, 4);
    assert.deepEqual(
      messages.map((message) => message.id),
      ["acc-b-2", "acc-b-1", "acc-a-2", "acc-a-1"],
    );

    // accountId 필터는 해당 계정만 반환.
    const onlyA = await service.listMessages("ch", "user", "acc-a");
    assert.deepEqual(
      onlyA.messages.map((message) => message.id),
      ["acc-a-2", "acc-a-1"],
    );
  });
});

test("connection status reports empty when no accounts", async () => {
  await withDatabase(createMailAccountDatabase(), async () => {
    const service = new MailService();
    const status = await service.getConnectionStatus("ch", "user");
    assert.deepEqual(status, {
      connected: false,
      email: null,
      accountCount: 0,
    });
  });
});


test("gmail provider maps Message-ID to a token-free Gmail search URL", async () => {
  const { GmailMailProvider } = await import("./features/mail/providers/gmail.provider.js");
  const originalFetch = globalThis.fetch;
  const account: MailAccount = {
    id: "acc-gmail",
    provider: "gmail",
    email: "student@gmail.com",
    displayName: null,
    connectedAt: "2026-09-01T00:00:00.000Z",
  };

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/messages?")) {
      return Response.json({ messages: [{ id: "msg-1", threadId: "thread-1" }] });
    }
    if (url.includes("/messages/msg-1?")) {
      return Response.json({
        id: "msg-1",
        threadId: "thread-1",
        internalDate: String(Date.UTC(2026, 8, 19, 0, 0, 0)),
        snippet: "snippet",
        payload: {
          headers: [
            { name: "Subject", value: "Scholarship notice" },
            { name: "From", value: "SKKU <help@skku.edu>" },
            { name: "Message-ID", value: "<abc.123@example.com>" },
          ],
        },
      });
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;

  try {
    const provider = new GmailMailProvider(async () => "access-token", 1);
    const [message] = await provider.fetchMessages(account);
    assert.equal(message?.gmailMessageId, "msg-1");
    assert.equal(message?.gmailThreadId, "thread-1");
    assert.equal(message?.rfc822MessageId, "abc.123@example.com");
    assert.equal(
      message?.externalUrl,
      "https://mail.google.com/mail/u/0/?authuser=student%40gmail.com#search/rfc822msgid%3Aabc.123%40example.com",
    );
    assert.equal(message?.externalUrl.includes("access-token"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
