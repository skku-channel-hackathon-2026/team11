import { useEffect } from 'react'

const channelPluginScriptSrc = 'https://cdn.channel.io/plugin/ch-plugin-web.js'

function loadChannelPluginScript(): void {
  if (window.ChannelIO) return

  const channelIO = ((...args: ChannelTalkCommand) => {
    channelIO.c(args)
  }) as Window['ChannelIO'] & {
    q: ChannelTalkCommand[]
    c(args: ChannelTalkCommand): void
  }
  channelIO.q = []
  channelIO.c = (args: ChannelTalkCommand) => {
    channelIO.q.push(args)
  }
  window.ChannelIO = channelIO

  const load = () => {
    if (window.ChannelIOInitialized) return
    window.ChannelIOInitialized = true

    const script = document.createElement('script')
    script.type = 'text/javascript'
    script.async = true
    script.src = channelPluginScriptSrc
    const firstScript = document.getElementsByTagName('script')[0]
    firstScript?.parentNode?.insertBefore(script, firstScript)
  }

  if (document.readyState === 'complete') {
    load()
    return
  }

  window.addEventListener('DOMContentLoaded', load, { once: true })
  window.addEventListener('load', load, { once: true })
}

export function ChannelTalkWidget() {
  const pluginKey = import.meta.env.VITE_CHANNEL_TALK_PLUGIN_KEY?.trim()

  useEffect(() => {
    if (!pluginKey) return undefined

    loadChannelPluginScript()
    window.ChannelIO?.('boot', { pluginKey })

    return () => {
      window.ChannelIO?.('shutdown')
    }
  }, [pluginKey])

  return null
}
