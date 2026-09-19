import { Injectable } from "@nestjs/common";
import {
  UserProfileSchema,
  type Notice,
  type NoticeAnalysis,
  type UserProfile,
  type RecommendationStudent,
  type RecommendationListOutput,
} from "@tutorial/shared";
import { analyzeNotice, type AnalysisOptions } from "./notice-analysis.js";
import { getDatabase } from "../../database.js";
// Public collection facade: recommendation code consumes shared Notice[], never NoticeRow.
import { listNoticesWithFavorites } from "../school-notices/notice-favorite.store.js";

interface ProfileRow {
  department: string;
  grade: number;
  interests_json: string;
}

type DeterministicDecision =
  | { type: "include"; analysis: NoticeAnalysis }
  | { type: "exclude" }
  | { type: "unknown" };

function parseProfile(row: ProfileRow | null): UserProfile | null {
  if (!row) return null;

  return {
    department: row.department,
    grade: row.grade,
    interests: JSON.parse(row.interests_json),
  };
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, "");
}

function noticeText(notice: Notice): string {
  return [notice.title, notice.content, notice.category ?? "", notice.source]
    .join(" ")
    .trim();
}

function hasAny(text: string, terms: readonly string[]): boolean {
  const normalized = normalize(text);
  return terms.some((term) => normalized.includes(normalize(term)));
}

function extractTargetGrades(text: string): Set<number> {
  const grades = new Set<number>();
  for (const match of text.matchAll(/([1-6])\s*학년/g)) {
    grades.add(Number(match[1]));
  }
  if (/신입생|새내기/.test(text)) grades.add(1);
  return grades;
}

function mapCategory(notice: Notice): NoticeAnalysis["category"] {
  const text = noticeText(notice);
  if (hasAny(text, ["장학", "등록금", "학자금"])) return "SCHOLARSHIP";
  if (hasAny(text, ["채용", "취업", "인턴", "현장실습", "모집"]))
    return "CAREER";
  if (hasAny(text, ["교환학생", "국제교류", "파견"])) return "EXCHANGE";
  if (hasAny(text, ["동아리", "소모임"])) return "CLUB";
  if (hasAny(text, ["행사", "세미나", "특강", "설명회"])) return "EVENT";
  if (hasAny(text, ["학사", "수강", "졸업", "휴학", "복학", "시험"]))
    return "ACADEMIC";
  return "OTHER";
}

function deterministicDecision(
  student: RecommendationStudent,
  notice: Notice,
): DeterministicDecision {
  const text = noticeText(notice);
  const normalized = normalize(text);
  const targetGrades = extractTargetGrades(text);
  const openToAllGrades = hasAny(text, [
    "전학년",
    "전체학년",
    "학년제한없음",
    "학년무관",
  ]);

  if (
    targetGrades.size > 0 &&
    !targetGrades.has(student.grade) &&
    !openToAllGrades
  ) {
    return { type: "exclude" };
  }

  const majorMatched = student.major.trim()
    ? normalized.includes(normalize(student.major))
    : false;
  const allStudentsMatched = hasAny(text, [
    "전체재학생",
    "전체학생",
    "전교생",
    "학부생대상",
    "재학생대상",
    "성균관대학교학생",
    "성균관대학생",
  ]);
  const interestMatched = student.interests.some((interest) =>
    hasAny(text, [interest]),
  );

  if (!majorMatched && !allStudentsMatched && !interestMatched) {
    return { type: "unknown" };
  }

  const reason = majorMatched
    ? `${student.major} 정보와 직접 연결된 공지입니다.`
    : allStudentsMatched
      ? "전체 학생 또는 학부생 대상 공지입니다."
      : "저장된 관심사와 연결된 공지입니다.";

  return {
    type: "include",
    analysis: {
      relevant: true,
      reason,
      summary: notice.title,
      category: mapCategory(notice),
    },
  };
}

export async function recommendNotices(
  student: RecommendationStudent,
  notices: readonly Notice[],
  options: AnalysisOptions = {},
): Promise<RecommendationListOutput> {
  const personalized: RecommendationListOutput["notices"] = [];
  for (const notice of notices) {
    const deterministic = deterministicDecision(student, notice);
    if (deterministic.type === "exclude") continue;
    if (deterministic.type === "include") {
      personalized.push({ ...notice, ...deterministic.analysis });
      continue;
    }

    try {
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
    } catch {
      // Individual AI failures must not make the whole personalized notice list fail.
    }
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
    const { notices } = await listNoticesWithFavorites(channelId, userId);
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
