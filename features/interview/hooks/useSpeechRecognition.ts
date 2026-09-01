'use client'

import { useEffect, useRef, useState } from 'react'

interface Options {
  enabled: boolean
  lang?: string
  onFinal: (text: string) => void
  onInterim: (text: string) => void
  onError?: (error: string) => void
  onFirstSpeech?: () => void
}

// 가이드 §7-2: enabled(면접 단계가 "listening"일 때만 true)에 맞춰 인식을 시작/중지하고,
// 사용자가 의도적으로 끈 경우에는 onend에서 자동 재시작하지 않는다.
export function useSpeechRecognition({ enabled, lang = 'ja-JP', onFinal, onInterim, onError, onFirstSpeech }: Options) {
  const [supported, setSupported] = useState(true)
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<any>(null)
  const finalTextRef = useRef('')
  const desiredRef = useRef(false)
  const callbacksRef = useRef({ onFinal, onInterim, onError, onFirstSpeech })
  callbacksRef.current = { onFinal, onInterim, onError, onFirstSpeech }

  useEffect(() => {
    desiredRef.current = enabled
    if (enabled) startInternal()
    else stopInternal()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  useEffect(() => {
    return () => {
      desiredRef.current = false
      recognitionRef.current?.stop()
    }
  }, [])

  function startInternal() {
    if (recognitionRef.current) return
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) {
      setSupported(false)
      callbacksRef.current.onError?.('unsupported')
      return
    }

    const recognition = new SR()
    recognition.lang = lang
    recognition.continuous = true
    recognition.interimResults = true
    finalTextRef.current = ''

    // 브라우저가 실제로 마이크를 열고 인식을 시작한 시점(onstart)에만 "듣고 있음"으로
    // 표시한다. recognition.start() 호출 직후 곧바로 listening=true로 두면, 실제로는
    // 아직 엔진이 준비되기 전이라 그 사이에 말한 초반부가 잘려서 인식되지 않는 문제가 있었다.
    recognition.onstart = () => setListening(true)
    recognition.onspeechstart = () => callbacksRef.current.onFirstSpeech?.()

    recognition.onresult = (event: any) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const chunk = event.results[i][0].transcript
        if (event.results[i].isFinal) finalTextRef.current += chunk
        else interim += chunk
      }
      callbacksRef.current.onInterim(finalTextRef.current + interim)
      if (finalTextRef.current) callbacksRef.current.onFinal(finalTextRef.current)
    }

    recognition.onerror = (e: any) => {
      callbacksRef.current.onError?.(e?.error ?? 'unknown')
    }

    recognition.onend = () => {
      recognitionRef.current = null
      setListening(false)
      // 의도적으로 끈 것이 아니라 브라우저가 스스로 종료한 경우에만 재시작한다.
      if (desiredRef.current) {
        window.setTimeout(() => {
          if (desiredRef.current) startInternal()
        }, 150)
      }
    }

    try {
      recognition.start()
      recognitionRef.current = recognition
    } catch {
      recognitionRef.current = null
    }
  }

  function stopInternal() {
    desiredRef.current = false
    recognitionRef.current?.stop()
  }

  return { supported, listening }
}
