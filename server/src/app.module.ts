import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ChannelAppModule, SignatureGuard } from "@channel.io/app-sdk-server";
import { channelAppOptions } from "./config.js";
import { CommandExtension, TutorialFunctions } from "./tutorial.functions.js";
import { SchoolNoticeFunctions } from "./school-notice.functions.js";
import { SchoolNoticeService } from "./school-notice.service.js";
import { NoticeRecommendationService } from "./features/recommendations/notice-recommendation.service.js";
import { MailFunctions } from "./mail.functions.js";
import { MailService } from "./features/mail/mail.service.js";
import { ChatFunctions } from "./chat.functions.js";
import { ChatService } from "./features/chat/chat.service.js";
import { HomeFunctions } from "./home.functions.js";
import { DashboardService } from "./features/home/dashboard.service.js";
import { AcademicScheduleFunctions } from "./academic-schedule.functions.js";
import { AcademicScheduleService } from "./academic-schedule.service.js";

@Module({
  imports: [ChannelAppModule.forRoot(channelAppOptions)],
  providers: [
    CommandExtension,
    TutorialFunctions,
    SchoolNoticeFunctions,
    SchoolNoticeService,
    NoticeRecommendationService,
    MailFunctions,
    MailService,
    ChatFunctions,
    ChatService,
    HomeFunctions,
    DashboardService,
    AcademicScheduleFunctions,
    AcademicScheduleService,
    {
      provide: APP_GUARD,
      useFactory: () => new SignatureGuard(channelAppOptions),
    },
  ],
})
export class AppModule {}
