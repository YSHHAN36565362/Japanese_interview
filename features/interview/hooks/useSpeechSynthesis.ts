'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { VOICEVOX_PREFIX, VOICEVOX_SPEAKERS, synthesizeVoicevox } from '@/lib/voicevoxTts'

interface Options {
  onStart?: () => void
  onEnd?: () => void
}

const VOICE_STORAGE_KEY = 'voiceInterviewJp:ttsVoiceURI'
const RATE_STORAGE_KEY = 'voiceInterviewJp:ttsRate'
const PITCH_STORAGE_KEY = 'voiceInterviewJp:ttsPitch'
const DEFAULT_RATE = 0.95
const MIN_RATE = 0.5
const MAX_RATE = 1.4
const DEFAULT_PITCH = 1
const MIN_PITCH = 0.5
const MAX_PITCH = 1.5

export type VoiceOption = { id: string; name: string }
export type SpeakingBoundary = { charIndex: number; charLength: number } | null

// 질문 낭독 전용 TTS 훅. 재생 중에는 STT를 시작하지 않도록 onStart/onEnd 콜백으로
// 면접 상태 머신에 TTS_STARTED/TTS_ENDED 이벤트를 보낸다 (가이드 §7-4).
// 기본값은 브라우저(OS)가 무료로 제공하는 일본어 음성(Web Speech API)이고, 여기에 더해
// 무료 VOICEVOX 음성(외부, tts.quest 경유)도 선택지로 추가했다 — 다만 이건 비공식 키리스
// 경로라 불안정할 수 있어서, 실패하면 조용히 넘어가고 절대 면접 진행을 막지 않는다.
export function useSpeechSynthesis({ onStart, onEnd }: Options) {
  const [supported, setSupported] = useState(true)
  const [nativeVoices, setNativeVoices] = useState<SpeechSynthesisVoice[]>([])
  const [voiceURI, setVoiceURIState] = useState<string>('')
  const [rate, setRateState] = useState<number>(DEFAULT_RATE)
  const [pitch, setPitchState] = useState<number>(DEFAULT_PITCH)
  const [speakingBoundary, setSpeakingBoundary] = useState<SpeakingBoundary>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const savedRate = Number(window.localStorage.getItem(RATE_STORAGE_KEY))
    if (savedRate && savedRate >= MIN_RATE && savedRate <= MAX_RATE) setRateState(savedRate)
    const savedPitch = Number(window.localStorage.getItem(PITCH_STORAGE_KEY))
    if (savedPitch && savedPitch >= MIN_PITCH && savedPitch <= MAX_PITCH) setPitchState(savedPitch)
  }, [])

  const setRate = useCallback((next: number) => {
    const clamped = Math.min(MAX_RATE, Math.max(MIN_RATE, Math.round(next * 100) / 100))
    setRateState(clamped)
    if (typeof window !== 'undefined') window.localStorage.setItem(RATE_STORAGE_KEY, String(clamped))
    if (audioRef.current) audioRef.current.playbackRate = clamped
  }, [])

  // 피치(음높이)는 브라우저 기본 음성(SpeechSynthesisUtterance.pitch)에만 적용된다 —
  // VOICEVOX는 외부 오디오 파일을 그대로 재생하는 방식이라 피치를 실시간으로 바꿀 수 없다.
  const setPitch = useCallback((next: number) => {
    const clamped = Math.min(MAX_PITCH, Math.max(MIN_PITCH, Math.round(next * 100) / 100))
    setPitchState(clamped)
    if (typeof window !== 'undefined') window.localStorage.setItem(PITCH_STORAGE_KEY, String(clamped))
  }, [])

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
      utter.rate = rate
      utter.pitch = pitch
      // React state(nativeVoices)는 최초 몇 번의 재생 시점엔 아직 비어있을 수 있어서(음성
      // 목록이 비동기로 채워지는 도중), 그 state만 보고 매칭하면 목소리를 못 찾아
      // utter.voice가 비워진 채 브라우저가 임의로 고르는 기본값이 나가버려 "분명 같은
      // 설정인데 가끔 다른 목소리가 나온다"는 문제가 있었다. window.speechSynthesis.
      // getVoices()는 항상 그 순간의 실제 목록을 동기로 돌려주므로, 이걸 우선 사용해서
      // 매번 같은 voiceURI가 같은 목소리로 확실히 연결되게 한다.
      const liveVoices = window.speechSynthesis.getVoices()
      const selected =
        liveVoices.find((v) => v.voiceURI === voiceURI) ?? nativeVoices.find((v) => v.voiceURI === voiceURI)
      if (selected) utter.voice = selected
      utter.onstart = () => {
        setSpeakingBoundary(null)
        onStart?.()
      }
      utter.onend = () => {
        setSpeakingBoundary(null)
        onEnd?.()
      }
      utter.onerror = () => {
        setSpeakingBoundary(null)
        onEnd?.()
      }
      // 브라우저가 일본어처럼 띄어쓰기가 없는 언어에서는 charLength를 안 주는 경우가 많아서,
      // 없으면 글자 하나 단위로 잡는다 — 요미가나 점처럼 "지금 읽고 있는 글자"만 짚어주는
      // 용도라 오히려 한 글자씩 정확히 짚는 편이 더 자연스럽다.
      utter.onboundary = (e: SpeechSynthesisEvent) => {
        const charLength = (e as unknown as { charLength?: number }).charLength || 1
        setSpeakingBoundary({ charIndex: e.charIndex, charLength })
      }
      window.speechSynthesis.speak(utter)
    },
    [onStart, onEnd, nativeVoices, voiceURI, rate, pitch]
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
      setSpeakingBoundary(null)
      onStart?.()
      synthesizeVoicevox(text, speakerId, controller.signal)
        .then((objectUrl) => {
          if (controller.signal.aborted) return
          const audio = new Audio(objectUrl)
          audio.playbackRate = rate
          audioRef.current = audio
          audio.onended = () => onEnd?.()
          // 재생 자체가 실패하면(자동재생 차단 등) 그냥 무음으로 넘어가지 않고 브라우저
          // 기본 음성으로 즉시 대체해서, 최소한 질문은 항상 소리로 들리게 한다.
          audio.onerror = () => speakNative(text)
          audio.play().catch(() => speakNative(text))
        })
        .catch(() => {
          // 외부 음성 합성 실패(키리스 경로 불안정, 요청 제한 등) — 무음으로 넘어가는 대신
          // 브라우저 기본 음성(native TTS)으로 자동 대체한다. 질문이 안 들리고 그냥
          // 답변 단계로 넘어가버리는 문제를 막기 위함.
          if (!controller.signal.aborted) speakNative(text)
        })
    },
    [voiceURI, speakNative, onStart, onEnd, rate]
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
    setSpeakingBoundary(null)
  }, [])

  useEffect(() => () => cancel(), [cancel])

  return {
    supported,
    speak,
    cancel,
    voices,
    voiceURI,
    setVoiceURI,
    rate,
    setRate,
    defaultRate: DEFAULT_RATE,
    minRate: MIN_RATE,
    maxRate: MAX_RATE,
    pitch,
    setPitch,
    defaultPitch: DEFAULT_PITCH,
    minPitch: MIN_PITCH,
    maxPitch: MAX_PITCH,
    speakingBoundary,
  }
}
