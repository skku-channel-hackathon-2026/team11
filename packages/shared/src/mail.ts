import { z } from "zod";

export const MAIL_FUNCTIONS = {
  getConnectionStatus: "mail.getConnectionStatus",
  listAccounts: "mail.listAccounts",
  connectAccount: "mail.connectAccount",
  disconnectAccount: "mail.disconnectAccount",
  listMessages: "mail.listMessages",
} as const;

/** 현재 통합 지원하는 메일 제공자. 채널톡 수신함 연동 기준(Gmail, Outlook). */
export const MailProviderSchema = z.enum(["gmail", "outlook"]);

export type MailProvider = z.infer<typeof MailProviderSchema>;

/** 사용자가 하나의 채널/계정에 연결한 개별 메일 계정. */
export const MailAccountSchema = z.object({
  id: z.string(),
  provider: MailProviderSchema,
  email: z.string().email(),
  displayName: z.string().nullable(),
  connectedAt: z.string(),
});

export type MailAccount = z.infer<typeof MailAccountSchema>;

export const MailAccountListOutputSchema = z.object({
  accounts: z.array(MailAccountSchema),
});

export type MailAccountListOutput = z.infer<typeof MailAccountListOutputSchema>;

export const ConnectMailAccountInputSchema = z.object({
  provider: MailProviderSchema,
  email: z.string().email(),
  displayName: z.string().trim().min(1).max(120).optional(),
});

export type ConnectMailAccountInput = z.infer<
  typeof ConnectMailAccountInputSchema
>;

export const DisconnectMailAccountInputSchema = z.object({
  accountId: z.string().min(1),
});

export type DisconnectMailAccountInput = z.infer<
  typeof DisconnectMailAccountInputSchema
>;

export const DisconnectMailAccountOutputSchema = z.object({
  disconnected: z.boolean(),
});

export type DisconnectMailAccountOutput = z.infer<
  typeof DisconnectMailAccountOutputSchema
>;

/**
 * 연결 상태 요약. 여러 계정을 하나로 묶으므로 대표 이메일 하나와 전체 개수를 함께 노출한다.
 * `email`은 가장 먼저 연결된 계정을 가리키며, 연결이 없으면 null.
 */
export const MailConnectionStatusSchema = z.object({
  connected: z.boolean(),
  email: z.string().email().nullable(),
  accountCount: z.number().int().min(0),
});

export type MailConnectionStatus = z.infer<typeof MailConnectionStatusSchema>;

/**
 * 통합 수신함의 개별 메시지. 여러 계정을 하나로 묶어 보여주므로
 * 어떤 계정에서 왔는지(`accountId`, `accountEmail`, `provider`)를 함께 담는다.
 */
export const MailMessageSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  accountEmail: z.string(),
  provider: MailProviderSchema,
  subject: z.string(),
  from: z.string(),
  receivedAt: z.string(),
  snippet: z.string(),
});

export type MailMessage = z.infer<typeof MailMessageSchema>;

/**
 * 통합 메시지 목록 조회 입력. `accountId`를 지정하면 그 계정만,
 * 지정하지 않으면 연결된 모든 계정을 하나로 묶어 반환한다.
 */
export const ListMailMessagesInputSchema = z.object({
  accountId: z.string().optional(),
});

export type ListMailMessagesInput = z.infer<typeof ListMailMessagesInputSchema>;

export const MailMessageListOutputSchema = z.object({
  messages: z.array(MailMessageSchema),
});

export type MailMessageListOutput = z.infer<typeof MailMessageListOutputSchema>;
