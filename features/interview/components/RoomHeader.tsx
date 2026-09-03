'use client'

import { useRouter } from 'next/navigation'
import { getMainQuestionCount } from '@/lib/questionBank'
import { MODE_LABEL, TRACK_LABEL } from '../constants'

export default function RoomHeader({
  mode,
  track,
  questionIndex,
  totalQuestions,
  timerFormatted,
  onExit,
}: {
  mode: string
  track?: string
  questionIndex: number
  totalQuestions: number
  timerFormatted: string
  onExit: () => void
}) {
  const router = useRouter()

  function handleExit() {
    onExit()
    router.push('/interview')
  }

  return (
    <header className="room-header" data-testid="room-header">
      <button className="room-exit-btn" onClick={handleExit} aria-label="면접 나가기">
        ← 나가기
      </button>
      <div className="room-header-meta">
        <span>{MODE_LABEL[mode] ?? mode}</span>
        {track && TRACK_LABEL[track] && <span> · {TRACK_LABEL[track]}</span>}
      </div>
      <div className="room-header-progress">
        질문 {questionIndex} / {totalQuestions}
        <span className="room-header-bank-total"> (대분류 총 {getMainQuestionCount()}개)</span> · {timerFormatted}
      </div>
      <div className="room-header-status">
        <span className="room-status-dot" aria-hidden="true" />
        연결됨
      </div>
    </header>
  )
}
