import assert from "node:assert/strict";
import test from "node:test";
import { withDatabase, type AppDatabase } from "./database.js";
import { toggleNoticeFavorite, favoriteNoticeIds } from "./features/school-notices/notice-favorite.store.js";

function createFavoriteDatabase(): AppDatabase {
  const notices = [{ id: 1 }];
  const favorites: Array<{ id: string; channel_id: string; user_id: string; notice_id: number; created_at: string }> = [];
  return {
    prepare(sql: string) {
      return {
        bind(...values: (string | number | null)[]) {
          return {
            async run() {
              if (sql.startsWith("INSERT OR IGNORE INTO notice_favorites")) {
                const [id, channelId, userId, noticeId] = values as [string, string, string, number];
                if (!favorites.some((row) => row.channel_id === channelId && row.user_id === userId && row.notice_id === noticeId)) {
                  favorites.push({ id, channel_id: channelId, user_id: userId, notice_id: noticeId, created_at: `created-${favorites.length + 1}` });
                }
                return {};
              }
              if (sql.startsWith("DELETE FROM notice_favorites")) {
                const [id] = values as [string];
                const index = favorites.findIndex((row) => row.id === id);
                if (index >= 0) favorites.splice(index, 1);
                return {};
              }
              throw new Error(`Unexpected run SQL: ${sql}`);
            },
            async first<T>() {
              if (sql.includes("SELECT id FROM notices")) {
                return (notices.find((notice) => notice.id === values[0]) ?? null) as T | null;
              }
              if (sql.includes("FROM notice_favorites") && sql.includes("notice_id = ?")) {
                const [channelId, userId, noticeId] = values as [string, string, number];
                return (favorites.find((row) => row.channel_id === channelId && row.user_id === userId && row.notice_id === noticeId) ?? null) as T | null;
              }
              throw new Error(`Unexpected first SQL: ${sql}`);
            },
            async all<T>() {
              if (sql.includes("FROM notice_favorites")) {
                const [channelId, userId] = values as [string, string];
                return { results: favorites.filter((row) => row.channel_id === channelId && row.user_id === userId) as T[] };
              }
              throw new Error(`Unexpected all SQL: ${sql}`);
            },
          };
        },
        async first<T>() {
          throw new Error(`Unexpected first SQL: ${sql}`);
        },
        async all<T>() {
          throw new Error(`Unexpected all SQL: ${sql}`);
        },
      };
    },
  };
}

test("notice favorites toggle idempotently per user", async () => {
  await withDatabase(createFavoriteDatabase(), async () => {
    assert.equal(await toggleNoticeFavorite("ch", "u1", "1"), true);
    assert.deepEqual([...await favoriteNoticeIds("ch", "u1")].map(([id]) => id), ["1"]);
    assert.equal((await favoriteNoticeIds("ch", "u2")).size, 0);
    assert.equal(await toggleNoticeFavorite("ch", "u1", "1"), false);
    assert.equal((await favoriteNoticeIds("ch", "u1")).size, 0);
  });
});
