import type { Notice } from '@tutorial/shared'
import { NoticeCard } from './NoticeCard'

type NoticeListProps = {
  notices: Notice[]
  loading: boolean
  emptyTitle: string
  emptyDescription: string
  onToggleFavorite: (noticeId: string) => void
}

export function NoticeList({
  notices,
  loading,
  emptyTitle,
  emptyDescription,
  onToggleFavorite,
}: NoticeListProps) {
  if (loading && notices.length === 0) {
    return (
      <div className="state-panel">
        <div className="state-panel__pulse" />
        <strong>공지 불러오는 중</strong>
        <p>학교 공지 데이터를 정리하고 있습니다.</p>
      </div>
    )
  }

  if (notices.length === 0) {
    return (
      <div className="state-panel">
        <div className="state-panel__mark">0</div>
        <strong>{emptyTitle}</strong>
        <p>{emptyDescription}</p>
      </div>
    )
  }

  return (
    <section
      className="notice-list"
      aria-label="공지 목록"
    >
      {notices.map((notice) => (
        <NoticeCard
          key={notice.id}
          notice={notice}
          onToggleFavorite={onToggleFavorite}
        />
      ))}
    </section>
  )
}
