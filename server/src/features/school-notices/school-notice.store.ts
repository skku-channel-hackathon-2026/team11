import type {
  Notice,
  NoticeDateRange,
  NoticeListInput,
  NoticeListOutput,
} from "@tutorial/shared";
import { getDatabase } from "../../database.js";

export interface NoticeRow {
  id: number;
  title: string;
  content: string;
  url: string;
  posted_at: string;
  department: string;
  category: string | null;
  created_at: string;
}

export interface NoticeRelevanceRow {
  relevant: number;
  category: string | null;
  reason: string | null;
}

export interface UpsertableNotice {
  title: string;
  content: string;
  url: string;
  postedAt: string;
  department: string;
  category?: string | null;
}

export function toNotice(
  row: NoticeRow,
  relevance?: NoticeRelevanceRow,
): Notice {
  return {
    id: String(row.id),
    title: row.title,
    content: row.content,
    url: row.url,
    postedAt: row.posted_at,
    source: row.department,
    department: row.department,
    category: row.category,
    createdAt: row.created_at,
    relevant: relevance ? relevance.relevant === 1 : undefined,
    reason: relevance?.reason ?? undefined,
  };
}

function toKstDate(value: Date): Date {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return new Date(`${formatter.format(value)}T00:00:00.000+09:00`);
}

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function addDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addMonths(value: Date, months: number): Date {
  const next = new Date(value);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

function dateBoundsForRange(
  dateRange: NoticeDateRange = "all",
  now = new Date(),
): { from?: string; to?: string } {
  if (dateRange === "all") return {};

  const today = toKstDate(now);
  const tomorrow = addDays(today, 1);

  if (dateRange === "today") {
    return { from: formatDate(today), to: formatDate(tomorrow) };
  }

  if (dateRange === "yesterday") {
    const yesterday = addDays(today, -1);
    return { from: formatDate(yesterday), to: formatDate(today) };
  }

  if (dateRange === "thisWeek") {
    const day = today.getUTCDay();
    const daysSinceMonday = day === 0 ? 6 : day - 1;
    return {
      from: formatDate(addDays(today, -daysSinceMonday)),
      to: formatDate(tomorrow),
    };
  }

  if (dateRange === "thisMonth") {
    return {
      from: `${formatDate(today).slice(0, 8)}01`,
      to: formatDate(tomorrow),
    };
  }

  if (dateRange === "last6Months") {
    return { from: formatDate(addMonths(today, -6)), to: formatDate(tomorrow) };
  }

  return { from: formatDate(addMonths(today, -12)), to: formatDate(tomorrow) };
}

export async function listNoticeRows(
  input: NoticeListInput = {},
): Promise<NoticeRow[]> {
  const { from, to } = dateBoundsForRange(input.dateRange ?? "all");
  const where: string[] = [];
  const values: string[] = [];

  if (from) {
    where.push("posted_at >= ?");
    values.push(from);
  }

  if (to) {
    where.push("posted_at < ?");
    values.push(to);
  }

  if (input.category) {
    where.push("category = ?");
    values.push(input.category);
  }

  const sql = [
    "SELECT id, title, content, url, posted_at, department, category, created_at FROM notices",
    where.length > 0 ? `WHERE ${where.join(" AND ")}` : "",
    "ORDER BY posted_at DESC, id DESC",
  ]
    .filter(Boolean)
    .join(" ");

  const statement = getDatabase().prepare(sql);
  const rows =
    values.length > 0
      ? await statement.bind(...values).all<NoticeRow>()
      : await statement.all<NoticeRow>();

  return rows.results;
}

export async function listAllNotices(
  input: NoticeListInput = {},
): Promise<NoticeListOutput> {
  const rows = await listNoticeRows(input);
  return { notices: rows.map((row) => toNotice(row)) };
}

export async function countNotices(): Promise<number> {
  const row = await getDatabase()
    .prepare("SELECT COUNT(*) AS count FROM notices")
    .first<{ count: number }>();

  return row?.count ?? 0;
}

export async function upsertNotice(
  notice: UpsertableNotice,
): Promise<"inserted" | "updated" | "skipped"> {
  const db = getDatabase();
  const existing = await db
    .prepare(
      "SELECT id, title, content, posted_at, department, category FROM notices WHERE url = ?",
    )
    .bind(notice.url)
    .first<{
      id: number;
      title: string;
      content: string;
      posted_at: string;
      department: string;
      category: string | null;
    }>();

  if (!existing) {
    await db
      .prepare(
        "INSERT INTO notices (title, content, url, posted_at, department, category) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .bind(
        notice.title,
        notice.content,
        notice.url,
        notice.postedAt,
        notice.department,
        notice.category ?? null,
      )
      .run();
    return "inserted";
  }

  if (
    existing.title === notice.title &&
    existing.content === notice.content &&
    existing.posted_at === notice.postedAt &&
    existing.department === notice.department &&
    existing.category === (notice.category ?? null)
  ) {
    return "skipped";
  }

  await db
    .prepare(
      "UPDATE notices SET title = ?, content = ?, posted_at = ?, department = ?, category = ? WHERE url = ?",
    )
    .bind(
      notice.title,
      notice.content,
      notice.postedAt,
      notice.department,
      notice.category ?? null,
      notice.url,
    )
    .run();

  return "updated";
}
