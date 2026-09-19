import { z } from "zod";
import {
  AgentDecisionSchema,
  AgentFunctionNameSchema,
  type AgentDecision,
} from "@tutorial/shared";
import { openAiApiKey, openAiModel } from "../../config.js";

export interface ChatAgentRouteInput {
  message: string;
  categories: string[];
  functions: Array<{ name: string; description: string }>;
}

export interface ChatAgent {
  route(input: ChatAgentRouteInput): Promise<AgentDecision>;
}

const routerInstructions = `너는 대학교 공지/메일 조회용 라우터다.
실제 데이터 조회는 하지 않고, 사용자의 요청이 현재 제공된 함수로 수행 가능한지 판단한다.
출력 type은 반드시 tool 또는 unsupported 중 하나다.

판단 기준:
- 사용자의 핵심 요청을 제공된 함수 하나로 실제 수행할 수 있을 때만 type=tool을 선택한다.
- 단어 하나가 비슷하다는 이유로 억지로 함수를 선택하지 않는다.
- 날씨, 음식 추천, 코드 작성, 알람, 주식 추천, 일반 잡담처럼 학교 공지/학교 메일 조회와 무관한 요청은 type=unsupported다.
- type=tool일 때 function은 제공된 enum 중 하나만 선택한다.
- getImportantFromAll은 특정 주제의 최근 공지+메일 정보가 궁금할 때 선택한다.
- getUpcomingDeadlines는 언제까지 해야 하는지, 곧 끝나는 일정/신청/제출/마감이 궁금할 때 선택한다.
- findRequiredActions는 사용자가 실제로 신청/제출/등록/회신 등 해야 하는 행동이 궁금할 때 선택한다.
- 공지 분류가 필요한 함수에서는 allowedCategories 중 의미적으로 가장 가까운 분류 하나를 category에 넣는다.
- 분류가 필요 없거나 적절한 분류가 없으면 category는 null이다.
- type=unsupported일 때 function/category/query는 모두 null이다.
- query는 type=tool일 때만 사용자의 핵심 검색 의도를 한국어로 짧게 정리한다.`;

const responseSchema = z.object({
  status: z.literal("completed"),
  output: z.array(
    z.object({
      type: z.string(),
      content: z
        .array(
          z.object({
            type: z.string(),
            text: z.string().optional(),
          }),
        )
        .optional(),
    }),
  ),
});

export class OpenAIChatAgent implements ChatAgent {
  async route(input: ChatAgentRouteInput): Promise<AgentDecision> {
    const apiKey = openAiApiKey.trim();
    if (!apiKey || apiKey === "your_openai_api_key_here") {
      return fallbackDecision(input);
    }

    const allowedCategories = input.categories.length > 0 ? input.categories : ["일반"];
    const outputSchema = {
      type: "object",
      properties: {
        type: { type: "string", enum: ["tool", "unsupported"] },
        function: {
          type: ["string", "null"],
          enum: [...AgentFunctionNameSchema.options, null],
        },
        category: { type: ["string", "null"], enum: [...allowedCategories, null] },
        query: { type: ["string", "null"], maxLength: 120 },
      },
      required: ["type", "function", "category", "query"],
      additionalProperties: false,
    };

    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        signal: AbortSignal.timeout(20_000),
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: openAiModel || "gpt-4o-mini",
          store: false,
          max_output_tokens: 600,
          instructions: routerInstructions,
          input: JSON.stringify({
            userMessage: input.message,
            functions: input.functions,
            allowedCategories,
          }),
          text: {
            format: {
              type: "json_schema",
              name: "chat_agent_route",
              strict: true,
              schema: outputSchema,
            },
          },
        }),
      });

      if (!response.ok) return fallbackDecision(input);
      const body = responseSchema.parse(await response.json());
      const texts = body.output
        .filter((item) => item.type === "message")
        .flatMap((item) => item.content ?? [])
        .filter((part) => part.type === "output_text" && part.text);
      if (texts.length !== 1 || !texts[0]?.text) return fallbackDecision(input);
      return AgentDecisionSchema.parse(JSON.parse(texts[0].text));
    } catch {
      return fallbackDecision(input);
    }
  }
}

function fallbackDecision(input: ChatAgentRouteInput): AgentDecision {
  const message = input.message.toLowerCase();
  const category = chooseCategory(input.message, input.categories);
  const hasMail = includesAny(message, ["메일", "이메일", "gmail", "지메일"]);
  const hasNotice = includesAny(message, ["공지", "안내", "장학", "수강", "학사", "채용", "모집", "입학", "세미나", "행사"]);
  const asksAll = includesAny(message, ["전부", "같이", "함께", "둘 다", "모두"]);
  const asksDeadline = includesAny(message, ["마감", "기한", "언제까지", "이번 주", "이번주", "이번 달", "이번달", "놓치면", "일정"]);
  const asksAction = includesAny(message, ["해야", "할 일", "신청해야", "제출", "등록", "납부", "회신", "놓치고"]);

  if (asksAction) {
    return {
      type: "tool",
      function: "findRequiredActions",
      category,
      query: input.message.slice(0, 120),
    };
  }

  if (asksDeadline) {
    return {
      type: "tool",
      function: "getUpcomingDeadlines",
      category,
      query: input.message.slice(0, 120),
    };
  }

  if (hasMail && (hasNotice || asksAll)) {
    return {
      type: "tool",
      function: "getImportantFromAll",
      category,
      query: input.message.slice(0, 120),
    };
  }

  if (hasMail) {
    return {
      type: "tool",
      function: "searchSchoolMail",
      category: null,
      query: input.message.slice(0, 120),
    };
  }

  if (hasNotice) {
    return {
      type: "tool",
      function: "getImportantNotices",
      category,
      query: input.message.slice(0, 120),
    };
  }

  return { type: "unsupported", function: null, category: null, query: null };
}

function includesAny(message: string, keywords: string[]): boolean {
  return keywords.some((keyword) => message.includes(keyword));
}

function chooseCategory(message: string, categories: string[]): string | null {
  if (categories.length === 0) return null;
  const normalized = message.toLowerCase();
  const direct = categories.find((category) => normalized.includes(category.toLowerCase()));
  if (direct) return direct;

  const hints: Array<[string[], string[]]> = [
    [["장학", "장학금"], ["장학"]],
    [["수강", "증원", "신청"], ["수강증원", "학사"]],
    [["취업", "채용", "모집", "인턴"], ["취업", "채용/모집", "채용·모집"]],
    [["입학", "신입"], ["입학"]],
    [["행사", "세미나", "특강"], ["행사/세미나", "행사·세미나"]],
    [["학사", "졸업", "휴학", "복학"], ["학사"]],
  ];

  for (const [keywords, candidates] of hints) {
    if (!keywords.some((keyword) => normalized.includes(keyword))) continue;
    const matched = categories.find((category) => candidates.some((candidate) => category.includes(candidate)));
    if (matched) return matched;
  }

  return categories[0] ?? null;
}
