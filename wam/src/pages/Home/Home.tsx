import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import { useCallFunction } from '@channel.io/app-sdk-wam'
import {
  HOME_FUNCTIONS,
  SCHOOL_NOTICE_FUNCTIONS,
  type ChecklistTask,
  type ChecklistTaskSource,
  type CompleteChecklistTaskOutput,
  type HomeDashboardOutput,
  type FavoriteHomeNotice,
  type ToggleNoticeFavoriteOutput,
  type SaveUserProfileOutput,
  type UserProfile,
  formatRemainingTime,
} from '@tutorial/shared'
import { useTutorialWamData } from '../../hooks/useTutorialWamData'
import './Home.css'

const homeDashboardCacheKey = 'hanoon.home.dashboard.v1'
const homeDashboardCacheMs = 5 * 60 * 1000
const defaultProfileInterests: UserProfile['interests'] = ['학사']
const gradeOptions = [1, 2, 3, 4, 5, 6]

const sourceLabels: Record<ChecklistTaskSource['sourceType'], string> = {
  NOTICE: '공지',
  MAIL: '메일',
  ACADEMIC_SCHEDULE: '학사일정',
}

function formatDate(value: string | null): string {
  if (!value) return ''
  return value.slice(0, 10).replace(/-/g, '.')
}

function deadlineLabel(task: Pick<ChecklistTask, 'deadline' | 'deadlinePrecision'>): string {
  return formatRemainingTime(task.deadline, task.deadlinePrecision) ?? '일정 정보 확인 필요'
}

function uniqueSources(task: ChecklistTask): ChecklistTaskSource['sourceType'][] {
  return Array.from(new Set(task.sources.map((source) => source.sourceType)))
}

function progressPercent(current: number, total: number | null): number {
  if (!total || total <= 0) return 100
  return Math.min(100, Math.max(0, (current / total) * 100))
}

function Home() {
  const { data: wamData } = useTutorialWamData()
  const appId = wamData?.appId ?? ''
  const [dashboard, setDashboard] = useState<HomeDashboardOutput | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [checklistExpanded, setChecklistExpanded] = useState(false)
  const [favoritesExpanded, setFavoritesExpanded] = useState(false)
  const [expandedCompleted, setExpandedCompleted] = useState(false)
  const [openSourcesTaskId, setOpenSourcesTaskId] = useState<string | null>(null)
  const [confirmDismissTaskId, setConfirmDismissTaskId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState('')
  const [profileEditorOpen, setProfileEditorOpen] = useState(false)
  const [profileDepartment, setProfileDepartment] = useState('')
  const [profileGrade, setProfileGrade] = useState(1)
  const [levelUp, setLevelUp] = useState<{ level: number; levelName: string } | null>(null)
  const { call: getDashboard, loading, error } = useCallFunction<HomeDashboardOutput>({
    appId,
    name: HOME_FUNCTIONS.getDashboard,
  })
  const { call: completeTask, loading: completing } = useCallFunction<CompleteChecklistTaskOutput>({
    appId,
    name: HOME_FUNCTIONS.completeTask,
  })
  const { call: undoTask, loading: undoing } = useCallFunction<CompleteChecklistTaskOutput>({
    appId,
    name: HOME_FUNCTIONS.undoTask,
  })
  const { call: dismissTask, loading: dismissing } = useCallFunction<CompleteChecklistTaskOutput>({
    appId,
    name: HOME_FUNCTIONS.dismissTask,
  })
  const { call: toggleFavorite } = useCallFunction<ToggleNoticeFavoriteOutput>({
    appId,
    name: SCHOOL_NOTICE_FUNCTIONS.toggleFavorite,
  })
  const { call: saveProfile, loading: savingProfile } = useCallFunction<SaveUserProfileOutput>({
    appId,
    name: SCHOOL_NOTICE_FUNCTIONS.saveProfile,
  })

  const load = useCallback(async () => {
    setErrorMessage('')
    const output = await getDashboard({})
    setDashboard(output)
    window.sessionStorage.setItem(homeDashboardCacheKey, JSON.stringify({ savedAt: Date.now(), dashboard: output }))
  }, [getDashboard])

  useEffect(() => {
    if (!appId || dashboard) return
    const cached = window.sessionStorage.getItem(homeDashboardCacheKey)
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as { savedAt: number; dashboard: HomeDashboardOutput }
        if (Date.now() - parsed.savedAt < homeDashboardCacheMs) {
          setDashboard(parsed.dashboard)
          return
        }
      } catch {
        window.sessionStorage.removeItem(homeDashboardCacheKey)
      }
    }
    void load().catch(() => setErrorMessage('체크리스트를 불러오지 못했습니다.'))
  }, [appId, dashboard, load])

  const pendingTasks = useMemo(
    () => (dashboard?.tasks ?? []).filter((task) => task.status === 'pending'),
    [dashboard]
  )
  const completedTasks = useMemo(
    () => (dashboard?.tasks ?? []).filter((task) => task.status === 'completed'),
    [dashboard]
  )
  const visiblePendingTasks = checklistExpanded ? pendingTasks : pendingTasks.slice(0, 3)
  const favoriteNotices = dashboard?.favorites ?? []
  const visibleFavorites = favoritesExpanded ? favoriteNotices : favoriteNotices.slice(0, 3)
  const hasWarning = (dashboard?.failedAccounts.length ?? 0) > 0
  const progress = dashboard?.progress
  const xpTotal = progress?.nextLevelXp ?? null
  const profile = dashboard?.profile ?? null
  const profileText = profile
    ? `${profile.department} · ${profile.grade}학년`
    : '학과와 학년을 설정해주세요.'


  const openProfileEditor = () => {
    setErrorMessage('')
    setProfileDepartment(profile?.department ?? '')
    setProfileGrade(profile?.grade ?? 1)
    setProfileEditorOpen(true)
  }

  const handleSaveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage('')
    const department = profileDepartment.trim()
    if (!department) {
      setErrorMessage('학과를 입력해주세요.')
      return
    }

    try {
      const output = await saveProfile({
        department,
        grade: profileGrade,
        interests: profile?.interests?.length ? profile.interests : defaultProfileInterests,
      })
      setDashboard((current) => current ? { ...current, profile: output.profile } : current)
      window.sessionStorage.removeItem(homeDashboardCacheKey)
      setProfileEditorOpen(false)
      setFeedback('프로필을 저장했어요.')
    } catch {
      setErrorMessage('프로필을 저장하지 못했습니다.')
    }
  }

  const handleToggleFavorite = async (noticeId: string) => {
    setFeedback('')
    setErrorMessage('')
    try {
      const output = await toggleFavorite({ noticeId })
      setDashboard((current) => current
        ? {
            ...current,
            favorites: current.favorites.filter((notice) => notice.id !== output.noticeId),
          }
        : current)
      window.sessionStorage.removeItem(homeDashboardCacheKey)
    } catch {
      setErrorMessage('즐겨찾기를 변경하지 못했습니다.')
    }
  }

  function updateTaskInDashboard(output: CompleteChecklistTaskOutput) {
    setDashboard((current) => {
      if (!current) return current

      const taskHidden = output.task.status === 'dismissed'
      return {
        ...current,
        progress: output.progress,
        tasks: taskHidden
          ? current.tasks.filter((task) => task.id !== output.task.id)
          : current.tasks.map((task) => task.id === output.task.id ? output.task : task),
        upcomingDeadlines: output.task.status !== 'pending'
          ? current.upcomingDeadlines.filter((item) => item.taskId !== output.task.id)
          : current.upcomingDeadlines.some((item) => item.taskId === output.task.id) || !output.task.deadline
            ? current.upcomingDeadlines
            : [...current.upcomingDeadlines, { taskId: output.task.id, title: output.task.canonicalTitle, deadline: output.task.deadline, deadlinePrecision: output.task.deadlinePrecision }]
              .sort((a, b) => a.deadline.localeCompare(b.deadline))
              .slice(0, 6),
      }
    })
    window.sessionStorage.removeItem(homeDashboardCacheKey)
  }

  const handleUndo = async (taskId: string) => {
    setFeedback('')
    setErrorMessage('')
    try {
      const output = await undoTask({ taskId })
      updateTaskInDashboard(output)
      if (output.xpReverted > 0) {
        setFeedback(`완료를 취소했어요 · ${output.xpReverted} XP 회수`)
      } else {
        setFeedback('이미 진행 중인 할 일이에요.')
      }
    } catch {
      setErrorMessage('완료 취소에 실패했습니다.')
    }
  }

  const handleComplete = async (taskId: string) => {
    setFeedback('')
    setErrorMessage('')
    const previousLevel = dashboard?.progress.level ?? null
    try {
      const output = await completeTask({ taskId })
      updateTaskInDashboard(output)
      const didLevelUp = previousLevel !== null && output.progress.level > previousLevel
      if (didLevelUp) {
        setLevelUp({ level: output.progress.level, levelName: output.progress.levelName })
      }
      if (output.xpAwarded > 0) {
        setFeedback(`${didLevelUp ? 'LEVEL UP · ' : ''}+${output.xpAwarded} XP`)
      } else {
        setFeedback('이미 완료된 할 일이에요.')
      }
    } catch {
      setErrorMessage('완료 처리에 실패했습니다.')
    }
  }

  const handleDismiss = async (taskId: string) => {
    setFeedback('')
    setErrorMessage('')
    try {
      const output = await dismissTask({ taskId })
      updateTaskInDashboard(output)
      setConfirmDismissTaskId(null)
      setFeedback('목록에서 삭제했어요. XP는 변하지 않습니다.')
    } catch {
      setErrorMessage('할 일을 삭제하지 못했습니다.')
    }
  }

  useEffect(() => {
    if (!levelUp) return undefined
    const timer = window.setTimeout(() => setLevelUp(null), 2600)
    return () => window.clearTimeout(timer)
  }, [levelUp])

  return (
    <main className="notice-shell home-shell">
      <header className="home-hero is-checklist">
        <div className="home-hero__copy">
          <span>HANOON CHECKLIST</span>
          <h1>안녕하세요!<br />학교가 보낸 정보를 내 할 일로 정리했어요.</h1>
          <div className="home-profile-line">
            <p>{profileText}</p>
            <button type="button" onClick={openProfileEditor}>{profile ? '수정' : '설정'}</button>
          </div>
        </div>
        <button type="button" disabled={loading} onClick={() => void load().catch(() => setErrorMessage('체크리스트를 불러오지 못했습니다.'))}>
          {loading ? '동기화 중' : '새로고침'}
        </button>
      </header>

      {levelUp && <LevelUpCelebration level={levelUp.level} levelName={levelUp.levelName} />}
      {profileEditorOpen && (
        <ProfileEditor
          department={profileDepartment}
          grade={profileGrade}
          saving={savingProfile}
          onDepartmentChange={setProfileDepartment}
          onGradeChange={setProfileGrade}
          onClose={() => setProfileEditorOpen(false)}
          onSubmit={handleSaveProfile}
        />
      )}

      {(errorMessage || error) && <div className="mail-status is-error">{errorMessage || '요청을 처리하지 못했습니다.'}</div>}
      {hasWarning && <div className="mail-status is-warning">일부 메일 계정을 확인하지 못했습니다. 가능한 데이터만 반영했습니다.</div>}
      {feedback && <div className="mail-status is-warning">{feedback}</div>}
      {dashboard?.sync.newTaskCount ? <div className="mail-status is-warning">새로운 할 일 {dashboard.sync.newTaskCount}개를 찾았어요.</div> : null}

      {loading && !dashboard ? (
        <section className="home-section">
          <div className="state-panel"><div className="state-panel__pulse" /><strong>체크리스트 확인 중</strong><p>공지, 메일, 학사일정을 한 번에 정리하고 있습니다.</p></div>
        </section>
      ) : dashboard && progress ? (
        <>
          <section className="home-progress-grid">
            <article className="home-progress-card is-xp">
              <span>MY LEVEL</span>
              <strong>Lv. {progress.level} · {progress.levelName}</strong>
              <p>{progress.totalXp} XP{progress.isMaxLevel ? ' · MAX LEVEL' : ` · 다음 레벨까지 ${progress.nextLevelRemainingXp} XP`}</p>
              <div className="home-progress-bar"><i style={{ width: `${progressPercent(progress.currentLevelXp, xpTotal)}%` }} /></div>
            </article>
            <article className="home-progress-card">
              <span>THIS CHECKLIST</span>
              <strong>{progress.completedTasks} / {progress.totalTasks} 완료</strong>
              <p>{progress.totalTasks > 0 ? `${Math.round(progress.completionRate * 100)}% 진행` : '현재 확인할 할 일이 없어요.'}</p>
              <div className="home-progress-bar"><i style={{ width: `${progress.completionRate * 100}%` }} /></div>
            </article>
          </section>

          <section className="home-section">
            <div className="home-section__head">
              <div><span>CHECKLIST</span><strong>내 체크리스트</strong><p>중복 source는 하나의 할 일로 합쳤습니다.</p></div>
              <em>{pendingTasks.length}개 진행 중</em>
            </div>
            <div className="home-list">
              {pendingTasks.length > 0 ? visiblePendingTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  open={openSourcesTaskId === task.id}
                  completing={completing || undoing || dismissing}
                  confirmingDismiss={confirmDismissTaskId === task.id}
                  onToggleSources={() => setOpenSourcesTaskId((value) => value === task.id ? null : task.id)}
                  onRequestDismiss={() => setConfirmDismissTaskId(task.id)}
                  onCancelDismiss={() => setConfirmDismissTaskId(null)}
                  onDismiss={() => void handleDismiss(task.id)}
                  onComplete={() => void handleComplete(task.id)}
                />
              )) : <EmptyCard title="✓ 지금 확인된 할 일을 모두 완료했어요." />}
            </div>
            {pendingTasks.length > 3 && (
              <button className="home-expand-toggle" type="button" onClick={() => setChecklistExpanded((value) => !value)}>
                {checklistExpanded ? '접기 ↑' : `${pendingTasks.length - 3}개 더 보기 ↓`}
              </button>
            )}
          </section>

          <section className="home-section">
            <div className="home-section__head">
              <div><span>FAVORITES</span><strong>즐겨찾기</strong><p>중요한 공지를 빠르게 다시 확인하세요.</p></div>
              <em>{favoriteNotices.length}개</em>
            </div>
            <div className="home-favorite-list">
              {favoriteNotices.length > 0 ? visibleFavorites.map((notice) => (
                <FavoriteNoticeRow key={notice.id} notice={notice} onToggle={() => void handleToggleFavorite(notice.id)} />
              )) : <div className="schedule-empty">중요한 공지에 ☆을 눌러보세요. 여기에서 빠르게 다시 확인할 수 있어요.</div>}
            </div>
            {favoriteNotices.length > 3 && (
              <button className="home-expand-toggle" type="button" onClick={() => setFavoritesExpanded((value) => !value)}>
                {favoritesExpanded ? '접기 ↑' : `${favoriteNotices.length - 3}개 더 보기 ↓`}
              </button>
            )}
          </section>

          <section className="home-section">
            <div className="home-section__head">
              <div><span>UPCOMING</span><strong>곧 다가와요</strong><p>마감이 가까운 pending 항목입니다.</p></div>
              <em>{dashboard.upcomingDeadlines.length}개</em>
            </div>
            <div className="home-deadline-list">
              {dashboard.upcomingDeadlines.length > 0 ? dashboard.upcomingDeadlines.map((item) => (
                <div className="home-deadline-row" key={item.taskId}>
                  <b>{deadlineLabel({ deadline: item.deadline, deadlinePrecision: item.deadlinePrecision } as ChecklistTask)}</b>
                  <span>{item.title}</span>
                </div>
              )) : <div className="schedule-empty">가까운 마감이 없습니다.</div>}
            </div>
          </section>

          <section className="home-section">
            <button className="home-completed-toggle" type="button" onClick={() => setExpandedCompleted((value) => !value)}>
              완료한 일 {completedTasks.length}개 {expandedCompleted ? '접기' : '펼치기'}
            </button>
            {expandedCompleted && <div className="home-list is-completed">{completedTasks.map((task) => <CompletedTask key={task.id} task={task} undoing={undoing} onUndo={() => void handleUndo(task.id)} />)}</div>}
          </section>
        </>
      ) : null}
    </main>
  )
}


function ProfileEditor({
  department,
  grade,
  saving,
  onDepartmentChange,
  onGradeChange,
  onClose,
  onSubmit,
}: {
  department: string
  grade: number
  saving: boolean
  onDepartmentChange: (value: string) => void
  onGradeChange: (value: number) => void
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  return (
    <div className="home-modal-backdrop" role="presentation">
      <form className="home-profile-modal" onSubmit={onSubmit}>
        <div className="home-profile-modal__head">
          <div>
            <span>PROFILE</span>
            <strong>내 정보 수정</strong>
          </div>
          <button type="button" onClick={onClose} aria-label="닫기">×</button>
        </div>
        <label className="home-profile-field">
          <span>학과</span>
          <input
            value={department}
            maxLength={80}
            placeholder="예: 소프트웨어학과"
            onChange={(event) => onDepartmentChange(event.target.value)}
          />
        </label>
        <label className="home-profile-field">
          <span>학년</span>
          <select value={grade} onChange={(event) => onGradeChange(Number(event.target.value))}>
            {gradeOptions.map((item) => <option key={item} value={item}>{item}학년</option>)}
          </select>
        </label>
        <div className="home-profile-modal__actions">
          <button type="button" disabled={saving} onClick={onClose}>취소</button>
          <button type="submit" disabled={saving}>{saving ? '저장 중' : '저장'}</button>
        </div>
      </form>
    </div>
  )
}

function LevelUpCelebration({ level, levelName }: { level: number; levelName: string }) {
  const pieces = Array.from({ length: 20 }, (_, index) => index)
  return (
    <div className="home-levelup" aria-live="polite">
      <div className="home-confetti" aria-hidden="true">
        {pieces.map((index) => <i key={index} style={{ '--i': index } as CSSProperties} />)}
      </div>
      <div className="home-levelup__toast">
        <span>Level Up!</span>
        <strong>Lv. {level} · {levelName}</strong>
      </div>
    </div>
  )
}

function TaskCard({
  task,
  open,
  completing,
  confirmingDismiss,
  onToggleSources,
  onRequestDismiss,
  onCancelDismiss,
  onDismiss,
  onComplete,
}: {
  task: ChecklistTask
  open: boolean
  completing: boolean
  confirmingDismiss: boolean
  onToggleSources: () => void
  onRequestDismiss: () => void
  onCancelDismiss: () => void
  onDismiss: () => void
  onComplete: () => void
}) {
  return (
    <article className={`home-card home-task ${task.isNew ? 'is-new' : ''}`}>
      <div className="home-card__top">
        <span>{task.isNew ? 'NEW' : deadlineLabel(task)}</span>
        <small>{task.xpReward} XP</small>
      </div>
      <h3>○ {task.canonicalTitle}</h3>
      <p>{task.action}</p>
      <div className="home-source-tags">{uniqueSources(task).map((type) => <span key={type}>{sourceLabels[type]}</span>)}</div>
      <footer>
        <button type="button" onClick={onToggleSources}>원문 보기</button>
        <button type="button" disabled={completing} onClick={onRequestDismiss}>삭제</button>
        <button type="button" disabled={completing} onClick={onComplete}>완료하기</button>
      </footer>
      {confirmingDismiss && (
        <div className="home-dismiss-confirm">
          <span>이 할 일을 목록에서 삭제할까요?</span>
          <div>
            <button type="button" disabled={completing} onClick={onCancelDismiss}>취소</button>
            <button type="button" disabled={completing} onClick={onDismiss}>삭제</button>
          </div>
        </div>
      )}
      {open && <SourceList sources={task.sources} />}
    </article>
  )
}

function FavoriteNoticeRow({ notice, onToggle }: { notice: FavoriteHomeNotice; onToggle: () => void }) {
  return (
    <article className="home-favorite-row">
      <button type="button" onClick={onToggle} aria-label="즐겨찾기 해제">★</button>
      <a href={notice.url} target="_blank" rel="noreferrer">
        <strong>{notice.title}</strong>
        <span>{notice.source} · {formatDate(notice.postedAt)}</span>
      </a>
    </article>
  )
}

function SourceList({ sources }: { sources: ChecklistTaskSource[] }) {
  return <div className="home-source-list">{sources.map((source) => source.url ? <a key={source.id} href={source.url} target="_blank" rel="noreferrer">{sourceLabels[source.sourceType]} · {source.title}</a> : <span key={source.id}>{sourceLabels[source.sourceType]} · {source.title}</span>)}</div>
}

function CompletedTask({ task, undoing, onUndo }: { task: ChecklistTask; undoing: boolean; onUndo: () => void }) {
  return (
    <article className="home-card home-task is-completed">
      <h3>✓ {task.canonicalTitle}</h3>
      <p>{formatDate(task.completedAt)} 완료 · +{task.xpReward} XP</p>
      <footer>
        <button type="button" disabled={undoing} onClick={onUndo}>되돌리기</button>
      </footer>
    </article>
  )
}

function EmptyCard({ title }: { title: string }) {
  return <div className="state-panel"><div className="state-panel__mark">0</div><strong>{title}</strong><p>새로운 공지, 메일, 학사일정이 생기면 이곳에 표시됩니다.</p></div>
}

export default Home
