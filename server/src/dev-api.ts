import {
  SCHOOL_NOTICE_FUNCTIONS,
  NoticeListInputSchema,
  UserProfileSchema,
  type NoticeListOutput,
  type SaveUserProfileOutput,
  type SeedNoticesOutput,
  type SyncNoticesOutput,
  type UserProfileOutput,
} from "@tutorial/shared";
import { SchoolNoticeService } from "./school-notice.service.js";
import { countNotices } from "./school-notice.store.js";

const localDevChannelId = "local-dev-channel";
const localDevUserId = "local-dev-user";

function isLocalhost(url: URL): boolean {
  return (
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "::1"
  );
}

function json(data: unknown, init?: ResponseInit): Response {
  return Response.json(data, {
    headers: { "cache-control": "no-store", ...init?.headers },
    status: init?.status,
    statusText: init?.statusText,
  });
}

export async function handleDevSchoolNoticeRequest(
  request: Request,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/dev/school-notice")) return null;

  if (!isLocalhost(url)) {
    return json({ error: "Not found" }, { status: 404 });
  }

  if (
    url.pathname === "/api/dev/school-notice/stats" &&
    request.method === "GET"
  ) {
    return json({ notices: await countNotices() });
  }

  if (
    url.pathname !== "/api/dev/school-notice/function" ||
    request.method !== "POST"
  ) {
    return json({ error: "Not found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as {
    name?: string;
    params?: unknown;
  } | null;

  if (!body?.name) {
    return json({ error: "Function name is required" }, { status: 400 });
  }

  try {
    const service = new SchoolNoticeService();

    switch (body.name) {
      case SCHOOL_NOTICE_FUNCTIONS.getProfile: {
        const output: UserProfileOutput = {
          profile: await service.getProfile(localDevChannelId, localDevUserId),
        };
        return json(output);
      }

      case SCHOOL_NOTICE_FUNCTIONS.saveProfile: {
        const profile = UserProfileSchema.parse(body.params);
        const output: SaveUserProfileOutput = {
          profile: await service.saveProfile(
            localDevChannelId,
            localDevUserId,
            profile,
          ),
        };
        return json(output);
      }

      case SCHOOL_NOTICE_FUNCTIONS.listNotices: {
        const input = NoticeListInputSchema.parse(body.params ?? {});
        const output: NoticeListOutput = await service.listNotices(input);
        return json(output);
      }

      case SCHOOL_NOTICE_FUNCTIONS.listPersonalizedNotices: {
        const output: NoticeListOutput = await service.listPersonalizedNotices(
          localDevChannelId,
          localDevUserId,
        );
        return json(output);
      }

      case SCHOOL_NOTICE_FUNCTIONS.seedNotices: {
        const output: SeedNoticesOutput = await service.seedNotices();
        return json(output);
      }

      case SCHOOL_NOTICE_FUNCTIONS.syncNotices: {
        const output: SyncNoticesOutput = await service.syncNotices();
        return json(output);
      }

      default:
        return json({ error: "Unsupported function" }, { status: 404 });
    }
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 400 },
    );
  }
}
