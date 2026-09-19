import assert from "node:assert/strict";
import test from "node:test";
import { withDatabase, type AppDatabase } from "./database.js";
import {
  deleteMailAccount,
  insertMailAccount,
  listMailAccounts,
  type MailAccountRow,
} from "./features/mail/mail.store.js";

/** mail_accounts 테이블만 흉내 내는 인메모리 AppDatabase. */
export function createMailAccountDatabase(): AppDatabase {
  const rows: MailAccountRow[] = [];

  function runAll(sql: string, channelId?: string, userId?: string): MailAccountRow[] {
    if (sql.includes("FROM mail_accounts") && sql.includes("ORDER BY")) {
      return rows
        .filter(
          (row) =>
            (channelId === undefined || row.channel_id === channelId) &&
            (userId === undefined || row.user_id === userId),
        )
        .sort((a, b) => {
          if (a.connected_at !== b.connected_at) {
            return a.connected_at < b.connected_at ? -1 : 1;
          }
          return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
        });
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
                const [id, channelId, userId, provider, email, displayName, connectedAt] =
                  values as [string, string, string, string, string, string | null, string];
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
              if (sql.startsWith("DELETE FROM mail_accounts")) {
                const [channelId, userId, id] = values as [string, string, string];
                const index = rows.findIndex(
                  (row) =>
                    row.channel_id === channelId &&
                    row.user_id === userId &&
                    row.id === id,
                );
                if (index >= 0) rows.splice(index, 1);
                return {};
              }
              throw new Error(`Unexpected run SQL: ${sql}`);
            },
            async first<T>() {
              if (sql.includes("AND email = ?")) {
                const [channelId, userId, email] = values as [string, string, string];
                return (rows.find(
                  (row) =>
                    row.channel_id === channelId &&
                    row.user_id === userId &&
                    row.email === email,
                ) ?? null) as T | null;
              }
              if (sql.includes("AND id = ?")) {
                const [channelId, userId, id] = values as [string, string, string];
                return (rows.find(
                  (row) =>
                    row.channel_id === channelId &&
                    row.user_id === userId &&
                    row.id === id,
                ) ?? null) as T | null;
              }
              throw new Error(`Unexpected first SQL: ${sql}`);
            },
            async all<T>() {
              const [channelId, userId] = values as [string, string];
              return { results: runAll(sql, channelId, userId) as T[] };
            },
          };
        },
        async first<T>() {
          throw new Error(`Unexpected first SQL: ${sql}`);
        },
        async all<T>() {
          return { results: runAll(sql) as T[] };
        },
      };
    },
  };
}

test("mail accounts insert, dedupe by email, list in connected order, and delete", async () => {
  await withDatabase(createMailAccountDatabase(), async () => {
    const first = await insertMailAccount("ch", "user", {
      id: "acc-1",
      provider: "gmail",
      email: "a@gmail.com",
      displayName: "A",
      connectedAt: "2026-09-01T00:00:00.000Z",
    });
    assert.equal(first.id, "acc-1");

    await insertMailAccount("ch", "user", {
      id: "acc-2",
      provider: "outlook",
      email: "b@outlook.com",
      displayName: null,
      connectedAt: "2026-09-02T00:00:00.000Z",
    });

    // 같은 이메일 재연결은 새 행을 만들지 않고 기존 계정을 그대로 돌려준다.
    const dup = await insertMailAccount("ch", "user", {
      id: "acc-3",
      provider: "gmail",
      email: "a@gmail.com",
      displayName: "A again",
      connectedAt: "2026-09-03T00:00:00.000Z",
    });
    assert.equal(dup.id, "acc-1");

    const accounts = await listMailAccounts("ch", "user");
    assert.deepEqual(
      accounts.map((account) => account.id),
      ["acc-1", "acc-2"],
    );

    // 다른 사용자 계정은 섞이지 않는다.
    const otherUser = await listMailAccounts("ch", "someone-else");
    assert.equal(otherUser.length, 0);

    assert.equal(await deleteMailAccount("ch", "user", "acc-2"), true);
    assert.equal(await deleteMailAccount("ch", "user", "acc-2"), false);

    const afterDelete = await listMailAccounts("ch", "user");
    assert.deepEqual(
      afterDelete.map((account) => account.id),
      ["acc-1"],
    );
  });
});
