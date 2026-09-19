export interface CrawledAcademicSchedule {
  title: string;
  startAt: string;
  endAt: string | null;
  description: string | null;
  source: string;
  sourceUrl: string;
  category: string | null;
}

interface SkkuScheduleItem {
  title?: unknown;
  start?: unknown;
  end?: unknown;
  etcDate1?: unknown;
  etcDate2?: unknown;
  articleNo?: unknown;
}

interface SkkuScheduleResponse {
  data?: SkkuScheduleItem[];
}

const skkuScheduleEndpoint =
  "https://cse.skku.edu/_custom/shb/_common/board/calendar/proc/getCalendarData.jsp";
const skkuSchedulePageUrl = "https://cse.skku.edu/cse/schedule.do";
const skkuScheduleBoardNo = "4627";
const sourceName = "성균관대학교 소프트웨어학과";

function defaultYear(): number {
  return Number(
    new Intl.DateTimeFormat("en", {
      timeZone: "Asia/Seoul",
      year: "numeric",
    }).format(new Date()),
  );
}

function cleanText(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function isDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

async function fetchJsonWithTimeout(url: URL): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: "application/json,text/javascript,*/*",
        "user-agent": "HANOON academic schedule crawler (+https://cse.skku.edu)",
      },
    });

    if (!response.ok) {
      throw new Error(`SKKU academic schedule request failed: ${response.status}`);
    }

    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeItem(item: SkkuScheduleItem): CrawledAcademicSchedule | null {
  const title = cleanText(item.title);
  const startAt = cleanText(item.etcDate1 || item.start);
  const endAt = cleanText(item.etcDate2 || item.end);

  if (!title || !isDate(startAt)) return null;

  return {
    title,
    startAt,
    endAt: isDate(endAt) ? endAt : null,
    description: null,
    source: sourceName,
    sourceUrl: skkuSchedulePageUrl,
    category: "학사일정",
  };
}

export async function fetchSkkuAcademicSchedules(
  year = defaultYear(),
): Promise<CrawledAcademicSchedule[]> {
  const url = new URL(skkuScheduleEndpoint);
  url.searchParams.set("boardNo", skkuScheduleBoardNo);
  url.searchParams.set("date", `${year}-01-01`);
  url.searchParams.set("type", "year");
  url.searchParams.set("locale", "ko");

  const text = (await fetchJsonWithTimeout(url)).trim();
  const parsed = JSON.parse(text) as SkkuScheduleResponse;
  const rows = Array.isArray(parsed.data) ? parsed.data : [];
  const schedules = rows
    .map((item) => normalizeItem(item))
    .filter((item): item is CrawledAcademicSchedule => item !== null);

  const seen = new Set<string>();
  return schedules.filter((schedule) => {
    const key = `${schedule.title}|${schedule.startAt}|${schedule.endAt ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
