'use client'

import { useMemo, useState } from 'react'
import { getSelectableTopicCategories, type JobTrack, type TopicCategoryId } from '@/lib/questionBank'

// 세션 시작 전 마지막 단계 — 어떤 주제의 질문을 연습할지 체크박스로 직접 고른다.
// 예전에는 답변 중 키워드가 걸리면 자동으로 꼬리질문이 이어졌지만, 그 로직이 잘 동작하지
// 않는다는 피드백으로 완전히 제거했다(2026-09-07). 대신 세션 시작 전에 원하는 주제를
// 미리 고르는 이 화면으로 대체했다 — 무엇이 나올지 예측 가능하고, 원치 않는 주제를 아예
// 빼고 연습할 수 있다.
export default function CategoryPickerStep({
  mode,
  track,
  onContinue,
  onBack,
}: {
  mode: string
  track?: JobTrack
  onContinue: (topicCategories: TopicCategoryId[]) => void
  onBack?: () => void
}) {
  const categories = useMemo(() => getSelectableTopicCategories(mode, track), [mode, track])
  const [selected, setSelected] = useState<Set<TopicCategoryId>>(() => new Set(categories.map((c) => c.id)))

  const allSelected = selected.size === categories.length
  const noneSelected = selected.size === 0

  function toggle(id: TopicCategoryId) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAll() {
    setSelected(new Set(categories.map((c) => c.id)))
  }

  function clearAll() {
    setSelected(new Set())
  }

  return (
    <div className="preflight-overlay">
      <div className="preflight-card category-picker-card">
        <h2 className="preflight-title">연습할 주제 고르기</h2>
        <p className="preflight-subtitle">
          체크한 주제의 질문 중에서만 이번 세션 질문이 나옵니다. 최소 1개는 선택해야 시작할 수 있습니다.
        </p>

        <div className="category-picker-toolbar">
          <span className="muted small">
            {selected.size} / {categories.length}개 선택됨
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-small" onClick={selectAll} disabled={allSelected}>
              전체 선택
            </button>
            <button type="button" className="btn btn-small" onClick={clearAll} disabled={noneSelected}>
              전체 해제
            </button>
          </div>
        </div>

        <div className="category-picker-grid">
          {categories.map((c) => (
            <label key={c.id} className="category-picker-item">
              <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
              <span>{c.label}</span>
            </label>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
          {onBack ? (
            <button type="button" className="mode-track-picker-cancel" onClick={onBack}>
              ← 이전으로
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onContinue([...selected])}
            disabled={noneSelected}
          >
            이 주제로 시작하기
          </button>
        </div>
      </div>
    </div>
  )
}
