import assert from "node:assert/strict";
import test from "node:test";
import { formatRemainingTime } from "@tutorial/shared";

const now = new Date("2026-09-19T00:00:00+09:00");

test("formats remaining time as days and hours", () => {
  assert.equal(
    formatRemainingTime("2026-09-22T05:00:00+09:00", "datetime", now),
    "3일 5시간",
  );
});

test("formats sub-day remaining time", () => {
  assert.equal(
    formatRemainingTime("2026-09-19T08:00:00+09:00", "datetime", now),
    "8시간",
  );
  assert.equal(
    formatRemainingTime("2026-09-19T00:37:00+09:00", "datetime", now),
    "37분",
  );
  assert.equal(
    formatRemainingTime("2026-09-19T00:00:30+09:00", "datetime", now),
    "1분 미만",
  );
});

test("hides expired deadlines", () => {
  assert.equal(
    formatRemainingTime("2026-09-18T23:00:00+09:00", "datetime", now),
    null,
  );
});

test("uses Korea date end only for date precision display calculation", () => {
  assert.equal(formatRemainingTime("2026-09-19", "date", now), "23시간");
  assert.equal(formatRemainingTime("2026-09-25", "range", now), "6일 23시간");
});
