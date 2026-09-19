import { useCallback, useEffect, useMemo, useState } from 'react'
import { useCallFunction, useWamSize } from '@channel.io/app-sdk-wam'
import {
  SCHOOL_NOTICE_FUNCTIONS,
  type Notice,
  type NoticeDateRange,
  type NoticeListOutput,
  type SaveUserProfileOutput,
  type SeedNoticesOutput,
  type SyncNoticesOutput,
  type UserProfile,
  type UserProfileOutput,
} from '@tutorial/shared'
import { InlineBanner } from '@channel.io/app-sdk-wam-ui'

import { useTutorialWamData } from '../../hooks/useTutorialWamData'
import { NoticeFilters } from './components/NoticeFilters'
import { NoticeHeader } from './components/NoticeHeader'
import { NoticeList } from './components/NoticeList'
import { ProfilePanel } from './components/ProfilePanel'
import './Send.css'

type Tab = 'all' | 'mine'

const emptyProfile: UserProfile = {
  department: '',
  grade: 1,
  interests: ['장학'],
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

function Send() {
  const { setSize } = useWamSize()
  const { data: wamData, error: wamDataError } = useTutorialWamData()
  const appId = wamData?.appId ?? ''
  const [activeTab, setActiveTab] = useState<Tab>('all')
  const [profile, setProfile] = useState<UserProfile>(emptyProfile)
  const [savedProfile, setSavedProfile] = useState<UserProfile | null>(null)
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
    call: saveProfile,
    loading: saveLoading,
    error: saveError,
  } = useCallFunction<SaveUserProfileOutput>({
    appId,
    name: SCHOOL_NOTICE_FUNCTIONS.saveProfile,
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
        setAllNotices(noticesOutput.notices)
        if (profileOutput.profile) {
          setProfile(profileOutput.profile)
          setSavedProfile(profileOutput.profile)
        }
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
    saveLoading ||
    allLoading ||
    mineLoading ||
    seedLoading ||
    syncLoading
  const sdkError =
    profileError || saveError || allError || mineError || seedError || syncError
      ? '요청을 처리하지 못했습니다. 로컬 Worker/D1 실행 상태를 확인해주세요.'
      : ''
  const bannerMessage =
    errorMessage ||
    sdkError ||
    (wamDataError ? wamDataError.message : '') ||
    statusMessage

  const canLoadMine = useMemo(
    () => Boolean(savedProfile && savedProfile.interests.length > 0),
    [savedProfile]
  )

  const categories = useMemo(
    () =>
      Array.from(
        new Set(
          allNotices
            .map((notice) => notice.category)
            .filter((value): value is string => Boolean(value))
        )
      ).sort((a, b) => a.localeCompare(b, 'ko')),
    [allNotices]
  )

  const baseNotices = activeTab === 'all' ? allNotices : myNotices
  const visibleNotices = useMemo(
    () =>
      baseNotices.filter(
        (notice) =>
          matchesSearch(notice, query) &&
          (activeTab !== 'all' || matchesCategory(notice, category))
      ),
    [activeTab, baseNotices, category, query]
  )

  const handleSaveProfile = useCallback(async () => {
    setErrorMessage('')
    setStatusMessage('')
    try {
      const output = await saveProfile(profile)
      setSavedProfile(output.profile)
      setProfile(output.profile)
      setMyNotices([])
      setStatusMessage('프로필을 저장했습니다.')
    } catch {
      setErrorMessage('프로필을 저장하지 못했습니다.')
    }
  }, [profile, saveProfile])

  const handleSeed = useCallback(async () => {
    setErrorMessage('')
    setStatusMessage('')
    try {
      const output = await seedNotices({})
      await loadAll()
      setStatusMessage(
        output.inserted > 0
          ? `테스트 공지 ${output.inserted}개를 추가했습니다.`
          : '테스트 공지는 이미 추가되어 있습니다.'
      )
    } catch {
      setErrorMessage('테스트 공지를 추가하지 못했습니다.')
    }
  }, [loadAll, seedNotices])

  const handleSync = useCallback(async () => {
    setErrorMessage('')
    setStatusMessage('')
    try {
      const output = await syncNotices({})
      await loadAll()
      setStatusMessage(
        `학교 공지 동기화 완료: 추가 ${output.inserted}개, 갱신 ${output.updated}개, 유지 ${output.skipped}개`
      )
    } catch {
      setErrorMessage('학교 공지를 동기화하지 못했습니다.')
    }
  }, [loadAll, syncNotices])

  const handleTabChange = useCallback(
    async (tab: Tab) => {
      setActiveTab(tab)
      setErrorMessage('')
      setStatusMessage('')

      if (tab === 'all') {
        await loadAll()
        return
      }

      if (!canLoadMine) {
        setStatusMessage('내 공지를 보려면 프로필을 먼저 저장해주세요.')
        return
      }

      try {
        await loadMine()
      } catch {
        setErrorMessage('내 공지를 불러오지 못했습니다.')
      }
    },
    [canLoadMine, loadAll, loadMine]
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

      {activeTab === 'all' ? (
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
      ) : (
        <ProfilePanel
          profile={profile}
          loading={loading}
          saveLoading={saveLoading}
          onProfileChange={setProfile}
          onSave={() => void handleSaveProfile()}
        />
      )}

      {bannerMessage && (
        <InlineBanner
          variant={errorMessage || sdkError || wamDataError ? 'error' : 'info'}
          content={bannerMessage}
        />
      )}

      <NoticeList
        notices={visibleNotices}
        loading={activeTab === 'all' ? allLoading : mineLoading}
        emptyTitle={query ? '검색 결과가 없습니다.' : '표시할 공지가 없습니다.'}
        emptyDescription={
          query
            ? '다른 검색어를 입력하거나 분류와 기간 필터를 조정해보세요.'
            : activeTab === 'mine'
              ? '프로필을 저장한 뒤 내 공지를 다시 불러와주세요.'
              : '학교 동기화 버튼으로 최신 공지를 불러올 수 있습니다.'
        }
      />
    </main>
  )
}

export default Send
