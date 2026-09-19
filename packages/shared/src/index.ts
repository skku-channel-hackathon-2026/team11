export * from "./mail.js";
export * from "./academic-schedules.js";
export * from "./chat.js";
export * from "./home.js";
export * from "./remaining-time.js";
export * from "./recommendations.js";
export * from "./school-notices.js";
export * from "./tutorial.js";

import { NOTICE_RECOMMENDATION_FUNCTIONS } from "./recommendations.js";
import { SCHOOL_NOTICE_COLLECTION_FUNCTIONS } from "./school-notices.js";

export const SCHOOL_NOTICE_FUNCTIONS = {
  ...NOTICE_RECOMMENDATION_FUNCTIONS,
  ...SCHOOL_NOTICE_COLLECTION_FUNCTIONS,
} as const;
