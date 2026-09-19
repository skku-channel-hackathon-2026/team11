import type { AcademicSchedule, MailMessage, Notice } from "@tutorial/shared";
import { extractDeadline } from "../chat/schedule-analysis.js";
import type { ChecklistCandidate, ChecklistCandidateSource, DeadlinePrecision } from "./checklist.store.js";

const actionKeywords = [
  "신청",
  "제출",
  "등록",
  "납부",
  "수강신청",
  "수강변경",
  "수강철회",
  "변경",
  "취소",
  "확인",
  "응시",
  "면제",
  "포기",
  "이수",
  "참여",
  "접수",
];

const passiveScheduleKeywords = [
  "개시일",
  "개강",
  "기념일",
  "공휴일",
  "탄강일",
  "시험",
  "수업일수",
  "학기 개시",
  "방학",
  "종강",
];

const stopwords = [
  "안내",
  "기간",
  "학년도",
  "학기",
  "관련",
  "공지",
  "모집",
  "성균관대학교",
  "소프트웨어",
  "학사",
];

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/\[[^\]]+\]/g, " ")
    .replace(/202\d학년도/g, " ")
    .replace(/[0-9]+학기/g, (match) => match)
    .replace(/[^0-9a-z가-힣]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactKey(value: string): string {
  const normalized = normalizeText(value);
  return normalized
    .split(" ")
    .filter((token) => token.length > 0 && !stopwords.includes(token))
    .join("");
}

function actionKeyword(text: string): string | null {
  return actionKeywords.find((keyword) => text.includes(keyword)) ?? null;
}

function semesterKey(text: string): string {
  const semester = text.match(/([12])\s*학기/);
  return semester ? `${semester[1]}학기` : "";
}

function dateKey(deadline: string | null): string {
  if (!deadline) return "no-date";
  const date = new Date(deadline);
  if (Number.isNaN(date.getTime())) return deadline.slice(0, 10);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function canonicalTitle(title: string, action: string): string {
  const cleaned = title
    .replace(/^\[[^\]]+\]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length <= 34) return cleaned;
  const keyword = actionKeyword(cleaned) ?? actionKeyword(action);
  if (!keyword) return `${cleaned.slice(0, 34)}...`;
  const index = cleaned.indexOf(keyword);
  const start = Math.max(0, index - 16);
  return cleaned.slice(start, start + 34).trim();
}

function topicKey(text: string): string {
  if (text.includes("수강신청") || text.includes("수강변경")) return "수강신청";
  if (text.includes("수강철회")) return "수강철회";
  if (text.includes("장학")) return compactKey(text).slice(0, 18);
  if (text.includes("등록금") || text.includes("분할납부")) return "등록금";
  if (text.includes("휴학")) return "휴학";
  if (text.includes("복수전공")) return "복수전공";
  if (text.includes("마이크로디그리")) return "마이크로디그리";
  if (text.includes("논문")) return "논문";
  return compactKey(text).slice(0, 18);
}

function candidateKey(title: string, action: string, deadline: string | null): string {
  const text = `${title} ${action}`;
  const keyword = actionKeyword(text) ?? "action";
  return [semesterKey(text), keyword, topicKey(text), dateKey(deadline)].filter(Boolean).join(":");
}

function summarize(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 90 ? `${normalized.slice(0, 90)}...` : normalized;
}

function source(
  sourceType: ChecklistCandidateSource["sourceType"],
  sourceId: string,
  title: string,
  url: string | null,
): ChecklistCandidateSource {
  return { sourceType, sourceId, title, url };
}

function fromNotice(notice: Notice, now: Date): ChecklistCandidate | null {
  const text = `${notice.title}\n${notice.content}`;
  const keyword = actionKeyword(text);
  if (!keyword) return null;
  const deadline = extractDeadline(text, now);
  if (deadline && deadline.value < now) return null;
  const deadlineValue = deadline?.value.toISOString() ?? null;
  const action = summarize(text.split(/[.!?。]/).find((part) => part.includes(keyword)) ?? notice.title);
  return {
    canonicalKey: candidateKey(notice.title, action, deadlineValue),
    canonicalTitle: canonicalTitle(notice.title, action),
    action,
    deadline: deadlineValue,
    deadlinePrecision: deadline?.precision ?? "unknown",
    sources: [source("NOTICE", notice.id, notice.title, notice.url)],
  };
}

function fromMail(mail: MailMessage, now: Date): ChecklistCandidate | null {
  const text = `${mail.subject}\n${mail.snippet}`;
  const keyword = actionKeyword(text);
  if (!keyword) return null;
  const deadline = extractDeadline(text, now);
  if (deadline && deadline.value < now) return null;
  const deadlineValue = deadline?.value.toISOString() ?? null;
  const action = summarize(text.split(/[.!?。]/).find((part) => part.includes(keyword)) ?? mail.subject);
  return {
    canonicalKey: candidateKey(mail.subject, action, deadlineValue),
    canonicalTitle: canonicalTitle(mail.subject, action),
    action,
    deadline: deadlineValue,
    deadlinePrecision: deadline?.precision ?? "unknown",
    sources: [source("MAIL", mail.id, mail.subject, null)],
  };
}

function fromSchedule(schedule: AcademicSchedule, now: Date): ChecklistCandidate | null {
  const text = schedule.title;
  const keyword = actionKeyword(text);
  if (!keyword) return null;
  if (passiveScheduleKeywords.some((item) => text.includes(item)) && !text.includes("신청")) return null;
  const end = schedule.endAt ?? schedule.startAt;
  const deadlineDate = new Date(`${end}T23:59:59+09:00`);
  if (deadlineDate < now) return null;
  const precision: DeadlinePrecision = schedule.endAt && schedule.endAt !== schedule.startAt ? "range" : "date";
  const action = schedule.title.includes("확인")
    ? schedule.title
    : `${schedule.title} 확인`;
  return {
    canonicalKey: candidateKey(schedule.title, action, deadlineDate.toISOString()),
    canonicalTitle: canonicalTitle(schedule.title, action),
    action,
    deadline: deadlineDate.toISOString(),
    deadlinePrecision: precision,
    sources: [source("ACADEMIC_SCHEDULE", schedule.id, schedule.title, schedule.sourceUrl)],
  };
}

function precisionRank(value: DeadlinePrecision): number {
  if (value === "datetime") return 4;
  if (value === "date") return 3;
  if (value === "range") return 2;
  return 1;
}

function mergeCandidate(target: ChecklistCandidate, next: ChecklistCandidate): void {
  if (!target.deadline || (next.deadline && precisionRank(next.deadlinePrecision) > precisionRank(target.deadlinePrecision))) {
    target.deadline = next.deadline;
    target.deadlinePrecision = next.deadlinePrecision;
  }
  if (next.canonicalTitle.length < target.canonicalTitle.length) {
    target.canonicalTitle = next.canonicalTitle;
  }
  for (const nextSource of next.sources) {
    if (!target.sources.some((item) => item.sourceType === nextSource.sourceType && item.sourceId === nextSource.sourceId)) {
      target.sources.push(nextSource);
    }
  }
}

function duplicateKey(candidate: ChecklistCandidate): string {
  const withoutSourceNoise = candidate.canonicalKey
    .replace(/안내/g, "")
    .replace(/기간/g, "");
  return withoutSourceNoise;
}

export function buildChecklistCandidates(
  notices: Notice[],
  mails: MailMessage[],
  schedules: AcademicSchedule[],
  now = new Date(),
): ChecklistCandidate[] {
  const raw = [
    ...notices.flatMap((notice) => fromNotice(notice, now) ?? []),
    ...mails.flatMap((mail) => fromMail(mail, now) ?? []),
    ...schedules.flatMap((schedule) => fromSchedule(schedule, now) ?? []),
  ];
  const merged = new Map<string, ChecklistCandidate>();

  for (const candidate of raw) {
    const key = duplicateKey(candidate);
    const existing = merged.get(key);
    if (existing) {
      mergeCandidate(existing, candidate);
    } else {
      merged.set(key, { ...candidate, sources: [...candidate.sources] });
    }
  }

  return [...merged.values()].sort((a, b) => {
    if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
    if (a.deadline) return -1;
    if (b.deadline) return 1;
    return a.canonicalTitle.localeCompare(b.canonicalTitle, "ko");
  });
}
