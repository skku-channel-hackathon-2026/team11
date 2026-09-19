type NoticeHeaderProps = {
  totalCount: number
  visibleCount: number
  onSync: () => void
  syncLoading: boolean
  loading: boolean
}

export function NoticeHeader({
  totalCount,
  visibleCount,
  onSync,
  syncLoading,
  loading,
}: NoticeHeaderProps) {
  return (
    <header className="notice-hero">
      <div className="notice-hero__topline">
        <span className="notice-hero__brand">SKKU NOTICE</span>
        <span className="notice-hero__count">
          {visibleCount} / {totalCount}
        </span>
      </div>
      <h1>학교 공지를 한곳에서 빠르게 확인하세요.</h1>
      <p>
        성균관대학교 소프트웨어융합대학 공지를 수집해 날짜와 분류 기준으로 정리합니다.
      </p>
      <button
        className="notice-hero__button"
        type="button"
        disabled={loading}
        onClick={onSync}
      >
        {syncLoading ? '동기화 중' : '학교 공지 동기화'}
      </button>
    </header>
  )
}
