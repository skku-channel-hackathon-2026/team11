import type { NoticeDateRange } from '@tutorial/shared'

const dateRangeOptions: Array<{ value: NoticeDateRange; label: string }> = [
  { value: 'all', label: '전체' },
  { value: 'today', label: '오늘' },
  { value: 'yesterday', label: '어제' },
  { value: 'thisWeek', label: '이번주' },
  { value: 'thisMonth', label: '이번달' },
  { value: 'last6Months', label: '6개월' },
  { value: 'last1Year', label: '1년' },
]

type NoticeFiltersProps = {
  query: string
  dateRange: NoticeDateRange
  categories: string[]
  category: string
  loading: boolean
  onQueryChange: (query: string) => void
  onDateRangeChange: (dateRange: NoticeDateRange) => void
  onCategoryChange: (category: string) => void
}

export function NoticeFilters({
  query,
  dateRange,
  categories,
  category,
  loading,
  onQueryChange,
  onDateRangeChange,
  onCategoryChange,
}: NoticeFiltersProps) {
  return (
    <section className="notice-controls">
      <label className="notice-search">
        <span>검색</span>
        <input
          value={query}
          placeholder="제목, 본문, 출처 검색"
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </label>

      <div className="notice-select-row">
        <label className="notice-select">
          <span>기간</span>
          <select
            value={dateRange}
            disabled={loading}
            onChange={(event) =>
              onDateRangeChange(event.target.value as NoticeDateRange)
            }
          >
            {dateRangeOptions.map((option) => (
              <option
                key={option.value}
                value={option.value}
              >
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="notice-select">
          <span>분류</span>
          <select
            value={category}
            disabled={loading}
            onChange={(event) => onCategoryChange(event.target.value)}
          >
            <option value="">전체 분류</option>
            {categories.map((item) => (
              <option
                key={item}
                value={item}
              >
                {item}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  )
}
