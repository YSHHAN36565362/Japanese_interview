'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatKST } from '@/lib/formatDate'

type SessionRow = {
  id: string
  created_at: string
  mode: string
  session_answers?: { duration_seconds: number | null; feedback_result: { interviewScore?: number } | null }[]
}

const MODE_LABEL_KO: Record<string, string> = {
  practice: '연습 모드',
  real: '실전 모드',
  technical: '기술 면접',
}

export default function SessionList({ sessions }: { sessions: SessionRow[] }) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  const allSelected = sessions.length > 0 && selected.size === sessions.length

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(sessions.map((s) => s.id)))
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleBulkDelete() {
    if (selected.size === 0) return
    if (!window.confirm(`선택한 ${selected.size}개 세션을 삭제하시겠습니까? 되돌릴 수 없습니다.`)) return
    setBusy(true)
    const supabase = createClient()
    const ids = Array.from(selected)
    await supabase.from('session_answers').delete().in('session_id', ids)
    await supabase.from('sessions').delete().in('id', ids)
    setBusy(false)
    setSelected(new Set())
    router.refresh()
  }

  async function handleDeleteOne(id: string) {
    if (!window.confirm('이 세션 기록을 삭제하시겠습니까? 되돌릴 수 없습니다.')) return
    setBusy(true)
    const supabase = createClient()
    await supabase.from('session_answers').delete().eq('session_id', id)
    await supabase.from('sessions').delete().eq('id', id)
    setBusy(false)
    router.refresh()
  }

  if (sessions.length === 0) {
    return <p className="muted mypage-list-empty">아직 완료한 세션이 없습니다.</p>
  }

  return (
    <div>
      <div className="session-list-toolbar">
        <label className="session-list-select-all">
          <input type="checkbox" checked={allSelected} onChange={toggleAll} />
          전체 선택
        </label>
        <button className="btn btn-small" onClick={handleBulkDelete} disabled={selected.size === 0 || busy}>
          {busy ? '처리 중...' : `선택 삭제 (${selected.size})`}
        </button>
      </div>
      <ul className="session-list">
        {sessions.map((s) => {
          const count = s.session_answers?.length ?? 0
          const totalDuration = (s.session_answers ?? []).reduce((sum, a) => sum + (a.duration_seconds ?? 0), 0)
          const minutes = Math.round(totalDuration / 60)
          // 힌트 공개/다시 듣기/시간 초과로 깎이는 "면접 점수" — 이 기능 이전 세션엔 없어서
          // interviewScore가 없는 답변만 있으면 그냥 배지를 숨긴다(0점으로 잘못 표시하지 않기 위함).
          const scores = (s.session_answers ?? [])
            .map((a) => a.feedback_result?.interviewScore)
            .filter((v): v is number => v != null)
          const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null
          return (
            <li key={s.id} className="session-list-row">
              <input
                type="checkbox"
                checked={selected.has(s.id)}
                onChange={() => toggleOne(s.id)}
                aria-label="이 세션 선택"
              />
              <div className="session-list-row-main">
                <div className="session-list-row-title">
                  {MODE_LABEL_KO[s.mode] ?? s.mode} · {count}문항
                </div>
                <div className="session-list-row-meta">
                  {formatKST(s.created_at)}
                  {minutes > 0 && <> · {minutes}분</>}
                </div>
              </div>
              <span className="session-list-count-pill">답변 {count}개</span>
              {avgScore != null && (
                <span
                  className={`room-interview-score room-interview-score-${avgScore >= 70 ? 'good' : avgScore >= 40 ? 'warn' : 'bad'}`}
                >
                  면접 점수 {avgScore}점
                </span>
              )}
              <Link href={`/interview/result/${s.id}`} className="btn btn-small">
                리포트 보기
              </Link>
              <button className="btn btn-small" onClick={() => handleDeleteOne(s.id)} disabled={busy}>
                삭제
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
