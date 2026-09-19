import { z } from "zod";
import { NoticeSchema } from "./school-notices.js";
import { MailMessageSchema } from "./mail.js";

export const CHAT_FUNCTIONS = {
  sendMessage: "chat.sendMessage",
} as const;

export const AgentFunctionNameSchema = z.enum([
  "getImportantNotices",
  "searchSchoolMail",
  "getImportantFromAll",
  "getUpcomingDeadlines",
  "findRequiredActions",
]);

export type AgentFunctionName = z.infer<typeof AgentFunctionNameSchema>;

export const AgentToolDecisionSchema = z.object({
  type: z.literal("tool"),
  function: AgentFunctionNameSchema,
  category: z.string().nullable(),
  query: z.string().trim().min(1).max(120),
});

export const AgentUnsupportedDecisionSchema = z.object({
  type: z.literal("unsupported"),
  function: z.null(),
  category: z.null(),
  query: z.null(),
});

export const AgentDecisionSchema = z.discriminatedUnion("type", [
  AgentToolDecisionSchema,
  AgentUnsupportedDecisionSchema,
]);

export type AgentDecision = z.infer<typeof AgentDecisionSchema>;
export type AgentToolDecision = z.infer<typeof AgentToolDecisionSchema>;

export const ChatSuggestionSchema = z.object({
  toolName: AgentFunctionNameSchema,
  label: z.string(),
  prompt: z.string(),
});

export type ChatSuggestion = z.infer<typeof ChatSuggestionSchema>;

export const ChatSendMessageInputSchema = z.object({
  message: z.string().trim().min(1).max(1000),
});

export type ChatSendMessageInput = z.infer<
  typeof ChatSendMessageInputSchema
>;

export const ChatNoticeItemSchema = NoticeSchema.pick({
  id: true,
  title: true,
  content: true,
  url: true,
  postedAt: true,
  source: true,
  category: true,
}).extend({
  sourceType: z.literal("NOTICE"),
  date: z.string(),
  summary: z.string(),
});

export type ChatNoticeItem = z.infer<typeof ChatNoticeItemSchema>;

export const ChatMailItemSchema = MailMessageSchema.extend({
  sourceType: z.literal("MAIL"),
  date: z.string(),
  title: z.string(),
});

export type ChatMailItem = z.infer<typeof ChatMailItemSchema>;

export const ChatDeadlineItemSchema = z.object({
  sourceType: z.literal("DEADLINE"),
  originalSourceType: z.enum(["NOTICE", "MAIL", "ACADEMIC_SCHEDULE"]),
  id: z.string(),
  title: z.string(),
  deadline: z.string(),
  date: z.string(),
  source: z.string().optional(),
  category: z.string().nullable().optional(),
  url: z.string().optional(),
  snippet: z.string(),
});

export type ChatDeadlineItem = z.infer<typeof ChatDeadlineItemSchema>;

export const ChatRequiredActionItemSchema = z.object({
  sourceType: z.literal("ACTION"),
  originalSourceType: z.enum(["NOTICE", "MAIL", "ACADEMIC_SCHEDULE"]),
  id: z.string(),
  title: z.string(),
  action: z.string(),
  deadline: z.string().nullable(),
  date: z.string(),
  source: z.string().optional(),
  category: z.string().nullable().optional(),
  url: z.string().optional(),
  snippet: z.string(),
});

export type ChatRequiredActionItem = z.infer<typeof ChatRequiredActionItemSchema>;

export const ChatResultItemSchema = z.discriminatedUnion("sourceType", [
  ChatNoticeItemSchema,
  ChatMailItemSchema,
  ChatDeadlineItemSchema,
  ChatRequiredActionItemSchema,
]);

export type ChatResultItem = z.infer<typeof ChatResultItemSchema>;

export const ChatSendMessageOutputSchema = z.object({
  decision: AgentDecisionSchema,
  message: z.string(),
  items: z.array(ChatResultItemSchema),
  total: z.number().int().min(0),
  suggestions: z.array(ChatSuggestionSchema).max(3).default([]),
});

export type ChatSendMessageOutput = z.infer<
  typeof ChatSendMessageOutputSchema
>;
