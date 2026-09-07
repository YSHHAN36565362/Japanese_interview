'use client'

import { useRouter } from 'next/navigation'
import { MODE_LABEL, TRACK_LABEL } from '../constants'

export default function RoomHeader({
  mode,
  track,
  questionIndex,
  totalQuestions,
  timerFormatted,
  recording,
  onExit,
}: {
  mode: string
  track?: string
  questionIndex: number
  totalQuestions: number
  timerFormatted: string
  recording?: boolean
  onExit: () => void
}) {
  const router = useRouter()

  function handleExit() {
    onExit()
    router.push('/interview')
  }

  return (
    <header className="room-header" data-testid="room-header">
      <div className="room-header-left">
        <button className="room-exit-btn" onClick={handleExit} aria-label="면접 나가기">
          ← 나가기
        </button>
        <div className="room-header-meta">
          <span>{MODE_LABEL[mode] ?? mode}</span>
          {track && TRACK_LABEL[track] && <span> · {TRACK_LABEL[track]}</span>}
        </div>
        <div className="room-header-status">
          <span className="room-status-dot" aria-hidden="true" />
          연결됨
        </div>
      </div>

      <div className="room-header-progress">
        질문 {questionIndex} / {totalQuestions}
      </div>

      <div className="room-header-right">
        {recording && (
          <span className="room-header-recording">
            <span className="room-header-recording-dot" aria-hidden="true" />
            녹음 중
          </span>
        )}
        <span className="room-header-timer">{timerFormatted}</span>
      </div>
    </header>
  )
}
