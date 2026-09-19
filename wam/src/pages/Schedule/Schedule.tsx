import { useCallback, useEffect, useMemo, useState } from 'react'
import { useCallFunction } from '@channel.io/app-sdk-wam'
import {
  ACADEMIC_SCHEDULE_FUNCTIONS,
  type AcademicSchedule,
  type AcademicScheduleListOutput,
  type AcademicScheduleSyncOutput,
} from '@tutorial/shared'
import { useTutorialWamData } from '../../hooks/useTutorialWamData'
import './Schedule.css'

const weekdays = ['일', '월', '화', '수', '목', '금', '토']

type CalendarDay = {
  date: string
  day: number
  inMonth: boolean
  schedules: AcademicSchedule[]
}

function toDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatKoreanDate(date: string): string {
  return date.replace(/-/g, '.')
}

function scheduleTerm(schedule: AcademicSchedule): string {
  if (!schedule.endAt || schedule.endAt === schedule.startAt) {
    return formatKoreanDate(schedule.startAt)
  }
  return `${formatKoreanDate(schedule.startAt)} - ${formatKoreanDate(schedule.endAt)}`
}

function overlapsDate(schedule: AcademicSchedule, date: string): boolean {
  return schedule.startAt <= date && (schedule.endAt ?? schedule.startAt) >= date
}

function monthLabel(year: number, month: number): string {
  return `${year}.${String(month).padStart(2, '0')}`
}

function currentYearMonth(): { year: number; month: number; today: string } {
  const now = new Date()
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    today: toDateKey(now),
  }
}

function buildCalendarDays(
  year: number,
  month: number,
  schedules: AcademicSchedule[]
): CalendarDay[] {
  const first = new Date(year, month - 1, 1)
  const start = new Date(first)
  start.setDate(first.getDate() - first.getDay())

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    const key = toDateKey(date)
    return {
      date: key,
      day: date.getDate(),
      inMonth: date.getMonth() === month - 1,
      schedules: schedules.filter((schedule) => overlapsDate(schedule, key)),
    }
  })
}

function addMonths(year: number, month: number, amount: number): { year: number; month: number } {
  const date = new Date(year, month - 1 + amount, 1)
  return { year: date.getFullYear(), month: date.getMonth() + 1 }
}

function Schedule() {
  const initial = useMemo(() => currentYearMonth(), [])
  const { data: wamData } = useTutorialWamData()
  const appId = wamData?.appId ?? ''
  const [year, setYear] = useState(initial.year)
  const [month, setMonth] = useState(initial.month)
  const [selectedDate, setSelectedDate] = useState(initial.today)
  const [schedules, setSchedules] = useState<AcademicSchedule[]>([])
  const [statusMessage, setStatusMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const { call: listSchedules, loading: listLoading, error: listError } = useCallFunction<AcademicScheduleListOutput>({
    appId,
    name: ACADEMIC_SCHEDULE_FUNCTIONS.listSchedules,
  })
  const { call: syncSchedules, loading: syncLoading, error: syncError } = useCallFunction<AcademicScheduleSyncOutput>({
    appId,
    name: ACADEMIC_SCHEDULE_FUNCTIONS.syncSchedules,
  })

  const loadSchedules = useCallback(async () => {
    setErrorMessage('')
    const output = await listSchedules({ year, month })
    setSchedules(output.schedules)
  }, [listSchedules, year, month])

  useEffect(() => {
    if (!appId) return
    void loadSchedules().catch(() => setErrorMessage('학사 일정을 불러오지 못했습니다.'))
  }, [appId, loadSchedules])

  const calendarDays = useMemo(
    () => buildCalendarDays(year, month, schedules),
    [year, month, schedules]
  )
  const selectedSchedules = useMemo(
    () => schedules.filter((schedule) => overlapsDate(schedule, selectedDate)),
    [schedules, selectedDate]
  )
  const upcomingSchedules = useMemo(
    () => schedules.filter((schedule) => (schedule.endAt ?? schedule.startAt) >= initial.today).slice(0, 6),
    [schedules, initial.today]
  )

  const moveMonth = (amount: number) => {
    const next = addMonths(year, month, amount)
    setYear(next.year)
    setMonth(next.month)
    setSelectedDate(`${next.year}-${String(next.month).padStart(2, '0')}-01`)
  }

  const handleSync = async () => {
    setStatusMessage('')
    setErrorMessage('')
    try {
      const output = await syncSchedules({ year })
      setStatusMessage(`동기화 완료: ${output.fetched}개 수집, ${output.inserted}개 추가, ${output.updated}개 갱신`)
      await loadSchedules()
    } catch {
      setErrorMessage('학사 일정 동기화에 실패했습니다.')
    }
  }

  const isLoading = listLoading || syncLoading

  return (
    <main className="notice-shell schedule-shell">
      <header className="schedule-hero">
        <div>
          <span>ACADEMIC CALENDAR</span>
          <h1>학사 일정을 달력으로 확인하세요.</h1>
          <p>성균관대학교 소프트웨어학과 주요일정을 월별로 정리합니다.</p>
        </div>
        <button type="button" disabled={syncLoading} onClick={() => void handleSync()}>
          {syncLoading ? '동기화 중' : '학사 일정 동기화'}
        </button>
      </header>

      {(statusMessage || errorMessage || listError || syncError) && (
        <div className={`mail-status ${errorMessage || listError || syncError ? 'is-error' : 'is-warning'}`}>
          {errorMessage || statusMessage || '요청을 처리하지 못했습니다.'}
        </div>
      )}

      <section className="schedule-panel">
        <div className="schedule-toolbar">
          <button type="button" onClick={() => moveMonth(-1)} aria-label="이전 달">‹</button>
          <strong>{monthLabel(year, month)}</strong>
          <button type="button" onClick={() => moveMonth(1)} aria-label="다음 달">›</button>
          <button type="button" className="schedule-toolbar__today" onClick={() => {
            setYear(initial.year)
            setMonth(initial.month)
            setSelectedDate(initial.today)
          }}>
            오늘
          </button>
        </div>

        <div className="schedule-weekdays">
          {weekdays.map((weekday) => <span key={weekday}>{weekday}</span>)}
        </div>
        <div className="schedule-calendar" aria-busy={isLoading}>
          {calendarDays.map((day) => (
            <button
              key={day.date}
              type="button"
              className={[
                'schedule-day',
                day.inMonth ? '' : 'is-muted',
                day.date === selectedDate ? 'is-selected' : '',
                day.date === initial.today ? 'is-today' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => setSelectedDate(day.date)}
            >
              <span>{day.day}</span>
              {day.schedules.length > 0 && <em>{day.schedules.length}</em>}
            </button>
          ))}
        </div>
      </section>

      <section className="schedule-detail-grid">
        <div className="schedule-list-panel">
          <div className="schedule-section-head">
            <span>SELECTED DAY</span>
            <strong>{formatKoreanDate(selectedDate)}</strong>
          </div>
          <ScheduleList schedules={selectedSchedules} emptyText="선택한 날짜의 일정이 없습니다." />
        </div>
        <div className="schedule-list-panel">
          <div className="schedule-section-head">
            <span>UPCOMING</span>
            <strong>다가오는 일정</strong>
          </div>
          <ScheduleList schedules={upcomingSchedules} emptyText="이번 달 남은 일정이 없습니다." />
        </div>
      </section>
    </main>
  )
}

function ScheduleList({ schedules, emptyText }: { schedules: AcademicSchedule[]; emptyText: string }) {
  if (schedules.length === 0) {
    return <div className="schedule-empty">{emptyText}</div>
  }

  return (
    <div className="schedule-list">
      {schedules.map((schedule) => (
        <article className="schedule-card" key={schedule.id}>
          <span>{schedule.category ?? '학사일정'}</span>
          <h3>{schedule.title}</h3>
          <p>{scheduleTerm(schedule)}</p>
          <footer>
            <small>{schedule.source}</small>
            <a href={schedule.sourceUrl} target="_blank" rel="noreferrer">원문 보기</a>
          </footer>
        </article>
      ))}
    </div>
  )
}

export default Schedule
