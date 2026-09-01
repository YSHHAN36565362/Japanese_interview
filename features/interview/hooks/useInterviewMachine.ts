'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  REAL_MODE_INTRO_QUESTION,
  getQuestionsByCategory,
  shuffle,
  type BankQuestion,
} from '@/lib/questionBank'
import { evaluateAnswer } from '../lib/evaluateAnswer'
import { decideFollowUp } from '../lib/followUpEngine'
import { loadUserCustomTerms, normalizeTranscript, findSuggestion, type CustomTerm } from '../lib/transcriptNormalizer'
import { MODE_TO_CATEGORY } from '../constants'
import type { InterviewPhase, LastFeedback } from '../types'

export function useInterviewMachine({ sessionId, mode }: { sessionId: string; mode: string }) {
  const router = useRouter()

  const [phase, setPhase] = useState<InterviewPhase>('preflight')
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [questions, setQuestions] = useState<BankQuestion[]>([])
  const [queueIndex, setQueueIndex] = useState(0)
  const [currentQuestion, setCurrentQuestion] = useState<BankQuestion | null>(null)
  const [isFollowUp, setIsFollowUp] = useState(false)
  const askedFollowUpsRef = useRef<Set<string>>(new Set())

  const [interimTranscript, setInterimTranscript] = useState('')
  const [draftTranscript, setDraftTranscript] = useState('')
  const [suggestion, setSuggestion] = useState<{ from: string; to: string } | null>(null)
  const [lastFeedback, setLastFeedback] = useState<LastFeedback | null>(null)

  const [sttSupported, setSttSupported] = useState(true)
  const [saving, setSaving] = useState(false)

  const startedAtRef = useRef<number>(Date.now())
  const firstSpeechAtRef = useRef<number | null>(null)
  const customTermsRef = useRef<CustomTerm[]>([])

  // 세션 사용자 확인 + 질문 큐 구성 (data/questions.json에서 로컬 로딩, 매번 셔플)
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.replace('/login')
        return
      }
      setUserId(data.user.id)
      customTermsRef.current = await loadUserCustomTerms(data.user.id)

      const categories = MODE_TO_CATEGORY[mode] ?? ['personality']
      const isRealMode = mode === 'real'
      const poolSize = isRealMode ? 5 : 6
      const pool = shuffle(getQuestionsByCategory(categories)).slice(0, poolSize)
      const finalQuestions = isRealMode ? [REAL_MODE_INTRO_QUESTION, ...pool] : pool

      setQuestions(finalQuestions)
      setCurrentQuestion(finalQuestions[0] ?? null)
      setLoading(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  function resetForQuestion() {
    setInterimTranscript('')
    setDraftTranscript('')
    setSuggestion(null)
    startedAtRef.current = Date.now()
    firstSpeechAtRef.current = null
  }

  // preflight를 마치면(마이크 테스트 완료 또는 텍스트 모드 선택) 첫 질문으로 진입한다.
  const completePreflight = useCallback((micAvailable: boolean) => {
    setSttSupported(micAvailable)
    resetForQuestion()
    setPhase('questionReady')
  }, [])

  const handleTtsStarted = useCallback(() => setPhase('interviewerSpeaking'), [])
  const handleTtsEnded = useCallback(() => setPhase((p) => (p === 'interviewerSpeaking' ? 'questionReady' : p)), [])

  const startListening = useCallback(() => {
    if (phase !== 'questionReady') return
    setPhase('listening')
  }, [phase])

  const stopListening = useCallback(() => {
    if (phase !== 'listening') return
    setPhase('answerReview')
  }, [phase])

  const handleFirstSpeech = useCallback(() => {
    firstSpeechAtRef.current = Date.now()
  }, [])

  const handleFinalTranscript = useCallback((text: string) => {
    setDraftTranscript(text)
    const found = findSuggestion(text, customTermsRef.current)
    setSuggestion(found)
  }, [])

  const handleSpeechError = useCallback((code: string) => {
    if (code === 'unsupported' || code === 'not-allowed' || code === 'audio-capture') {
      setSttSupported(false)
    }
  }, [])

  function applySuggestion() {
    if (!suggestion) return
    setDraftTranscript((prev) => (prev || interimTranscript).split(suggestion.from).join(suggestion.to))
    setSuggestion(null)
  }

  function goToNextInQueue() {
    setIsFollowUp(false)
    const nextIndex = queueIndex + 1
    if (nextIndex >= questions.length) {
      setPhase('completed')
      return
    }
    setQueueIndex(nextIndex)
    setCurrentQuestion(questions[nextIndex])
    resetForQuestion()
    setPhase('questionReady')
  }

  // 답변 확정: 정규화 → 규칙 기반 평가 → 저장 → 꼬리질문 판단 → 다음 질문
  // skipFollowUp이 true면("꼬리질문 종료" 버튼) 꼬리질문 판단을 건너뛰고 바로 다음 대분류 질문으로 넘어간다.
  const confirmAnswer = useCallback(async (opts?: { skipFollowUp?: boolean }) => {
    if (!currentQuestion || !userId) return
    setPhase('saving')
    setSaving(true)

    const supabase = createClient()
    const rawText = draftTranscript || interimTranscript
    const finalText = normalizeTranscript(rawText, customTermsRef.current)
    const durationSeconds = (Date.now() - startedAtRef.current) / 1000
    const latency = firstSpeechAtRef.current
      ? Number(((firstSpeechAtRef.current - startedAtRef.current) / 1000).toFixed(2))
      : null
    const analysis = evaluateAnswer(finalText)
    setLastFeedback({ questionTextJa: currentQuestion.textJa, analysis })

    await supabase.from('session_answers').insert({
      session_id: sessionId,
      question_id: isFollowUp ? null : currentQuestion.id,
      follow_up_question_id: isFollowUp ? currentQuestion.id : null,
      stt_raw_text: rawText,
      corrected_answer_text: finalText,
      duration_seconds: durationSeconds,
      latency_to_first_speech_sec: latency,
      politeness_score_ratio: analysis.politenessRatio,
      filler_counts: analysis.fillerBreakdown,
      feedback_result: analysis,
    })

    if (suggestion) {
      await supabase.from('user_custom_terms').upsert(
        { user_id: userId, spoken_variation: suggestion.from, correct_term: suggestion.to, category: 'tech' },
        { onConflict: 'user_id,spoken_variation' }
      )
      customTermsRef.current = [...customTermsRef.current, { spoken_variation: suggestion.from, correct_term: suggestion.to }]
    }

    if (!opts?.skipFollowUp) {
      // isFollowUp 여부와 무관하게 항상 꼬리질문을 우선 확인한다 (꼬리질문 체인이 계속 이어질 수 있음).
      // 같은 대상 질문은 askedFollowUpsRef가 한 번만 나오도록 막아주므로 무한 루프 걱정은 없다.
      const followUpQuestion = await decideFollowUp(
        currentQuestion.id,
        finalText,
        durationSeconds,
        currentQuestion.expectedDurationSec,
        askedFollowUpsRef.current
      )
      if (followUpQuestion) {
        askedFollowUpsRef.current.add(followUpQuestion.id)
        setIsFollowUp(true)
        setCurrentQuestion(followUpQuestion)
        resetForQuestion()
        setSaving(false)
        setPhase('questionReady')
        return
      }
    }

    setSaving(false)
    goToNextInQueue()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestion, userId, draftTranscript, interimTranscript, isFollowUp, suggestion, sessionId])

  // "꼬리질문 종료" 버튼: 지금 답변은 저장하되, 꼬리질문 판단은 건너뛰고 바로 다음 대분류 질문으로.
  const endFollowUp = useCallback(() => confirmAnswer({ skipFollowUp: true }), [confirmAnswer])

  const requestEnd = useCallback(() => {
    setPhase('completed')
  }, [])

  useEffect(() => {
    if (phase === 'completed') {
      router.push(`/interview/result/${sessionId}`)
    }
  }, [phase, sessionId, router])

  return {
    phase,
    loading,
    error,
    setError,
    questions,
    queueIndex,
    currentQuestion,
    isFollowUp,
    interimTranscript,
    draftTranscript,
    setDraftTranscript,
    suggestion,
    applySuggestion,
    lastFeedback,
    sttSupported,
    saving,
    completePreflight,
    handleTtsStarted,
    handleTtsEnded,
    startListening,
    stopListening,
    handleFirstSpeech,
    handleFinalTranscript,
    setInterimTranscript,
    handleSpeechError,
    confirmAnswer,
    endFollowUp,
    requestEnd,
  }
}

export type InterviewMachine = ReturnType<typeof useInterviewMachine>
