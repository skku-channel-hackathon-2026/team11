import type { SyncNoticesOutput } from "@tutorial/shared";
import {
  collectNoticesFromAdapters,
  schoolNoticeAdapters,
  type NoticeSourceAdapter,
} from "./notice-crawler.js";
import { upsertNotice } from "./school-notice.store.js";

export async function syncSchoolNotices(
  adapters: readonly NoticeSourceAdapter[] = schoolNoticeAdapters,
): Promise<SyncNoticesOutput> {
  const notices = await collectNoticesFromAdapters(adapters);
  const result: SyncNoticesOutput = { inserted: 0, updated: 0, skipped: 0 };

  for (const notice of notices) {
    const status = await upsertNotice(notice);
    result[status] += 1;
  }

  return result;
}
