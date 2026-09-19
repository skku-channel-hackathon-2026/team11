import { Injectable } from "@nestjs/common";
import { z } from "zod";
import {
  ConnectMailAccountInputSchema,
  DisconnectMailAccountInputSchema,
  DisconnectMailAccountOutputSchema,
  ListMailMessagesInputSchema,
  MAIL_FUNCTIONS,
  MailAccountListOutputSchema,
  MailAccountSchema,
  MailConnectionStatusSchema,
  MailMessageListOutputSchema,
  type ConnectMailAccountInput,
  type DisconnectMailAccountInput,
  type ListMailMessagesInput,
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
import { MailService } from "./features/mail/mail.service.js";

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

/**
 * 메일 연동 Channel App Function.
 *
 * 여러 메일 계정을 연결/해제하고, 연결된 계정들의 메시지를 하나의 통합
 * 수신함으로 묶어 조회한다. 모든 함수는 현재 채널/호출자 기준으로 동작한다.
 */
@Injectable()
export class MailFunctions {
  constructor(private readonly mailService: MailService) {}

  @Func(MAIL_FUNCTIONS.getConnectionStatus)
  @Description("Return the mail connection status for the current user")
  @InputSchema(z.object({}))
  @OutputSchema(MailConnectionStatusSchema)
  async getConnectionStatus(
    @Ctx() ctx: Context,
  ): Promise<z.infer<typeof MailConnectionStatusSchema>> {
    return this.mailService.getConnectionStatus(
      ctx.channel.id,
      userIdFromContext(ctx),
    );
  }

  @Func(MAIL_FUNCTIONS.listAccounts)
  @Description("List the mail accounts connected by the current user")
  @InputSchema(z.object({}))
  @OutputSchema(MailAccountListOutputSchema)
  async listAccounts(
    @Ctx() ctx: Context,
  ): Promise<z.infer<typeof MailAccountListOutputSchema>> {
    return {
      accounts: await this.mailService.listAccounts(
        ctx.channel.id,
        userIdFromContext(ctx),
      ),
    };
  }

  @Func(MAIL_FUNCTIONS.connectAccount)
  @Description("Connect a mail account to the current user's unified inbox")
  @InputSchema(ConnectMailAccountInputSchema)
  @OutputSchema(MailAccountSchema)
  async connectAccount(
    @Ctx() ctx: Context,
    @Input() input: ConnectMailAccountInput,
  ): Promise<z.infer<typeof MailAccountSchema>> {
    return this.mailService.connectAccount(
      ctx.channel.id,
      userIdFromContext(ctx),
      input,
    );
  }

  @Func(MAIL_FUNCTIONS.disconnectAccount)
  @Description("Disconnect a mail account from the current user's inbox")
  @InputSchema(DisconnectMailAccountInputSchema)
  @OutputSchema(DisconnectMailAccountOutputSchema)
  async disconnectAccount(
    @Ctx() ctx: Context,
    @Input() input: DisconnectMailAccountInput,
  ): Promise<z.infer<typeof DisconnectMailAccountOutputSchema>> {
    return {
      disconnected: await this.mailService.disconnectAccount(
        ctx.channel.id,
        userIdFromContext(ctx),
        input.accountId,
      ),
    };
  }

  @Func(MAIL_FUNCTIONS.listMessages)
  @Description("List unified inbox messages across all connected mail accounts")
  @InputSchema(ListMailMessagesInputSchema)
  @OutputSchema(MailMessageListOutputSchema)
  async listMessages(
    @Ctx() ctx: Context,
    @Input() input: ListMailMessagesInput,
  ): Promise<z.infer<typeof MailMessageListOutputSchema>> {
    return this.mailService.listMessages(
      ctx.channel.id,
      userIdFromContext(ctx),
      input.accountId,
    );
  }
}
