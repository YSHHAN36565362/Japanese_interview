'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  REAL_MODE_INTRO_QUESTION,
  getQuestionsByCategory,
  getRandomClosingQuestion,
  sampleMainQuestions,
  type BankQuestion,
  type JobTrack,
} from '@/lib/questionBank'
import { evaluateAnswer } from '../lib/evaluateAnswer'
import { decideFollowUp } from '../lib/followUpEngine'
import { loadUserCustomTerms, normalizeTranscript, findSuggestion, type CustomTerm } from '../lib/transcriptNormalizer'
import { MODE_TO_CATEGORY } from '../constants'
import type { InterviewPhase, LastFeedback } from '../types'

export function useInterviewMachine({
  sessionId,
  mode,
  track,
}: {
  sessionId: string
  mode: string
  track?: JobTrack
}) {
  const router = useRouter()

  const [phase, setPhase] = useState<InterviewPhase>('preflight')
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [questions, setQuestions] = useState<BankQuestion[]>([])
  const [queueIndex, setQueueIndex] = useState(0)
  const [currentQuestion, setCurrentQuestion] = useState<BankQuestion | null>(null)
  const [isFollowUp, setIsFollowUp] = useState(false)
  const [isFinalQuestion, setIsFinalQuestion] = useState(false)
  const askedFollowUpsRef = useRef<Set<string>>(new Set())

  const [interimTranscript, setInterimTranscript] = useState('')
  const [draftTranscript, setDraftTranscript] = useState('')
  const [suggestion, setSuggestion] = useState<{ from: string; to: string } | null>(null)
  const [lastFeedback, setLastFeedback] = useState<LastFeedback | null>(null)

  const [sttSupported, setSttSupported] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isGuest, setIsGuest] = useState(false)

  const startedAtRef = useRef<number>(Date.now())
  const firstSpeechAtRef = useRef<number | null>(null)
  const customTermsRef = useRef<CustomTerm[]>([])
  const isGuestRef = useRef(false)

  // 세션 사용자 확인 + 질문 큐 구성 (data/questions.json에서 로컬 로딩, 매번 셔플)
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.replace('/login')
        return
      }
      setUserId(data.user.id)
      // "번호 없이 시작하기"(익명 로그인)로 들어온 게스트는 아무것도 저장하지 않는다 —
      // 고유 번호를 입력해야만 그 다음부터 저장된다.
      const guest = data.user.is_anonymous ?? false
      isGuestRef.current = guest
      setIsGuest(guest)
      customTermsRef.current = guest ? [] : await loadUserCustomTerms(data.user.id)

      const categories = MODE_TO_CATEGORY[mode] ?? ['personality']
      const isRealMode = mode === 'real'
      // 질문 은행이 대폭 늘어난 것을 세션에도 반영해 한 번에 더 다양한 질문이 나오게 한다.
      // 모드별로 실제 이용 가능한 풀 크기가 다르므로(기술 면접은 technical 단독) 모드마다
      // poolSize를 다르게 둔다 — 풀 크기에 너무 가까우면 세션마다 거의 같은 조합만 나오게 된다.
      // 2026-09-02: "16개는 너무 적다, 꼬리질문 제외 30개 정도는 되어야 한다"는 요청으로
      // 세 모드 모두 상당히 늘렸다(대분류 총량이 149→170개로 늘어난 것도 반영).
      const poolSize = isRealMode ? 28 : mode === 'technical' ? 24 : 30
      // 비슷한 주제의 질문(예: 스트레스 해소법 여러 버전)이 한 세션에 같이 나오지 않도록,
      // group이 같은 질문 중 하나만 무작위로 골라서 풀을 구성한다. 실전 모드에서 지원 직무
      // (소프트웨어/반도체)를 골랐다면 그 track과 안 맞는 전용 질문은 애초에 후보에서 뺀다.
      const pool = sampleMainQuestions(categories, poolSize, isRealMode ? track : undefined)
      // 실전 모드는 자기소개로 시작해서, 마지막엔 항상 역질문("최後に、何か質問はありますか。")으로 마무리한다.
      // 역질문 모드는 더 이상 별도 모드로 선택하지 않는다.
      const reverseQuestions = isRealMode ? getQuestionsByCategory(['reverse']) : []
      const finalQuestions = isRealMode ? [REAL_MODE_INTRO_QUESTION, ...pool, ...reverseQuestions] : pool

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

  // 면접관 음성이 끝나면, 마이크를 쓸 수 있는 경우 바로 답변 녹음을 시작한다(자동 마이크 on).
  // 텍스트 모드(sttSupported=false)인 경우에는 questionReady로 두어 사용자가 직접 입력하게 한다.
  const handleTtsEnded = useCallback(() => {
    setPhase((p) => (p === 'interviewerSpeaking' ? (sttSupported ? 'listening' : 'questionReady') : p))
  }, [sttSupported])

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

    if (!isGuestRef.current) {
      const { error: saveError } = await supabase.from('session_answers').insert({
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
      // 이 insert 실패를 그동안 아무 데도 표시하지 않아서, 저장이 실패해도 사용자는 계속
      // 다음 질문으로 넘어가며 답변이 전혀 저장되지 않는 것을 전혀 알 수 없었다(2026-09-02
      // 실제 배포본에서 발견 — Supabase 스키마 불일치로 매 답변이 조용히 실패하고 있었음).
      // 면접 흐름 자체는 막지 않되, 화면에 눈에 띄는 경고를 남겨서 최소한 알아챌 수 있게 한다.
      if (saveError) {
        setError(`답변 저장에 실패했습니다 (진행은 계속됩니다): ${saveError.message}`)
      }

      if (suggestion) {
        await supabase.from('user_custom_terms').upsert(
          { user_id: userId, spoken_variation: suggestion.from, correct_term: suggestion.to, category: 'tech' },
          { onConflict: 'user_id,spoken_variation' }
        )
        customTermsRef.current = [...customTermsRef.current, { spoken_variation: suggestion.from, correct_term: suggestion.to }]
      }
    }

    // "마지막 질문하기" 버튼으로 들어온 질문(final_word)에 답했다면, 꼬리질문 없이 바로 면접을 종료한다.
    if (isFinalQuestion) {
      setSaving(false)
      setPhase('completed')
      return
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
        // 꼬리질문을 큐에 실제로 끼워 넣어서(현재 위치 바로 다음) "질문 X / Y"에 꼬리질문까지
        // 포함되게 한다 — 이전에는 currentQuestion만 바꾸고 questions/queueIndex는 그대로라
        // 꼬리질문이 진행 표시에 전혀 반영되지 않았다.
        setQuestions((prev) => {
          // 꼬리질문의 대상이 대분류 질문(예: team_project)이라, 세션 시작 시 뽑힌 풀에
          // 이미 예정되어 있을 수도 있다 — 그대로 두면 지금 꼬리질문으로 물어보고 나서
          // 나중에 또 같은 질문이 나온다. 지금 물어볼 것이므로 이후 자리에 남아있는 같은
          // id는 미리 제거해서 같은 질문이 세션에서 두 번 나오지 않게 한다.
          const next = prev.filter((q) => q.id !== followUpQuestion.id)
          next.splice(queueIndex + 1, 0, followUpQuestion)
          return next
        })
        setQueueIndex((idx) => idx + 1)
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
  }, [currentQuestion, userId, draftTranscript, interimTranscript, isFollowUp, isFinalQuestion, suggestion, sessionId, queueIndex])

  // "꼬리질문 종료" 버튼: 지금 답변은 저장하되, 꼬리질문 판단은 건너뛰고 바로 다음 대분류 질문으로.
  const endFollowUp = useCallback(() => confirmAnswer({ skipFollowUp: true }), [confirmAnswer])

  // "마지막 질문하기" 버튼: 'closing' 태그가 붙은 여러 마무리 질문(final_word 포함) 중
  // 하나를 무작위로 골라 등장시킨다 — 매번 다른 질문이 나온다. 이 태그가 붙은 질문들은
  // 무작위 첫 질문 풀에는 섞이지 않고, 이 버튼을 눌렀을 때만 등장한다.
  const requestFinalQuestion = useCallback(() => {
    const finalQuestion = getRandomClosingQuestion()
    if (!finalQuestion) return
    setIsFollowUp(false)
    setIsFinalQuestion(true)
    setCurrentQuestion(finalQuestion)
    resetForQuestion()
    setPhase('questionReady')
  }, [])

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
    isGuest,
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
    requestFinalQuestion,
    requestEnd,
  }
}

export type InterviewMachine = ReturnType<typeof useInterviewMachine>
