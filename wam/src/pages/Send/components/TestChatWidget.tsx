import { FormEvent, useCallback, useMemo, useState } from 'react'
import { useNativeFunction } from '@channel.io/app-sdk-wam'
import {
  TUTORIAL_FUNCTIONS,
  type TutorialWamData,
  type WriteGroupMessageAsManagerInput,
} from '@tutorial/shared'

type ChatMessage = {
  id: string
  role: 'user' | 'bot'
  text: string
}

interface TestChatWidgetProps {
  wamData: TutorialWamData | null
}

function createMessageId(role: ChatMessage['role']): string {
  return `${role}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function TestChatWidget({ wamData }: TestChatWidgetProps) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'bot',
      text: '테스트 채팅입니다. 무엇을 보내도 test라고 답합니다.',
    },
  ])
  const [status, setStatus] = useState('')
  const {
    call: writeGroupMessageAsManager,
    loading,
    error,
  } = useNativeFunction<Record<string, never>>({
    name: TUTORIAL_FUNCTIONS.writeAsManager,
  })

  const canUseChannelChat = useMemo(
    () =>
      Boolean(
        wamData?.channelId &&
          wamData.chatType === 'group' &&
          wamData.chatId &&
          wamData.managerId
      ),
    [wamData]
  )

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()

      const text = input.trim()
      if (!text || loading) return

      setInput('')
      setStatus('')
      setMessages((current) => [
        ...current,
        { id: createMessageId('user'), role: 'user', text },
        { id: createMessageId('bot'), role: 'bot', text: 'test' },
      ])

      if (!canUseChannelChat || !wamData) {
        setStatus('로컬 테스트 모드입니다.')
        return
      }

      const params: WriteGroupMessageAsManagerInput = {
        channelId: wamData.channelId,
        groupId: wamData.chatId,
        rootMessageId: wamData.rootMessageId,
        broadcast: wamData.broadcast,
        dto: {
          plainText: 'test',
          managerId: wamData.managerId,
        },
      }

      try {
        await writeGroupMessageAsManager(
          params as unknown as Record<string, unknown>
        )
        setStatus('Channel 채팅으로 test를 전송했습니다.')
      } catch {
        setStatus('Channel native 채팅 전송은 현재 환경에서 사용할 수 없습니다.')
      }
    },
    [canUseChannelChat, input, loading, wamData, writeGroupMessageAsManager]
  )

  return (
    <aside className="test-chat" aria-label="테스트 채팅">
      {open && (
        <section className="test-chat__panel">
          <div className="test-chat__header">
            <div>
              <span>TEST CHAT</span>
              <strong>채널톡 SDK 테스트</strong>
            </div>
            <button
              type="button"
              aria-label="테스트 채팅 닫기"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </div>

          <div className="test-chat__messages" aria-live="polite">
            {messages.map((message) => (
              <p
                key={message.id}
                className={
                  message.role === 'user'
                    ? 'test-chat__bubble is-user'
                    : 'test-chat__bubble'
                }
              >
                {message.text}
              </p>
            ))}
          </div>

          {(status || error) && (
            <p className="test-chat__status">
              {status || 'Channel native 채팅 전송에 실패했습니다.'}
            </p>
          )}

          <form className="test-chat__form" onSubmit={handleSubmit}>
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="메시지 입력"
              aria-label="테스트 채팅 메시지"
            />
            <button type="submit" disabled={!input.trim() || loading}>
              {loading ? '전송 중' : '전송'}
            </button>
          </form>
        </section>
      )}

      <button
        type="button"
        className="test-chat__toggle"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        Chat
      </button>
    </aside>
  )
}
