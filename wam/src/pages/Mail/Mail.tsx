import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { useCallFunction } from '@channel.io/app-sdk-wam'
import {
  MAIL_FUNCTIONS,
  type MailAccount,
  type MailAccountListOutput,
  type MailConnectionStatus,
  type MailMessage,
  type MailMessageListOutput,
  type MailProvider,
} from '@tutorial/shared'
import { Button, HStack, Text, VStack } from '@channel.io/bezier-react/beta'
import { InlineBanner } from '@channel.io/app-sdk-wam-ui'

import { useTutorialWamData } from '../../hooks/useTutorialWamData'

const providers: { value: MailProvider; label: string }[] = [
  { value: 'gmail', label: 'Gmail' },
  { value: 'outlook', label: 'Outlook' },
]

function AccountRow({
  account,
  onDisconnect,
  disabled,
}: {
  account: MailAccount
  onDisconnect: (accountId: string) => void
  disabled: boolean
}) {
  return (
    <div style={styles.accountRow}>
      <div style={{ minWidth: 0 }}>
        <Text
          typo="14"
          bold
        >
          {account.email}
        </Text>
        <Text
          typo="12"
          color="text-neutral-light"
        >
          {account.provider} · {account.connectedAt.slice(0, 10)}
        </Text>
      </div>
      <Button
        variant="outlined"
        semantic="secondary"
        size="s"
        label="연결 해제"
        disabled={disabled}
        onClick={() => onDisconnect(account.id)}
      />
    </div>
  )
}

function MessageCard({ message }: { message: MailMessage }) {
  return (
    <article style={styles.card}>
      <HStack
        justify="between"
        align="start"
        spacing={8}
      >
        <div style={{ minWidth: 0 }}>
          <Text
            typo="14"
            bold
          >
            {message.subject}
          </Text>
          <Text
            typo="12"
            color="text-neutral-light"
          >
            {message.from} · {message.receivedAt.slice(0, 16).replace('T', ' ')}
          </Text>
        </div>
        <span style={styles.badge}>{message.accountEmail}</span>
      </HStack>
      <p style={styles.snippet}>{message.snippet}</p>
    </article>
  )
}

function Mail() {
  const { data: wamData } = useTutorialWamData()
  const appId = wamData?.appId ?? ''

  const [provider, setProvider] = useState<MailProvider>('gmail')
  const [email, setEmail] = useState('')
  const [accounts, setAccounts] = useState<MailAccount[]>([])
  const [status, setStatus] = useState<MailConnectionStatus | null>(null)
  const [messages, setMessages] = useState<MailMessage[]>([])
  const [statusMessage, setStatusMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const {
    call: getConnectionStatus,
    loading: statusLoading,
    error: statusError,
  } = useCallFunction<MailConnectionStatus>({
    appId,
    name: MAIL_FUNCTIONS.getConnectionStatus,
  })
  const {
    call: listAccounts,
    loading: accountsLoading,
    error: accountsError,
  } = useCallFunction<MailAccountListOutput>({
    appId,
    name: MAIL_FUNCTIONS.listAccounts,
  })
  const {
    call: connectAccount,
    loading: connectLoading,
    error: connectError,
  } = useCallFunction<MailAccount>({
    appId,
    name: MAIL_FUNCTIONS.connectAccount,
  })
  const {
    call: disconnectAccount,
    loading: disconnectLoading,
    error: disconnectError,
  } = useCallFunction<{ disconnected: boolean }>({
    appId,
    name: MAIL_FUNCTIONS.disconnectAccount,
  })
  const {
    call: listMessages,
    loading: messagesLoading,
    error: messagesError,
  } = useCallFunction<MailMessageListOutput>({
    appId,
    name: MAIL_FUNCTIONS.listMessages,
  })

  const refresh = useCallback(async () => {
    const [statusOutput, accountsOutput, messagesOutput] = await Promise.all([
      getConnectionStatus({}),
      listAccounts({}),
      listMessages({}),
    ])
    setStatus(statusOutput)
    setAccounts(accountsOutput.accounts)
    setMessages(messagesOutput.messages)
  }, [getConnectionStatus, listAccounts, listMessages])

  useEffect(() => {
    if (!appId) return

    let active = true
    async function load() {
      setErrorMessage('')
      try {
        await refresh()
      } catch {
        if (active) setErrorMessage('메일 데이터를 불러오지 못했습니다.')
      }
    }

    void load()
    return () => {
      active = false
    }
  }, [appId, refresh])

  const loading =
    statusLoading ||
    accountsLoading ||
    connectLoading ||
    disconnectLoading ||
    messagesLoading
  const sdkError =
    statusError ||
    accountsError ||
    connectError ||
    disconnectError ||
    messagesError
      ? '요청을 처리하지 못했습니다. 로컬 Worker/D1 실행 상태를 확인해주세요.'
      : ''
  const bannerMessage = errorMessage || sdkError || statusMessage

  const canConnect = useMemo(() => /.+@.+\..+/.test(email.trim()), [email])

  const handleConnect = useCallback(async () => {
    setErrorMessage('')
    setStatusMessage('')
    try {
      await connectAccount({ provider, email: email.trim() })
      setEmail('')
      await refresh()
      setStatusMessage('메일 계정을 연결했습니다.')
    } catch {
      setErrorMessage('메일 계정을 연결하지 못했습니다.')
    }
  }, [connectAccount, email, provider, refresh])

  const handleDisconnect = useCallback(
    async (accountId: string) => {
      setErrorMessage('')
      setStatusMessage('')
      try {
        await disconnectAccount({ accountId })
        await refresh()
        setStatusMessage('메일 계정 연결을 해제했습니다.')
      } catch {
        setErrorMessage('메일 계정 연결을 해제하지 못했습니다.')
      }
    },
    [disconnectAccount, refresh]
  )

  return (
    <VStack spacing={16}>
      <section style={styles.panel}>
        <Text
          typo="16"
          bold
        >
          메일 계정 연결
        </Text>
        <Text
          typo="12"
          color="text-neutral-light"
        >
          {status
            ? status.connected
              ? `연결된 계정 ${status.accountCount}개 · 통합 수신함`
              : '아직 연결된 메일 계정이 없습니다.'
            : '상태를 확인하는 중입니다.'}
        </Text>
        <div style={styles.formGrid}>
          <label style={styles.label}>
            제공자
            <select
              style={styles.input}
              value={provider}
              onChange={(event) =>
                setProvider(event.target.value as MailProvider)
              }
            >
              {providers.map((item) => (
                <option
                  key={item.value}
                  value={item.value}
                >
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label style={styles.label}>
            이메일 주소
            <input
              style={styles.input}
              value={email}
              placeholder="예: me@gmail.com"
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
        </div>
        <div style={{ marginTop: 12 }}>
          <Button
            variant="filled"
            semantic="primary"
            label={connectLoading ? '연결 중' : '계정 연결'}
            disabled={loading || !canConnect}
            onClick={() => void handleConnect()}
          />
        </div>

        {accounts.length > 0 && (
          <div style={styles.accountList}>
            {accounts.map((account) => (
              <AccountRow
                key={account.id}
                account={account}
                onDisconnect={(accountId) => void handleDisconnect(accountId)}
                disabled={loading}
              />
            ))}
          </div>
        )}
      </section>

      <HStack
        justify="between"
        align="center"
      >
        <Text
          typo="16"
          bold
        >
          통합 수신함
        </Text>
        <Button
          variant="outlined"
          semantic="primary"
          label={messagesLoading ? '새로고침 중' : '새로고침'}
          disabled={loading}
          onClick={() => {
            setErrorMessage('')
            setStatusMessage('')
            void refresh().catch(() =>
              setErrorMessage('메일을 새로고침하지 못했습니다.')
            )
          }}
        />
      </HStack>

      {bannerMessage && (
        <InlineBanner
          variant={errorMessage || sdkError ? 'error' : 'info'}
          content={bannerMessage}
        />
      )}

      <section style={styles.list}>
        {loading && messages.length === 0 ? (
          <Text color="text-neutral-light">불러오는 중입니다.</Text>
        ) : messages.length > 0 ? (
          messages.map((message) => (
            <MessageCard
              key={message.id}
              message={message}
            />
          ))
        ) : (
          <Text color="text-neutral-light">
            표시할 메일이 없습니다. 메일 계정을 먼저 연결해보세요.
          </Text>
        )}
      </section>
    </VStack>
  )
}

const styles = {
  panel: {
    padding: 14,
    border: '1px solid var(--bdr-black-lightest, #e5e8eb)',
    borderRadius: 8,
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: '112px 1fr',
    gap: 10,
    marginTop: 12,
  },
  label: {
    display: 'grid',
    gap: 6,
    color: '#31373d',
    fontSize: 12,
    fontWeight: 600,
  },
  input: {
    boxSizing: 'border-box',
    width: '100%',
    height: 36,
    border: '1px solid #d9dee3',
    borderRadius: 6,
    padding: '0 10px',
    color: '#20252a',
    fontSize: 14,
    background: '#fff',
  },
  accountList: {
    display: 'grid',
    gap: 8,
    marginTop: 12,
  },
  accountRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    border: '1px solid #e5e8eb',
    borderRadius: 8,
    background: '#fff',
  },
  list: {
    display: 'grid',
    gap: 10,
    maxHeight: 260,
    overflowY: 'auto',
    paddingRight: 2,
  },
  card: {
    padding: 12,
    border: '1px solid #e5e8eb',
    borderRadius: 8,
    background: '#fff',
  },
  badge: {
    flex: '0 0 auto',
    padding: '3px 7px',
    borderRadius: 6,
    background: '#eef2ff',
    color: '#3b5bdb',
    fontSize: 11,
    fontWeight: 700,
  },
  snippet: {
    margin: '8px 0 0',
    color: '#4f5963',
    fontSize: 13,
    lineHeight: 1.45,
  },
} satisfies Record<string, CSSProperties>

export default Mail
