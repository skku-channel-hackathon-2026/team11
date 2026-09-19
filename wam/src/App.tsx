import { useState } from 'react'
import type { CSSProperties } from 'react'
import {
  HeightSynchronizer,
  WamHeader,
  WamThemeProvider,
} from '@channel.io/app-sdk-wam-ui'
import { useWamClose } from '@channel.io/app-sdk-wam'

import Send from './pages/Send'
import Mail from './pages/Mail'

type View = 'notice' | 'mail'

function App() {
  const { close } = useWamClose()
  const [view, setView] = useState<View>('notice')

  return (
    <WamThemeProvider>
      <HeightSynchronizer>
        <WamHeader
          title="학교 공지 · 메일"
          onClose={close}
        />
        <div style={{ padding: isMobile() ? '0 16px 16px' : '0 24px 24px' }}>
          <div style={styles.tabs}>
            <button
              type="button"
              style={{
                ...styles.tab,
                ...(view === 'notice' ? styles.tabActive : {}),
              }}
              onClick={() => setView('notice')}
            >
              학교 공지
            </button>
            <button
              type="button"
              style={{
                ...styles.tab,
                ...(view === 'mail' ? styles.tabActive : {}),
              }}
              onClick={() => setView('mail')}
            >
              메일
            </button>
          </div>
          {view === 'notice' ? <Send /> : <Mail />}
        </div>
      </HeightSynchronizer>
    </WamThemeProvider>
  )
}

const styles = {
  tabs: {
    display: 'inline-flex',
    padding: 3,
    margin: '0 0 16px',
    border: '1px solid #d9dee3',
    borderRadius: 8,
    background: '#f7f8fa',
  },
  tab: {
    height: 32,
    padding: '0 14px',
    border: 0,
    borderRadius: 6,
    background: 'transparent',
    color: '#59636e',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  },
  tabActive: {
    background: '#fff',
    color: '#20252a',
    boxShadow: '0 1px 3px rgba(20, 24, 28, 0.12)',
  },
} satisfies Record<string, CSSProperties>

export default App
