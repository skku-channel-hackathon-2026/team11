/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CHANNEL_TALK_PLUGIN_KEY?: string
}

type ChannelTalkBootOption = {
  pluginKey: string
}

type ChannelTalkCommand = ['boot', ChannelTalkBootOption] | ['shutdown']

interface Window {
  ChannelIO?: {
    (...args: ChannelTalkCommand): void
    q?: ChannelTalkCommand[]
    c?: (args: ChannelTalkCommand) => void
  }
  ChannelIOInitialized?: boolean
}
