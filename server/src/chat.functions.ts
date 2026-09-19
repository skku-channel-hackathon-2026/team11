import { Injectable } from "@nestjs/common";
import {
  CHAT_FUNCTIONS,
  ChatSendMessageInputSchema,
  ChatSendMessageOutputSchema,
  type ChatSendMessageInput,
  type ChatSendMessageOutput,
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
import { ChatService } from "./features/chat/chat.service.js";

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
export class ChatFunctions {
  constructor(private readonly chatService: ChatService) {}

  @Func(CHAT_FUNCTIONS.sendMessage)
  @Description("Route a user question to one school notice/mail function and return structured results")
  @InputSchema(ChatSendMessageInputSchema)
  @OutputSchema(ChatSendMessageOutputSchema)
  async sendMessage(
    @Ctx() ctx: Context,
    @Input() input: ChatSendMessageInput,
  ): Promise<ChatSendMessageOutput> {
    return this.chatService.sendMessage(ctx.channel.id, userIdFromContext(ctx), input);
  }
}
