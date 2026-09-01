'use client'

import { useRouter } from 'next/navigation'
import { MODE_LABEL } from '../constants'

const KEIGO_MODE_LABEL: Record<string, string> = {
  forced: '경어 강제',
  flexible: '경어 자율',
  casual_allowed: '보통체 허용',
}

export default function RoomHeader({
  mode,
  levelLabel,
  keigoMode,
  questionIndex,
  totalQuestions,
  timerFormatted,
  onExit,
}: {
  mode: string
  levelLabel: string | null
  keigoMode: string | null
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
        {levelLabel && <span>· {levelLabel}</span>}
        {keigoMode && <span>· {KEIGO_MODE_LABEL[keigoMode] ?? keigoMode}</span>}
      </div>
      <div className="room-header-progress">
        질문 {questionIndex} / {totalQuestions} · {timerFormatted}
      </div>
      <div className="room-header-status">
        <span className="room-status-dot" aria-hidden="true" />
        연결됨
      </div>
    </header>
  )
}
