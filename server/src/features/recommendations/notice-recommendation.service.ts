import { Injectable } from "@nestjs/common";
import {
  UserProfileSchema,
  type Notice,
  type UserProfile,
  type RecommendationStudent,
  type RecommendationListOutput,
} from "@tutorial/shared";
import { analyzeNotice, type AnalysisOptions } from "./notice-analysis.js";
import { getDatabase } from "../../database.js";
// Public collection facade: recommendation code consumes shared Notice[], never NoticeRow.
import { listAllNotices } from "../../school-notice.store.js";

interface ProfileRow {
  department: string;
  grade: number;
  interests_json: string;
}

function parseProfile(row: ProfileRow | null): UserProfile | null {
  if (!row) return null;

  return {
    department: row.department,
    grade: row.grade,
    interests: JSON.parse(row.interests_json),
  };
}

export async function recommendNotices(
  student: RecommendationStudent,
  notices: readonly Notice[],
  options: AnalysisOptions = {},
): Promise<RecommendationListOutput> {
  const personalized: RecommendationListOutput["notices"] = [];
  for (const notice of notices) {
    const analysis = await analyzeNotice(
      {
        student,
        notice: {
          title: notice.title,
          content: notice.content,
          url: notice.url,
          department: notice.department,
        },
      },
      options,
    );
    if (analysis.relevant) personalized.push({ ...notice, ...analysis });
  }
  return { notices: personalized };
}

@Injectable()
export class NoticeRecommendationService {
  async getProfile(
    channelId: string,
    userId: string,
  ): Promise<UserProfile | null> {
    const row = await getDatabase()
      .prepare(
        "SELECT department, grade, interests_json FROM user_profiles WHERE channel_id = ? AND user_id = ?",
      )
      .bind(channelId, userId)
      .first<ProfileRow>();

    return parseProfile(row);
  }

  async saveProfile(
    channelId: string,
    userId: string,
    profile: UserProfile,
  ): Promise<UserProfile> {
    profile = UserProfileSchema.parse(profile);
    const interestsJson = JSON.stringify(profile.interests);

    await getDatabase()
      .prepare(
        `INSERT INTO user_profiles (channel_id, user_id, department, grade, interests_json, updated_at)
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(channel_id, user_id) DO UPDATE SET
           department = excluded.department,
           grade = excluded.grade,
           interests_json = excluded.interests_json,
           updated_at = CURRENT_TIMESTAMP`,
      )
      .bind(channelId, userId, profile.department, profile.grade, interestsJson)
      .run();

    await getDatabase()
      .prepare(
        "DELETE FROM notice_relevance WHERE channel_id = ? AND user_id = ?",
      )
      .bind(channelId, userId)
      .run();

    return profile;
  }

  async listPersonalizedNotices(
    channelId: string,
    userId: string,
  ): Promise<RecommendationListOutput> {
    const profile = await this.getProfile(channelId, userId);
    if (!profile) return { notices: [] };
    const { notices } = await listAllNotices();
    // No legacy keyword cache: fresh content/profile is the source of every decision.
    // The existing stored profile does not contain status; do not invent it.
    return recommendNotices(
      {
        major: profile.department,
        grade: profile.grade,
        interests: profile.interests,
        status: [],
      },
      notices,
    );
  }
}
