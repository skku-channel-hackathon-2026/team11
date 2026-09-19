import { Injectable } from "@nestjs/common";
import type {
  AcademicSchedule,
  CompleteChecklistTaskOutput,
  HomeDashboardOutput,
} from "@tutorial/shared";
import { MailService } from "../mail/mail.service.js";
import { NoticeRecommendationService } from "../recommendations/notice-recommendation.service.js";
import { SchoolNoticeService } from "../../school-notice.service.js";
import { AcademicScheduleService } from "../../academic-schedule.service.js";
import { buildChecklistCandidates } from "../checklist/checklist-analyzer.js";
import {
  completeChecklistTask,
  undoChecklistTask,
  dismissChecklistTask,
  progressForTasks,
  reconcileChecklistTasks,
} from "../checklist/checklist.store.js";
import { calculateLevelProgress } from "../checklist/level.js";
import { isSchoolRelatedMail } from "../mail/school-mail-classifier.js";
import { getDeadlineTargetTimeMs } from "@tutorial/shared";

@Injectable()
export class DashboardService {
  constructor(
    private readonly noticeService: SchoolNoticeService,
    private readonly mailService: MailService,
    private readonly academicScheduleService = new AcademicScheduleService(),
    private readonly recommendations = new NoticeRecommendationService(),
  ) {}

  async getDashboard(
    channelId: string,
    userId: string,
  ): Promise<HomeDashboardOutput> {
    const now = new Date();
    const [profile, notices, favoriteOutput, mailOutput, schedules] = await Promise.all([
      this.recommendations.getProfile(channelId, userId),
      this.noticeService.listNotices({ dateRange: "all" }),
      this.noticeService.listFavorites(channelId, userId),
      this.safeListMessages(channelId, userId),
      this.safeListAcademicSchedules(now),
    ]);
    const schoolMails = mailOutput.messages.filter(isSchoolRelatedMail);
    const candidates = buildChecklistCandidates(notices.notices, schoolMails, schedules, now);
    const { tasks, newTaskCount } = await reconcileChecklistTasks(channelId, userId, candidates);
    const progress = await progressForTasks(channelId, userId, tasks);

    return {
      profile,
      progress,
      tasks,
      favorites: favoriteOutput.notices.map((notice) => ({
        id: notice.id,
        title: notice.title,
        url: notice.url,
        postedAt: notice.postedAt,
        source: notice.source,
        category: notice.category,
        favoritedAt: notice.favoritedAt ?? null,
        isFavorite: true,
      })),
      upcomingDeadlines: tasks
        .filter((task) => task.status === "pending" && task.deadline)
        .filter((task) => {
          const target = task.deadline
            ? getDeadlineTargetTimeMs(task.deadline, task.deadlinePrecision)
            : null;
          return target !== null && target > now.getTime();
        })
        .sort((a, b) => String(a.deadline).localeCompare(String(b.deadline)))
        .slice(0, 6)
        .map((task) => ({
          taskId: task.id,
          title: task.canonicalTitle,
          deadline: task.deadline ?? "",
          deadlinePrecision: task.deadlinePrecision,
        })),
      failedAccounts: mailOutput.failedAccounts,
      sync: {
        lastUpdatedAt: new Date().toISOString(),
        newTaskCount,
        sourceCounts: {
          notices: notices.notices.length,
          mails: schoolMails.length,
          academicSchedules: schedules.length,
        },
      },
      generatedAt: new Date().toISOString(),
    };
  }

  async completeTask(
    channelId: string,
    userId: string,
    taskId: string,
  ): Promise<CompleteChecklistTaskOutput> {
    const result = await completeChecklistTask(channelId, userId, taskId);
    const previous = calculateLevelProgress(result.previousTotalXp, 0, 0);
    return {
      task: result.task,
      progress: result.progress,
      xpAwarded: result.xpAwarded,
      xpReverted: 0,
      leveledUp: result.progress.level > previous.level,
    };
  }

  async undoTask(
    channelId: string,
    userId: string,
    taskId: string,
  ): Promise<CompleteChecklistTaskOutput> {
    const result = await undoChecklistTask(channelId, userId, taskId);
    const previous = calculateLevelProgress(result.previousTotalXp, 0, 0);
    return {
      task: result.task,
      progress: result.progress,
      xpAwarded: 0,
      xpReverted: result.xpReverted,
      leveledUp: result.progress.level > previous.level,
    };
  }

  async dismissTask(
    channelId: string,
    userId: string,
    taskId: string,
  ): Promise<CompleteChecklistTaskOutput> {
    const result = await dismissChecklistTask(channelId, userId, taskId);
    const previous = calculateLevelProgress(result.previousTotalXp, 0, 0);
    return {
      task: result.task,
      progress: result.progress,
      xpAwarded: 0,
      xpReverted: 0,
      leveledUp: result.progress.level > previous.level,
    };
  }

  private async safeListMessages(channelId: string, userId: string) {
    try {
      return await this.mailService.listMessages(channelId, userId);
    } catch {
      return { messages: [], failedAccounts: [] };
    }
  }

  private async safeListAcademicSchedules(now: Date): Promise<AcademicSchedule[]> {
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const months = [0, 1, 2].map((offset) => {
      const value = new Date(year, month - 1 + offset, 1);
      return { year: value.getFullYear(), month: value.getMonth() + 1 };
    });

    const outputs = await Promise.all(
      months.map(async (input) => {
        try {
          return await this.academicScheduleService.listSchedules(input);
        } catch {
          return { schedules: [] };
        }
      }),
    );

    const seen = new Set<string>();
    return outputs
      .flatMap((output) => output.schedules)
      .filter((schedule) => {
        if (seen.has(schedule.id)) return false;
        seen.add(schedule.id);
        return true;
      });
  }
}

