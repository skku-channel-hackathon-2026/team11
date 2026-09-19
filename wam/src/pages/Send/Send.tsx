import { useCallback, useEffect, useMemo, useState } from 'react'
import { useCallFunction, useWamSize } from '@channel.io/app-sdk-wam'
import {
  SCHOOL_NOTICE_FUNCTIONS,
  type Notice,
  type NoticeDateRange,
  type NoticeListOutput,
  type SeedNoticesOutput,
  type SyncNoticesOutput,
  type ToggleNoticeFavoriteOutput,
  type UserProfileOutput,
} from '@tutorial/shared'
import { InlineBanner } from '@channel.io/app-sdk-wam-ui'

import { useTutorialWamData } from '../../hooks/useTutorialWamData'
import { NoticeFilters } from './components/NoticeFilters'
import { NoticeHeader } from './components/NoticeHeader'
import { NoticeList } from './components/NoticeList'
import './Send.css'

type Tab = 'all' | 'mine'

type SendProps = {
  onNavigateHome?: () => void
}

function matchesSearch(notice: Notice, query: string): boolean {
  const keyword = query.trim().toLowerCase()
  if (!keyword) return true

  return [notice.title, notice.content, notice.source, notice.category ?? '']
    .join(' ')
    .toLowerCase()
    .includes(keyword)
}

function matchesCategory(notice: Notice, category: string): boolean {
  return !category || notice.category === category
}

function toDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function matchesDateRange(notice: Notice, dateRange: NoticeDateRange): boolean {
  if (dateRange === 'all') return true

  const postedAt = new Date(notice.postedAt)
  if (Number.isNaN(postedAt.getTime())) return true

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const noticeStart = new Date(
    postedAt.getFullYear(),
    postedAt.getMonth(),
    postedAt.getDate()
  )
  const noticeKey = toDateKey(noticeStart)
  const todayKey = toDateKey(todayStart)

  if (dateRange === 'today') return noticeKey === todayKey

  const yesterday = new Date(todayStart)
  yesterday.setDate(yesterday.getDate() - 1)
  if (dateRange === 'yesterday') return noticeKey === toDateKey(yesterday)

  const cutoff = new Date(todayStart)
  if (dateRange === 'thisWeek') cutoff.setDate(cutoff.getDate() - 6)
  if (dateRange === 'thisMonth') cutoff.setMonth(cutoff.getMonth() - 1)
  if (dateRange === 'last6Months') cutoff.setMonth(cutoff.getMonth() - 6)
  if (dateRange === 'last1Year') cutoff.setFullYear(cutoff.getFullYear() - 1)

  return noticeStart >= cutoff
}

function Send({ onNavigateHome }: SendProps) {
  const { setSize } = useWamSize()
  const { data: wamData, error: wamDataError } = useTutorialWamData()
  const appId = wamData?.appId ?? ''
  const [activeTab, setActiveTab] = useState<Tab>('all')
  const [profile, setProfile] = useState<UserProfileOutput['profile']>(null)
  const [dateRange, setDateRange] = useState<NoticeDateRange>('all')
  const [category, setCategory] = useState('')
  const [query, setQuery] = useState('')
  const [allNotices, setAllNotices] = useState<Notice[]>([])
  const [myNotices, setMyNotices] = useState<Notice[]>([])
  const [statusMessage, setStatusMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    setSize({ width: 430, height: 680 })
  }, [setSize])

  const {
    call: getProfile,
    loading: profileLoading,
    error: profileError,
  } = useCallFunction<UserProfileOutput>({
    appId,
    name: SCHOOL_NOTICE_FUNCTIONS.getProfile,
  })
  const {
    call: listNotices,
    loading: allLoading,
    error: allError,
  } = useCallFunction<NoticeListOutput>({
    appId,
    name: SCHOOL_NOTICE_FUNCTIONS.listNotices,
  })
  const {
    call: listPersonalizedNotices,
    loading: mineLoading,
    error: mineError,
  } = useCallFunction<NoticeListOutput>({
    appId,
    name: SCHOOL_NOTICE_FUNCTIONS.listPersonalizedNotices,
  })
  const {
    call: seedNotices,
    loading: seedLoading,
    error: seedError,
  } = useCallFunction<SeedNoticesOutput>({
    appId,
    name: SCHOOL_NOTICE_FUNCTIONS.seedNotices,
  })
  const {
    call: toggleFavorite,
    loading: favoriteLoading,
    error: favoriteError,
  } = useCallFunction<ToggleNoticeFavoriteOutput>({
    appId,
    name: SCHOOL_NOTICE_FUNCTIONS.toggleFavorite,
  })
  const {
    call: syncNotices,
    loading: syncLoading,
    error: syncError,
  } = useCallFunction<SyncNoticesOutput>({
    appId,
    name: SCHOOL_NOTICE_FUNCTIONS.syncNotices,
  })

  const loadAll = useCallback(async () => {
    const output = await listNotices({ dateRange })
    setAllNotices(output.notices)
  }, [dateRange, listNotices])

  const loadMine = useCallback(async () => {
    const output = await listPersonalizedNotices({})
    setMyNotices(output.notices)
  }, [listPersonalizedNotices])

  useEffect(() => {
    if (!appId) return

    let active = true
    async function loadInitialData() {
      setErrorMessage('')
      try {
        const [profileOutput, noticesOutput] = await Promise.all([
          getProfile({}),
          listNotices({ dateRange }),
        ])
        if (!active) return
        setProfile(profileOutput.profile)
        setAllNotices(noticesOutput.notices)
      } catch {
        if (active) {
          setErrorMessage('공지 데이터를 불러오지 못했습니다.')
        }
      }
    }

    void loadInitialData()
    return () => {
      active = false
    }
  }, [appId, dateRange, getProfile, listNotices])

  const loading =
    profileLoading ||
    allLoading ||
    mineLoading ||
    seedLoading ||
    syncLoading ||
    favoriteLoading
  const sdkError =
    profileError ||
    allError ||
    mineError ||
    seedError ||
    syncError ||
    favoriteError
      ? '요청을 처리하지 못했습니다. 로컬 Worker/D1 실행 상태를 확인해주세요.'
      : ''
  const bannerMessage =
    errorMessage ||
    sdkError ||
    (wamDataError ? wamDataError.message : '') ||
    statusMessage

  const hasProfile = Boolean(profile?.department.trim())

  const categories = useMemo(
    () =>
      Array.from(
        new Set(
          [...allNotices, ...myNotices]
            .map((notice) => notice.category)
            .filter((value): value is string => Boolean(value))
        )
      ).sort((a, b) => a.localeCompare(b, 'ko')),
    [allNotices, myNotices]
  )

  const baseNotices = activeTab === 'all' ? allNotices : myNotices
  const visibleNotices = useMemo(
    () =>
      baseNotices.filter(
        (notice) =>
          matchesSearch(notice, query) &&
          matchesCategory(notice, category) &&
          matchesDateRange(notice, dateRange)
      ),
    [baseNotices, category, dateRange, query]
  )

  const handleSeed = useCallback(async () => {
    setErrorMessage('')
    setStatusMessage('')
    try {
      const output = await seedNotices({})
      await loadAll()
      if (activeTab === 'mine' && hasProfile) await loadMine()
      setStatusMessage(
        output.inserted > 0
          ? `테스트 공지 ${output.inserted}개를 추가했습니다.`
          : '테스트 공지는 이미 추가되어 있습니다.'
      )
    } catch {
      setErrorMessage('테스트 공지를 추가하지 못했습니다.')
    }
  }, [activeTab, hasProfile, loadAll, loadMine, seedNotices])

  const handleSync = useCallback(async () => {
    setErrorMessage('')
    setStatusMessage('')
    try {
      const output = await syncNotices({})
      await loadAll()
      if (activeTab === 'mine' && hasProfile) await loadMine()
      setStatusMessage(
        `학교 공지 동기화 완료: 추가 ${output.inserted}개, 갱신 ${output.updated}개, 유지 ${output.skipped}개`
      )
    } catch {
      setErrorMessage('학교 공지를 동기화하지 못했습니다.')
    }
  }, [activeTab, hasProfile, loadAll, loadMine, syncNotices])

  const applyFavorite = useCallback((noticeId: string, isFavorite: boolean) => {
    setAllNotices((notices) =>
      notices.map((notice) =>
        notice.id === noticeId ? { ...notice, isFavorite } : notice
      )
    )
    setMyNotices((notices) =>
      notices.map((notice) =>
        notice.id === noticeId ? { ...notice, isFavorite } : notice
      )
    )
    window.sessionStorage.removeItem('hanoon.home.dashboard.v1')
  }, [])

  const handleToggleFavorite = useCallback(
    async (noticeId: string) => {
      setErrorMessage('')
      setStatusMessage('')
      try {
        const output = await toggleFavorite({ noticeId })
        applyFavorite(output.noticeId, output.isFavorite)
      } catch {
        setErrorMessage('즐겨찾기를 변경하지 못했습니다.')
      }
    },
    [applyFavorite, toggleFavorite]
  )

  const handleTabChange = useCallback(
    async (tab: Tab) => {
      setActiveTab(tab)
      setErrorMessage('')
      setStatusMessage('')

      if (tab === 'all') {
        await loadAll()
        return
      }

      try {
        const profileOutput = await getProfile({})
        setProfile(profileOutput.profile)
        if (!profileOutput.profile) {
          setMyNotices([])
          setStatusMessage(
            '내 공지를 보려면 한눈보기에서 학과와 학년을 설정해주세요.'
          )
          return
        }
        await loadMine()
      } catch {
        setErrorMessage('내 공지를 불러오지 못했습니다.')
      }
    },
    [getProfile, loadAll, loadMine]
  )

  return (
    <main className="notice-shell">
      <NoticeHeader
        totalCount={baseNotices.length}
        visibleCount={visibleNotices.length}
        syncLoading={syncLoading}
        loading={loading}
        onSync={() => void handleSync()}
      />

      <section className="notice-tabs">
        <button
          type="button"
          className={activeTab === 'all' ? 'is-active' : undefined}
          onClick={() => void handleTabChange('all')}
        >
          전체 공지
        </button>
        <button
          type="button"
          className={activeTab === 'mine' ? 'is-active' : undefined}
          onClick={() => void handleTabChange('mine')}
        >
          내 공지
        </button>
        <button
          type="button"
          onClick={() => void handleSeed()}
          disabled={loading}
        >
          샘플
        </button>
      </section>

      {activeTab === 'mine' && profile && (
        <section className="profile-summary">
          <div>
            <span>PROFILE</span>
            <strong>
              {profile.department} · {profile.grade}학년
            </strong>
            <p>
              한눈보기에서 저장한 정보로 관련 공지를 골라 보여줍니다.
              {profile.interests.length > 0
                ? ` 관심사: ${profile.interests.join(', ')}`
                : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onNavigateHome}
          >
            한눈보기에서 수정
          </button>
        </section>
      )}

      <NoticeFilters
        query={query}
        dateRange={dateRange}
        categories={categories}
        category={category}
        loading={loading}
        onQueryChange={setQuery}
        onDateRangeChange={setDateRange}
        onCategoryChange={setCategory}
      />

      {bannerMessage && (
        <InlineBanner
          variant={errorMessage || sdkError || wamDataError ? 'error' : 'info'}
          content={bannerMessage}
        />
      )}

      {activeTab === 'mine' && !hasProfile ? (
        <div className="state-panel">
          <div className="state-panel__mark">!</div>
          <strong>내 공지를 보려면 프로필이 필요합니다.</strong>
          <p>
            한눈보기에서 학과와 학년을 설정하면 저장된 Profile 기준으로 관련
            공지를 보여줍니다.
          </p>
          <button
            type="button"
            className="state-panel__button"
            onClick={onNavigateHome}
          >
            한눈보기로 이동
          </button>
        </div>
      ) : (
        <NoticeList
          notices={visibleNotices}
          loading={activeTab === 'all' ? allLoading : mineLoading}
          emptyTitle={
            query ? '검색 결과가 없습니다.' : '표시할 공지가 없습니다.'
          }
          onToggleFavorite={(noticeId) => void handleToggleFavorite(noticeId)}
          emptyDescription={
            query
              ? '다른 검색어를 입력하거나 분류와 기간 필터를 조정해보세요.'
              : activeTab === 'mine'
                ? '현재 내 정보와 관련된 공지가 없습니다.'
                : '학교 동기화 버튼으로 최신 공지를 불러올 수 있습니다.'
          }
        />
      )}
    </main>
  )
}

export default Send
