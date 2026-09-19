import type { MailAccount, MailProvider } from "@tutorial/shared";
import { getDatabase } from "../../database.js";

/** D1 `mail_accounts` 테이블의 한 행. */
export interface MailAccountRow {
  id: string;
  channel_id: string;
  user_id: string;
  provider: string;
  email: string;
  display_name: string | null;
  connected_at: string;
}

export interface InsertableMailAccount {
  id: string;
  provider: MailProvider;
  email: string;
  displayName?: string | null;
  connectedAt: string;
}

function toMailAccount(row: MailAccountRow): MailAccount {
  return {
    id: row.id,
    provider: row.provider as MailProvider,
    email: row.email,
    displayName: row.display_name,
    connectedAt: row.connected_at,
  };
}

/** 한 사용자가 이 채널에 연결한 메일 계정 전체를 오래된 순으로 반환. */
export async function listMailAccountRows(
  channelId: string,
  userId: string,
): Promise<MailAccountRow[]> {
  const rows = await getDatabase()
    .prepare(
      "SELECT id, channel_id, user_id, provider, email, display_name, connected_at FROM mail_accounts WHERE channel_id = ? AND user_id = ? ORDER BY connected_at ASC, id ASC",
    )
    .bind(channelId, userId)
    .all<MailAccountRow>();

  return rows.results;
}

export async function listMailAccounts(
  channelId: string,
  userId: string,
): Promise<MailAccount[]> {
  const rows = await listMailAccountRows(channelId, userId);
  return rows.map(toMailAccount);
}

export async function findMailAccountByEmail(
  channelId: string,
  userId: string,
  email: string,
): Promise<MailAccount | null> {
  const row = await getDatabase()
    .prepare(
      "SELECT id, channel_id, user_id, provider, email, display_name, connected_at FROM mail_accounts WHERE channel_id = ? AND user_id = ? AND email = ?",
    )
    .bind(channelId, userId, email)
    .first<MailAccountRow>();

  return row ? toMailAccount(row) : null;
}

/**
 * 메일 계정을 저장한다. 같은 (채널, 사용자, 이메일) 조합이 이미 있으면
 * 새로 넣지 않고 기존 계정을 그대로 반환한다(중복 연결 방지).
 */
export async function insertMailAccount(
  channelId: string,
  userId: string,
  account: InsertableMailAccount,
): Promise<MailAccount> {
  const existing = await findMailAccountByEmail(channelId, userId, account.email);
  if (existing) return existing;

  await getDatabase()
    .prepare(
      "INSERT INTO mail_accounts (id, channel_id, user_id, provider, email, display_name, connected_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      account.id,
      channelId,
      userId,
      account.provider,
      account.email,
      account.displayName ?? null,
      account.connectedAt,
    )
    .run();

  return {
    id: account.id,
    provider: account.provider,
    email: account.email,
    displayName: account.displayName ?? null,
    connectedAt: account.connectedAt,
  };
}

/** 계정 연결 해제. 실제로 지워졌으면 true. */
export async function deleteMailAccount(
  channelId: string,
  userId: string,
  accountId: string,
): Promise<boolean> {
  const existing = await getDatabase()
    .prepare(
      "SELECT id, channel_id, user_id, provider, email, display_name, connected_at FROM mail_accounts WHERE channel_id = ? AND user_id = ? AND id = ?",
    )
    .bind(channelId, userId, accountId)
    .first<MailAccountRow>();

  if (!existing) return false;

  await getDatabase()
    .prepare(
      "DELETE FROM mail_accounts WHERE channel_id = ? AND user_id = ? AND id = ?",
    )
    .bind(channelId, userId, accountId)
    .run();

  return true;
}
