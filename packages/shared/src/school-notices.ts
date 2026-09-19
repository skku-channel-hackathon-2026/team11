import { z } from "zod";

export const SCHOOL_NOTICE_COLLECTION_FUNCTIONS = {
  listNotices: "schoolNotice.listNotices",
  seedNotices: "schoolNotice.seedNotices",
  syncNotices: "schoolNotice.syncNotices",
} as const;

export const NoticeSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  url: z.string(),
  postedAt: z.string(),
  source: z.string(),
  department: z.string(),
  createdAt: z.string(),
  relevant: z.boolean().optional(),
  category: z.string().nullable().optional(),
  reason: z.string().nullable().optional(),
});

export type Notice = z.infer<typeof NoticeSchema>;

export const NoticeDateRangeSchema = z.enum([
  "all",
  "today",
  "yesterday",
  "thisWeek",
  "thisMonth",
  "last6Months",
  "last1Year",
]);

export type NoticeDateRange = z.infer<typeof NoticeDateRangeSchema>;

export const NoticeListInputSchema = z.object({
  dateRange: NoticeDateRangeSchema.default("all"),
  category: z.string().trim().min(1).max(40).optional(),
});

export type NoticeListInput = z.input<typeof NoticeListInputSchema>;

export const NoticeListOutputSchema = z.object({
  notices: z.array(NoticeSchema),
});

export type NoticeListOutput = z.infer<typeof NoticeListOutputSchema>;

export const SeedNoticesOutputSchema = z.object({
  inserted: z.number().int().min(0),
});

export type SeedNoticesOutput = z.infer<typeof SeedNoticesOutputSchema>;

export const SyncNoticesInputSchema = z.object({
  source: z.string().optional(),
});

export type SyncNoticesInput = z.infer<typeof SyncNoticesInputSchema>;

export const SyncNoticesOutputSchema = z.object({
  inserted: z.number().int().min(0),
  updated: z.number().int().min(0),
  skipped: z.number().int().min(0),
});

export type SyncNoticesOutput = z.infer<typeof SyncNoticesOutputSchema>;
