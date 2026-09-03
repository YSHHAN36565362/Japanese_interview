'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import MacWindow from '@/components/MacWindow'
import LoadingDots from '@/components/LoadingDots'
import ResumeInputStep from '@/components/ResumeInputStep'
import type { JobTrack } from '@/lib/questionBank'
import { RESUME_PRIORITY_STORAGE_KEY } from '@/lib/resumePriorityStorage'

const JOB_TRACKS: { id: JobTrack; label: string }[] = [
  { id: 'general', label: '기본' },
  { id: 'software', label: '소프트웨어' },
  { id: 'semiconductor', label: '반도체' },
]

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
  // 실전 모드는 "다른 직무 질문이 안 섞이게" 지원 직무(소프트웨어/반도체)를 먼저 골라야 한다 —
  // 카드를 누르면 바로 시작하는 대신, 이 카드 안에서만 직무 선택 버튼을 펼쳐서 보여준다.
  const [pickingTrackFor, setPickingTrackFor] = useState<string | null>(null)
  // 직무를 고른 뒤, 세션을 바로 시작하지 않고 이력서/자기소개 붙여넣기(선택) 단계를 한 번
  // 더 보여준다 — 값이 있으면 그 트랙으로 진행할 준비가 된 것이고, 이 단계의 "스킵하기"나
  // "반영하고 시작하기"를 누르면 실제로 startSession이 호출된다.
  const [resumeStepTrack, setResumeStepTrack] = useState<JobTrack | null>(null)

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

  async function startSession(mode: string, track?: JobTrack, resumePriorityIds?: string[]) {
    if (!userId) return
    setStarting(true)
    const trackQuery = track ? `&track=${track}` : ''

    if (resumePriorityIds && resumePriorityIds.length > 0 && typeof window !== 'undefined') {
      window.sessionStorage.setItem(RESUME_PRIORITY_STORAGE_KEY, JSON.stringify(resumePriorityIds))
    }

    // 게스트("번호 없이 시작하기")는 sessions 행 자체를 만들지 않는다 — 로컬에서만 쓰는
    // id로 진행하고, 답변도 Supabase에 저장하지 않는다(useInterviewMachine.ts 참고).
    if (isGuest) {
      const localId = crypto.randomUUID()
      setStarting(false)
      router.push(`/interview/run/${localId}?mode=${mode}${trackQuery}`)
      return
    }

    const supabase = createClient()
    const { data, error } = await supabase.from('sessions').insert({ user_id: userId, mode }).select().single()
    setStarting(false)

    if (error || !data) {
      alert('세션 생성 중 오류가 발생했습니다: ' + (error?.message ?? '알 수 없는 오류'))
      return
    }
    router.push(`/interview/run/${data.id}?mode=${mode}${trackQuery}`)
  }

  function handleModeClick(modeId: string) {
    // 실전 모드만 지원 직무를 먼저 고르게 한다 — 다른 모드는 바로 시작.
    if (modeId === 'real') {
      setPickingTrackFor(modeId)
      return
    }
    startSession(modeId)
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
              {m.id === 'real' && pickingTrackFor === 'real' ? (
                <div className="mode-track-picker">
                  <p className="muted small mode-track-picker-label">지원 직무를 골라주세요</p>
                  <div className="mode-track-picker-buttons">
                    {JOB_TRACKS.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        className="btn-3d btn-3d-track"
                        disabled={starting}
                        onClick={() => setResumeStepTrack(t.id)}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="mode-track-picker-cancel"
                    onClick={() => setPickingTrackFor(null)}
                  >
                    ← 취소
                  </button>
                </div>
              ) : (
                <button className="btn-3d" disabled={starting} onClick={() => handleModeClick(m.id)}>
                  {m.label}
                </button>
              )}
              <p className="muted small mode-3d-desc">{m.desc}</p>
            </div>
          ))}
        </div>
      )}

      {resumeStepTrack && (
        <ResumeInputStep
          onContinue={(matchedIds) => {
            const track = resumeStepTrack
            setResumeStepTrack(null)
            startSession('real', track, matchedIds)
          }}
        />
      )}
    </MacWindow>
  )
}
