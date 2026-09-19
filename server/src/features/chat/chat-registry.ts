import type {
  AgentFunctionName,
  AgentToolDecision,
  ChatSuggestion,
  ChatMailItem,
  ChatNoticeItem,
  ChatResultItem,
  MailMessage,
  Notice,
} from "@tutorial/shared";
import { MailService } from "../mail/mail.service.js";
import { SchoolNoticeService } from "../../school-notice.service.js";
import { AcademicScheduleService } from "../../academic-schedule.service.js";
import {
  extractActionItems,
  extractDeadlineItems,
  periodHintFromQuery,
} from "./schedule-analysis.js";
import { buildChecklistCandidates } from "../checklist/checklist-analyzer.js";
import { isSchoolRelatedMail } from "../mail/school-mail-classifier.js";

export interface ChatFunctionContext {
  channelId: string;
  userId: string;
}

export interface ChatFunctionResult {
  message: string;
  items: ChatResultItem[];
  total: number;
}

export interface ChatFunctionDefinition {
  name: AgentFunctionName;
  description: string;
  suggestion: ChatSuggestion;
  execute(decision: AgentToolDecision, ctx: ChatFunctionContext): Promise<ChatFunctionResult>;
}

export class ChatFunctionRegistry {
  readonly functions: ChatFunctionDefinition[];

  constructor(
    private readonly noticeService: SchoolNoticeService,
    private readonly mailService: MailService,
    private readonly academicScheduleService = new AcademicScheduleService(),
  ) {
    this.functions = [
      {
        name: "getImportantNotices",
        description: "사용자 질문과 가장 가까운 학교 공지 분류에서 최신 공지 3개를 조회한다.",
        suggestion: {
          toolName: "getImportantNotices",
          label: "중요한 학교 공지 찾아보기",
          prompt: "지금 나에게 중요한 학교 공지를 찾아줘",
        },
        execute: (decision) => this.getImportantNotices(decision),
      },
      {
        name: "searchSchoolMail",
        description: "현재 Channel 사용자에게 연결된 Gmail에서 최근 1개월 학교 관련 메일을 조회한다.",
        suggestion: {
          toolName: "searchSchoolMail",
          label: "최근 학교 메일 찾아보기",
          prompt: "최근 한 달간 학교 관련 메일을 찾아줘",
        },
        execute: (_decision, ctx) => this.searchSchoolMail(ctx),
      },
      {
        name: "getImportantFromAll",
        description: "특정 주제에 관한 학교 공지와 학교 관련 메일의 최근 정보를 최신순으로 합친다.",
        suggestion: {
          toolName: "getImportantFromAll",
          label: "공지와 메일 함께 확인하기",
          prompt: "공지와 메일에서 지금 확인할 중요한 내용을 찾아줘",
        },
        execute: (decision, ctx) => this.getImportantFromAll(decision, ctx),
      },
      {
        name: "getUpcomingDeadlines",
        description: "학교 공지와 학교 관련 메일에서 신청, 제출, 등록 등 곧 마감되는 일정과 기한을 찾는다.",
        suggestion: {
          toolName: "getUpcomingDeadlines",
          label: "곧 마감되는 일정 확인하기",
          prompt: "곧 마감되는 학교 일정이나 신청이 있는지 알려줘",
        },
        execute: (decision, ctx) => this.getUpcomingDeadlines(decision, ctx),
      },
      {
        name: "findRequiredActions",
        description: "학교 공지와 학교 관련 메일에서 사용자가 실제로 신청, 제출, 등록, 회신 등 해야 하는 일을 찾는다.",
        suggestion: {
          toolName: "findRequiredActions",
          label: "내가 해야 할 일 확인하기",
          prompt: "학교 공지와 메일에서 내가 해야 할 일을 찾아줘",
        },
        execute: (_decision, ctx) => this.findRequiredActions(ctx),
      },
    ];
  }

  descriptions(): Array<{ name: string; description: string }> {
    return this.functions.map(({ name, description }) => ({ name, description }));
  }

  suggestions(query = ""): ChatSuggestion[] {
    const normalized = query.toLowerCase();
    return [...this.functions]
      .sort((a, b) => scoreSuggestion(b, normalized) - scoreSuggestion(a, normalized))
      .slice(0, 3)
      .map((item) => item.suggestion);
  }

  async execute(decision: AgentToolDecision, ctx: ChatFunctionContext): Promise<ChatFunctionResult> {
    const definition = this.functions.find((item) => item.name === decision.function);
    if (!definition) throw new Error(`Unsupported chat function: ${decision.function}`);
    return definition.execute(decision, ctx);
  }

  private async getImportantNotices(decision: AgentToolDecision): Promise<ChatFunctionResult> {
    const output = await this.noticeService.listNotices({
      dateRange: "all",
      ...(decision.category ? { category: decision.category } : {}),
    });
    const items = output.notices.slice(0, 3).map(toNoticeItem);
    return {
      message: decision.category
        ? `${decision.category} 관련해서 최근 확인할 공지 ${items.length}개를 찾았어요.`
        : `최근 확인할 학교 공지 ${items.length}개를 찾았어요.`,
      items,
      total: output.notices.length,
    };
  }

  private async searchSchoolMail(ctx: ChatFunctionContext): Promise<ChatFunctionResult> {
    const messages = await this.schoolMailMessages(ctx);
    return {
      message: messages.length > 0
        ? `최근 한 달간 학교 관련 메일 ${messages.length}개를 찾았어요.`
        : "최근 한 달간 학교 관련 메일을 찾지 못했어요. Gmail 계정 연결 상태도 확인해주세요.",
      items: messages.map(toMailItem),
      total: messages.length,
    };
  }

  private async getImportantFromAll(
    decision: AgentToolDecision,
    ctx: ChatFunctionContext,
  ): Promise<ChatFunctionResult> {
    const notices = await this.noticeService.listNotices({
      dateRange: "all",
      ...(decision.category ? { category: decision.category } : {}),
    });
    const mails = await this.schoolMailMessages(ctx);
    const items = [
      ...notices.notices.map(toNoticeItem),
      ...mails.map(toMailItem),
    ].sort((a, b) => compareDateDesc(a.date, b.date));

    return {
      message: decision.category
        ? `${decision.category} 관련 공지와 메일을 함께 확인해서 최근 정보 ${Math.min(items.length, 3)}개를 정리했어요.`
        : `공지와 메일을 함께 확인해서 최근 정보 ${Math.min(items.length, 3)}개를 정리했어요.`,
      items: items.slice(0, 3),
      total: items.length,
    };
  }


  private async getUpcomingDeadlines(
    decision: AgentToolDecision,
    ctx: ChatFunctionContext,
  ): Promise<ChatFunctionResult> {
    const [notices, mails, schedules] = await Promise.all([
      this.noticeService.listNotices({ dateRange: "all" }),
      this.schoolMailMessages(ctx),
      this.academicSchedules(),
    ]);
    const hint = periodHintFromQuery(decision.query);
    const scheduleItems = buildChecklistCandidates(notices.notices, mails, schedules)
      .filter((item) => item.deadline)
      .map((item) => ({
        sourceType: "DEADLINE" as const,
        originalSourceType: item.sources[0]?.sourceType ?? "NOTICE",
        id: item.canonicalKey,
        title: item.canonicalTitle,
        deadline: item.deadline ?? new Date().toISOString(),
        date: item.deadline ?? new Date().toISOString(),
        source: item.sources.map((source) => source.sourceType).join(", "),
        url: item.sources.find((source) => source.url)?.url ?? undefined,
        snippet: item.action,
      }));
    const items = [
      ...extractDeadlineItems(notices.notices, mails, new Date(), hint),
      ...scheduleItems,
    ]
      .sort((a, b) => a.deadline.localeCompare(b.deadline))
      .slice(0, 5);

    return {
      message: items.length > 0
        ? `가까운 마감 일정 ${items.length}개를 찾았어요.`
        : "현재 확인된 가까운 마감 일정이 없습니다.",
      items,
      total: items.length,
    };
  }

  private async findRequiredActions(ctx: ChatFunctionContext): Promise<ChatFunctionResult> {
    const [notices, mails, schedules] = await Promise.all([
      this.noticeService.listNotices({ dateRange: "all" }),
      this.schoolMailMessages(ctx),
      this.academicSchedules(),
    ]);
    const checklistItems = buildChecklistCandidates(notices.notices, mails, schedules).map((item) => ({
      sourceType: "ACTION" as const,
      originalSourceType: item.sources[0]?.sourceType ?? "NOTICE",
      id: item.canonicalKey,
      title: item.canonicalTitle,
      action: item.action,
      deadline: item.deadline,
      date: item.deadline ?? new Date().toISOString(),
      source: item.sources.map((source) => source.sourceType).join(", "),
      url: item.sources.find((source) => source.url)?.url ?? undefined,
      snippet: item.action,
    }));
    const items = [
      ...extractActionItems(notices.notices, mails),
      ...checklistItems,
    ]
      .sort((a, b) => {
        if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
        if (a.deadline) return -1;
        if (b.deadline) return 1;
        return a.title.localeCompare(b.title, "ko");
      })
      .slice(0, 5);

    return {
      message: items.length > 0
        ? `지금 확인할 해야 할 일 ${items.length}개를 찾았어요.`
        : "현재 확인된 해야 할 일이 없습니다.",
      items,
      total: items.length,
    };
  }

  private async academicSchedules() {
    const now = new Date();
    const months = [0, 1].map((offset) => {
      const date = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      return { year: date.getFullYear(), month: date.getMonth() + 1 };
    });
    const outputs = await Promise.all(months.map(async (input) => {
      try {
        return await this.academicScheduleService.listSchedules(input);
      } catch {
        return { schedules: [] };
      }
    }));
    return outputs.flatMap((output) => output.schedules);
  }

  private async schoolMailMessages(ctx: ChatFunctionContext): Promise<MailMessage[]> {
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    try {
      const output = await this.mailService.listMessages(ctx.channelId, ctx.userId);
      return output.messages
        .filter((message) => new Date(message.receivedAt).getTime() >= oneMonthAgo.getTime())
        .filter(isSchoolRelatedMail)
        .sort((a, b) => compareDateDesc(a.receivedAt, b.receivedAt));
    } catch {
      return [];
    }
  }
}

function toNoticeItem(notice: Notice): ChatNoticeItem {
  return {
    id: notice.id,
    title: notice.title,
    content: notice.content,
    url: notice.url,
    postedAt: notice.postedAt,
    source: notice.source,
    category: notice.category,
    sourceType: "NOTICE",
    date: notice.postedAt,
    summary: summarize(notice.content),
  };
}

function toMailItem(message: MailMessage): ChatMailItem {
  return {
    ...message,
    sourceType: "MAIL",
    date: message.receivedAt,
    title: message.subject,
  };
}

function summarize(content: string): string {
  const normalized = content.replace(/\s+/g, " ").trim();
  return normalized.length > 140 ? `${normalized.slice(0, 140)}...` : normalized;
}

function compareDateDesc(a: string, b: string): number {
  const aTime = new Date(a).getTime();
  const bTime = new Date(b).getTime();
  if (aTime !== bTime) return bTime - aTime;
  return b.localeCompare(a);
}

function scoreSuggestion(item: ChatFunctionDefinition, query: string): number {
  const text = `${item.name} ${item.description} ${item.suggestion.label} ${item.suggestion.prompt}`.toLowerCase();
  return query
    .split(/\s+/)
    .filter(Boolean)
    .reduce((score, token) => score + (text.includes(token) ? 1 : 0), 0);
}
