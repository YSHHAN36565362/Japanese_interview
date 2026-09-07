'use client'

import { useMemo, useState } from 'react'
import { checkGrammar, type GrammarIssue, type GrammarIssueSeverity, type GrammarIssueType } from '../lib/grammarCheck'

const TYPE_LABEL: Record<GrammarIssueType, string> = {
  particle: '조사',
  style_mixing: '문체',
  filler: '필러',
  tech_term: 'STT 오인식',
  choon: '장음',
  repetition: '반복',
}

const SEVERITY_LABEL: Record<GrammarIssueSeverity, string> = {
  error: '오류',
  warning: '주의',
  info: '참고',
}

const SEVERITY_BADGE_CLASS: Record<GrammarIssueSeverity, string> = {
  error: 'badge-error',
  warning: 'badge-warn',
  info: '',
}

export default function GrammarPanel({
  draftText,
  onChangeText,
}: {
  draftText: string
  onChangeText: (text: string) => void
}) {
  const [showPreview, setShowPreview] = useState(false)
  const result = useMemo(() => checkGrammar(draftText || ''), [draftText])

  function applyIssue(issue: GrammarIssue) {
    if (issue.suggestion == null) return
    onChangeText(draftText.slice(0, issue.start) + issue.suggestion + draftText.slice(issue.end))
  }

  return (
    <div className="room-coaching-panel" data-testid="grammar-panel">
      <h3 className="room-panel-title">문법 교정 ({result.issues.length}건)</h3>

      {result.issues.length === 0 && (
        <p className="muted small">규칙 기반 검사에서 발견된 이슈가 없습니다. (모든 오류를 잡아내지는 못합니다)</p>
      )}

      {result.issues.length > 0 && (
        <ul className="room-grammar-list">
          {result.issues.map((issue, i) => (
            <li key={`${issue.type}-${issue.start}-${i}`} className={`room-grammar-item severity-${issue.severity}`}>
              <div className="room-grammar-item-head">
                <span className="badge">{TYPE_LABEL[issue.type]}</span>
                <span className={`badge ${SEVERITY_BADGE_CLASS[issue.severity]}`}>{SEVERITY_LABEL[issue.severity]}</span>
                <code className="room-grammar-matched">{issue.matchedText}</code>
              </div>
              <p className="room-grammar-message">{issue.message}</p>
              {issue.translation && <p className="room-grammar-translation">뜻: {issue.translation}</p>}
              {issue.suggestion != null && (
                <button className="btn btn-small" onClick={() => applyIssue(issue)}>
                  {issue.suggestion === '' ? '삭제 적용' : `"${issue.suggestion}"로 교정`}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {result.issues.length > 0 && (
        <>
          <button className="btn btn-small" onClick={() => setShowPreview((v) => !v)}>
            {showPreview ? '미리보기 닫기' : '전체 교정 미리보기'}
          </button>
          {showPreview && <p className="room-grammar-preview">{result.correctedText}</p>}
        </>
      )}

      <p className="muted small">
        정규식/사전 기반 규칙 검사이며 AI 호출 없이 동작합니다. 조사·문체·STT 오인식 등 흔한 패턴만 잡아내는
        참고용 힌트이니, 최종 판단은 직접 해주세요.
      </p>
    </div>
  )
}
