'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { VOICEVOX_PREFIX, VOICEVOX_SPEAKERS, synthesizeVoicevox } from '@/lib/voicevoxTts'

interface Options {
  onStart?: () => void
  onEnd?: () => void
}

const VOICE_STORAGE_KEY = 'voiceInterviewJp:ttsVoiceURI'

export type VoiceOption = { id: string; name: string }

// 질문 낭독 전용 TTS 훅. 재생 중에는 STT를 시작하지 않도록 onStart/onEnd 콜백으로
// 면접 상태 머신에 TTS_STARTED/TTS_ENDED 이벤트를 보낸다 (가이드 §7-4).
// 기본값은 브라우저(OS)가 무료로 제공하는 일본어 음성(Web Speech API)이고, 여기에 더해
// 무료 VOICEVOX 음성(외부, tts.quest 경유)도 선택지로 추가했다 — 다만 이건 비공식 키리스
// 경로라 불안정할 수 있어서, 실패하면 조용히 넘어가고 절대 면접 진행을 막지 않는다.
export function useSpeechSynthesis({ onStart, onEnd }: Options) {
  const [supported, setSupported] = useState(true)
  const [nativeVoices, setNativeVoices] = useState<SpeechSynthesisVoice[]>([])
  const [voiceURI, setVoiceURIState] = useState<string>('')
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const refreshVoices = useCallback(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    const jaVoices = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('ja'))
    // 브라우저가 처음엔 일부(가끔 1개)만 동기로 반환하고 나머지는 비동기로 채워준다.
    // 그런데 onvoiceschanged가 안 뜨는 브라우저/환경도 있어서, 새로 얻은 목록이 기존보다
    // 줄어들지만 않으면(0개로 리셋되는 경우 방지) 항상 최신 목록으로 갱신한다.
    setNativeVoices((prevVoices) => (jaVoices.length >= prevVoices.length ? jaVoices : prevVoices))
    setVoiceURIState((prev) => {
      if (prev) return prev
      const saved = window.localStorage.getItem(VOICE_STORAGE_KEY)
      if (saved && (jaVoices.some((v) => v.voiceURI === saved) || saved.startsWith(VOICEVOX_PREFIX))) return saved
      const kyoko = jaVoices.find((v) => v.name === 'Kyoko')
      return (kyoko ?? jaVoices[0])?.voiceURI ?? prev
    })
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setSupported(false)
      return
    }
    setSupported(true)

    refreshVoices()
    window.speechSynthesis.onvoiceschanged = refreshVoices
    // onvoiceschanged 이벤트가 안 뜨는 환경을 대비해, 마운트 직후 한동안 몇 번 더 재조회한다
    // (전체 음성 목록을 비동기로 채우는 데 다소 시간이 걸리는 브라우저가 있다).
    const retryTimers = [200, 500, 1000, 2000, 3500, 5000].map((ms) => window.setTimeout(refreshVoices, ms))
    return () => {
      window.speechSynthesis.onvoiceschanged = null
      retryTimers.forEach((t) => window.clearTimeout(t))
    }
  }, [refreshVoices])

  const voices: VoiceOption[] = [
    ...nativeVoices.map((v) => ({ id: v.voiceURI, name: v.name })),
    ...VOICEVOX_SPEAKERS.map((s) => ({ id: `${VOICEVOX_PREFIX}${s.id}`, name: `${s.name} (외부 음성)` })),
  ]

  const setVoiceURI = useCallback((uri: string) => {
    setVoiceURIState(uri)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(VOICE_STORAGE_KEY, uri)
    }
  }, [])

  const speakNative = useCallback(
    (text: string) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        onEnd?.()
        return
      }
      window.speechSynthesis.cancel()
      const utter = new SpeechSynthesisUtterance(text)
      utter.lang = 'ja-JP'
      utter.rate = 0.95
      const selected = nativeVoices.find((v) => v.voiceURI === voiceURI)
      if (selected) utter.voice = selected
      utter.onstart = () => onStart?.()
      utter.onend = () => onEnd?.()
      utter.onerror = () => onEnd?.()
      window.speechSynthesis.speak(utter)
    },
    [onStart, onEnd, nativeVoices, voiceURI]
  )

  const speak = useCallback(
    (text: string) => {
      abortRef.current?.abort()
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }

      if (!voiceURI.startsWith(VOICEVOX_PREFIX)) {
        speakNative(text)
        return
      }

      const speakerId = Number(voiceURI.slice(VOICEVOX_PREFIX.length))
      const controller = new AbortController()
      abortRef.current = controller
      onStart?.()
      synthesizeVoicevox(text, speakerId, controller.signal)
        .then((objectUrl) => {
          if (controller.signal.aborted) return
          const audio = new Audio(objectUrl)
          audioRef.current = audio
          audio.onended = () => onEnd?.()
          audio.onerror = () => onEnd?.()
          audio.play().catch(() => onEnd?.())
        })
        .catch(() => {
          // 외부 음성 합성 실패(키리스 경로 불안정, 요청 제한 등) — 조용히 넘어가서
          // 면접 진행이 막히지 않게 한다. 질문 텍스트는 이미 화면에 표시되어 있다.
          if (!controller.signal.aborted) onEnd?.()
        })
    },
    [voiceURI, speakNative, onStart, onEnd]
  )

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
  }, [])

  useEffect(() => () => cancel(), [cancel])

  return { supported, speak, cancel, voices, voiceURI, setVoiceURI }
}
