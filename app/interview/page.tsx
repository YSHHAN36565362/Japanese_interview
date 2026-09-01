'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import MacWindow from '@/components/MacWindow'
import LoadingDots from '@/components/LoadingDots'

const MODES = [
  {
    id: 'practice',
    label: '연습 모드',
    desc: '질문 미리보기·다시 듣기 가능, 시간 제한 없음',
    img: '/mode-practice.png',
  },
  {
    id: 'real',
    label: '실전 모드',
    desc: '제한 시간 안에 답변, 마지막엔 역질문까지',
    img: '/mode-real.png',
  },
  {
    id: 'technical',
    label: '기술 면접',
    desc: '프로젝트 경험·기술 선택 이유 중심',
    img: '/mode-tech.png',
  },
]

export default function InterviewModeSelectPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [isGuest, setIsGuest] = useState(false)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace('/login')
        return
      }
      setUserId(data.user.id)
      setIsGuest(data.user.is_anonymous ?? false)
    })
  }, [router])

  async function startSession(mode: string) {
    if (!userId) return
    setStarting(true)

    // 게스트("번호 없이 시작하기")는 sessions 행 자체를 만들지 않는다 — 로컬에서만 쓰는
    // id로 진행하고, 답변도 Supabase에 저장하지 않는다(useInterviewMachine.ts 참고).
    if (isGuest) {
      const localId = crypto.randomUUID()
      setStarting(false)
      router.push(`/interview/run/${localId}?mode=${mode}`)
      return
    }

    const supabase = createClient()
    const { data, error } = await supabase.from('sessions').insert({ user_id: userId, mode }).select().single()
    setStarting(false)

    if (error || !data) {
      alert('세션 생성 중 오류가 발생했습니다: ' + (error?.message ?? '알 수 없는 오류'))
      return
    }
    router.push(`/interview/run/${data.id}?mode=${mode}`)
  }

  if (!userId) return <LoadingDots label="확인 중입니다..." />

  return (
    <MacWindow title="mensetsu-dojo — select mode">
      <h1 style={{ marginTop: 0 }}>면접 모드 선택</h1>
      {starting ? (
        <LoadingDots label="세션을 준비하고 있습니다..." />
      ) : (
        <div className="mode-grid mode-grid-3d">
          {MODES.map((m) => (
            <div key={m.id} className="mode-3d-item">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.img} alt="" aria-hidden="true" className="mode-illustration" />
              <button className="btn-3d" disabled={starting} onClick={() => startSession(m.id)}>
                {m.label}
              </button>
              <p className="muted small mode-3d-desc">{m.desc}</p>
            </div>
          ))}
        </div>
      )}
    </MacWindow>
  )
}
