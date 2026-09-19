import { Injectable } from "@nestjs/common";
import { z } from "zod";
import {
  NoticeListOutputSchema,
  NoticeListInputSchema,
  SCHOOL_NOTICE_FUNCTIONS,
  SeedNoticesOutputSchema,
  SyncNoticesInputSchema,
  SyncNoticesOutputSchema,
  UserProfileOutputSchema,
  UserProfileSchema,
  SaveUserProfileOutputSchema,
  type NoticeListInput,
  type SyncNoticesInput,
  type UserProfile,
} from "@tutorial/shared";
import {
  Ctx,
  Description,
  Func,
  FunctionCallError,
  FunctionCallErrorCode,
  Input,
  InputSchema,
  OutputSchema,
  type Context,
} from "@channel.io/app-sdk-server";
import { SchoolNoticeService } from "./school-notice.service.js";

function userIdFromContext(ctx: Context): string {
  const userId = ctx.caller.id;
  if (!userId) {
    throw new FunctionCallError(
      "The caller cannot be identified",
      FunctionCallErrorCode.BadRequest,
      { type: "missingCallerId" },
    );
  }
  return userId;
}

@Injectable()
export class SchoolNoticeFunctions {
  constructor(private readonly schoolNoticeService: SchoolNoticeService) {}

  @Func(SCHOOL_NOTICE_FUNCTIONS.getProfile)
  @Description("Return the current user's school notice profile")
  @InputSchema(z.object({}))
  @OutputSchema(UserProfileOutputSchema)
  async getProfile(
    @Ctx() ctx: Context,
  ): Promise<z.infer<typeof UserProfileOutputSchema>> {
    return {
      profile: await this.schoolNoticeService.getProfile(
        ctx.channel.id,
        userIdFromContext(ctx),
      ),
    };
  }

  @Func(SCHOOL_NOTICE_FUNCTIONS.saveProfile)
  @Description("Save the current user's school notice profile")
  @InputSchema(UserProfileSchema)
  @OutputSchema(SaveUserProfileOutputSchema)
  async saveProfile(
    @Ctx() ctx: Context,
    @Input() profile: UserProfile,
  ): Promise<z.infer<typeof SaveUserProfileOutputSchema>> {
    return {
      profile: await this.schoolNoticeService.saveProfile(
        ctx.channel.id,
        userIdFromContext(ctx),
        profile,
      ),
    };
  }

  @Func(SCHOOL_NOTICE_FUNCTIONS.listNotices)
  @Description("List all school notices")
  @InputSchema(NoticeListInputSchema)
  @OutputSchema(NoticeListOutputSchema)
  async listNotices(
    @Input() input: NoticeListInput,
  ): Promise<z.infer<typeof NoticeListOutputSchema>> {
    return this.schoolNoticeService.listNotices(input);
  }

  @Func(SCHOOL_NOTICE_FUNCTIONS.listPersonalizedNotices)
  @Description("List notices relevant to the current user's profile")
  @InputSchema(z.object({}))
  @OutputSchema(NoticeListOutputSchema)
  async listPersonalizedNotices(
    @Ctx() ctx: Context,
  ): Promise<z.infer<typeof NoticeListOutputSchema>> {
    return this.schoolNoticeService.listPersonalizedNotices(
      ctx.channel.id,
      userIdFromContext(ctx),
    );
  }

  @Func(SCHOOL_NOTICE_FUNCTIONS.seedNotices)
  @Description("Insert sample school notices for local MVP testing")
  @InputSchema(z.object({}))
  @OutputSchema(SeedNoticesOutputSchema)
  async seedNotices(): Promise<z.infer<typeof SeedNoticesOutputSchema>> {
    return this.schoolNoticeService.seedNotices();
  }

  @Func(SCHOOL_NOTICE_FUNCTIONS.syncNotices)
  @Description("Sync school notices from configured crawler adapters")
  @InputSchema(SyncNoticesInputSchema)
  @OutputSchema(SyncNoticesOutputSchema)
  async syncNotices(
    @Input() _input: SyncNoticesInput,
  ): Promise<z.infer<typeof SyncNoticesOutputSchema>> {
    return this.schoolNoticeService.syncNotices();
  }
}
