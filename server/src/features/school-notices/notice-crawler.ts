export interface RawNotice {
  title: string;
  content?: string;
  url: string;
  postedAt?: string;
  department?: string;
  category?: string;
}

export interface NormalizedNotice {
  title: string;
  content: string;
  url: string;
  postedAt: string;
  department: string;
  category: string | null;
}

export interface NoticeSourceAdapter {
  name: string;
  fetch(): Promise<string>;
  parse(html: string): Promise<RawNotice[]> | RawNotice[];
}

export function normalizeNotice(
  notice: RawNotice,
  fallbackDepartment: string,
): NormalizedNotice {
  return {
    title: notice.title.trim(),
    content: (notice.content ?? "").trim(),
    url: notice.url.trim(),
    postedAt: notice.postedAt?.trim() || new Date().toISOString(),
    department: notice.department?.trim() || fallbackDepartment,
    category: notice.category?.trim() || null,
  };
}

export async function collectNotices(
  adapter: NoticeSourceAdapter,
): Promise<NormalizedNotice[]> {
  const html = await adapter.fetch();
  const parsed = await adapter.parse(html);

  return parsed
    .map((notice) => normalizeNotice(notice, adapter.name))
    .filter((notice) => notice.title && notice.url);
}

export async function collectNoticesFromAdapters(
  adapters: readonly NoticeSourceAdapter[],
): Promise<NormalizedNotice[]> {
  const collected: NormalizedNotice[] = [];

  for (const adapter of adapters) {
    try {
      collected.push(...(await collectNotices(adapter)));
    } catch (error) {
      console.warn(
        `Failed to collect notices from ${adapter.name}`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  return collected;
}

const SKKU_CSE_NOTICE_URL =
  "https://cse.skku.edu/cse/notice.do?mode=list&articleLimit=20&article.offset=0";
const SKKU_CSE_SOURCE = "성균관대학교 소프트웨어융합대학";
const SKKU_CSE_BASE_URL = "https://cse.skku.edu/cse/notice.do";

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) =>
      String.fromCharCode(Number.parseInt(code, 16)),
    );
}

function cleanText(value: string): string {
  return decodeHtml(value)
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function htmlToText(html: string): string {
  return cleanText(
    html
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<script\b[\s\S]*?<\/script>/gi, "")
      .replace(/<style\b[\s\S]*?<\/style>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
      .replace(/<\/(td|th)>/gi, " | ")
      .replace(/<img\b[^>]*>/gi, "")
      .replace(/<[^>]+>/g, " "),
  );
}

function firstMatch(html: string, pattern: RegExp): string {
  return pattern.exec(html)?.[1] ?? "";
}

function absoluteUrl(href: string): string {
  return new URL(decodeHtml(href), SKKU_CSE_BASE_URL).toString();
}

function canonicalNoticeUrl(url: string): string {
  const parsed = new URL(url);
  const articleNo = parsed.searchParams.get("articleNo");
  if (!articleNo) return parsed.toString();

  return new URL(
    `?mode=view&articleNo=${encodeURIComponent(articleNo)}&article.offset=0&articleLimit=20`,
    SKKU_CSE_BASE_URL,
  ).toString();
}

function parseListEntries(html: string): RawNotice[] {
  const entries: RawNotice[] = [];
  const seen = new Set<string>();
  const blocks = html.match(
    /<dl\s+class="board-list-content-wrap[^"]*"[\s\S]*?<\/dl>/g,
  );

  for (const block of blocks ?? []) {
    const href = firstMatch(
      block,
      /<a\s+href="([^"]+)"\s+title="자세히 보기"/i,
    );
    if (!href) continue;

    const url = canonicalNoticeUrl(absoluteUrl(href));
    if (seen.has(url)) continue;
    seen.add(url);

    const anchorHtml = firstMatch(
      block,
      /<a\s+href="[^"]+"\s+title="자세히 보기">([\s\S]*?)<\/a>/i,
    );
    const title = htmlToText(anchorHtml);
    const category = cleanText(
      firstMatch(
        block,
        /<span\s+class="c-board-list-category">\[?([^\]<]+)\]?<\/span>/i,
      ),
    );
    const postedAt = firstMatch(block, /<li>\s*(\d{4}-\d{2}-\d{2})\s*<\/li>/);

    if (!title || !postedAt) continue;

    entries.push({
      title,
      url,
      postedAt,
      department: SKKU_CSE_SOURCE,
      category,
    });
  }

  return entries;
}

function parseDetail(html: string): {
  title?: string;
  content?: string;
  postedAt?: string;
  category?: string;
} {
  const titleBlock = firstMatch(
    html,
    /<div\s+class="board-view-title-wrap">([\s\S]*?)<\/div>\s*<div class="board-view-util-wrap">/i,
  );
  const headingHtml = firstMatch(titleBlock, /<h4>([\s\S]*?)<\/h4>/i);
  const category = cleanText(
    firstMatch(headingHtml, /<span>\[?([^\]<]+)\]?<\/span>/i),
  );
  const title = htmlToText(headingHtml.replace(/<span>[\s\S]*?<\/span>/i, ""));
  const postedAt = firstMatch(
    titleBlock,
    /<li>\s*(\d{4}-\d{2}-\d{2})\s*<\/li>/,
  );
  const contentWrap = firstMatch(
    html,
    /<div\s+class="board-view-content-wrap board-view-txt">([\s\S]*?)<div\s+class="board-txt-navi-wrap">/i,
  );
  const content = htmlToText(contentWrap);

  return {
    title,
    content,
    postedAt,
    category,
  };
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent": "skku-channel-hackathon-team11-notice-sync/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  return response.text();
}

export const skkuCseNoticeAdapter: NoticeSourceAdapter = {
  name: SKKU_CSE_SOURCE,

  fetch(): Promise<string> {
    return fetchText(SKKU_CSE_NOTICE_URL);
  },

  async parse(html: string): Promise<RawNotice[]> {
    const listEntries = parseListEntries(html).slice(0, 20);
    const notices: RawNotice[] = [];

    for (const entry of listEntries) {
      try {
        const detailHtml = await fetchText(entry.url);
        const detail = parseDetail(detailHtml);
        notices.push({
          ...entry,
          title: detail.title || entry.title,
          content: detail.content || entry.content,
          postedAt: detail.postedAt || entry.postedAt,
          category: detail.category || entry.category,
        });
      } catch {
        notices.push(entry);
      }
    }

    return notices;
  },
};

export const schoolNoticeAdapters = [skkuCseNoticeAdapter] as const;
