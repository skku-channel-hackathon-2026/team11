import type {
  ChecklistTask,
  ChecklistTaskSource,
  HomeProgress,
} from "@tutorial/shared";
import { getDatabase } from "../../database.js";
import { calculateLevelProgress } from "./level.js";

export type ChecklistSourceType = "NOTICE" | "MAIL" | "ACADEMIC_SCHEDULE";
export type DeadlinePrecision = "datetime" | "date" | "range" | "unknown";

export interface ChecklistCandidateSource {
  sourceType: ChecklistSourceType;
  sourceId: string;
  title: string;
  url: string | null;
}

export interface ChecklistCandidate {
  canonicalKey: string;
  canonicalTitle: string;
  action: string;
  deadline: string | null;
  deadlinePrecision: DeadlinePrecision;
  sources: ChecklistCandidateSource[];
}

interface ChecklistTaskRow {
  id: string;
  channel_id: string;
  user_id: string;
  canonical_key: string;
  canonical_title: string;
  action: string;
  deadline: string | null;
  deadline_precision: DeadlinePrecision;
  status: "pending" | "completed" | "dismissed";
  completed_at: string | null;
  xp_reward: number;
  created_at: string;
  updated_at: string;
}

interface ChecklistTaskSourceRow {
  id: string;
  task_id: string;
  source_type: ChecklistSourceType;
  source_id: string;
  title: string;
  url: string | null;
}

const defaultXpReward = 10;

function hash(value: string): string {
  let hashValue = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hashValue ^= value.charCodeAt(i);
    hashValue = Math.imul(hashValue, 0x01000193);
  }
  return (hashValue >>> 0).toString(36);
}

function taskId(channelId: string, userId: string, canonicalKey: string): string {
  return `task-${hash(`${channelId}|${userId}|${canonicalKey}`)}`;
}

function sourceId(taskIdValue: string, source: ChecklistCandidateSource): string {
  return `src-${hash(`${taskIdValue}|${source.sourceType}|${source.sourceId}`)}`;
}

function toTask(
  row: ChecklistTaskRow,
  sources: ChecklistTaskSourceRow[],
  newIds: Set<string>,
): ChecklistTask {
  return {
    id: row.id,
    canonicalTitle: row.canonical_title,
    action: row.action,
    deadline: row.deadline,
    deadlinePrecision: row.deadline_precision,
    status: row.status,
    completedAt: row.completed_at,
    xpReward: row.xp_reward,
    sources: sources.map((source): ChecklistTaskSource => ({
      id: source.id,
      sourceType: source.source_type,
      sourceId: source.source_id,
      title: source.title,
      url: source.url,
    })),
    isNew: newIds.has(row.id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function precisionRank(value: DeadlinePrecision): number {
  if (value === "datetime") return 4;
  if (value === "date") return 3;
  if (value === "range") return 2;
  return 1;
}

function shouldReplaceDeadline(
  existing: ChecklistTaskRow,
  candidate: ChecklistCandidate,
): boolean {
  if (!candidate.deadline) return false;
  if (!existing.deadline) return true;
  const nextRank = precisionRank(candidate.deadlinePrecision);
  const currentRank = precisionRank(existing.deadline_precision);
  if (nextRank !== currentRank) return nextRank > currentRank;
  return candidate.deadline < existing.deadline;
}

export async function reconcileChecklistTasks(
  channelId: string,
  userId: string,
  candidates: ChecklistCandidate[],
): Promise<{ tasks: ChecklistTask[]; newTaskCount: number }> {
  const newIds = new Set<string>();

  for (const candidate of candidates) {
    const id = taskId(channelId, userId, candidate.canonicalKey);
    const existing = await getDatabase()
      .prepare(
        `SELECT id, channel_id, user_id, canonical_key, canonical_title, action, deadline, deadline_precision, status, completed_at, xp_reward, created_at, updated_at
         FROM checklist_tasks
         WHERE channel_id = ? AND user_id = ? AND canonical_key = ?`,
      )
      .bind(channelId, userId, candidate.canonicalKey)
      .first<ChecklistTaskRow>();

    if (!existing) {
      await getDatabase()
        .prepare(
          `INSERT INTO checklist_tasks
           (id, channel_id, user_id, canonical_key, canonical_title, action, deadline, deadline_precision, xp_reward)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          id,
          channelId,
          userId,
          candidate.canonicalKey,
          candidate.canonicalTitle,
          candidate.action,
          candidate.deadline,
          candidate.deadlinePrecision,
          defaultXpReward,
        )
        .run();
      newIds.add(id);
    } else {
      const nextDeadline = shouldReplaceDeadline(existing, candidate)
        ? candidate.deadline
        : existing.deadline;
      const nextPrecision = shouldReplaceDeadline(existing, candidate)
        ? candidate.deadlinePrecision
        : existing.deadline_precision;
      await getDatabase()
        .prepare(
          `UPDATE checklist_tasks
           SET canonical_title = ?, action = ?, deadline = ?, deadline_precision = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
        )
        .bind(
          candidate.canonicalTitle,
          candidate.action,
          nextDeadline,
          nextPrecision,
          existing.id,
        )
        .run();
    }

    for (const source of candidate.sources) {
      await getDatabase()
        .prepare(
          `INSERT OR IGNORE INTO checklist_task_sources
           (id, task_id, source_type, source_id, title, url)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .bind(sourceId(id, source), id, source.sourceType, source.sourceId, source.title, source.url)
        .run();
    }
  }

  return { tasks: await listChecklistTasks(channelId, userId, newIds), newTaskCount: newIds.size };
}

export async function listChecklistTasks(
  channelId: string,
  userId: string,
  newIds = new Set<string>(),
  options: { includeDismissed?: boolean } = {},
): Promise<ChecklistTask[]> {
  const rows = await getDatabase()
    .prepare(
      `SELECT id, channel_id, user_id, canonical_key, canonical_title, action, deadline, deadline_precision, status, completed_at, xp_reward, created_at, updated_at
       FROM checklist_tasks
       WHERE channel_id = ? AND user_id = ?${options.includeDismissed ? "" : " AND status != 'dismissed'"}
       ORDER BY status ASC, COALESCE(deadline, '9999-12-31') ASC, updated_at DESC`,
    )
    .bind(channelId, userId)
    .all<ChecklistTaskRow>();

  if (rows.results.length === 0) return [];
  const sources = await getDatabase()
    .prepare(
      `SELECT id, task_id, source_type, source_id, title, url
       FROM checklist_task_sources
       WHERE task_id IN (${rows.results.map(() => "?").join(", ")})
       ORDER BY source_type ASC, title ASC`,
    )
    .bind(...rows.results.map((row) => row.id))
    .all<ChecklistTaskSourceRow>();

  return rows.results.map((row) =>
    toTask(
      row,
      sources.results.filter((source) => source.task_id === row.id),
      newIds,
    ),
  );
}

export async function ensureUserProgress(
  channelId: string,
  userId: string,
): Promise<number> {
  await getDatabase()
    .prepare(
      `INSERT OR IGNORE INTO user_progress (channel_id, user_id, total_xp)
       VALUES (?, ?, 0)`,
    )
    .bind(channelId, userId)
    .run();
  await recomputeUserProgress(channelId, userId);
  const row = await getDatabase()
    .prepare("SELECT total_xp FROM user_progress WHERE channel_id = ? AND user_id = ?")
    .bind(channelId, userId)
    .first<{ total_xp: number }>();
  return row?.total_xp ?? 0;
}

async function recomputeUserProgress(channelId: string, userId: string): Promise<void> {
  await getDatabase()
    .prepare(
      `UPDATE user_progress
       SET total_xp = (
         SELECT COALESCE(SUM(xp_awarded), 0)
         FROM checklist_xp_awards
         WHERE channel_id = ? AND user_id = ?
       ), updated_at = CURRENT_TIMESTAMP
       WHERE channel_id = ? AND user_id = ?`,
    )
    .bind(channelId, userId, channelId, userId)
    .run();
}

export async function progressForTasks(
  channelId: string,
  userId: string,
  tasks: ChecklistTask[],
): Promise<HomeProgress> {
  const totalXp = await ensureUserProgress(channelId, userId);
  const completedTasks = tasks.filter((task) => task.status === "completed").length;
  return calculateLevelProgress(totalXp, completedTasks, tasks.length);
}

export async function completeChecklistTask(
  channelId: string,
  userId: string,
  id: string,
): Promise<{ task: ChecklistTask; progress: HomeProgress; xpAwarded: number; previousTotalXp: number }> {
  const beforeProgress = await ensureUserProgress(channelId, userId);
  const row = await getDatabase()
    .prepare(
      `SELECT id, channel_id, user_id, canonical_key, canonical_title, action, deadline, deadline_precision, status, completed_at, xp_reward, created_at, updated_at
       FROM checklist_tasks
       WHERE channel_id = ? AND user_id = ? AND id = ?`,
    )
    .bind(channelId, userId, id)
    .first<ChecklistTaskRow>();

  if (!row) throw new Error("Checklist task not found");

  if (row.status === "dismissed") {
    throw new Error("Dismissed checklist task cannot be completed");
  }

  if (row.status === "pending") {
    await getDatabase()
      .prepare(
        `UPDATE checklist_tasks
         SET status = 'completed', completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP
         WHERE channel_id = ? AND user_id = ? AND id = ? AND status = 'pending'`,
      )
      .bind(channelId, userId, id)
      .run();
  }

  const awardBefore = await getDatabase()
    .prepare("SELECT task_id FROM checklist_xp_awards WHERE task_id = ?")
    .bind(id)
    .first<{ task_id: string }>();

  await getDatabase()
    .prepare(
      `INSERT OR IGNORE INTO checklist_xp_awards
       (task_id, channel_id, user_id, xp_awarded)
       VALUES (?, ?, ?, ?)`,
    )
    .bind(id, channelId, userId, row.xp_reward)
    .run();

  await recomputeUserProgress(channelId, userId);
  const tasks = await listChecklistTasks(channelId, userId);
  const task = tasks.find((item) => item.id === id);
  if (!task) throw new Error("Checklist task not found after completion");
  return {
    task,
    progress: await progressForTasks(channelId, userId, tasks),
    xpAwarded: awardBefore ? 0 : row.xp_reward,
    previousTotalXp: beforeProgress,
  };
}

export async function undoChecklistTask(
  channelId: string,
  userId: string,
  id: string,
): Promise<{ task: ChecklistTask; progress: HomeProgress; xpReverted: number; previousTotalXp: number }> {
  const beforeProgress = await ensureUserProgress(channelId, userId);
  const row = await getDatabase()
    .prepare(
      `SELECT id, channel_id, user_id, canonical_key, canonical_title, action, deadline, deadline_precision, status, completed_at, xp_reward, created_at, updated_at
       FROM checklist_tasks
       WHERE channel_id = ? AND user_id = ? AND id = ?`,
    )
    .bind(channelId, userId, id)
    .first<ChecklistTaskRow>();

  if (!row) throw new Error("Checklist task not found");

  const award = await getDatabase()
    .prepare("SELECT xp_awarded FROM checklist_xp_awards WHERE task_id = ? AND channel_id = ? AND user_id = ?")
    .bind(id, channelId, userId)
    .first<{ xp_awarded: number }>();

  if (row.status === "completed") {
    await getDatabase()
      .prepare(
        `UPDATE checklist_tasks
         SET status = 'pending', completed_at = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE channel_id = ? AND user_id = ? AND id = ? AND status = 'completed'`,
      )
      .bind(channelId, userId, id)
      .run();
  }

  if (award) {
    await getDatabase()
      .prepare("DELETE FROM checklist_xp_awards WHERE task_id = ? AND channel_id = ? AND user_id = ?")
      .bind(id, channelId, userId)
      .run();
  }

  await recomputeUserProgress(channelId, userId);
  const tasks = await listChecklistTasks(channelId, userId);
  const task = tasks.find((item) => item.id === id);
  if (!task) throw new Error("Checklist task not found after undo");
  return {
    task,
    progress: await progressForTasks(channelId, userId, tasks),
    xpReverted: award?.xp_awarded ?? 0,
    previousTotalXp: beforeProgress,
  };
}


export async function dismissChecklistTask(
  channelId: string,
  userId: string,
  id: string,
): Promise<{ task: ChecklistTask; progress: HomeProgress; previousTotalXp: number }> {
  const beforeProgress = await ensureUserProgress(channelId, userId);
  const row = await getDatabase()
    .prepare(
      `SELECT id, channel_id, user_id, canonical_key, canonical_title, action, deadline, deadline_precision, status, completed_at, xp_reward, created_at, updated_at
       FROM checklist_tasks
       WHERE channel_id = ? AND user_id = ? AND id = ?`,
    )
    .bind(channelId, userId, id)
    .first<ChecklistTaskRow>();

  if (!row) throw new Error("Checklist task not found");
  if (row.status === "completed") {
    throw new Error("Completed checklist task must be undone before dismissing");
  }

  if (row.status === "pending") {
    await getDatabase()
      .prepare(
        `UPDATE checklist_tasks
         SET status = 'dismissed', completed_at = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE channel_id = ? AND user_id = ? AND id = ? AND status = 'pending'`,
      )
      .bind(channelId, userId, id)
      .run();
  }

  await recomputeUserProgress(channelId, userId);
  const activeTasks = await listChecklistTasks(channelId, userId);
  const allTasks = await listChecklistTasks(channelId, userId, new Set<string>(), { includeDismissed: true });
  const task = allTasks.find((item) => item.id === id);
  if (!task) throw new Error("Checklist task not found after dismissal");

  return {
    task,
    progress: await progressForTasks(channelId, userId, activeTasks),
    previousTotalXp: beforeProgress,
  };
}
