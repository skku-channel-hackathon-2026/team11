import assert from "node:assert/strict";
import test from "node:test";
import type { MailMessage } from "@tutorial/shared";
import {
  classifySchoolMail,
  isSchoolRelatedMail,
  type SchoolMailClassificationInput,
} from "./features/mail/school-mail-classifier.js";

function mail(overrides: Partial<MailMessage>): MailMessage {
  return {
    id: "mail-1",
    accountId: "acc-1",
    accountEmail: "me@gmail.com",
    provider: "gmail",
    subject: "뉴스레터",
    from: "news@example.com",
    receivedAt: "2026-09-19T00:00:00.000Z",
    snippet: "일반 소식입니다.",
    isSchoolRelated: false,
    gmailMessageId: null,
    gmailThreadId: null,
    rfc822MessageId: null,
    externalUrl: null,
    ...overrides,
  };
}

function classify(input: SchoolMailClassificationInput): boolean {
  return classifySchoolMail(input).isSchoolRelated;
}

test("classifies official SKKU sender with school content as school mail", () => {
  assert.equal(
    isSchoolRelatedMail(mail({
      from: "학생지원팀 <help@skku.edu>",
      subject: "장학 신청 안내",
      snippet: "재학생 대상 제출 서류를 안내합니다.",
    })),
    true,
  );
});

test("classifies school keyword combinations beyond sender domain", () => {
  assert.equal(
    isSchoolRelatedMail(mail({
      subject: "성균관대 장학 신청 안내",
      from: "external-system@example.com",
      snippet: "학생지원 관련 제출 기간을 확인하세요.",
    })),
    true,
  );
});

test("does not classify unrelated single weak keyword mail", () => {
  assert.equal(
    isSchoolRelatedMail(mail({ subject: "학교 앞 맛집 뉴스레터" })),
    false,
  );
});

test("excludes Google security alerts even for school mailbox recipients", () => {
  assert.equal(
    isSchoolRelatedMail(mail({
      accountEmail: "student@skku.edu",
      from: "Google <no-reply@accounts.google.com>",
      subject: "보안 알림",
      snippet: "회원님의 Google 계정에서 새로운 로그인이 감지되었습니다.",
    })),
    false,
  );
});

test("excludes Google new sign-in notices", () => {
  assert.equal(
    classify({
      from: "Google <no-reply@accounts.google.com>",
      subject: "새로운 로그인",
      bodyText: "새 기기에서 Google 계정에 로그인했습니다.",
    }),
    false,
  );
});

test("classifies course registration notices as school mail", () => {
  assert.equal(
    classify({
      from: "학사팀 <notice@example.com>",
      subject: "2026학년도 2학기 수강신청 변경 안내",
      bodyText: "수강신청 변경 및 취소 기간을 안내드립니다.",
    }),
    true,
  );
});

test("classifies scholarship application notices as school mail", () => {
  assert.equal(
    classify({
      from: "scholarship@example.com",
      subject: "장학금 신청 안내",
      bodyText: "재학생 대상 장학금 신청기간 및 제출서류를 안내합니다.",
    }),
    true,
  );
});

test("uses body text for vague subjects with class context", () => {
  assert.equal(
    classify({
      from: "ta@example.com",
      subject: "안내드립니다",
      bodyText: "이번 주 자료구조 수업의 과제 제출기한은 9월 25일까지입니다.",
    }),
    true,
  );
});

test("excludes shopping or password service notices", () => {
  assert.equal(
    classify({
      from: "shop@example.com",
      subject: "중요한 안내",
      bodyText: "회원님의 쇼핑몰 비밀번호가 변경되었습니다.",
    }),
    false,
  );
});

test("classifies professor or TA class notices on personal Gmail as school mail", () => {
  assert.equal(
    isSchoolRelatedMail(mail({
      accountEmail: "personal@gmail.com",
      from: "김교수 <professor@example.com>",
      subject: "자료구조 수업 안내",
      snippet: "조교가 과제 제출기한과 시험 범위를 안내드립니다.",
    })),
    true,
  );
});

test("excludes ads that merely mention school", () => {
  assert.equal(
    classify({
      from: "promo@example.com",
      subject: "학교 앞 할인 이벤트",
      bodyText: "광고 수신 동의 고객님께 쇼핑몰 할인 쿠폰을 드립니다.",
    }),
    false,
  );
});

test("excludes ambiguous generic mail conservatively", () => {
  assert.equal(
    classify({
      from: "notice@example.com",
      subject: "중요한 안내",
      bodyText: "서비스 이용 정책이 변경되었습니다.",
    }),
    false,
  );
});


test("includes explicit SKKU mentions in subject or body", () => {
  assert.equal(
    classify({
      from: "notice@example.com",
      subject: "SKKU 행사 안내",
      bodyText: "참가 신청 링크를 확인해주세요.",
    }),
    true,
  );
  assert.equal(
    classify({
      from: "notice@example.com",
      subject: "안내드립니다",
      bodyText: "성균관대학교 재학생 대상 프로그램입니다.",
    }),
    true,
  );
  assert.equal(
    classify({
      from: "notice@example.com",
      subject: "성대 학생 대상 공지",
      bodyText: "자세한 내용은 본문을 확인해주세요.",
    }),
    true,
  );
});
