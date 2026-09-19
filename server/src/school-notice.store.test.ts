import assert from "node:assert/strict";
import test from "node:test";
import { withDatabase, type AppDatabase } from "./database.js";
import {
  listAllNotices,
  upsertNotice,
  type NoticeRow,
} from "./school-notice.store.js";

type NoticeTableRow = Omit<NoticeRow, "id" | "created_at"> & {
  id?: number;
  created_at?: string;
};

function createNoticeDatabase(): AppDatabase {
  const notices: NoticeRow[] = [];
  let nextId = 1;

  return {
    prepare(sql: string) {
      const statement = {
        bind(...values: (string | number | null)[]) {
          return {
            async run() {
              if (sql.startsWith("INSERT INTO notices")) {
                const [title, content, url, postedAt, department, category] =
                  values as [
                    string,
                    string,
                    string,
                    string,
                    string,
                    string | null,
                  ];
                notices.push({
                  id: nextId,
                  title,
                  content,
                  url,
                  posted_at: postedAt,
                  department,
                  category,
                  created_at: `created-${nextId}`,
                });
                nextId += 1;
                return {};
              }

              if (sql.startsWith("UPDATE notices SET")) {
                const [title, content, postedAt, department, category, url] =
                  values as [
                    string,
                    string,
                    string,
                    string,
                    string | null,
                    string,
                  ];
                const row = notices.find((notice) => notice.url === url);
                if (row) {
                  row.title = title;
                  row.content = content;
                  row.posted_at = postedAt;
                  row.department = department;
                  row.category = category;
                }
                return {};
              }

              throw new Error(`Unexpected run SQL: ${sql}`);
            },
            async first<T>() {
              if (sql.includes("FROM notices WHERE url = ?")) {
                return (notices.find((notice) => notice.url === values[0]) ??
                  null) as T | null;
              }

              throw new Error(`Unexpected first SQL: ${sql}`);
            },
            async all<T>() {
              if (sql.includes("FROM notices ORDER BY")) {
                return { results: [...notices].reverse() as T[] };
              }

              throw new Error(`Unexpected all SQL: ${sql}`);
            },
          };
        },
        async first<T>() {
          if (sql.includes("COUNT(*) AS count FROM notices")) {
            return { count: notices.length } as T;
          }

          throw new Error(`Unexpected first SQL: ${sql}`);
        },
        async all<T>() {
          if (sql.includes("FROM notices ORDER BY")) {
            return { results: [...notices].reverse() as T[] };
          }

          throw new Error(`Unexpected all SQL: ${sql}`);
        },
      };

      return statement;
    },
  };
}

test("notice upsert uses url as the duplicate key and exposes standard Notice output", async () => {
  await withDatabase(createNoticeDatabase(), async () => {
    const notice: NoticeTableRow = {
      title: "공지",
      content: "본문",
      url: "https://example.test/notice/1",
      posted_at: "2026-09-19",
      department: "성균관대학교 소프트웨어융합대학",
      category: "학사",
    };

    assert.equal(
      await upsertNotice({
        title: notice.title,
        content: notice.content,
        url: notice.url,
        postedAt: notice.posted_at,
        department: notice.department,
        category: notice.category,
      }),
      "inserted",
    );
    assert.equal(
      await upsertNotice({
        title: notice.title,
        content: notice.content,
        url: notice.url,
        postedAt: notice.posted_at,
        department: notice.department,
        category: notice.category,
      }),
      "skipped",
    );
    assert.equal(
      await upsertNotice({
        title: "수정된 공지",
        content: notice.content,
        url: notice.url,
        postedAt: notice.posted_at,
        department: notice.department,
        category: notice.category,
      }),
      "updated",
    );

    const output = await listAllNotices();

    assert.equal(output.notices.length, 1);
    assert.deepEqual(output.notices[0], {
      id: "1",
      title: "수정된 공지",
      content: "본문",
      url: "https://example.test/notice/1",
      postedAt: "2026-09-19",
      source: "성균관대학교 소프트웨어융합대학",
      department: "성균관대학교 소프트웨어융합대학",
      category: "학사",
      createdAt: "created-1",
      relevant: undefined,
      reason: undefined,
    });
  });
});
