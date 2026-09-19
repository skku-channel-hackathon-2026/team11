import { Injectable } from "@nestjs/common";
import type {
  NoticeListInput,
  NoticeListOutput,
  SeedNoticesOutput,
  SyncNoticesOutput,
  UserProfile,
} from "@tutorial/shared";
import { NoticeRecommendationService } from "./features/recommendations/notice-recommendation.service.js";
import { listAllNotices } from "./features/school-notices/school-notice.store.js";
import { listFavoriteNotices, listNoticesWithFavorites, toggleNoticeFavorite } from "./features/school-notices/notice-favorite.store.js";
import { syncSchoolNotices } from "./features/school-notices/school-notice-sync.js";
import { upsertNotice } from "./school-notice.store.js";

const sampleNotices = [
  {
    title: "신입생 장학금 신청 안내",
    content:
      "2026학년도 신입생을 대상으로 입학 초기 정착을 돕기 위한 장학금 신청을 받습니다. 1학년 재학생은 기간 내 신청서를 제출하세요.",
    url: "https://example.skku.edu/notices/freshman-scholarship-2026",
    postedAt: "2026-03-04T09:00:00.000Z",
    department: "학생지원팀",
    category: "장학",
  },
  {
    title: "소프트웨어학과 창업동아리 모집",
    content:
      "소프트웨어학과 학생을 대상으로 창업 아이디어를 함께 실험할 신입 부원을 모집합니다. 학년 제한 없이 지원할 수 있습니다.",
    url: "https://example.skku.edu/notices/software-startup-club-2026",
    postedAt: "2026-03-06T09:00:00.000Z",
    department: "소프트웨어학과",
    category: "채용/모집",
  },
  {
    title: "4학년 졸업요건 안내",
    content:
      "2026학년도 4학년 학생은 졸업논문, 인증, 전공학점 이수 현황을 확인하고 누락 항목을 보완하세요.",
    url: "https://example.skku.edu/notices/graduation-requirements-2026",
    postedAt: "2026-03-08T09:00:00.000Z",
    department: "학사운영팀",
    category: "학사",
  },
  {
    title: "교환학생 모집 안내",
    content:
      "2026학년도 2학기 파견 교환학생을 모집합니다. 어학 성적과 학업 계획서를 준비해 국제처 공지를 확인하세요.",
    url: "https://example.skku.edu/notices/exchange-student-2026",
    postedAt: "2026-03-10T09:00:00.000Z",
    department: "국제처",
    category: "일반",
  },
] as const;

@Injectable()
export class SchoolNoticeService {
  constructor(
    private readonly recommendations = new NoticeRecommendationService(),
  ) {}

  async listNotices(input: NoticeListInput = {}): Promise<NoticeListOutput> {
    return listAllNotices(input);
  }

  async listNoticesForUser(
    channelId: string,
    userId: string,
    input: NoticeListInput = {},
  ): Promise<NoticeListOutput> {
    return listNoticesWithFavorites(channelId, userId, input);
  }

  async listFavorites(channelId: string, userId: string): Promise<NoticeListOutput> {
    return listFavoriteNotices(channelId, userId);
  }

  async toggleFavorite(
    channelId: string,
    userId: string,
    noticeId: string,
  ): Promise<boolean> {
    return toggleNoticeFavorite(channelId, userId, noticeId);
  }

  async seedNotices(): Promise<SeedNoticesOutput> {
    let inserted = 0;

    for (const notice of sampleNotices) {
      const result = await upsertNotice(notice);
      if (result === "inserted") inserted += 1;
    }

    return { inserted };
  }

  async syncNotices(): Promise<SyncNoticesOutput> {
    return syncSchoolNotices();
  }

  async getProfile(
    channelId: string,
    userId: string,
  ): Promise<UserProfile | null> {
    return this.recommendations.getProfile(channelId, userId);
  }

  async saveProfile(
    channelId: string,
    userId: string,
    profile: UserProfile,
  ): Promise<UserProfile> {
    return this.recommendations.saveProfile(channelId, userId, profile);
  }

  async listPersonalizedNotices(
    channelId: string,
    userId: string,
  ): Promise<NoticeListOutput> {
    return this.recommendations.listPersonalizedNotices(channelId, userId);
  }
}
