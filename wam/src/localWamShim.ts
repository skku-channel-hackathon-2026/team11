import { ACADEMIC_SCHEDULE_FUNCTIONS, CHAT_FUNCTIONS, HOME_FUNCTIONS, MAIL_FUNCTIONS, SCHOOL_NOTICE_FUNCTIONS, TUTORIAL_WAM_NAME } from '@tutorial/shared'

type CallFunctionInput = {
  appId: string
  name: string
  params?: unknown
}

const localWamData: Record<string, unknown> = {
  appId: 'local-dev-app',
  channelId: 'local-dev-channel',
  managerId: 'local-dev-user',
  chatId: 'local-dev-group',
  chatType: 'group',
  chatTitle: 'Local development',
  broadcast: false,
  message: '',
  name: TUTORIAL_WAM_NAME,
}

const localFunctionNames = new Set<string>([
  SCHOOL_NOTICE_FUNCTIONS.getProfile,
  SCHOOL_NOTICE_FUNCTIONS.saveProfile,
  SCHOOL_NOTICE_FUNCTIONS.listNotices,
  SCHOOL_NOTICE_FUNCTIONS.listPersonalizedNotices,
  SCHOOL_NOTICE_FUNCTIONS.seedNotices,
  SCHOOL_NOTICE_FUNCTIONS.syncNotices,
  SCHOOL_NOTICE_FUNCTIONS.toggleFavorite,
  SCHOOL_NOTICE_FUNCTIONS.listFavorites,
  MAIL_FUNCTIONS.getConnectionStatus,
  MAIL_FUNCTIONS.listAccounts,
  MAIL_FUNCTIONS.startGmailOAuth,
  MAIL_FUNCTIONS.connectAccount,
  MAIL_FUNCTIONS.disconnectAccount,
  MAIL_FUNCTIONS.listMessages,
  CHAT_FUNCTIONS.sendMessage,
  HOME_FUNCTIONS.getDashboard,
  HOME_FUNCTIONS.completeTask,
  HOME_FUNCTIONS.undoTask,
  HOME_FUNCTIONS.dismissTask,
  ACADEMIC_SCHEDULE_FUNCTIONS.listSchedules,
  ACADEMIC_SCHEDULE_FUNCTIONS.syncSchedules,
])

function isLocalBrowser(): boolean {
  return (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '::1'
  )
}

if (
  typeof window !== 'undefined' &&
  isLocalBrowser() &&
  !window.ChannelIOWam
) {
  window.ChannelIOWam = {
    getWamData(key: string): unknown {
      return localWamData[key]
    },

    async callFunction<T>(input: CallFunctionInput): Promise<T> {
      if (!localFunctionNames.has(input.name)) {
        throw new Error(`Unsupported local function: ${input.name}`)
      }

      const response = await fetch('/api/dev/function', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: input.name, params: input.params ?? {} }),
      })

      if (!response.ok) {
        throw new Error(`Local function failed: ${response.status}`)
      }

      return response.json() as Promise<T>
    },

    async callNativeFunction<T>(): Promise<T> {
      throw new Error('Native Channel functions are unavailable in local WAM.')
    },

    setSize() {},

    close() {},
  }
}
