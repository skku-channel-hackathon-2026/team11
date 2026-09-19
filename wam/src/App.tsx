import { useState } from 'react'
import {
  HeightSynchronizer,
  WamHeader,
  WamThemeProvider,
} from '@channel.io/app-sdk-wam-ui'
import { useWamClose } from '@channel.io/app-sdk-wam'

import Home from './pages/Home'
import Send from './pages/Send'
import Mail from './pages/Mail'
import AgentChat from './pages/Chat'
import Schedule from './pages/Schedule'
import { ChannelTalkWidget } from './components/ChannelTalkWidget'

type View = 'home' | 'notice' | 'mail' | 'schedule'

function App() {
  const { close } = useWamClose()
  const [view, setView] = useState<View>('home')

  return (
    <WamThemeProvider>
      <HeightSynchronizer>
        <WamHeader
          title="한눈"
          onClose={close}
        />
        <div className="wam-content">
          <nav
            className="app-tabs"
            aria-label="주요 화면"
          >
            <button
              type="button"
              className={view === 'home' ? 'is-active' : undefined}
              onClick={() => setView('home')}
            >
              한눈보기
            </button>
            <button
              type="button"
              className={view === 'notice' ? 'is-active' : undefined}
              onClick={() => setView('notice')}
            >
              학교 공지
            </button>
            <button
              type="button"
              className={view === 'mail' ? 'is-active' : undefined}
              onClick={() => setView('mail')}
            >
              메일
            </button>
            <button
              type="button"
              className={view === 'schedule' ? 'is-active' : undefined}
              onClick={() => setView('schedule')}
            >
              학사 일정
            </button>
          </nav>
          {view === 'home' ? (
            <Home />
          ) : view === 'notice' ? (
            <Send onNavigateHome={() => setView('home')} />
          ) : view === 'mail' ? (
            <Mail />
          ) : (
            <Schedule />
          )}
        </div>
        <AgentChat />
        <ChannelTalkWidget />
      </HeightSynchronizer>
    </WamThemeProvider>
  )
}

export default App
