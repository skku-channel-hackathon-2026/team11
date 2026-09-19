import "reflect-metadata";
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  InternalServerErrorException,
  Module,
  Post,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import {
  AnalyzeNoticeInputSchema,
  type AnalyzeNoticeInput,
  type NoticeAnalysis,
} from "@tutorial/shared";
import { analyzeNotice } from "./notice-analysis.js";

type Analyzer = (input: AnalyzeNoticeInput) => Promise<NoticeAnalysis>;

// Self-contained Express-backed Nest app. Does not change shared routing or signature guards.
export async function createRecommendationApp(
  analyze: Analyzer = analyzeNotice,
) {
  @Controller()
  class RecommendationController {
    @Get()
    health() {
      return { status: "ok" };
    }

    @Post("analyze-notice")
    @HttpCode(200)
    async analyze(@Body() body: unknown) {
      const result = AnalyzeNoticeInputSchema.safeParse(body);
      if (!result.success)
        throw new BadRequestException({
          error: "student와 notice 및 올바른 내부 필드를 입력해 주세요.",
        });
      try {
        return await analyze(result.data);
      } catch {
        throw new InternalServerErrorException({
          error:
            "공지 분석에 실패했습니다. OpenAI API 설정을 확인하거나 잠시 후 다시 시도해 주세요.",
        });
      }
    }
  }
  @Module({ controllers: [RecommendationController] })
  class RecommendationModule {}
  const app = await NestFactory.create<NestExpressApplication>(
    RecommendationModule,
    { logger: false },
  );
  app.useBodyParser("json", { limit: "100kb" });
  return app;
}
