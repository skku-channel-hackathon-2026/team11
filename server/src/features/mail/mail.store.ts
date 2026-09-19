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
  access_token?: string | null;
  refresh_token?: string | null;
  token_expires_at?: string | null;
  token_scope?: string | null;
}

export interface InsertableMailAccount {
  id: string;
  provider: MailProvider;
  email: string;
  displayName?: string | null;
  connectedAt: string;
  accessToken?: string | null;
  refreshToken?: string | null;
  tokenExpiresAt?: string | null;
  tokenScope?: string | null;
}

export interface MailAccountTokenSet {
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiresAt: string | null;
  tokenScope: string | null;
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

const accountColumns =
  "id, channel_id, user_id, provider, email, display_name, connected_at, access_token, refresh_token, token_expires_at, token_scope";

/** 한 사용자가 이 채널에 연결한 메일 계정 전체를 오래된 순으로 반환. */
export async function listMailAccountRows(
  channelId: string,
  userId: string,
): Promise<MailAccountRow[]> {
  const rows = await getDatabase()
    .prepare(
      `SELECT ${accountColumns} FROM mail_accounts WHERE channel_id = ? AND user_id = ? ORDER BY connected_at ASC, id ASC`,
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
      `SELECT ${accountColumns} FROM mail_accounts WHERE channel_id = ? AND user_id = ? AND email = ?`,
    )
    .bind(channelId, userId, email)
    .first<MailAccountRow>();

  return row ? toMailAccount(row) : null;
}

export async function findMailAccountRowById(
  channelId: string,
  userId: string,
  accountId: string,
): Promise<MailAccountRow | null> {
  return getDatabase()
    .prepare(
      `SELECT ${accountColumns} FROM mail_accounts WHERE channel_id = ? AND user_id = ? AND id = ?`,
    )
    .bind(channelId, userId, accountId)
    .first<MailAccountRow>();
}

/**
 * 메일 계정을 저장한다. 같은 (채널, 사용자, 이메일) 조합이 이미 있으면
 * 기존 행을 토큰 정보로 갱신하고 기존 계정을 반환한다(중복 연결 방지).
 */
export async function insertMailAccount(
  channelId: string,
  userId: string,
  account: InsertableMailAccount,
): Promise<MailAccount> {
  const existingRow = await getDatabase()
    .prepare(
      `SELECT ${accountColumns} FROM mail_accounts WHERE channel_id = ? AND user_id = ? AND email = ?`,
    )
    .bind(channelId, userId, account.email)
    .first<MailAccountRow>();

  if (existingRow) {
    if (
      account.accessToken !== undefined ||
      account.refreshToken !== undefined ||
      account.tokenExpiresAt !== undefined ||
      account.tokenScope !== undefined
    ) {
      await updateMailAccountTokens(existingRow.id, {
        accessToken: account.accessToken ?? existingRow.access_token ?? null,
        refreshToken: account.refreshToken ?? existingRow.refresh_token ?? null,
        tokenExpiresAt: account.tokenExpiresAt ?? existingRow.token_expires_at ?? null,
        tokenScope: account.tokenScope ?? existingRow.token_scope ?? null,
      });
    }
    return toMailAccount(existingRow);
  }
  const existing = await findMailAccountByEmail(
    channelId,
    userId,
    account.email,
  );
  if (existing) return existing;

  await getDatabase()
    .prepare(
      `INSERT INTO mail_accounts (id, channel_id, user_id, provider, email, display_name, connected_at, access_token, refresh_token, token_expires_at, token_scope) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      account.id,
      channelId,
      userId,
      account.provider,
      account.email,
      account.displayName ?? null,
      account.connectedAt,
      account.accessToken ?? null,
      account.refreshToken ?? null,
      account.tokenExpiresAt ?? null,
      account.tokenScope ?? null,
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

export async function getMailAccountTokens(
  accountId: string,
): Promise<MailAccountTokenSet | null> {
  const row = await getDatabase()
    .prepare(
      "SELECT access_token, refresh_token, token_expires_at, token_scope FROM mail_accounts WHERE id = ?",
    )
    .bind(accountId)
    .first<Pick<MailAccountRow, "access_token" | "refresh_token" | "token_expires_at" | "token_scope">>();

  if (!row) return null;
  return {
    accessToken: row.access_token ?? null,
    refreshToken: row.refresh_token ?? null,
    tokenExpiresAt: row.token_expires_at ?? null,
    tokenScope: row.token_scope ?? null,
  };
}

export async function updateMailAccountTokens(
  accountId: string,
  tokens: MailAccountTokenSet,
): Promise<void> {
  await getDatabase()
    .prepare(
      "UPDATE mail_accounts SET access_token = ?, refresh_token = ?, token_expires_at = ?, token_scope = ? WHERE id = ?",
    )
    .bind(
      tokens.accessToken,
      tokens.refreshToken,
      tokens.tokenExpiresAt,
      tokens.tokenScope,
      accountId,
    )
    .run();
}

/** 계정 연결 해제. 실제로 지워졌으면 true. */
export async function deleteMailAccount(
  channelId: string,
  userId: string,
  accountId: string,
): Promise<boolean> {
  const existing = await findMailAccountRowById(channelId, userId, accountId);
  if (!existing) return false;

  await getDatabase()
    .prepare(
      "DELETE FROM mail_accounts WHERE channel_id = ? AND user_id = ? AND id = ?",
    )
    .bind(channelId, userId, accountId)
    .run();

  return true;
}
