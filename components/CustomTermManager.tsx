'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type TermRow = {
  id: string
  spoken_variation: string
  correct_term: string
  category: string
}

// 이름·회사명처럼 카타카나/영어라 STT가 잘 못 알아듣는 표현을, "적용" 제안을 기다리지
// 않고 사용자가 직접 미리 등록할 수 있게 한다(2026-09-02). 여기 등록해두면 다음 면접부터
// normalizeTranscript(features/interview/lib/transcriptNormalizer.ts)가 확정 답변에
// 자동으로 바꿔준다.
export default function CustomTermManager({ terms }: { terms: TermRow[] }) {
  const router = useRouter()
  const [spoken, setSpoken] = useState('')
  const [correct, setCorrect] = useState('')
  const [category, setCategory] = useState('name')
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const spokenTrimmed = spoken.trim()
    const correctTrimmed = correct.trim()
    if (!spokenTrimmed || !correctTrimmed) {
      setError('인식된 표현과 올바른 표현을 모두 입력해주세요.')
      return
    }
    setSaving(true)
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setSaving(false)
      return
    }
    const { error: upsertError } = await supabase.from('user_custom_terms').upsert(
      { user_id: user.id, spoken_variation: spokenTrimmed, correct_term: correctTrimmed, category },
      { onConflict: 'user_id,spoken_variation' }
    )
    setSaving(false)
    if (upsertError) {
      setError(upsertError.message)
      return
    }
    setSpoken('')
    setCorrect('')
    router.refresh()
  }

  async function handleDelete(id: string) {
    setBusyId(id)
    const supabase = createClient()
    await supabase.from('user_custom_terms').delete().eq('id', id)
    setBusyId(null)
    router.refresh()
  }

  return (
    <div>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <input
          className="auth-input"
          style={{ flex: '1 1 160px' }}
          type="text"
          value={spoken}
          onChange={(e) => setSpoken(e.target.value)}
          placeholder="인식되는 표현 (예: スタロ)"
        />
        <input
          className="auth-input"
          style={{ flex: '1 1 160px' }}
          type="text"
          value={correct}
          onChange={(e) => setCorrect(e.target.value)}
          placeholder="올바른 표현 (예: スター)"
        />
        <select className="room-voice-select" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="name">이름</option>
          <option value="tech">기술 용어</option>
          <option value="other">기타</option>
        </select>
        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? '추가하는 중...' : '추가'}
        </button>
      </form>
      {error && <p className="badge badge-error">{error}</p>}

      {terms.length === 0 ? (
        <p className="muted">아직 등록된 항목이 없습니다.</p>
      ) : (
        <ul>
          {terms.map((t) => (
            <li key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span>
                {t.spoken_variation} → {t.correct_term} ({t.category})
              </span>
              <button className="btn btn-small" onClick={() => handleDelete(t.id)} disabled={busyId === t.id}>
                삭제
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
