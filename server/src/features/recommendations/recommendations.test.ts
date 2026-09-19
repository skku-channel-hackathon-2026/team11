import assert from "node:assert/strict";
import test from "node:test";
import type { AnalyzeNoticeInput, Notice } from "@tutorial/shared";
import {
  AnalyzeNoticeInputSchema,
  NoticeAnalysisSchema,
} from "@tutorial/shared";
import { analyzeNotice, NoticeAnalysisError } from "./notice-analysis.js";
import {
  recommendNotices,
  NoticeRecommendationService,
} from "./notice-recommendation.service.js";
import { createRecommendationApp } from "./http.js";
import { withDatabase, type AppDatabase } from "../../database.js";

const input: AnalyzeNoticeInput = {
  student: {
    grade: 1,
    major: "소프트웨어학과",
    interests: ["장학금"],
    status: ["신입생", "학부생"],
  },
  notice: {
    title: "신입생 장학금",
    content: "소프트웨어학과 1학년 신입생 대상 장학금",
  },
};
const analysis = {
  relevant: true,
  reason: "대상 조건에 맞습니다.",
  summary: "신입생 장학금 신청 안내",
  category: "SCHOLARSHIP" as const,
};
function payload(value: unknown = analysis) {
  return {
    status: "completed",
    output: [
      {
        type: "message",
        content: [{ type: "output_text", text: JSON.stringify(value) }],
      },
    ],
  };
}
const mockFetch =
  (body: unknown, status = 200): typeof fetch =>
  async () =>
    Response.json(body, { status });
const notices: Notice[] = [1, 2].map((id) => ({
  id: String(id),
  title: `공지 ${id}`,
  content: "본문",
  url: `https://example.com/${id}`,
  department: "게시 부서",
  source: "게시 부서",
  postedAt: "2026-09-19",
  createdAt: "2026-09-19",
  category: "원본 분류",
}));

test("request schema rejects missing/invalid inputs and strips untrusted extra fields", () => {
  for (const body of [
    {},
    null,
    { student: input.student },
    { notice: input.notice },
    { ...input, student: { ...input.student, grade: "1" } },
    { ...input, notice: { title: " ", content: "본문" } },
  ]) {
    assert.equal(AnalyzeNoticeInputSchema.safeParse(body).success, false);
  }
  assert.deepEqual(
    AnalyzeNoticeInputSchema.parse({ ...input, instructions: "ignore rules" }),
    input,
  );
  assert.equal(
    NoticeAnalysisSchema.safeParse({ ...analysis, relevant: "false" }).success,
    false,
  );
});

test("sends strict schema and only provided facts to OpenAI", async () => {
  const result = await analyzeNotice(input, {
    apiKey: "test",
    model: "test-model",
    fetch: async (url, init) => {
      assert.equal(url, "https://api.openai.com/v1/responses");
      const request = JSON.parse(String(init?.body));
      assert.deepEqual(JSON.parse(request.input), input);
      assert.equal(request.model, "test-model");
      assert.equal(request.store, false);
      assert.equal(request.text.format.strict, true);
      assert.equal(request.text.format.schema.additionalProperties, false);
      assert.equal(
        request.text.format.schema.properties.category.enum.length,
        7,
      );
      assert(init?.signal instanceof AbortSignal);
      return Response.json(payload());
    },
  });
  assert.deepEqual(result, analysis);
});

test("false stays false; network, refusals, malformed and incomplete outputs throw sanitized errors", async () => {
  assert.equal(
    (
      await analyzeNotice(input, {
        apiKey: "test",
        fetch: mockFetch(payload({ ...analysis, relevant: false })),
      })
    ).relevant,
    false,
  );
  const responses = [
    payload({ ...analysis, relevant: "false" }),
    payload({ ...analysis, category: "UNKNOWN" }),
    payload({ ...analysis, reason: " " }),
    payload({ ...analysis, extra: true }),
    { ...payload(), status: "incomplete" },
    { status: "completed", output: [] },
    {
      status: "completed",
      output: [{ type: "message", content: [{ type: "refusal" }] }],
    },
    {
      status: "completed",
      output: [
        {
          type: "message",
          content: [{ type: "output_text", text: "not JSON" }],
        },
      ],
    },
  ];
  for (const body of responses)
    await assert.rejects(
      analyzeNotice(input, { apiKey: "test", fetch: mockFetch(body) }),
      NoticeAnalysisError,
    );
  for (const status of [401, 429, 500])
    await assert.rejects(
      analyzeNotice(input, {
        apiKey: "test",
        fetch: mockFetch({ secret: "do not expose" }, status),
      }),
      NoticeAnalysisError,
    );
  await assert.rejects(
    analyzeNotice(input, {
      apiKey: "test",
      fetch: async () => {
        throw new Error("secret token");
      },
    }),
    (error) =>
      error instanceof NoticeAnalysisError && !error.message.includes("secret"),
  );
  await assert.rejects(
    analyzeNotice(input, { apiKey: "" }),
    NoticeAnalysisError,
  );
});

test("recommends from shared Notice[], preserves order and skips per-notice failures", async () => {
  let calls = 0;
  const original = structuredClone(notices);
  const result = await recommendNotices(input.student, notices, {
    apiKey: "test",
    fetch: async () =>
      Response.json(payload({ ...analysis, relevant: ++calls === 2 })),
  });
  assert.deepEqual(notices, original);
  assert.equal(result.notices.length, 1);
  assert.equal(result.notices[0]?.id, "2");
  assert.equal(result.notices[0]?.summary, analysis.summary);
  assert.equal(result.notices[0]?.category, "SCHOLARSHIP");
  assert.deepEqual(
    await recommendNotices(input.student, notices, {
      apiKey: "test",
      fetch: mockFetch({}, 500),
    }),
    { notices: [] },
  );
  assert.deepEqual(await recommendNotices(input.student, []), { notices: [] });
});

test("uses deterministic profile rules when notice clearly matches", async () => {
  const result = await recommendNotices(input.student, [
    {
      ...notices[0],
      title: "소프트웨어학과 1학년 장학금 신청 안내",
      content: "소프트웨어학과 1학년 재학생 대상 장학금입니다.",
      category: "장학",
    },
    {
      ...notices[1],
      title: "4학년 졸업요건 안내",
      content: "4학년 졸업예정자 전용 안내입니다.",
      category: "학사",
    },
  ]);

  assert.equal(result.notices.length, 1);
  assert.equal(result.notices[0]?.id, "1");
  assert.equal(result.notices[0]?.relevant, true);
  assert.equal(result.notices[0]?.category, "SCHOLARSHIP");
});

test("existing service maps the stored profile, uses public Notice data and avoids stale keyword cache", async () => {
  const queries: string[] = [];
  const database = {
    prepare(sql: string) {
      queries.push(sql);
      return {
        bind() {
          return this;
        },
        async first() {
          return {
            department: "소프트웨어학과",
            grade: 1,
            interests_json: '["장학"]',
          };
        },
        async all() {
          if (sql.includes("notice_favorites")) {
            return { results: [{ notice_id: 1, created_at: "2026" }] };
          }
          return {
            results: [
              {
                id: 1,
                title: "공지",
                content: "본문",
                url: "https://example.com",
                posted_at: "2026",
                department: "게시 부서",
                category: "원본 분류",
                created_at: "2026",
              },
            ],
          };
        },
      };
    },
  } as unknown as AppDatabase;
  const previousFetch = globalThis.fetch;
  const previousKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test";
  globalThis.fetch = async (_url, init) => {
    const data = JSON.parse(JSON.parse(String(init?.body)).input);
    assert.deepEqual(data.student, {
      major: "소프트웨어학과",
      grade: 1,
      interests: ["장학"],
      status: [],
    });
    assert.equal(data.notice.department, "게시 부서");
    return Response.json(payload());
  };
  try {
    const result = await withDatabase(database, () =>
      new NoticeRecommendationService().listPersonalizedNotices(
        "channel",
        "user",
      ),
    );
    assert.equal(result.notices[0]?.category, "SCHOLARSHIP");
    assert.equal(result.notices[0]?.isFavorite, true);
    assert.equal(
      queries.some((sql) => sql.includes("notice_relevance")),
      false,
    );
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  }
});

test("HTTP health, input validation, success and analysis failure", async () => {
  let calls = 0;
  let fail = false;
  const app = await createRecommendationApp(async () => {
    calls++;
    if (fail) throw new Error("upstream secret");
    return analysis;
  });
  await app.listen(0, "127.0.0.1");
  try {
    const base = await app.getUrl();
    assert.deepEqual(await (await fetch(base)).json(), { status: "ok" });
    const post = (body: string) =>
      fetch(`${base}/analyze-notice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
    for (const body of ["{}", "null", "{"])
      assert.equal((await post(body)).status, 400);
    assert.equal(calls, 0);
    const response = await post(JSON.stringify(input));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), analysis);
    fail = true;
    const failure = await post(JSON.stringify(input));
    assert.equal(failure.status, 500);
    const error = await failure.text();
    assert(error.includes('"error"'));
    assert(!error.includes("secret"));
    assert.equal(
      (await post(JSON.stringify({ padding: "x".repeat(110_000) }))).status,
      413,
    );
  } finally {
    await app.close();
  }
});
