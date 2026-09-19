import type { AcademicScheduleSyncOutput } from "@tutorial/shared";
import { fetchSkkuAcademicSchedules } from "./academic-schedule-crawler.js";
import { upsertAcademicSchedule } from "./academic-schedule.store.js";

export async function syncAcademicSchedules(
  year?: number,
): Promise<AcademicScheduleSyncOutput> {
  const schedules = await fetchSkkuAcademicSchedules(year);
  const result: AcademicScheduleSyncOutput = {
    fetched: schedules.length,
    inserted: 0,
    updated: 0,
    skipped: 0,
  };

  for (const schedule of schedules) {
    try {
      const status = await upsertAcademicSchedule(schedule);
      result[status] += 1;
    } catch (error) {
      result.skipped += 1;
      console.warn("Failed to upsert academic schedule", error);
    }
  }

  return result;
}
