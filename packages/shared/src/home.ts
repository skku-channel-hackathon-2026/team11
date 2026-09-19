import { z } from "zod";
import { UserProfileSchema } from "./recommendations.js";
import { FailedMailAccountSchema } from "./mail.js";
import { NoticeSchema } from "./school-notices.js";
import { ChatDeadlineItemSchema, ChatRequiredActionItemSchema } from "./chat.js";

export const HOME_FUNCTIONS = {
  getDashboard: "home.getDashboard",
  completeTask: "home.completeTask",
  undoTask: "home.undoTask",
  dismissTask: "home.dismissTask",
} as const;

export const HomeDeadlinePrecisionSchema = z.enum([
  "datetime",
  "date",
  "range",
  "unknown",
]);

export const HomeDeadlineItemSchema = ChatDeadlineItemSchema.extend({
  precision: HomeDeadlinePrecisionSchema,
  confidence: z.enum(["high", "medium", "low"]),
});

export type HomeDeadlineItem = z.infer<typeof HomeDeadlineItemSchema>;

export const HomeRequiredActionItemSchema = ChatRequiredActionItemSchema.extend({
  precision: HomeDeadlinePrecisionSchema.nullable(),
  confidence: z.enum(["high", "medium", "low"]).nullable(),
});

export type HomeRequiredActionItem = z.infer<typeof HomeRequiredActionItemSchema>;

export const ChecklistTaskStatusSchema = z.enum([
  "pending",
  "completed",
  "dismissed",
]);
export const ChecklistTaskSourceTypeSchema = z.enum([
  "NOTICE",
  "MAIL",
  "ACADEMIC_SCHEDULE",
]);

export const ChecklistTaskSourceSchema = z.object({
  id: z.string(),
  sourceType: ChecklistTaskSourceTypeSchema,
  sourceId: z.string(),
  title: z.string(),
  url: z.string().nullable(),
});

export type ChecklistTaskSource = z.infer<typeof ChecklistTaskSourceSchema>;

export const ChecklistTaskSchema = z.object({
  id: z.string(),
  canonicalTitle: z.string(),
  action: z.string(),
  deadline: z.string().nullable(),
  deadlinePrecision: HomeDeadlinePrecisionSchema,
  status: ChecklistTaskStatusSchema,
  completedAt: z.string().nullable(),
  xpReward: z.number().int().min(0),
  sources: z.array(ChecklistTaskSourceSchema),
  isNew: z.boolean().default(false),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ChecklistTask = z.infer<typeof ChecklistTaskSchema>;

export const HomeProgressSchema = z.object({
  totalXp: z.number().int().min(0),
  level: z.number().int().min(1).max(10),
  levelName: z.string(),
  currentLevelXp: z.number().int().min(0),
  nextLevelXp: z.number().int().min(0).nullable(),
  nextLevelRemainingXp: z.number().int().min(0),
  isMaxLevel: z.boolean(),
  completedTasks: z.number().int().min(0),
  totalTasks: z.number().int().min(0),
  completionRate: z.number().min(0).max(1),
});

export type HomeProgress = z.infer<typeof HomeProgressSchema>;

export const HomeUpcomingDeadlineSchema = z.object({
  taskId: z.string(),
  title: z.string(),
  deadline: z.string(),
  deadlinePrecision: HomeDeadlinePrecisionSchema,
});

export type HomeUpcomingDeadline = z.infer<typeof HomeUpcomingDeadlineSchema>;

export const HomeSyncSummarySchema = z.object({
  lastUpdatedAt: z.string(),
  newTaskCount: z.number().int().min(0),
  sourceCounts: z.object({
    notices: z.number().int().min(0),
    mails: z.number().int().min(0),
    academicSchedules: z.number().int().min(0),
  }),
});

export type HomeSyncSummary = z.infer<typeof HomeSyncSummarySchema>;

export const FavoriteHomeNoticeSchema = NoticeSchema.pick({
  id: true,
  title: true,
  url: true,
  postedAt: true,
  source: true,
  category: true,
  favoritedAt: true,
  isFavorite: true,
});

export type FavoriteHomeNotice = z.infer<typeof FavoriteHomeNoticeSchema>;

export const HomeDashboardOutputSchema = z.object({
  profile: UserProfileSchema.nullable(),
  progress: HomeProgressSchema,
  tasks: z.array(ChecklistTaskSchema),
  favorites: z.array(FavoriteHomeNoticeSchema),
  upcomingDeadlines: z.array(HomeUpcomingDeadlineSchema),
  failedAccounts: z.array(FailedMailAccountSchema).default([]),
  sync: HomeSyncSummarySchema,
  generatedAt: z.string(),
});

export type HomeDashboardOutput = z.infer<typeof HomeDashboardOutputSchema>;

export const CompleteChecklistTaskInputSchema = z.object({
  taskId: z.string().min(1),
});

export type CompleteChecklistTaskInput = z.infer<
  typeof CompleteChecklistTaskInputSchema
>;

export const UndoChecklistTaskInputSchema = CompleteChecklistTaskInputSchema;

export type UndoChecklistTaskInput = CompleteChecklistTaskInput;

export const DismissChecklistTaskInputSchema = CompleteChecklistTaskInputSchema;

export type DismissChecklistTaskInput = CompleteChecklistTaskInput;

export const CompleteChecklistTaskOutputSchema = z.object({
  task: ChecklistTaskSchema,
  progress: HomeProgressSchema,
  xpAwarded: z.number().int().min(0),
  xpReverted: z.number().int().min(0).default(0),
  leveledUp: z.boolean(),
});

export type CompleteChecklistTaskOutput = z.infer<
  typeof CompleteChecklistTaskOutputSchema
>;

export const UndoChecklistTaskOutputSchema = CompleteChecklistTaskOutputSchema;

export type UndoChecklistTaskOutput = CompleteChecklistTaskOutput;

export const DismissChecklistTaskOutputSchema = CompleteChecklistTaskOutputSchema;

export type DismissChecklistTaskOutput = CompleteChecklistTaskOutput;
