import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { useCallFunction } from '@channel.io/app-sdk-wam'
import {
  MAIL_FUNCTIONS,
  type MailAccount,
  type MailAccountListOutput,
  type MailConnectionStatus,
  type FailedMailAccount,
  type MailMessage,
  type MailMessageListOutput,
  type MailProvider,
  type StartGmailOAuthOutput,
} from '@tutorial/shared'

import { useTutorialWamData } from '../../hooks/useTutorialWamData'
import './Mail.css'

const providers: { value: MailProvider; label: string }[] = [
  { value: 'gmail', label: 'Gmail' },
  { value: 'outlook', label: 'Outlook' },
]

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 16).replace('T', ' ')
  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function providerLabel(provider: MailProvider): string {
  return provider === 'gmail' ? 'Gmail' : 'Outlook'
}

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
    <article className="mail-account-card">
      <div className="mail-account-card__mark">{providerLabel(account.provider)[0]}</div>
      <div className="mail-account-card__body">
        <span>{providerLabel(account.provider)}</span>
        <strong>{account.email}</strong>
        <p>연결일 {account.connectedAt.slice(0, 10)}</p>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onDisconnect(account.id)}
      >
        연결 해제
      </button>
    </article>
  )
}

function MessageCard({
  message,
  showAccount,
}: {
  message: MailMessage
  showAccount: boolean
}) {
  const openOriginal = () => {
    if (!message.externalUrl) return
    window.open(message.externalUrl, '_blank', 'noopener,noreferrer')
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!message.externalUrl) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openOriginal()
    }
  }

  return (
    <article
      className={`mail-card ${message.externalUrl ? 'is-clickable' : ''}`}
      role={message.externalUrl ? 'link' : undefined}
      tabIndex={message.externalUrl ? 0 : undefined}
      aria-label={message.externalUrl ? `${message.subject || '메일'} Gmail 원문 열기` : undefined}
      onClick={openOriginal}
      onKeyDown={handleKeyDown}
    >
      <div className="mail-card__rail" />
      <div className="mail-card__body">
        <div className="mail-card__meta">
          <span>{message.from || '발신자 없음'}</span>
          <time dateTime={message.receivedAt}>{formatDate(message.receivedAt)}</time>
        </div>
        <h2>{message.subject || '(제목 없음)'}</h2>
        <p>{message.snippet || '미리보기 내용이 없습니다.'}</p>
        <div className="mail-card__footer">
          {showAccount ? <span>{message.accountEmail}</span> : <span>{providerLabel(message.provider)}</span>}
          {showAccount && <span>{providerLabel(message.provider)}</span>}
        </div>
      </div>
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
  const [failedAccounts, setFailedAccounts] = useState<FailedMailAccount[]>([])
  const [selectedMailbox, setSelectedMailbox] = useState('all')
  const [schoolOnly, setSchoolOnly] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [messageWarning, setMessageWarning] = useState('')

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
    call: startGmailOAuth,
    loading: gmailOAuthLoading,
    error: gmailOAuthError,
  } = useCallFunction<StartGmailOAuthOutput>({
    appId,
    name: MAIL_FUNCTIONS.startGmailOAuth,
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
    setMessageWarning('')
    const [statusOutput, accountsOutput] = await Promise.all([
      getConnectionStatus({}),
      listAccounts({}),
    ])
    setStatus(statusOutput)
    setAccounts(accountsOutput.accounts)

    try {
      const messagesOutput = await listMessages({})
      setMessages(messagesOutput.messages)
      setFailedAccounts(messagesOutput.failedAccounts ?? [])
    } catch (error) {
      console.error('메일 메시지 조회 실패', error)
      setMessages([])
      setFailedAccounts([])
      setMessageWarning(
        '메일 계정은 연결되었지만 메시지를 불러오지 못했습니다. 서버 로그를 확인해주세요.'
      )
    }
  }, [getConnectionStatus, listAccounts, listMessages])

  useEffect(() => {
    if (!appId) return

    let active = true
    async function load() {
      setErrorMessage('')
      try {
        await refresh()
      } catch (error) {
        console.error('메일 계정 조회 실패', error)
        if (active) setErrorMessage('메일 계정 정보를 불러오지 못했습니다.')
      }
    }

    void load()
    return () => {
      active = false
    }
  }, [appId, refresh])

  useEffect(() => {
    if (!appId) return

    function reloadAfterOAuth() {
      if (document.visibilityState === 'visible') {
        void refresh()
      }
    }

    window.addEventListener('focus', reloadAfterOAuth)
    document.addEventListener('visibilitychange', reloadAfterOAuth)
    return () => {
      window.removeEventListener('focus', reloadAfterOAuth)
      document.removeEventListener('visibilitychange', reloadAfterOAuth)
    }
  }, [appId, refresh])

  const loading =
    statusLoading ||
    accountsLoading ||
    gmailOAuthLoading ||
    connectLoading ||
    disconnectLoading ||
    messagesLoading
  const sdkError =
    statusError ||
    accountsError ||
    gmailOAuthError ||
    connectError ||
    disconnectError ||
    messagesError
      ? '요청을 처리하지 못했습니다. 로컬 Worker/D1 실행 상태를 확인해주세요.'
      : ''
  const bannerMessage = errorMessage || sdkError || messageWarning || statusMessage

  const canConnect = useMemo(
    () => /.+@.+\..+/.test(email.trim()),
    [email]
  )

  useEffect(() => {
    if (selectedMailbox === 'all') return
    if (!accounts.some((account) => account.id === selectedMailbox)) {
      setSelectedMailbox('all')
    }
  }, [accounts, selectedMailbox])

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === selectedMailbox) ?? null,
    [accounts, selectedMailbox]
  )

  const mailboxMessages = useMemo(
    () =>
      selectedMailbox === 'all'
        ? messages
        : messages.filter((message) => message.accountId === selectedMailbox),
    [messages, selectedMailbox]
  )

  const visibleMessages = useMemo(
    () => schoolOnly
      ? mailboxMessages.filter((message) => message.isSchoolRelated)
      : mailboxMessages,
    [mailboxMessages, schoolOnly]
  )

  const visibleFailedAccounts = useMemo(
    () =>
      selectedMailbox === 'all'
        ? failedAccounts
        : failedAccounts.filter((account) => account.accountId === selectedMailbox),
    [failedAccounts, selectedMailbox]
  )

  const inboxTitle = selectedAccount
    ? selectedAccount.email
    : '통합 수신함'

  const handleStartGmailOAuth = useCallback(async () => {
    setErrorMessage('')
    setStatusMessage('')
    try {
      const output = await startGmailOAuth({})
      window.open(output.authorizationUrl, '_blank', 'noopener,noreferrer')
      setStatusMessage(
        'Gmail 인증 창을 열었습니다. 인증 후 이 화면으로 돌아오면 자동으로 다시 조회합니다.'
      )
    } catch {
      setErrorMessage(
        'Gmail 인증을 시작하지 못했습니다. GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REDIRECT_URI 설정을 확인해주세요.'
      )
    }
  }, [startGmailOAuth])

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
    <main className="notice-shell mail-shell">
      <header className="notice-hero mail-hero">
        <div className="notice-hero__topline">
          <span className="notice-hero__brand">SKKU MAIL</span>
          <span className="notice-hero__count">
            {accounts.length} 계정 / {visibleMessages.length} 메일
          </span>
        </div>
        <h1>학교 생활 메일을 한곳에서 확인하세요.</h1>
        <p>
          Gmail 계정을 연결하고 최근 메일을 통합 수신함 형태로 정리합니다.
        </p>
      </header>

      <section className="mail-panel">
        <div className="mail-panel__head">
          <div>
            <span>ACCOUNT</span>
            <strong>메일 계정 연결</strong>
            <p>
              {status
                ? status.connected
                  ? `연결된 계정 ${status.accountCount}개`
                  : '아직 연결된 메일 계정이 없습니다.'
                : '상태를 확인하는 중입니다.'}
            </p>
          </div>
        </div>

        <div className="mail-form-grid">
          <label className="mail-field">
            <span>제공자</span>
            <select
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
          <label className="mail-field">
            <span>이메일 주소</span>
            <input
              value={email}
              placeholder="예: me@gmail.com"
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
        </div>

        <div className="mail-actions">
          <button
            type="button"
            className="mail-primary-button"
            disabled={loading}
            onClick={() => void handleStartGmailOAuth()}
          >
            {gmailOAuthLoading ? 'Gmail 인증 중' : 'Gmail 계정 연결'}
          </button>
          <button
            type="button"
            className="mail-secondary-button"
            disabled={loading || !canConnect}
            onClick={() => void handleConnect()}
          >
            {connectLoading ? '연결 중' : '수동 연결'}
          </button>
        </div>

        {accounts.length > 0 && (
          <div className="mail-account-list">
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

      <section className="mail-inbox-head">
        <div>
          <span>INBOX</span>
          <strong>{inboxTitle}</strong>
          <p>
            {selectedAccount
              ? '선택한 계정의 메일만 표시합니다.'
              : '연결된 모든 계정의 메일을 최신순으로 합쳐 보여줍니다.'}
          </p>
        </div>
        <div className="mail-inbox-controls">
          {accounts.length > 0 && (
            <label className="mail-inline-select" aria-label="수신함 선택">
              <span>수신함</span>
              <select
                value={selectedMailbox}
                disabled={loading}
                onChange={(event) => setSelectedMailbox(event.target.value)}
              >
                <option value="all">통합 수신함</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.email}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            type="button"
            className={`mail-filter-button ${schoolOnly ? 'is-on' : ''}`}
            aria-pressed={schoolOnly}
            onClick={() => setSchoolOnly((value) => !value)}
          >
            학교 필터 {schoolOnly ? 'ON' : 'OFF'}
          </button>
          <button
            type="button"
            className="mail-secondary-button mail-refresh-button"
            disabled={loading}
            onClick={() => {
              setErrorMessage('')
              setStatusMessage('')
              void refresh().catch(() =>
                setErrorMessage('메일 계정 정보를 불러오지 못했습니다.')
              )
            }}
          >
            {messagesLoading ? '새로고침 중' : '새로고침'}
          </button>
        </div>
      </section>

      {bannerMessage && (
        <div
          className={
            errorMessage || sdkError
              ? 'mail-status is-error'
              : messageWarning
                ? 'mail-status is-warning'
                : 'mail-status'
          }
        >
          {bannerMessage}
        </div>
      )}

      {visibleFailedAccounts.map((account) => (
        <div key={account.accountId} className="mail-status is-warning">
          {account.accountEmail} 계정의 메일을 불러오지 못했습니다. 다른 계정의
          메일은 계속 표시합니다.
        </div>
      ))}

      <section className="mail-list" aria-label="메일 목록">
        {loading && visibleMessages.length === 0 ? (
          <div className="state-panel">
            <div className="state-panel__pulse" />
            <strong>메일 불러오는 중</strong>
            <p>연결 계정과 최근 메일을 확인하고 있습니다.</p>
          </div>
        ) : visibleMessages.length > 0 ? (
          visibleMessages.map((message) => (
            <MessageCard
              key={message.id}
              message={message}
              showAccount={selectedMailbox === 'all'}
            />
          ))
        ) : (
          <div className="state-panel">
            <div className="state-panel__mark">0</div>
            <strong>{schoolOnly ? '학교 관련 메일이 없습니다.' : '표시할 메일이 없습니다.'}</strong>
            <p>
              {schoolOnly
                ? '학교 필터를 끄면 전체 메일을 다시 볼 수 있습니다.'
                : selectedAccount
                  ? '이 계정에 표시할 메일이 없습니다. 새로고침을 눌러 다시 확인해보세요.'
                  : accounts.length === 0
                    ? 'Gmail 계정을 연결하면 통합 수신함에서 메일을 확인할 수 있습니다.'
                    : '새로고침을 눌러 메일을 불러와주세요.'}
            </p>
          </div>
        )}
      </section>
    </main>
  )
}

export default Mail
