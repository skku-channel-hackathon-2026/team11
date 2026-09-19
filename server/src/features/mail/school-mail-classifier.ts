import type { MailMessage } from "@tutorial/shared";

export interface SchoolMailClassificationInput {
  id?: string;
  from: string;
  subject: string;
  snippet?: string;
  bodyText?: string | null;
  isSchoolRelated?: boolean;
}

export type SchoolMailCategory =
  | "ACADEMIC"
  | "CLASS"
  | "SCHOLARSHIP"
  | "DEPARTMENT"
  | "PROFESSOR"
  | "ADMINISTRATION"
  | "STUDENT_ACTIVITY"
  | "SCHOOL_SYSTEM"
  | "NOT_SCHOOL";

export interface SchoolMailClassificationResult {
  isSchoolRelated: boolean;
  confidence: number;
  category: SchoolMailCategory;
  path: "deterministic";
  reason: string;
}

const officialSchoolSenderPatterns = [
  /@([a-z0-9.-]+\.)?skku\.edu\b/i,
  /@([a-z0-9.-]+\.)?skku\.ac\.kr\b/i,
  /@([a-z0-9.-]+\.)?kingo\.skku\.edu\b/i,
];

const explicitSchoolNameKeywords = [
  "성균관대학교",
  "성균관대",
  "성대",
  "skku",
];

const nonSchoolSenderPatterns = [
  /@([a-z0-9.-]+\.)?accounts\.google\.com\b/i,
  /@([a-z0-9.-]+\.)?google\.com\b/i,
  /@([a-z0-9.-]+\.)?youtube\.com\b/i,
  /@([a-z0-9.-]+\.)?googleplay\.com\b/i,
  /@([a-z0-9.-]+\.)?apple\.com\b/i,
  /@([a-z0-9.-]+\.)?amazon\.com\b/i,
  /@([a-z0-9.-]+\.)?coupang\.com\b/i,
];

const nonSchoolKeywords = [
  "google 계정",
  "google account",
  "보안 알림",
  "security alert",
  "새로운 로그인",
  "새 로그인",
  "new sign-in",
  "로그인했습니다",
  "비밀번호가 변경",
  "password changed",
  "복구 이메일",
  "recovery email",
  "2단계 인증",
  "2-step verification",
  "youtube",
  "google play",
  "배송",
  "주문",
  "결제",
  "쇼핑몰",
  "광고",
  "할인",
  "프로모션",
  "뉴스레터",
];

const schoolAnchorKeywords = [
  "성균관",
  "성균관대",
  "skku",
  "소프트웨어학과",
  "소프트웨어융합대학",
  "학과",
  "학부",
  "대학",
  "교수",
  "조교",
  "행정실",
  "학생지원",
  "학사",
  "수강신청",
  "수강",
  "장학",
  "등록금",
  "졸업",
  "휴학",
  "복학",
  "강의",
  "수업",
  "과제",
  "시험",
  "세미나",
  "비교과",
  "킹고",
  "kingo",
];

const schoolActionKeywords = [
  "안내",
  "공지",
  "신청",
  "제출",
  "변경",
  "취소",
  "등록",
  "납부",
  "모집",
  "채용",
  "참여",
  "제출기한",
  "기한",
  "기간",
  "강의자료",
  "자료구조",
  "과제",
  "시험",
  "수업",
  "재학생",
];

function normalizedText(input: SchoolMailClassificationInput): string {
  return [input.subject, input.from, input.snippet, input.bodyText]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function senderDomain(from: string): string {
  const match = from.match(/[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})/i);
  return match?.[1]?.toLowerCase() ?? "";
}

function hasAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword.toLowerCase()));
}

function hitCount(text: string, keywords: string[]): number {
  return keywords.filter((keyword) => text.includes(keyword.toLowerCase())).length;
}

function isOfficialSchoolSender(from: string): boolean {
  return officialSchoolSenderPatterns.some((pattern) => pattern.test(from));
}

function isKnownNonSchoolSender(from: string): boolean {
  return nonSchoolSenderPatterns.some((pattern) => pattern.test(from));
}

export function classifySchoolMail(
  input: SchoolMailClassificationInput,
): SchoolMailClassificationResult {
  const text = normalizedText(input);
  const domain = senderDomain(input.from);
  const subjectAndBody = [input.subject, input.snippet, input.bodyText]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const anchorHits = hitCount(text, schoolAnchorKeywords);
  const actionHits = hitCount(text, schoolActionKeywords);
  const officialSender = isOfficialSchoolSender(input.from);

  if (hasAny(subjectAndBody, explicitSchoolNameKeywords)) {
    return {
      isSchoolRelated: true,
      confidence: 0.99,
      category: "SCHOOL_SYSTEM",
      path: "deterministic",
      reason: "explicit school name in subject/snippet/body",
    };
  }

  if (isKnownNonSchoolSender(input.from) || hasAny(text, nonSchoolKeywords)) {
    const hasStrongSchoolContent = anchorHits >= 2 && actionHits >= 1 && !isKnownNonSchoolSender(input.from);
    if (!hasStrongSchoolContent) {
      return {
        isSchoolRelated: false,
        confidence: 0.98,
        category: "NOT_SCHOOL",
        path: "deterministic",
        reason: `non-school service or account/security mail${domain ? ` from ${domain}` : ""}`,
      };
    }
  }

  if (officialSender && (anchorHits >= 1 || actionHits >= 1)) {
    return {
      isSchoolRelated: true,
      confidence: 0.96,
      category: "SCHOOL_SYSTEM",
      path: "deterministic",
      reason: "official school sender with school/action content",
    };
  }

  if (text.includes("장학") && (text.includes("재학생") || actionHits >= 2)) {
    return {
      isSchoolRelated: true,
      confidence: 0.9,
      category: "SCHOLARSHIP",
      path: "deterministic",
      reason: "scholarship content with student/application context",
    };
  }

  if (anchorHits >= 2 && actionHits >= 1) {
    return {
      isSchoolRelated: true,
      confidence: 0.9,
      category: text.includes("장학") ? "SCHOLARSHIP" : "ACADEMIC",
      path: "deterministic",
      reason: "multiple school anchors with an actionable school context",
    };
  }

  if ((text.includes("교수") || text.includes("조교")) && (text.includes("수업") || text.includes("과제") || text.includes("시험") || text.includes("강의"))) {
    return {
      isSchoolRelated: true,
      confidence: 0.88,
      category: "CLASS",
      path: "deterministic",
      reason: "professor/TA class context",
    };
  }

  if ((text.includes("수업") || text.includes("과제") || text.includes("시험") || text.includes("강의")) && actionHits >= 2) {
    return {
      isSchoolRelated: true,
      confidence: 0.84,
      category: "CLASS",
      path: "deterministic",
      reason: "classwork context with actionable deadline/content",
    };
  }

  return {
    isSchoolRelated: false,
    confidence: 0.72,
    category: "NOT_SCHOOL",
    path: "deterministic",
    reason: "insufficient direct school-life evidence",
  };
}

export function isSchoolRelatedMail(
  message: MailMessage | SchoolMailClassificationInput,
): boolean {
  return classifySchoolMail(message).isSchoolRelated;
}

export function withSchoolRelatedFlag(message: MailMessage): MailMessage {
  if (message.isSchoolRelated) {
    console.info("[SchoolMailClassifier]", {
      messageId: message.gmailMessageId ?? message.id,
      senderDomain: senderDomain(message.from),
      result: true,
      confidence: 0.9,
      category: "SCHOOL_SYSTEM",
      path: "deterministic",
    });
    return message;
  }

  const result = classifySchoolMail(message);
  console.info("[SchoolMailClassifier]", {
    messageId: message.gmailMessageId ?? message.id,
    senderDomain: senderDomain(message.from),
    result: result.isSchoolRelated,
    confidence: result.confidence,
    category: result.category,
    path: result.path,
  });
  return {
    ...message,
    isSchoolRelated: result.isSchoolRelated,
  };
}
