'use client'

import { useMemo } from 'react'
import { evaluateAnswer } from '../lib/evaluateAnswer'

const STAGES = ['결론', '이유', '사례', '정리']

export default function CoachingPanel({
  draftText,
  suggestion,
  onApplySuggestion,
}: {
  draftText: string
  suggestion: { from: string; to: string } | null
  onApplySuggestion: () => void
}) {
  const analysis = useMemo(() => evaluateAnswer(draftText || ''), [draftText])

  return (
    <div className="room-coaching-panel">
      <h3 className="room-panel-title">STAR / PREP 체크</h3>
      <ul className="room-star-checklist">
        {STAGES.map((stage) => {
          const done = analysis.detectedFrameworkStages.includes(stage)
          return (
            <li key={stage} className={done ? 'done' : ''}>
              <span className="room-star-check" aria-hidden="true">
                {done ? '✓' : '○'}
              </span>
              {stage}
            </li>
          )
        })}
      </ul>

      <h3 className="room-panel-title">규칙 기반 신호 (추정치)</h3>
      <ul className="room-signal-list">
        <li>필러 사용: {analysis.fillerCount}회</li>
        <li>정중체 비율: {analysis.politenessRatio ?? '—'}</li>
        <li>결론 선행: {analysis.hasConclusionFirst ? '충족' : '미충족'}</li>
        <li>구체적 수치/성과: {analysis.hasNumberOrResult ? '포함' : '없음'}</li>
      </ul>

      {suggestion && (
        <p className="badge badge-warn">
          혹시 &quot;{suggestion.to}&quot;를 의도하셨나요?
          <button className="btn btn-small" onClick={onApplySuggestion}>
            적용
          </button>
        </p>
      )}
    </div>
  )
}
