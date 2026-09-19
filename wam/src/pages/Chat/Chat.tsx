import {
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useCallFunction, useWamSize } from '@channel.io/app-sdk-wam'
import {
  CHAT_FUNCTIONS,
  type ChatResultItem,
  type ChatSendMessageOutput,
  type ChatSuggestion,
} from '@tutorial/shared'
import { useTutorialWamData } from '../../hooks/useTutorialWamData'
import './Chat.css'

type ChatViewMode = 'closed' | 'mini' | 'expanded'

type UiMessage =
  | { id: string; role: 'user'; text: string }
  | {
      id: string
      role: 'agent'
      text: string
      items: ChatResultItem[]
      total: number
      visibleCount: number
      suggestions: ChatSuggestion[]
    }

const examples = [
  '장학 관련해서 지금 확인해야 할 공지 있어?',
  '최근 한 달간 학교에서 온 메일 보여줘',
  '수강신청 관련해서 공지랑 메일을 같이 확인해줘',
]

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function formatDate(value: string): string {
  if (!value) return ''
  return value.slice(0, 10)
}

function daysUntil(value: string): string {
  const now = new Date()
  const target = new Date(value)
  const diff = Math.ceil((target.getTime() - now.getTime()) / 86_400_000)
  if (Number.isNaN(diff)) return '마감'
  if (diff <= 0) return '오늘 마감'
  return `마감 D-${diff}`
}

function AgentChat() {
  const { setSize } = useWamSize()
  const { data: wamData, error: wamDataError } = useTutorialWamData()
  const appId = wamData?.appId ?? ''
  const [mode, setMode] = useState<ChatViewMode>('closed')
  const [messages, setMessages] = useState<UiMessage[]>([])
  const [input, setInput] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const endRef = useRef<HTMLDivElement | null>(null)
  const { call: sendChatMessage, loading, error } =
    useCallFunction<ChatSendMessageOutput>({
      appId,
      name: CHAT_FUNCTIONS.sendMessage,
    })

  useEffect(() => {
    if (mode === 'expanded') {
      setSize({ width: 920, height: 820 })
      return
    }

    setSize({ width: 430, height: 680 })
  }, [mode, setSize])

  useEffect(() => {
    if (mode === 'closed') return
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length, loading, mode])

  const canSend = useMemo(
    () => Boolean(input.trim()) && !loading,
    [input, loading]
  )

  const submitText = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || loading) return

      if (mode === 'closed') setMode('mini')
      setInput('')
      setErrorMessage('')
      setMessages((current) => [
        ...current,
        { id: createId('user'), role: 'user', text: trimmed },
      ])

      try {
        const output = await sendChatMessage({ message: trimmed })
        setMessages((current) => [
          ...current,
          {
            id: createId('agent'),
            role: 'agent',
            text: output.message,
            items: output.items,
            total: output.total,
            visibleCount:
              output.decision.type === 'tool' &&
              output.decision.function === 'searchSchoolMail'
                ? Math.min(3, output.items.length)
                : output.items.length,
            suggestions: output.suggestions,
          },
        ])
      } catch {
        setErrorMessage(
          'AI Agent가 요청을 처리하지 못했습니다. 서버와 API 설정을 확인해주세요.'
        )
      }
    },
    [loading, mode, sendChatMessage]
  )

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key !== 'Enter' || event.shiftKey) return
      event.preventDefault()
      if (canSend) void submitText(input)
    },
    [canSend, input, submitText]
  )

  const showMore = useCallback((id: string) => {
    setMessages((current) =>
      current.map((message) =>
        message.role === 'agent' && message.id === id
          ? {
              ...message,
              visibleCount: Math.min(
                message.visibleCount + 3,
                message.items.length
              ),
            }
          : message
      )
    )
  }, [])

  const closePanel = useCallback(() => setMode('closed'), [])
  const openMini = useCallback(() => setMode('mini'), [])
  const expand = useCallback(() => setMode('expanded'), [])
  const minimize = useCallback(() => setMode('mini'), [])

  return (
    <aside
      className={`agent-chat agent-chat--${mode}`}
      aria-label="한눈 AI Agent"
    >
      {mode !== 'closed' && (
        <section className="agent-chat__panel">
          <header className="agent-chat__header">
            <div>
              <span>HANNOON AI</span>
              <strong>한눈 AI Agent</strong>
            </div>
            <div className="agent-chat__actions">
              {mode === 'mini' ? (
                <button type="button" aria-label="채팅 확대" onClick={expand}>
                  ↗
                </button>
              ) : (
                <button type="button" onClick={minimize}>
                  축소
                </button>
              )}
              <button type="button" aria-label="채팅 닫기" onClick={closePanel}>
                ×
              </button>
            </div>
          </header>

          {mode === 'expanded' && (
            <section className="agent-chat__hero">
              <span>SKKU AGENT</span>
              <h1>공지와 메일을 한 번에 물어보세요.</h1>
              <p>질문을 분석해 공지, 메일, 통합 조회 중 하나를 실행합니다.</p>
            </section>
          )}

          <div className="agent-chat__messages" aria-live="polite">
            {messages.length === 0 && (
              <div className="agent-chat__empty">
                <strong>무엇을 찾아드릴까요?</strong>
                <p>예시 질문을 누르면 실제 공지와 메일 데이터를 조회합니다.</p>
                <div className="agent-chat__examples">
                  {examples.map((example) => (
                    <button
                      key={example}
                      type="button"
                      disabled={loading}
                      onClick={() => void submitText(example)}
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message) =>
              message.role === 'user' ? (
                <article key={message.id} className="agent-chat__bubble is-user">
                  {message.text}
                </article>
              ) : (
                <article key={message.id} className="agent-chat__bubble is-agent">
                  <p>{message.text}</p>
                  <div className="agent-chat__results">
                    {message.items.slice(0, message.visibleCount).map((item) => (
                      <ResultCard
                        key={`${message.id}-${item.sourceType}-${item.id}`}
                        item={item}
                        compact={mode === 'mini'}
                      />
                    ))}
                  </div>
                  {message.suggestions.length > 0 && (
                    <div className="agent-chat__suggestions">
                      {message.suggestions.map((suggestion) => (
                        <button
                          key={suggestion.toolName}
                          type="button"
                          disabled={loading}
                          onClick={() => void submitText(suggestion.prompt)}
                        >
                          {suggestion.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {message.visibleCount < message.items.length && (
                    <button
                      type="button"
                      className="agent-chat__more"
                      onClick={() => showMore(message.id)}
                    >
                      더보기
                    </button>
                  )}
                  {message.items.length === 0 && (
                    <p className="agent-chat__muted">
                      조건에 맞는 실제 데이터가 없습니다.
                    </p>
                  )}
                </article>
              )
            )}

            {loading && (
              <article className="agent-chat__bubble is-agent">
                조회할 기능을 선택하고 실제 데이터를 확인하고 있어요.
              </article>
            )}
            <div ref={endRef} />
          </div>

          {(errorMessage || error || wamDataError) && (
            <p className="agent-chat__error">
              {errorMessage ||
                wamDataError?.message ||
                '요청을 처리하지 못했습니다.'}
            </p>
          )}

          <form
            className="agent-chat__composer"
            onSubmit={(event) => {
              event.preventDefault()
              if (canSend) void submitText(input)
            }}
          >
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="학교 공지나 메일에 대해 물어보세요"
              rows={2}
            />
            <button type="submit" disabled={!canSend}>
              {loading ? '처리 중' : '전송'}
            </button>
          </form>
        </section>
      )}

      <button
        type="button"
        className="agent-chat__toggle"
        aria-expanded={mode !== 'closed'}
        onClick={mode === 'closed' ? openMini : closePanel}
      >
        Chat
      </button>
    </aside>
  )
}

function ResultCard({
  item,
  compact,
}: {
  item: ChatResultItem
  compact: boolean
}) {
  if (item.sourceType === 'DEADLINE') {
    return (
      <article className="agent-chat__card is-deadline">
        <div className="agent-chat__card-top">
          <span>{daysUntil(item.deadline)}</span>
          <span>{item.originalSourceType === 'NOTICE' ? '공지' : '메일'}</span>
          <time>{formatDate(item.deadline)}</time>
        </div>
        <strong>{item.title}</strong>
        <p>{item.snippet || '마감 관련 미리보기가 없습니다.'}</p>
        <footer>
          <span>{[item.source, item.category].filter(Boolean).join(' · ')}</span>
          {item.url && (
            <a href={item.url} target="_blank" rel="noreferrer">
              원문 보기
            </a>
          )}
        </footer>
      </article>
    )
  }

  if (item.sourceType === 'ACTION') {
    return (
      <article className="agent-chat__card is-action">
        <div className="agent-chat__card-top">
          <span>해야 할 일</span>
          <span>{item.originalSourceType === 'NOTICE' ? '공지' : '메일'}</span>
          <time>{item.deadline ? formatDate(item.deadline) : '기한 확인 필요'}</time>
        </div>
        <strong>{item.title}</strong>
        <p>→ {item.action}</p>
        <footer>
          <span>{[item.source, item.category].filter(Boolean).join(' · ')}</span>
          {item.url && (
            <a href={item.url} target="_blank" rel="noreferrer">
              원문 보기
            </a>
          )}
        </footer>
      </article>
    )
  }

  if (item.sourceType === 'NOTICE') {
    return (
      <article className="agent-chat__card">
        <div className="agent-chat__card-top">
          <span>공지</span>
          {item.category && <span>{item.category}</span>}
          <time>{formatDate(item.date)}</time>
        </div>
        <strong>{item.title}</strong>
        <p>{item.summary || '본문 미리보기가 없는 공지입니다.'}</p>
        <footer>
          <span>{item.source}</span>
          <a href={item.url} target="_blank" rel="noreferrer">
            원문 보기
          </a>
        </footer>
      </article>
    )
  }

  return (
    <article className="agent-chat__card is-mail">
      <div className="agent-chat__card-top">
        <span>메일</span>
        <time>{formatDate(item.date)}</time>
      </div>
      <strong>{item.title || '(제목 없음)'}</strong>
      <p>{item.snippet || '미리보기 내용이 없습니다.'}</p>
      <footer>
        <span>{compact ? item.from : `${item.from} · ${item.accountEmail}`}</span>
      </footer>
    </article>
  )
}

export default AgentChat
