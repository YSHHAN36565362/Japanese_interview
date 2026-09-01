'use client'

import { useEffect, useRef, useState } from 'react'

// 질문이 바뀔 때마다 경과 시간을 재시작한다. RoomHeader의 "01:43" 표시,
// answerReview 단계의 답변 시간 계산에 함께 쓰인다.
export function useSessionTimer(resetKey: unknown) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const startedAtRef = useRef<number>(Date.now())

  useEffect(() => {
    startedAtRef.current = Date.now()
    setElapsedSeconds(0)
    const interval = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000))
    }, 1000)
    return () => window.clearInterval(interval)
  }, [resetKey])

  function getElapsedNow() {
    return (Date.now() - startedAtRef.current) / 1000
  }

  function format(totalSeconds: number) {
    const m = Math.floor(totalSeconds / 60)
    const s = Math.floor(totalSeconds % 60)
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  return { elapsedSeconds, getElapsedNow, formatted: format(elapsedSeconds) }
}
