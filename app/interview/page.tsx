'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import LoadingDots from '@/components/LoadingDots'
import ResumeInputStep from '@/components/ResumeInputStep'
import type { JobTrack } from '@/lib/questionBank'

const JOB_TRACKS: { id: JobTrack; label: string }[] = [
  { id: 'general', label: '기본' },
  { id: 'software', label: '소프트웨어' },
  { id: 'semiconductor', label: '반도체' },
]

// 카드에 적는 상세 정보는 실제 코드 동작과 어긋나지 않는 것만 적는다 — "역질문 있음",
// "예상 소요 25분" 같은 값은 실전 모드에만 해당하거나 실측치가 없어서 다른 모드에는 못 씀.
const MODES = [
  {
    id: 'practice',
    label: '연습 모드',
    labelJa: '練習モード',
    badge: '처음이면 여기',
    desc: '질문을 미리 보고, 몇 번이든 다시 듣고, 시간 제한 없이 답변을 다듬습니다.',
    illustration: '/mode-practice.svg',
    details: [
      { label: '질문 수', value: '최대 30문항' },
      { label: '질문 미리보기', value: '가능' },
      { label: '지원 직무 선택', value: '없음' },
    ],
  },
  {
    id: 'real',
    label: '실전 모드',
    labelJa: '本番モード',
    badge: '지원 직무 선택',
    desc: '지원 직무(소프트웨어/반도체/기본)를 고르고, 마지막엔 역질문까지 이어집니다.',
    illustration: '/mode-real.svg',
    details: [
      { label: '질문 수', value: '최대 28문항 + 역질문' },
      { label: '질문 미리보기', value: '블러 처리 (듣기 연습)' },
      { label: '지원 직무 선택', value: '소프트웨어 / 반도체 / 기본' },
    ],
  },
  {
    id: 'technical',
    label: '기술 면접',
    labelJa: '技術面接',
    badge: '프로젝트 중심',
    desc: '프로젝트 경험과 기술 선택 이유를 파고듭니다. 답변마다 꼬리질문이 붙을 수 있습니다.',
    illustration: '/mode-tech.svg',
    details: [
      { label: '질문 수', value: '최대 24문항' },
      { label: '질문 미리보기', value: '가능' },
      { label: '지원 직무 선택', value: '없음' },
    ],
  },
] as const

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

  async function startSession(mode: string, track?: JobTrack) {
    if (!userId) return
    setStarting(true)
    const trackQuery = track ? `&track=${track}` : ''

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
    <div className="mode-page">
      <div className="step-indicator">
        <span className="step-indicator-current">01 MODE</span>
        <span className="step-indicator-line" />
        <span>02 CHECK</span>
        <span className="step-indicator-line step-indicator-line-short" />
        <span>03 INTERVIEW</span>
      </div>

      <div className="mode-page-head">
        <div>
          <h1 className="mode-page-title">면접 모드 선택</h1>
          <p className="mode-page-subtitle">面接モードを選んでください · 입장 후에도 바꿀 수 있습니다.</p>
        </div>
      </div>

      {starting ? (
        <LoadingDots label="세션을 준비하고 있습니다..." />
      ) : (
        <div className="mode-card-grid">
          {MODES.map((m) => (
            <div key={m.id} className={`mode-card-dojo${m.id === 'real' ? ' is-featured' : ''}`}>
              <div className="mode-card-dojo-head">
                <span className="mode-card-dojo-kicker">
                  {m.id === 'practice' ? '01' : m.id === 'real' ? '02' : '03'} · {m.labelJa}
                </span>
                <span className={`mode-card-dojo-badge${m.id === 'real' ? ' is-featured' : ''}`}>{m.badge}</span>
              </div>

              <div className="mode-card-dojo-illustration">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.illustration} alt={`${m.label} 일러스트`} className="mode-card-dojo-illustration-img" />
              </div>

              <div>
                <div className="mode-card-dojo-title">{m.label}</div>
                <div className="mode-card-dojo-title-ja">{m.labelJa}</div>
              </div>

              <p className="mode-card-dojo-desc">{m.desc}</p>

              <div className="mode-card-dojo-details">
                {m.details.map((d) => (
                  <div className="mode-card-dojo-detail-row" key={d.label}>
                    <span>{d.label}</span>
                    <span className="mode-card-dojo-detail-value">{d.value}</span>
                  </div>
                ))}
              </div>

              {m.id === 'real' && pickingTrackFor === 'real' ? (
                <div className="mode-track-picker">
                  <p className="muted small mode-track-picker-label">지원 직무를 골라주세요</p>
                  <div className="mode-track-picker-buttons">
                    {JOB_TRACKS.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        className="btn-dojo-track"
                        disabled={starting}
                        onClick={() => setResumeStepTrack(t.id)}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <button type="button" className="mode-track-picker-cancel" onClick={() => setPickingTrackFor(null)}>
                    ← 취소
                  </button>
                </div>
              ) : (
                <button
                  className={`mode-card-dojo-btn${m.id === 'real' ? ' is-primary' : ''}`}
                  disabled={starting}
                  onClick={() => handleModeClick(m.id)}
                >
                  {m.label}로 시작
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {isGuest && (
        <div className="mode-guest-notice">
          <span className="home-guest-dot" aria-hidden="true" />
          <span>지금은 게스트입니다. 고유번호를 저장하면 이 세션이 기록으로 남습니다.</span>
          <a href="/dashboard" className="mode-guest-link">
            고유번호 저장하기 →
          </a>
        </div>
      )}

      {resumeStepTrack && (
        <ResumeInputStep
          isGuest={isGuest}
          onContinue={() => {
            const track = resumeStepTrack
            setResumeStepTrack(null)
            startSession('real', track)
          }}
        />
      )}
    </div>
  )
}
