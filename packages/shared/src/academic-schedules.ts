import { z } from "zod";

export const ACADEMIC_SCHEDULE_FUNCTIONS = {
  listSchedules: "academicSchedule.listSchedules",
  syncSchedules: "academicSchedule.syncSchedules",
} as const;

export const AcademicScheduleSchema = z.object({
  id: z.string(),
  title: z.string(),
  startAt: z.string(),
  endAt: z.string().nullable(),
  allDay: z.boolean(),
  description: z.string().nullable(),
  source: z.string(),
  sourceUrl: z.string(),
  category: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type AcademicSchedule = z.infer<typeof AcademicScheduleSchema>;

export const AcademicScheduleListInputSchema = z.object({
  year: z.number().int().min(2000).max(2100).optional(),
  month: z.number().int().min(1).max(12).optional(),
});

export type AcademicScheduleListInput = z.infer<
  typeof AcademicScheduleListInputSchema
>;

export const AcademicScheduleListOutputSchema = z.object({
  schedules: z.array(AcademicScheduleSchema),
});

export type AcademicScheduleListOutput = z.infer<
  typeof AcademicScheduleListOutputSchema
>;

export const AcademicScheduleSyncInputSchema = z.object({
  year: z.number().int().min(2000).max(2100).optional(),
});

export type AcademicScheduleSyncInput = z.infer<
  typeof AcademicScheduleSyncInputSchema
>;

export const AcademicScheduleSyncOutputSchema = z.object({
  fetched: z.number().int().min(0),
  inserted: z.number().int().min(0),
  updated: z.number().int().min(0),
  skipped: z.number().int().min(0),
});

export type AcademicScheduleSyncOutput = z.infer<
  typeof AcademicScheduleSyncOutputSchema
>;
