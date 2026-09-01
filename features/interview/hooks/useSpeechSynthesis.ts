'use client'

import { useCallback, useEffect, useState } from 'react'

interface Options {
  onStart?: () => void
  onEnd?: () => void
}

// 질문 낭독 전용 TTS 훅. 재생 중에는 STT를 시작하지 않도록 onStart/onEnd 콜백으로
// 면접 상태 머신에 TTS_STARTED/TTS_ENDED 이벤트를 보낸다 (가이드 §7-4).
export function useSpeechSynthesis({ onStart, onEnd }: Options) {
  const [supported, setSupported] = useState(true)

  useEffect(() => {
    setSupported(typeof window !== 'undefined' && 'speechSynthesis' in window)
  }, [])

  const speak = useCallback(
    (text: string) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        onEnd?.()
        return
      }
      window.speechSynthesis.cancel()
      const utter = new SpeechSynthesisUtterance(text)
      utter.lang = 'ja-JP'
      utter.rate = 0.95
      utter.onstart = () => onStart?.()
      utter.onend = () => onEnd?.()
      utter.onerror = () => onEnd?.()
      window.speechSynthesis.speak(utter)
    },
    [onStart, onEnd]
  )

  const cancel = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
  }, [])

  useEffect(() => () => cancel(), [cancel])

  return { supported, speak, cancel }
}
