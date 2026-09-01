'use client'

import { useState } from 'react'
import type { BankQuestion } from '@/lib/questionBank'
import type { InterviewPhase } from '../types'
import { PHASE_STATUS_TEXT } from '../constants'

export default function InterviewStage({
  question,
  phase,
  isFollowUp,
  blurQuestion,
  onReplay,
  voices,
  voiceURI,
  onVoiceChange,
  onRefreshVoices,
}: {
  question: BankQuestion
  phase: InterviewPhase
  isFollowUp: boolean
  blurQuestion: boolean
  onReplay: () => void
  voices: SpeechSynthesisVoice[]
  voiceURI: string
  onVoiceChange: (uri: string) => void
  onRefreshVoices: () => void
}) {
  const speaking = phase === 'interviewerSpeaking'
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

      <div className="room-question-row">
        {voices.length > 0 && (
          <select
            className="room-voice-select"
            value={voiceURI}
            onChange={(e) => onVoiceChange(e.target.value)}
            aria-label="면접관 목소리 선택"
            title="면접관 목소리 선택 (브라우저 제공, 무료)"
          >
            {voices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {v.name}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          className="room-voice-refresh-btn"
          onClick={onRefreshVoices}
          title="목소리 목록이 1개만 보이면 눌러서 다시 불러와보세요"
        >
          목소리 다시 불러오기
        </button>
        <span className="badge">{isFollowUp ? '꼬리 질문' : '질문'}</span>
      </div>
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
    </section>
  )
}
