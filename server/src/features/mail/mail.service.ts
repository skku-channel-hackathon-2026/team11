import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type {
  ConnectMailAccountInput,
  MailAccount,
  MailConnectionStatus,
  MailMessage,
  MailMessageListOutput,
} from "@tutorial/shared";
import {
  deleteMailAccount,
  insertMailAccount,
  listMailAccounts,
} from "./mail.store.js";
import { defaultMailProvider, type MailProviderAdapter } from "./mail.provider.js";

/**
 * 메일 연동 기능의 핵심 서비스.
 *
 * 여러 메일 계정을 연결하고, 연결된 모든 계정의 메시지를 하나의 통합
 * 수신함으로 묶어(merge) 최신순으로 제공한다. 저장은 D1(mail_accounts),
 * 메시지 조회는 제공자 어댑터(기본: mock)를 통해 이뤄진다.
 *
 * NestJS가 인자 없이 생성할 수 있도록 생성자 주입을 두지 않고, provider는
 * 기본값(mock)을 쓰되 테스트/대체 구현에서는 `useProvider`로 교체한다.
 */
@Injectable()
export class MailService {
  private provider: MailProviderAdapter = defaultMailProvider;

  /** 테스트나 실제 Gmail/Outlook 어댑터로 메시지 제공자를 교체한다. */
  useProvider(provider: MailProviderAdapter): void {
    this.provider = provider;
  }

  async listAccounts(
    channelId: string,
    userId: string,
  ): Promise<MailAccount[]> {
    return listMailAccounts(channelId, userId);
  }

  async getConnectionStatus(
    channelId: string,
    userId: string,
  ): Promise<MailConnectionStatus> {
    const accounts = await this.listAccounts(channelId, userId);
    return {
      connected: accounts.length > 0,
      email: accounts[0]?.email ?? null,
      accountCount: accounts.length,
    };
  }

  async connectAccount(
    channelId: string,
    userId: string,
    input: ConnectMailAccountInput,
  ): Promise<MailAccount> {
    return insertMailAccount(channelId, userId, {
      id: randomUUID(),
      provider: input.provider,
      email: input.email,
      displayName: input.displayName ?? null,
      connectedAt: new Date().toISOString(),
    });
  }

  async disconnectAccount(
    channelId: string,
    userId: string,
    accountId: string,
  ): Promise<boolean> {
    return deleteMailAccount(channelId, userId, accountId);
  }

  /**
   * 연결된 계정들의 메시지를 하나로 묶어 최신순으로 반환한다.
   * `accountId`가 주어지면 해당 계정만, 없으면 모든 계정을 통합한다.
   */
  async listMessages(
    channelId: string,
    userId: string,
    accountId?: string,
  ): Promise<MailMessageListOutput> {
    const accounts = await this.listAccounts(channelId, userId);
    const targets = accountId
      ? accounts.filter((account) => account.id === accountId)
      : accounts;

    const perAccount = await Promise.all(
      targets.map((account) => this.provider.fetchMessages(account)),
    );

    const messages = perAccount
      .flat()
      .sort((a, b) => compareReceivedAtDesc(a, b));

    return { messages };
  }
}

/** 최신 수신 메시지가 앞에 오도록 정렬. 동률이면 id로 안정 정렬. */
function compareReceivedAtDesc(a: MailMessage, b: MailMessage): number {
  if (a.receivedAt !== b.receivedAt) {
    return a.receivedAt < b.receivedAt ? 1 : -1;
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
