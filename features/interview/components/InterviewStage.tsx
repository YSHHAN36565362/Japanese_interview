'use client'

import { useState } from 'react'
import type { BankQuestion } from '@/lib/questionBank'
import type { InterviewPhase } from '../types'
import type { SpeakingBoundary, VoiceOption } from '../hooks/useSpeechSynthesis'
import { PHASE_STATUS_TEXT } from '../constants'
import { VOICEVOX_PREFIX } from '@/lib/voicevoxTts'
import VoiceWaveform from './VoiceWaveform'

export default function InterviewStage({
  question,
  phase,
  isFollowUp,
  blurQuestion,
  onReplay,
  voices,
  voiceURI,
  onVoiceChange,
  micListening,
  micLevel,
  speakingBoundary,
  rate,
  onRateChange,
  defaultRate,
  minRate,
  maxRate,
  pitch,
  onPitchChange,
  defaultPitch,
  minPitch,
  maxPitch,
}: {
  question: BankQuestion
  phase: InterviewPhase
  isFollowUp: boolean
  blurQuestion: boolean
  onReplay: () => void
  voices: VoiceOption[]
  voiceURI: string
  onVoiceChange: (uri: string) => void
  micListening: boolean
  micLevel: number
  speakingBoundary: SpeakingBoundary
  rate: number
  onRateChange: (rate: number) => void
  defaultRate: number
  minRate: number
  maxRate: number
  pitch: number
  onPitchChange: (pitch: number) => void
  defaultPitch: number
  minPitch: number
  maxPitch: number
}) {
  const isVoicevoxVoice = voiceURI.startsWith(VOICEVOX_PREFIX)
  const speaking = phase === 'interviewerSpeaking'
  const [photoFailed, setPhotoFailed] = useState(false)
  const listeningPhase = phase === 'listening'

  // 지금 낭독 중인 글자를 요미가나 점처럼 짚어준다 — TTS가 어디를 읽고 있는지 실시간으로
  // 보여주면, 질문이 길 때 사용자가 청취 타이밍을 놓쳐서 늦게 반응하는 문제가 줄어든다.
  // (VOICEVOX 외부 음성은 오디오 파일 재생이라 글자 단위 경계 이벤트가 없어 이 표시가 뜨지 않는다.)
  let questionNode: React.ReactNode = question.textJa
  if (speaking && speakingBoundary) {
    const { charIndex, charLength } = speakingBoundary
    const before = question.textJa.slice(0, charIndex)
    const current = question.textJa.slice(charIndex, charIndex + charLength)
    const after = question.textJa.slice(charIndex + charLength)
    if (current) {
      questionNode = (
        <>
          {before}
          <span className="room-question-reading">{current}</span>
          {after}
        </>
      )
    }
  }

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
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        )}
        <span className="badge">{isFollowUp ? '꼬리 질문' : '질문'}</span>
      </div>
      <p
        className={`room-question-ja${blurQuestion ? ' blurred' : ''}`}
        tabIndex={blurQuestion ? 0 : undefined}
        title={blurQuestion ? '마우스를 올리면 질문이 보입니다 (듣기 연습)' : undefined}
      >
        {questionNode}
      </p>

      <p className="room-answer-goal">목표 답변 시간: 약 {question.expectedDurationSec}초</p>

      <div className="room-stage-controls-row">
        <button className="btn" onClick={onReplay}>
          다시 듣기 (TTS)
        </button>
        <div className="room-rate-control" role="group" aria-label="면접관 질문 속도 조절">
          <button
            type="button"
            className="room-rate-btn"
            onClick={() => onRateChange(rate - 0.1)}
            disabled={rate <= minRate}
            aria-label="속도 느리게"
          >
            −
          </button>
          <button
            type="button"
            className="room-rate-value"
            onClick={() => onRateChange(defaultRate)}
            title="눌러서 기본 속도로 되돌리기"
          >
            {rate.toFixed(2)}x
          </button>
          <button
            type="button"
            className="room-rate-btn"
            onClick={() => onRateChange(rate + 0.1)}
            disabled={rate >= maxRate}
            aria-label="속도 빠르게"
          >
            ＋
          </button>
        </div>
        <div
          className="room-rate-control"
          role="group"
          aria-label="면접관 목소리 톤(피치) 조절"
          title={isVoicevoxVoice ? '외부(VOICEVOX) 음성은 피치 조절을 지원하지 않습니다' : undefined}
        >
          <button
            type="button"
            className="room-rate-btn"
            onClick={() => onPitchChange(pitch - 0.1)}
            disabled={isVoicevoxVoice || pitch <= minPitch}
            aria-label="톤 낮게"
          >
            −
          </button>
          <button
            type="button"
            className="room-rate-value"
            onClick={() => onPitchChange(defaultPitch)}
            disabled={isVoicevoxVoice}
            title="눌러서 기본 톤으로 되돌리기"
          >
            톤 {pitch.toFixed(1)}
          </button>
          <button
            type="button"
            className="room-rate-btn"
            onClick={() => onPitchChange(pitch + 0.1)}
            disabled={isVoicevoxVoice || pitch >= maxPitch}
            aria-label="톤 높게"
          >
            ＋
          </button>
        </div>
      </div>

      {listeningPhase ? (
        <>
          <p className="room-mic-status" role="status" aria-live="polite">
            {micListening ? (
              <>
                <span className="room-mic-status-dot listening" aria-hidden="true" />
                듣고 있습니다 — 지금 말씀하세요
              </>
            ) : (
              <>
                <span className="room-mic-status-dot" aria-hidden="true" />
                마이크 준비 중... (점이 켜지면 말씀하세요)
              </>
            )}
          </p>
          <VoiceWaveform level={micLevel} active={micListening} />
        </>
      ) : (
        <p className="room-phase-status" role="status" aria-live="polite">
          {PHASE_STATUS_TEXT[phase]}
        </p>
      )}
    </section>
  )
}
