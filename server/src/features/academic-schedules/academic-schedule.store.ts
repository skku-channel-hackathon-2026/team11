import type {
  AcademicSchedule,
  AcademicScheduleListInput,
  AcademicScheduleListOutput,
} from "@tutorial/shared";
import { getDatabase } from "../../database.js";
import type { CrawledAcademicSchedule } from "./academic-schedule-crawler.js";

interface AcademicScheduleRow {
  id: string;
  title: string;
  start_at: string;
  end_at: string | null;
  all_day: number;
  description: string | null;
  source: string;
  source_url: string;
  category: string | null;
  created_at: string;
  updated_at: string;
}

export type UpsertableAcademicSchedule = CrawledAcademicSchedule;

function stableId(input: UpsertableAcademicSchedule): string {
  const value = [input.source, input.title, input.startAt, input.endAt ?? ""].join("|");
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `skku-cse-${(hash >>> 0).toString(36)}`;
}

function currentYearMonth(): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
  };
}

function monthBounds(input: AcademicScheduleListInput = {}): {
  from: string;
  to: string;
} {
  const now = currentYearMonth();
  const year = input.year ?? now.year;
  const month = input.month ?? now.month;
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  const to = `${next.year}-${String(next.month).padStart(2, "0")}-01`;
  return { from, to };
}

function toAcademicSchedule(row: AcademicScheduleRow): AcademicSchedule {
  return {
    id: row.id,
    title: row.title,
    startAt: row.start_at,
    endAt: row.end_at,
    allDay: row.all_day === 1,
    description: row.description,
    source: row.source,
    sourceUrl: row.source_url,
    category: row.category,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listAcademicSchedules(
  input: AcademicScheduleListInput = {},
): Promise<AcademicScheduleListOutput> {
  const { from, to } = monthBounds(input);
  const rows = await getDatabase()
    .prepare(
      `SELECT id, title, start_at, end_at, all_day, description, source, source_url, category, created_at, updated_at
       FROM academic_schedules
       WHERE start_at < ? AND COALESCE(end_at, start_at) >= ?
       ORDER BY start_at ASC, title ASC`,
    )
    .bind(to, from)
    .all<AcademicScheduleRow>();

  return { schedules: rows.results.map((row) => toAcademicSchedule(row)) };
}

export async function upsertAcademicSchedule(
  schedule: UpsertableAcademicSchedule,
): Promise<"inserted" | "updated" | "skipped"> {
  const id = stableId(schedule);
  const existing = await getDatabase()
    .prepare(
      `SELECT id, title, start_at, end_at, description, source, source_url, category
       FROM academic_schedules
       WHERE id = ?`,
    )
    .bind(id)
    .first<Pick<AcademicScheduleRow, "id" | "title" | "start_at" | "end_at" | "description" | "source" | "source_url" | "category">>();

  if (!existing) {
    await getDatabase()
      .prepare(
        `INSERT INTO academic_schedules
         (id, title, start_at, end_at, all_day, description, source, source_url, category)
         VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        schedule.title,
        schedule.startAt,
        schedule.endAt,
        schedule.description,
        schedule.source,
        schedule.sourceUrl,
        schedule.category,
      )
      .run();
    return "inserted";
  }

  if (
    existing.title === schedule.title &&
    existing.start_at === schedule.startAt &&
    existing.end_at === schedule.endAt &&
    existing.description === schedule.description &&
    existing.source === schedule.source &&
    existing.source_url === schedule.sourceUrl &&
    existing.category === schedule.category
  ) {
    return "skipped";
  }

  await getDatabase()
    .prepare(
      `UPDATE academic_schedules
       SET title = ?, start_at = ?, end_at = ?, description = ?, source = ?, source_url = ?, category = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    )
    .bind(
      schedule.title,
      schedule.startAt,
      schedule.endAt,
      schedule.description,
      schedule.source,
      schedule.sourceUrl,
      schedule.category,
      id,
    )
    .run();

  return "updated";
}
