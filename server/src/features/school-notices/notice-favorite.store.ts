import type { Notice, NoticeListInput, NoticeListOutput } from "@tutorial/shared";
import { getDatabase } from "../../database.js";
import { listNoticeRows, toNotice, type NoticeRow } from "./school-notice.store.js";

interface FavoriteRow {
  id: string;
  notice_id: number;
  created_at: string;
}

function favoriteId(channelId: string, userId: string, noticeId: string): string {
  let hash = 0x811c9dc5;
  const value = `${channelId}|${userId}|${noticeId}`;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fav-${(hash >>> 0).toString(36)}`;
}

export async function favoriteNoticeIds(
  channelId: string,
  userId: string,
): Promise<Map<string, string>> {
  const rows = await getDatabase()
    .prepare(
      `SELECT notice_id, created_at
       FROM notice_favorites
       WHERE channel_id = ? AND user_id = ?`,
    )
    .bind(channelId, userId)
    .all<{ notice_id: number; created_at: string }>();

  return new Map(rows.results.map((row) => [String(row.notice_id), row.created_at]));
}

export async function listNoticesWithFavorites(
  channelId: string,
  userId: string,
  input: NoticeListInput = {},
): Promise<NoticeListOutput> {
  const [rows, favorites] = await Promise.all([
    listNoticeRows(input),
    favoriteNoticeIds(channelId, userId),
  ]);
  return {
    notices: rows.map((row) => {
      const notice = toNotice(row);
      const favoritedAt = favorites.get(notice.id) ?? null;
      return { ...notice, isFavorite: Boolean(favoritedAt), favoritedAt };
    }),
  };
}

export async function listFavoriteNotices(
  channelId: string,
  userId: string,
): Promise<NoticeListOutput> {
  const rows = await getDatabase()
    .prepare(
      `SELECT n.id, n.title, n.content, n.url, n.posted_at, n.department, n.category, n.created_at, f.created_at AS favorited_at
       FROM notice_favorites f
       JOIN notices n ON n.id = f.notice_id
       WHERE f.channel_id = ? AND f.user_id = ?
       ORDER BY f.created_at DESC`,
    )
    .bind(channelId, userId)
    .all<NoticeRow & { favorited_at: string }>();

  return {
    notices: rows.results.map((row) => ({
      ...toNotice(row),
      isFavorite: true,
      favoritedAt: row.favorited_at,
    })),
  };
}

export async function toggleNoticeFavorite(
  channelId: string,
  userId: string,
  noticeId: string,
): Promise<boolean> {
  const notice = await getDatabase()
    .prepare("SELECT id FROM notices WHERE id = ?")
    .bind(Number(noticeId))
    .first<{ id: number }>();
  if (!notice) throw new Error("Notice not found");

  const existing = await getDatabase()
    .prepare(
      `SELECT id, notice_id, created_at
       FROM notice_favorites
       WHERE channel_id = ? AND user_id = ? AND notice_id = ?`,
    )
    .bind(channelId, userId, Number(noticeId))
    .first<FavoriteRow>();

  if (existing) {
    await getDatabase()
      .prepare("DELETE FROM notice_favorites WHERE id = ?")
      .bind(existing.id)
      .run();
    return false;
  }

  await getDatabase()
    .prepare(
      `INSERT OR IGNORE INTO notice_favorites (id, channel_id, user_id, notice_id)
       VALUES (?, ?, ?, ?)`,
    )
    .bind(favoriteId(channelId, userId, noticeId), channelId, userId, Number(noticeId))
    .run();
  return true;
}
