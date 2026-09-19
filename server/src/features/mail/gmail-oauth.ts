import { createHmac, timingSafeEqual } from "node:crypto";
import { randomUUID } from "node:crypto";
import type { MailAccount } from "@tutorial/shared";
import {
  getMailAccountTokens,
  insertMailAccount,
  updateMailAccountTokens,
} from "./mail.store.js";

const gmailAuthUrl = "https://accounts.google.com/o/oauth2/v2/auth";
const gmailTokenUrl = "https://oauth2.googleapis.com/token";
const gmailProfileUrl = "https://gmail.googleapis.com/gmail/v1/users/me/profile";
const googleUserInfoUrl = "https://www.googleapis.com/oauth2/v3/userinfo";
const stateDomain = "team11-gmail-oauth-state\0";
const scopes = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];

interface GmailOAuthState {
  channelId: string;
  userId: string;
  expiresAt: number;
}

interface GmailTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
}

interface GmailProfileResponse {
  emailAddress?: string;
}

interface GoogleUserInfoResponse {
  email?: string;
}

export function hasGmailOAuthConfig(): boolean {
  return Boolean(gmailClientId() && gmailClientSecret() && gmailRedirectUri());
}

export function createGmailAuthorizationUrl(channelId: string, userId: string): string {
  assertGmailOAuthConfig();

  const state = signState({
    channelId,
    userId,
    expiresAt: Date.now() + 10 * 60 * 1000,
  });
  const url = new URL(gmailAuthUrl);
  url.searchParams.set("client_id", gmailClientId());
  url.searchParams.set("redirect_uri", gmailRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scopes.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function handleGmailOAuthCallback(url: URL): Promise<Response> {
  try {
    assertGmailOAuthConfig();

    const code = url.searchParams.get("code");
    const stateToken = url.searchParams.get("state");
    const error = url.searchParams.get("error");
    if (error) return html(`Gmail 연동이 취소되었습니다: ${escapeHtml(error)}`, 400);
    if (!code || !stateToken) return html("Gmail OAuth callback 값이 부족합니다.", 400);

    const state = readState(stateToken);
    if (!state || state.expiresAt <= Date.now()) {
      return html("Gmail OAuth state가 유효하지 않거나 만료되었습니다.", 400);
    }

    const token = await exchangeCode(code);
    if (!token.access_token) return html("Gmail access token을 받지 못했습니다.", 400);

    const email = await fetchGmailEmail(token.access_token);
    if (!email) return html("Gmail 계정 이메일을 확인하지 못했습니다.", 400);

    const expiresAt = token.expires_in
      ? new Date(Date.now() + token.expires_in * 1000).toISOString()
      : null;

    await insertMailAccount(state.channelId, state.userId, {
      id: randomUUID(),
      provider: "gmail",
      email,
      displayName: email,
      connectedAt: new Date().toISOString(),
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? null,
      tokenExpiresAt: expiresAt,
      tokenScope: token.scope ?? scopes.join(" "),
    });

    return html("Gmail 연동이 완료되었습니다. 이 창을 닫고 메일 탭을 새로고침해주세요.");
  } catch (error) {
    return html(
      `Gmail 연동 중 오류가 발생했습니다: ${escapeHtml(error instanceof Error ? error.message : "unknown")}`,
      500,
    );
  }
}

export async function resolveGmailAccessToken(account: MailAccount): Promise<string> {
  assertGmailOAuthConfig();

  const tokens = await getMailAccountTokens(account.id);
  if (!tokens) throw new Error(`Gmail account token not found: ${account.email}`);

  const expiresAt = tokens.tokenExpiresAt ? Date.parse(tokens.tokenExpiresAt) : 0;
  if (tokens.accessToken && expiresAt - Date.now() > 60_000) {
    return tokens.accessToken;
  }

  if (!tokens.refreshToken) {
    throw new Error(`Gmail refresh token is missing for ${account.email}`);
  }

  const refreshed = await refreshAccessToken(tokens.refreshToken);
  if (!refreshed.access_token) {
    throw new Error(`Gmail refresh failed for ${account.email}`);
  }

  const nextExpiresAt = refreshed.expires_in
    ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
    : tokens.tokenExpiresAt;

  await updateMailAccountTokens(account.id, {
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token ?? tokens.refreshToken,
    tokenExpiresAt: nextExpiresAt,
    tokenScope: refreshed.scope ?? tokens.tokenScope,
  });

  return refreshed.access_token;
}

function assertGmailOAuthConfig(): void {
  if (!hasGmailOAuthConfig()) {
    throw new Error(
      "Gmail OAuth is not configured. Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and GMAIL_REDIRECT_URI.",
    );
  }
}

async function exchangeCode(code: string): Promise<GmailTokenResponse> {
  const response = await fetch(gmailTokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: gmailClientId(),
      client_secret: gmailClientSecret(),
      redirect_uri: gmailRedirectUri(),
      grant_type: "authorization_code",
    }),
  });
  const body = (await response.json()) as GmailTokenResponse;
  if (!response.ok) {
    throw new Error(body.error_description || body.error || `Gmail token exchange failed: ${response.status}`);
  }
  return body;
}

async function refreshAccessToken(refreshToken: string): Promise<GmailTokenResponse> {
  const response = await fetch(gmailTokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: gmailClientId(),
      client_secret: gmailClientSecret(),
      grant_type: "refresh_token",
    }),
  });
  const body = (await response.json()) as GmailTokenResponse;
  if (!response.ok) {
    throw new Error(body.error_description || body.error || `Gmail token refresh failed: ${response.status}`);
  }
  return body;
}

async function fetchGmailEmail(accessToken: string): Promise<string | null> {
  const gmailProfileResponse = await fetch(gmailProfileUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (gmailProfileResponse.ok) {
    const profile = (await gmailProfileResponse.json()) as GmailProfileResponse;
    if (profile.emailAddress) return profile.emailAddress;
  }

  const userInfoResponse = await fetch(googleUserInfoUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!userInfoResponse.ok) return null;
  const userInfo = (await userInfoResponse.json()) as GoogleUserInfoResponse;
  return userInfo.email ?? null;
}

function signState(state: GmailOAuthState): string {
  const body = Buffer.from(JSON.stringify(state)).toString("base64url");
  const signature = createHmac("sha256", gmailStateSecret())
    .update(stateDomain)
    .update(body)
    .digest("base64url");
  return `${body}.${signature}`;
}

function readState(token: string): GmailOAuthState | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  try {
    const expected = createHmac("sha256", gmailStateSecret())
      .update(stateDomain)
      .update(body)
      .digest();
    const actual = Buffer.from(signature, "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as GmailOAuthState;
    return parsed.channelId && parsed.userId && parsed.expiresAt ? parsed : null;
  } catch {
    return null;
  }
}

function html(message: string, status = 200): Response {
  return new Response(
    `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>Gmail 연결</title><style>body{font-family:system-ui,sans-serif;padding:32px;line-height:1.5;color:#151514;background:#f4f1ec}main{max-width:520px;margin:auto;background:#fffdf9;border:1px solid #ddd7cf;border-radius:16px;padding:24px}button{height:40px;border:0;border-radius:999px;background:#151514;color:#fffdf9;padding:0 18px;font-weight:800}</style></head><body><main><h1>Gmail 연결</h1><p>${message}</p><button onclick="window.close()">창 닫기</button></main></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function gmailClientId(): string {
  return process.env.GMAIL_CLIENT_ID?.trim() ?? "";
}

function gmailClientSecret(): string {
  return process.env.GMAIL_CLIENT_SECRET?.trim() ?? "";
}

function gmailRedirectUri(): string {
  return process.env.GMAIL_REDIRECT_URI?.trim() ?? "";
}

function gmailStateSecret(): string {
  const secret = process.env.APP_SECRET?.trim();
  if (!secret) throw new Error("APP_SECRET is required for Gmail OAuth state signing.");
  return secret;
}
