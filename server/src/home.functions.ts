import { Injectable } from "@nestjs/common";
import { z } from "zod";
import {
  CompleteChecklistTaskInputSchema,
  CompleteChecklistTaskOutputSchema,
  UndoChecklistTaskInputSchema,
  UndoChecklistTaskOutputSchema,
  DismissChecklistTaskInputSchema,
  DismissChecklistTaskOutputSchema,
  HOME_FUNCTIONS,
  HomeDashboardOutputSchema,
  type CompleteChecklistTaskInput,
  type CompleteChecklistTaskOutput,
  type UndoChecklistTaskInput,
  type DismissChecklistTaskInput,
  type DismissChecklistTaskOutput,
  type HomeDashboardOutput,
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
import { DashboardService } from "./features/home/dashboard.service.js";

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
export class HomeFunctions {
  constructor(private readonly dashboardService: DashboardService) {}

  @Func(HOME_FUNCTIONS.getDashboard)
  @Description("Return the HANOON checklist dashboard for the current user")
  @InputSchema(z.object({}))
  @OutputSchema(HomeDashboardOutputSchema)
  async getDashboard(@Ctx() ctx: Context): Promise<HomeDashboardOutput> {
    return this.dashboardService.getDashboard(ctx.channel.id, userIdFromContext(ctx));
  }

  @Func(HOME_FUNCTIONS.completeTask)
  @Description("Mark a checklist task as completed and award XP once")
  @InputSchema(CompleteChecklistTaskInputSchema)
  @OutputSchema(CompleteChecklistTaskOutputSchema)
  async completeTask(
    @Ctx() ctx: Context,
    @Input() input: CompleteChecklistTaskInput,
  ): Promise<CompleteChecklistTaskOutput> {
    return this.dashboardService.completeTask(
      ctx.channel.id,
      userIdFromContext(ctx),
      input.taskId,
    );
  }

  @Func(HOME_FUNCTIONS.undoTask)
  @Description("Move a completed checklist task back to pending and revert XP")
  @InputSchema(UndoChecklistTaskInputSchema)
  @OutputSchema(UndoChecklistTaskOutputSchema)
  async undoTask(
    @Ctx() ctx: Context,
    @Input() input: UndoChecklistTaskInput,
  ): Promise<CompleteChecklistTaskOutput> {
    return this.dashboardService.undoTask(
      ctx.channel.id,
      userIdFromContext(ctx),
      input.taskId,
    );
  }

  @Func(HOME_FUNCTIONS.dismissTask)
  @Description("Hide a pending checklist task without awarding XP")
  @InputSchema(DismissChecklistTaskInputSchema)
  @OutputSchema(DismissChecklistTaskOutputSchema)
  async dismissTask(
    @Ctx() ctx: Context,
    @Input() input: DismissChecklistTaskInput,
  ): Promise<DismissChecklistTaskOutput> {
    return this.dashboardService.dismissTask(
      ctx.channel.id,
      userIdFromContext(ctx),
      input.taskId,
    );
  }
}

