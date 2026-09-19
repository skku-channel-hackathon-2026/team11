import type { Notice } from '@tutorial/shared'

function previewText(content: string): string {
  const text = content.replace(/\s+/g, ' ').trim()
  if (!text)
    return '본문 미리보기가 없는 공지입니다. 원문에서 자세한 내용을 확인해주세요.'
  return text.length > 128 ? `${text.slice(0, 128)}...` : text
}

export function NoticeCard({ notice }: { notice: Notice }) {
  return (
    <article className="notice-card">
      <a
        className="notice-card__link"
        href={notice.url}
        target="_blank"
        rel="noreferrer"
        aria-label={`${notice.title} 원문 열기`}
      >
        <div className="notice-card__rail" />
        <div className="notice-card__body">
          <div className="notice-card__meta">
            <span>{notice.category ?? '일반'}</span>
            <span>{notice.postedAt.slice(0, 10)}</span>
          </div>
          <h2 className="notice-card__title">{notice.title}</h2>
          <p className="notice-card__preview">{previewText(notice.content)}</p>
          {notice.reason && (
            <p className="notice-card__reason">{notice.reason}</p>
          )}
          <div className="notice-card__footer">
            <span>{notice.source}</span>
            <span>원문 보기</span>
          </div>
        </div>
      </a>
    </article>
  )
}
