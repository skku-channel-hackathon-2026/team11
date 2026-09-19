import { Injectable } from "@nestjs/common";
import {
  AgentDecisionSchema,
  ChatSendMessageInputSchema,
  type ChatSendMessageInput,
  type ChatSendMessageOutput,
} from "@tutorial/shared";
import { MailService } from "../mail/mail.service.js";
import { SchoolNoticeService } from "../../school-notice.service.js";
import { ChatFunctionRegistry } from "./chat-registry.js";
import { OpenAIChatAgent, type ChatAgent } from "./chat-agent.js";

@Injectable()
export class ChatService {
  private readonly registry: ChatFunctionRegistry;
  private readonly agent: ChatAgent;

  constructor(
    private readonly noticeService: SchoolNoticeService,
    private readonly mailService: MailService,
  ) {
    this.registry = new ChatFunctionRegistry(noticeService, mailService);
    this.agent = new OpenAIChatAgent();
  }

  async sendMessage(
    channelId: string,
    userId: string,
    input: ChatSendMessageInput,
  ): Promise<ChatSendMessageOutput> {
    const parsed = ChatSendMessageInputSchema.parse(input);
    const categories = await this.allowedCategories();
    const rawDecision = await this.agent.route({
      message: parsed.message,
      categories,
      functions: this.registry.descriptions(),
    });
    const decision = this.validateDecision(rawDecision, categories);

    if (decision.type === "unsupported") {
      return {
        decision,
        message:
          "해당 요청은 아직 지원하지 않습니다. 아래 기능들을 요청해보세요.",
        items: [],
        total: 0,
        suggestions: this.registry.suggestions(parsed.message),
      };
    }

    const result = await this.registry.execute(decision, { channelId, userId });

    return {
      decision,
      message: result.message,
      items: result.items,
      total: result.total,
      suggestions: [],
    };
  }

  private async allowedCategories(): Promise<string[]> {
    const output = await this.noticeService.listNotices({ dateRange: "all" });
    return Array.from(
      new Set(
        output.notices
          .map((notice) => notice.category)
          .filter((category): category is string => Boolean(category)),
      ),
    ).sort((a, b) => a.localeCompare(b, "ko"));
  }

  private validateDecision(
    decision: unknown,
    categories: string[],
  ): ChatSendMessageOutput["decision"] {
    const parsed = AgentDecisionSchema.parse(decision);
    if (parsed.type === "unsupported") {
      return parsed;
    }

    const needsCategory =
      parsed.function === "getImportantNotices" ||
      parsed.function === "getImportantFromAll";
    const category = parsed.category && categories.includes(parsed.category)
      ? parsed.category
      : needsCategory
        ? categories[0] ?? null
        : null;

    return {
      type: "tool",
      function: parsed.function,
      category,
      query: parsed.query.slice(0, 120),
    };
  }
}
