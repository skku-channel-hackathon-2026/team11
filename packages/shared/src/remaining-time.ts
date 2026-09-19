export type RemainingDeadlinePrecision =
  | "datetime"
  | "date"
  | "range"
  | "unknown";

const minuteMs = 60_000;
const hourMs = 60 * minuteMs;
const dayMs = 24 * hourMs;

function kstDateParts(value: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

function dateOnlyParts(value: string): { year: number; month: number; day: number } | null {
  const match = value.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

export function getDeadlineTargetTimeMs(
  deadline: string,
  precision: RemainingDeadlinePrecision,
): number | null {
  if (precision === "unknown") return null;

  if (precision === "datetime") {
    const value = new Date(deadline).getTime();
    return Number.isNaN(value) ? null : value;
  }

  const parsed = new Date(deadline);
  const parts = Number.isNaN(parsed.getTime())
    ? dateOnlyParts(deadline)
    : kstDateParts(parsed);

  if (!parts) return null;

  // Date-only/range deadlines use the end of that Korea date for UI countdown only.
  return Date.UTC(parts.year, parts.month - 1, parts.day, 14, 59, 59, 999);
}

export function formatRemainingTime(
  deadline: string | null,
  precision: RemainingDeadlinePrecision,
  now = new Date(),
): string | null {
  if (!deadline) return null;
  const targetMs = getDeadlineTargetTimeMs(deadline, precision);
  if (targetMs === null) return null;

  const diff = targetMs - now.getTime();
  if (diff <= 0) return null;
  if (diff < minuteMs) return "1분 미만";
  if (diff < hourMs) return `${Math.floor(diff / minuteMs)}분`;

  const days = Math.floor(diff / dayMs);
  const hours = Math.floor((diff % dayMs) / hourMs);
  if (days <= 0) return `${hours}시간`;
  return `${days}일 ${hours}시간`;
}
