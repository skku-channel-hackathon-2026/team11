import { z } from "zod";
import { NoticeSchema } from "./school-notices.js";

export const NOTICE_RECOMMENDATION_FUNCTIONS = {
  getProfile: "schoolNotice.getProfile",
  saveProfile: "schoolNotice.saveProfile",
  listPersonalizedNotices: "schoolNotice.listPersonalizedNotices",
} as const;

export const NoticeInterestSchema = z.enum([
  "장학",
  "학사",
  "취업",
  "창업",
  "동아리",
  "대외활동",
  "교환학생",
  "대학원",
]);

export type NoticeInterest = z.infer<typeof NoticeInterestSchema>;

export const UserProfileSchema = z.object({
  department: z.string().trim().min(1).max(80),
  grade: z.coerce.number().int().min(1).max(6),
  interests: z.array(NoticeInterestSchema).min(1).max(8),
});

export type UserProfile = z.infer<typeof UserProfileSchema>;

export const UserProfileOutputSchema = z.object({
  profile: UserProfileSchema.nullable(),
});

export type UserProfileOutput = z.infer<typeof UserProfileOutputSchema>;

export const SaveUserProfileOutputSchema = z.object({
  profile: UserProfileSchema,
});

export type SaveUserProfileOutput = z.infer<typeof SaveUserProfileOutputSchema>;

// 추천 전용 계약. 수집 담당의 NoticeSchema와 저장 프로필 계약은 변경하지 않는다.
export const NoticeCategorySchema = z.enum([
  "ACADEMIC",
  "SCHOLARSHIP",
  "EVENT",
  "CAREER",
  "EXCHANGE",
  "CLUB",
  "OTHER",
]);
export type NoticeCategory = z.infer<typeof NoticeCategorySchema>;

const text = z.string().trim().min(1);
export const RecommendationStudentSchema = z.object({
  grade: z.number().int().positive(),
  major: text,
  interests: z.array(text),
  status: z.array(text),
});
export type RecommendationStudent = z.infer<typeof RecommendationStudentSchema>;

export const AnalyzeNoticeInputSchema = z.object({
  student: RecommendationStudentSchema,
  notice: z.object({
    title: text,
    content: text,
    url: z.string().optional(),
    department: z.string().optional(),
  }),
});
export type AnalyzeNoticeInput = z.infer<typeof AnalyzeNoticeInputSchema>;

export const NoticeAnalysisSchema = z
  .object({
    relevant: z.boolean(),
    reason: text,
    summary: text,
    category: NoticeCategorySchema,
  })
  .strict();
export type NoticeAnalysis = z.infer<typeof NoticeAnalysisSchema>;

// 원본 Notice를 수정하지 않고 추천용 출력만 확장한다.
export const RecommendedNoticeSchema = NoticeSchema.merge(NoticeAnalysisSchema);
export type RecommendedNotice = z.infer<typeof RecommendedNoticeSchema>;
export const RecommendationListOutputSchema = z.object({
  notices: z.array(RecommendedNoticeSchema),
});
export type RecommendationListOutput = z.infer<
  typeof RecommendationListOutputSchema
>;
