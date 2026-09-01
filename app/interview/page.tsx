'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const MODES = [
  { id: 'practice', label: '연습 모드', desc: '질문 미리보기·다시 듣기 가능, 시간 제한 없음' },
  { id: 'real', label: '실전 모드', desc: '제한 시간 안에 답변, 종료 후에만 수정' },
  { id: 'technical', label: '기술 면접', desc: '프로젝트 경험·기술 선택 이유 중심' },
  { id: 'reverse', label: '역질문 모드', desc: '면접관에게 할 질문 연습' },
]

export default function InterviewModeSelectPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.replace('/login')
      else setUserId(data.user.id)
    })
  }, [router])

  async function startSession(mode: string) {
    if (!userId) return
    setStarting(true)
    const supabase = createClient()
    const { data, error } = await supabase.from('sessions').insert({ user_id: userId, mode }).select().single()
    setStarting(false)

    if (error || !data) {
      alert('세션 생성 중 오류가 발생했습니다: ' + (error?.message ?? '알 수 없는 오류'))
      return
    }
    router.push(`/interview/run/${data.id}?mode=${mode}`)
  }

  if (!userId) return <p>확인 중입니다...</p>

  return (
    <div>
      <h1>면접 모드 선택</h1>
      <p className="muted small">
        레벨 체크를 아직 하지 않았다면{' '}
        <a href="/level-check" style={{ textDecoration: 'underline' }}>
          레벨 체크
        </a>
        를 먼저 해보는 것을 권장합니다.
      </p>
      <div className="mode-grid">
        {MODES.map((m) => (
          <button key={m.id} className="card mode-card" disabled={starting} onClick={() => startSession(m.id)}>
            <h3>{m.label}</h3>
            <p className="muted small">{m.desc}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
