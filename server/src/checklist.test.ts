import assert from "node:assert/strict";
import test from "node:test";
import type { AcademicSchedule, MailMessage, Notice } from "@tutorial/shared";
import { buildChecklistCandidates } from "./features/checklist/checklist-analyzer.js";
import { calculateLevelProgress } from "./features/checklist/level.js";

test("level thresholds are deterministic and capped at level 10", () => {
  assert.equal(calculateLevelProgress(49, 0, 0).level, 1);
  assert.equal(calculateLevelProgress(50, 0, 0).level, 2);
  assert.equal(calculateLevelProgress(119, 0, 0).level, 2);
  assert.equal(calculateLevelProgress(120, 0, 0).level, 3);
  assert.equal(calculateLevelProgress(1100, 0, 0).level, 10);
  assert.equal(calculateLevelProgress(1500, 0, 0).isMaxLevel, true);
});

test("deduplicates one action found in notice, mail, and academic schedule", () => {
  const notice: Notice = {
    id: "notice-1",
    title: "2026학년도 2학기 수강신청 변경 안내",
    content: "수강신청 변경은 9월 25일까지 신청하세요.",
    url: "https://example.test/notice",
    postedAt: "2026-09-01",
    source: "성균관대학교 소프트웨어융합대학",
    department: "성균관대학교 소프트웨어융합대학",
    createdAt: "2026-09-01",
    category: "학사",
  };
  const mail: MailMessage = {
    id: "mail-1",
    accountId: "acc-1",
    accountEmail: "me@gmail.com",
    provider: "gmail",
    subject: "[학사] 수강신청 변경기간 안내",
    from: "school@example.test",
    receivedAt: "2026-09-02",
    snippet: "2학기 수강신청 변경기간은 9월 25일까지입니다.",
    isSchoolRelated: true,
    gmailMessageId: null,
    gmailThreadId: null,
    rfc822MessageId: null,
    externalUrl: null,
  };
  const schedule: AcademicSchedule = {
    id: "schedule-1",
    title: "2학기 수강신청 변경 및 취소",
    startAt: "2026-09-21",
    endAt: "2026-09-25",
    allDay: true,
    description: null,
    source: "성균관대학교 소프트웨어학과",
    sourceUrl: "https://cse.skku.edu/cse/schedule.do",
    category: "학사일정",
    createdAt: "2026-09-01",
    updatedAt: "2026-09-01",
  };

  const candidates = buildChecklistCandidates(
    [notice],
    [mail],
    [schedule],
    new Date("2026-09-19T00:00:00+09:00"),
  );

  assert.equal(candidates.length, 1);
  assert.deepEqual(
    candidates[0]?.sources.map((source) => source.sourceType).sort(),
    ["ACADEMIC_SCHEDULE", "MAIL", "NOTICE"],
  );
});

test("level decreases when XP is reverted below a threshold", () => {
  assert.equal(calculateLevelProgress(120, 4, 5).level, 3);
  const reverted = calculateLevelProgress(110, 3, 5);
  assert.equal(reverted.level, 2);
  assert.equal(reverted.completedTasks, 3);
  assert.equal(reverted.completionRate, 0.6);
});
