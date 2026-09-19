import type {
  ChatDeadlineItem,
  ChatRequiredActionItem,
  HomeDeadlineItem,
  HomeRequiredActionItem,
  MailMessage,
  Notice,
} from "@tutorial/shared";

const deadlineKeywords = [
  "마감",
  "기한",
  "까지",
  "신청기간",
  "접수기간",
  "제출기간",
  "등록기간",
  "납부기간",
];

const actionKeywords = [
  "신청",
  "제출",
  "등록",
  "납부",
  "참여",
  "작성",
  "회신",
  "응답",
  "확인",
  "수강신청",
  "변경",
  "완료",
];

const informationalKeywords = ["개최되었습니다", "수상", "개편", "홍보", "뉴스레터"];

export type PeriodHint = "week" | "month" | "default";
type DeadlinePrecision = "datetime" | "date" | "range" | "unknown";
type DeadlineConfidence = "high" | "medium" | "low";
interface ExtractedDeadline {
  value: Date;
  precision: DeadlinePrecision;
  confidence: DeadlineConfidence;
}

export function periodHintFromQuery(query: string | null | undefined): PeriodHint {
  const text = query ?? "";
  if (text.includes("이번 주") || text.includes("이번주")) return "week";
  if (text.includes("이번 달") || text.includes("이번달")) return "month";
  return "default";
}

export function periodEnd(now: Date, hint: PeriodHint): Date {
  const end = new Date(now);
  if (hint === "week") {
    const day = end.getDay();
    const daysUntilSunday = day === 0 ? 0 : 7 - day;
    end.setDate(end.getDate() + daysUntilSunday);
  } else if (hint === "month") {
    end.setMonth(end.getMonth() + 1, 0);
  } else {
    end.setDate(end.getDate() + 30);
  }
  end.setHours(23, 59, 59, 999);
  return end;
}

export function extractDeadlineItems(
  notices: Notice[],
  mails: MailMessage[],
  now = new Date(),
  hint: PeriodHint = "default",
): ChatDeadlineItem[] {
  const end = periodEnd(now, hint);
  const items = [
    ...notices.flatMap((notice) => {
      const deadline = extractDeadline(`${notice.title}\n${notice.content}`, now);
      if (!deadline || deadline.value < now || deadline.value > end) return [];
      return [toDeadlineNotice(notice, deadline.value)];
    }),
    ...mails.flatMap((mail) => {
      const deadline = extractDeadline(`${mail.subject}\n${mail.snippet}`, now);
      if (!deadline || deadline.value < now || deadline.value > end) return [];
      return [toDeadlineMail(mail, deadline.value)];
    }),
  ];

  return items.sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
}

export function extractActionItems(
  notices: Notice[],
  mails: MailMessage[],
  now = new Date(),
): ChatRequiredActionItem[] {
  const items = [
    ...notices.flatMap((notice) => {
      const text = `${notice.title}\n${notice.content}`;
      const action = extractAction(text);
      if (!action) return [];
      const deadline = extractDeadline(text, now);
      if (deadline && deadline.value < now) return [];
      return [toActionNotice(notice, action, deadline?.value ?? null)];
    }),
    ...mails.flatMap((mail) => {
      const text = `${mail.subject}\n${mail.snippet}`;
      const action = extractAction(text);
      if (!action) return [];
      const deadline = extractDeadline(text, now);
      if (deadline && deadline.value < now) return [];
      return [toActionMail(mail, action, deadline?.value ?? null)];
    }),
  ];

  return items.sort((a, b) => {
    if (a.deadline && b.deadline) {
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    }
    if (a.deadline) return -1;
    if (b.deadline) return 1;
    return b.date.localeCompare(a.date);
  });
}

export function extractDeadline(text: string, now: Date): ExtractedDeadline | null {
  if (!deadlineKeywords.some((keyword) => text.includes(keyword))) return null;
  const normalized = text.replace(/\s+/g, " ");
  const year = now.getFullYear();
  const patterns: RegExp[] = [
    /(20\d{2})[.\-/년\s]+(\d{1,2})[.\-/월\s]+(\d{1,2})/,
    /(\d{1,2})\s*월\s*(\d{1,2})\s*일/,
    /(\d{1,2})\s*[./-]\s*(\d{1,2})/,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match) continue;
    const values = match.slice(1).map(Number);
    const date = values.length === 3
      ? new Date(values[0] ?? year, (values[1] ?? 1) - 1, values[2] ?? 1)
      : new Date(year, (values[0] ?? 1) - 1, values[1] ?? 1);
    const time = normalized.match(/(\d{1,2})\s*:\s*(\d{2})/);
    if (time) {
      date.setHours(Number(time[1]), Number(time[2]), 0, 0);
      return { value: date, precision: "datetime", confidence: "high" };
    }
    date.setHours(0, 0, 0, 0);
    return { value: date, precision: "date", confidence: "high" };
  }

  return null;
}

function extractAction(text: string): string | null {
  if (informationalKeywords.some((keyword) => text.includes(keyword))) return null;
  const keyword = actionKeywords.find((item) => text.includes(item));
  if (!keyword) return null;
  const compact = text.replace(/\s+/g, " ").trim();
  const sentence = compact.split(/[.!?。]/).find((part) => part.includes(keyword)) ?? compact;
  return sentence.length > 80 ? `${sentence.slice(0, 80)}...` : sentence;
}

function toDeadlineNotice(notice: Notice, deadline: Date): ChatDeadlineItem {
  return {
    sourceType: "DEADLINE",
    originalSourceType: "NOTICE",
    id: notice.id,
    title: notice.title,
    deadline: deadline.toISOString(),
    date: deadline.toISOString(),
    source: notice.source,
    category: notice.category,
    url: notice.url,
    snippet: summarize(notice.content),
  };
}

function toDeadlineMail(mail: MailMessage, deadline: Date): ChatDeadlineItem {
  return {
    sourceType: "DEADLINE",
    originalSourceType: "MAIL",
    id: mail.id,
    title: mail.subject,
    deadline: deadline.toISOString(),
    date: deadline.toISOString(),
    source: mail.from,
    snippet: summarize(mail.snippet),
  };
}

function toActionNotice(
  notice: Notice,
  action: string,
  deadline: Date | null,
): ChatRequiredActionItem {
  return {
    sourceType: "ACTION",
    originalSourceType: "NOTICE",
    id: notice.id,
    title: notice.title,
    action,
    deadline: deadline?.toISOString() ?? null,
    date: deadline?.toISOString() ?? notice.postedAt,
    source: notice.source,
    category: notice.category,
    url: notice.url,
    snippet: summarize(notice.content),
  };
}

function toActionMail(
  mail: MailMessage,
  action: string,
  deadline: Date | null,
): ChatRequiredActionItem {
  return {
    sourceType: "ACTION",
    originalSourceType: "MAIL",
    id: mail.id,
    title: mail.subject,
    action,
    deadline: deadline?.toISOString() ?? null,
    date: deadline?.toISOString() ?? mail.receivedAt,
    source: mail.from,
    snippet: summarize(mail.snippet),
  };
}

function summarize(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 140 ? `${normalized.slice(0, 140)}...` : normalized;
}


export function extractHomeDeadlineItems(
  notices: Notice[],
  mails: MailMessage[],
  now = new Date(),
  hint: PeriodHint = "default",
): HomeDeadlineItem[] {
  const end = periodEnd(now, hint);
  const items = [
    ...notices.flatMap((notice) => {
      const deadline = extractDeadline(`${notice.title}\n${notice.content}`, now);
      if (!deadline || deadline.value < now || deadline.value > end) return [];
      return [{ ...toDeadlineNotice(notice, deadline.value), precision: deadline.precision, confidence: deadline.confidence }];
    }),
    ...mails.flatMap((mail) => {
      const deadline = extractDeadline(`${mail.subject}\n${mail.snippet}`, now);
      if (!deadline || deadline.value < now || deadline.value > end) return [];
      return [{ ...toDeadlineMail(mail, deadline.value), precision: deadline.precision, confidence: deadline.confidence }];
    }),
  ];
  return items.sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
}

export function extractHomeActionItems(
  notices: Notice[],
  mails: MailMessage[],
  now = new Date(),
): HomeRequiredActionItem[] {
  const items = [
    ...notices.flatMap((notice) => {
      const text = `${notice.title}\n${notice.content}`;
      const action = extractAction(text);
      if (!action) return [];
      const deadline = extractDeadline(text, now);
      if (deadline && deadline.value < now) return [];
      return [{
        ...toActionNotice(notice, action, deadline?.value ?? null),
        precision: deadline?.precision ?? null,
        confidence: deadline?.confidence ?? null,
      }];
    }),
    ...mails.flatMap((mail) => {
      const text = `${mail.subject}\n${mail.snippet}`;
      const action = extractAction(text);
      if (!action) return [];
      const deadline = extractDeadline(text, now);
      if (deadline && deadline.value < now) return [];
      return [{
        ...toActionMail(mail, action, deadline?.value ?? null),
        precision: deadline?.precision ?? null,
        confidence: deadline?.confidence ?? null,
      }];
    }),
  ];
  return items.sort((a, b) => {
    if (a.deadline && b.deadline) return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    if (a.deadline) return -1;
    if (b.deadline) return 1;
    return b.date.localeCompare(a.date);
  });
}
