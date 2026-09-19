import {
  SCHOOL_NOTICE_FUNCTIONS,
  NoticeListInputSchema,
  UserProfileSchema,
  type NoticeListOutput,
  type SaveUserProfileOutput,
  type SeedNoticesOutput,
  type SyncNoticesOutput,
  type UserProfileOutput,
  ToggleNoticeFavoriteInputSchema,
  type FavoriteNoticesOutput,
  type ToggleNoticeFavoriteOutput,
  MAIL_FUNCTIONS,
  CHAT_FUNCTIONS,
  HOME_FUNCTIONS,
  ACADEMIC_SCHEDULE_FUNCTIONS,
  AcademicScheduleListInputSchema,
  AcademicScheduleSyncInputSchema,
  type AcademicScheduleListOutput,
  type AcademicScheduleSyncOutput,
  type HomeDashboardOutput,
  CompleteChecklistTaskInputSchema,
  UndoChecklistTaskInputSchema,
  DismissChecklistTaskInputSchema,
  type CompleteChecklistTaskOutput,
  ChatSendMessageInputSchema,
  type ChatSendMessageOutput,
  ConnectMailAccountInputSchema,
  DisconnectMailAccountInputSchema,
  ListMailMessagesInputSchema,
  StartGmailOAuthInputSchema,
  type StartGmailOAuthOutput,
  type MailAccount,
  type MailAccountListOutput,
  type MailConnectionStatus,
  type MailMessageListOutput,
} from "@tutorial/shared";
import { SchoolNoticeService } from "./school-notice.service.js";
import { countNotices } from "./school-notice.store.js";
import { MailService } from "./features/mail/mail.service.js";
import { ChatService } from "./features/chat/chat.service.js";
import { DashboardService } from "./features/home/dashboard.service.js";
import { AcademicScheduleService } from "./academic-schedule.service.js";

const localDevChannelId = "local-dev-channel";
const localDevUserId = "local-dev-user";

function isLocalhost(url: URL): boolean {
  return (
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "::1"
  );
}

function json(data: unknown, init?: ResponseInit): Response {
  return Response.json(data, {
    headers: { "cache-control": "no-store", ...init?.headers },
    status: init?.status,
    statusText: init?.statusText,
  });
}

export async function handleDevSchoolNoticeRequest(
  request: Request,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/dev/school-notice") && !url.pathname.startsWith("/api/dev/function")) return null;

  if (!isLocalhost(url)) {
    return json({ error: "Not found" }, { status: 404 });
  }

  if (
    url.pathname === "/api/dev/school-notice/stats" &&
    request.method === "GET"
  ) {
    return json({ notices: await countNotices() });
  }

  if (
    url.pathname !== "/api/dev/school-notice/function" && url.pathname !== "/api/dev/function" ||
    request.method !== "POST"
  ) {
    return json({ error: "Not found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as {
    name?: string;
    params?: unknown;
  } | null;

  if (!body?.name) {
    return json({ error: "Function name is required" }, { status: 400 });
  }

  try {
    const service = new SchoolNoticeService();
    const mailService = new MailService();
    const chatService = new ChatService(service, mailService);
    const dashboardService = new DashboardService(service, mailService);
    const academicScheduleService = new AcademicScheduleService();

    switch (body.name) {
      case SCHOOL_NOTICE_FUNCTIONS.getProfile: {
        const output: UserProfileOutput = {
          profile: await service.getProfile(localDevChannelId, localDevUserId),
        };
        return json(output);
      }

      case SCHOOL_NOTICE_FUNCTIONS.saveProfile: {
        const profile = UserProfileSchema.parse(body.params);
        const output: SaveUserProfileOutput = {
          profile: await service.saveProfile(
            localDevChannelId,
            localDevUserId,
            profile,
          ),
        };
        return json(output);
      }

      case SCHOOL_NOTICE_FUNCTIONS.listNotices: {
        const input = NoticeListInputSchema.parse(body.params ?? {});
        const output: NoticeListOutput = await service.listNoticesForUser(
          localDevChannelId,
          localDevUserId,
          input,
        );
        return json(output);
      }

      case SCHOOL_NOTICE_FUNCTIONS.listPersonalizedNotices: {
        const output: NoticeListOutput = await service.listPersonalizedNotices(
          localDevChannelId,
          localDevUserId,
        );
        return json(output);
      }

      case SCHOOL_NOTICE_FUNCTIONS.listFavorites: {
        const output: FavoriteNoticesOutput = await service.listFavorites(
          localDevChannelId,
          localDevUserId,
        );
        return json(output);
      }

      case SCHOOL_NOTICE_FUNCTIONS.toggleFavorite: {
        const input = ToggleNoticeFavoriteInputSchema.parse(body.params ?? {});
        const output: ToggleNoticeFavoriteOutput = {
          noticeId: input.noticeId,
          isFavorite: await service.toggleFavorite(
            localDevChannelId,
            localDevUserId,
            input.noticeId,
          ),
        };
        return json(output);
      }

      case SCHOOL_NOTICE_FUNCTIONS.seedNotices: {
        const output: SeedNoticesOutput = await service.seedNotices();
        return json(output);
      }

      case SCHOOL_NOTICE_FUNCTIONS.syncNotices: {
        const output: SyncNoticesOutput = await service.syncNotices();
        return json(output);
      }

      case MAIL_FUNCTIONS.getConnectionStatus: {
        const output: MailConnectionStatus = await mailService.getConnectionStatus(
          localDevChannelId,
          localDevUserId,
        );
        return json(output);
      }

      case MAIL_FUNCTIONS.listAccounts: {
        const output: MailAccountListOutput = {
          accounts: await mailService.listAccounts(
            localDevChannelId,
            localDevUserId,
          ),
        };
        return json(output);
      }

      case MAIL_FUNCTIONS.startGmailOAuth: {
        StartGmailOAuthInputSchema.parse(body.params ?? {});
        const output: StartGmailOAuthOutput = await mailService.startGmailOAuth(
          localDevChannelId,
          localDevUserId,
        );
        return json(output);
      }

      case MAIL_FUNCTIONS.connectAccount: {
        const input = ConnectMailAccountInputSchema.parse(body.params);
        const output: MailAccount = await mailService.connectAccount(
          localDevChannelId,
          localDevUserId,
          input,
        );
        return json(output);
      }

      case MAIL_FUNCTIONS.disconnectAccount: {
        const input = DisconnectMailAccountInputSchema.parse(body.params);
        return json({
          disconnected: await mailService.disconnectAccount(
            localDevChannelId,
            localDevUserId,
            input.accountId,
          ),
        });
      }

      case MAIL_FUNCTIONS.listMessages: {
        const input = ListMailMessagesInputSchema.parse(body.params ?? {});
        const output: MailMessageListOutput = await mailService.listMessages(
          localDevChannelId,
          localDevUserId,
          input.accountId,
        );
        return json(output);
      }

      case CHAT_FUNCTIONS.sendMessage: {
        const input = ChatSendMessageInputSchema.parse(body.params ?? {});
        const output: ChatSendMessageOutput = await chatService.sendMessage(
          localDevChannelId,
          localDevUserId,
          input,
        );
        return json(output);
      }

      case HOME_FUNCTIONS.getDashboard: {
        const output: HomeDashboardOutput = await dashboardService.getDashboard(
          localDevChannelId,
          localDevUserId,
        );
        return json(output);
      }

      case HOME_FUNCTIONS.completeTask: {
        const input = CompleteChecklistTaskInputSchema.parse(body.params ?? {});
        const output: CompleteChecklistTaskOutput = await dashboardService.completeTask(
          localDevChannelId,
          localDevUserId,
          input.taskId,
        );
        return json(output);
      }

      case HOME_FUNCTIONS.undoTask: {
        const input = UndoChecklistTaskInputSchema.parse(body.params ?? {});
        const output: CompleteChecklistTaskOutput = await dashboardService.undoTask(
          localDevChannelId,
          localDevUserId,
          input.taskId,
        );
        return json(output);
      }

      case HOME_FUNCTIONS.dismissTask: {
        const input = DismissChecklistTaskInputSchema.parse(body.params ?? {});
        const output: CompleteChecklistTaskOutput = await dashboardService.dismissTask(
          localDevChannelId,
          localDevUserId,
          input.taskId,
        );
        return json(output);
      }

      case ACADEMIC_SCHEDULE_FUNCTIONS.listSchedules: {
        const input = AcademicScheduleListInputSchema.parse(body.params ?? {});
        const output: AcademicScheduleListOutput =
          await academicScheduleService.listSchedules(input);
        return json(output);
      }

      case ACADEMIC_SCHEDULE_FUNCTIONS.syncSchedules: {
        const input = AcademicScheduleSyncInputSchema.parse(body.params ?? {});
        const output: AcademicScheduleSyncOutput =
          await academicScheduleService.syncSchedules(input);
        return json(output);
      }

      default:
        return json({ error: "Unsupported function" }, { status: 404 });
    }
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 400 },
    );
  }
}
