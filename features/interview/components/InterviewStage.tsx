'use client'

import { useState } from 'react'
import type { BankQuestion } from '@/lib/questionBank'
import type { InterviewPhase } from '../types'
import { PHASE_STATUS_TEXT } from '../constants'

export default function InterviewStage({
  question,
  phase,
  isFollowUp,
  interimTranscript,
  showSubtitle,
  blurQuestion,
  onReplay,
}: {
  question: BankQuestion
  phase: InterviewPhase
  isFollowUp: boolean
  interimTranscript: string
  showSubtitle: boolean
  blurQuestion: boolean
  onReplay: () => void
}) {
  const speaking = phase === 'interviewerSpeaking'
  const listening = phase === 'listening'
  const [photoFailed, setPhotoFailed] = useState(false)

  return (
    <section className="room-stage" data-testid="room-stage">
      <div className={`room-avatar${speaking ? ' speaking' : ''}`}>
        {photoFailed ? (
          '面'
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/interviewer.jpg"
            alt="면접관"
            className="room-avatar-photo"
            onError={() => setPhotoFailed(true)}
          />
        )}
      </div>
      <div className="room-speaker-name">
        面接官
        {speaking && <span className="room-speaking-indicator"> · 発話中…</span>}
      </div>

      <span className="badge">{isFollowUp ? '꼬리 질문' : '질문'}</span>
      <p
        className={`room-question-ja${blurQuestion ? ' blurred' : ''}`}
        tabIndex={blurQuestion ? 0 : undefined}
        title={blurQuestion ? '마우스를 올리면 질문이 보입니다 (듣기 연습)' : undefined}
      >
        {question.textJa}
      </p>

      <p className="room-answer-goal">목표 답변 시간: 약 {question.expectedDurationSec}초</p>

      <button className="btn" onClick={onReplay}>
        다시 듣기 (TTS)
      </button>

      <p className="room-phase-status" role="status" aria-live="polite">
        {PHASE_STATUS_TEXT[phase]}
      </p>

      {showSubtitle && listening && interimTranscript && (
        <p className="room-subtitle" aria-live="polite">
          {interimTranscript}
        </p>
      )}
    </section>
  )
}
