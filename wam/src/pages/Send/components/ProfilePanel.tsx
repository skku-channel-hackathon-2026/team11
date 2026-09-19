import type { NoticeInterest, UserProfile } from '@tutorial/shared'

const interests: NoticeInterest[] = [
  '장학',
  '학사',
  '취업',
  '창업',
  '동아리',
  '대외활동',
  '교환학생',
  '대학원',
]

type ProfilePanelProps = {
  profile: UserProfile
  loading: boolean
  saveLoading: boolean
  onProfileChange: (profile: UserProfile) => void
  onSave: () => void
}

export function ProfilePanel({
  profile,
  loading,
  saveLoading,
  onProfileChange,
  onSave,
}: ProfilePanelProps) {
  function toggleInterest(interest: NoticeInterest) {
    const selected = profile.interests.includes(interest)
    const next = selected
      ? profile.interests.filter((item) => item !== interest)
      : [...profile.interests, interest]

    onProfileChange({
      ...profile,
      interests: next.length > 0 ? next : profile.interests,
    })
  }

  return (
    <section className="profile-panel">
      <div className="profile-panel__head">
        <div>
          <span>PERSONAL</span>
          <strong>내 공지 설정</strong>
        </div>
        <button
          type="button"
          disabled={loading || !profile.department.trim()}
          onClick={onSave}
        >
          {saveLoading ? '저장 중' : '저장'}
        </button>
      </div>
      <div className="profile-panel__grid">
        <label>
          학과
          <input
            value={profile.department}
            placeholder="예: 소프트웨어학과"
            onChange={(event) =>
              onProfileChange({
                ...profile,
                department: event.target.value,
              })
            }
          />
        </label>
        <label>
          학년
          <select
            value={profile.grade}
            onChange={(event) =>
              onProfileChange({
                ...profile,
                grade: Number(event.target.value),
              })
            }
          >
            {[1, 2, 3, 4, 5, 6].map((grade) => (
              <option
                key={grade}
                value={grade}
              >
                {grade}학년
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="profile-panel__chips">
        {interests.map((interest) => (
          <button
            key={interest}
            type="button"
            className={
              profile.interests.includes(interest) ? 'is-selected' : undefined
            }
            onClick={() => toggleInterest(interest)}
          >
            {interest}
          </button>
        ))}
      </div>
    </section>
  )
}
