'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  REAL_MODE_INTRO_QUESTION,
  getMainQuestionsByCategory,
  getQuestionsByCategory,
  getRandomClosingQuestion,
  shuffle,
  type BankFollowUp,
  type BankQuestion,
} from '@/lib/questionBank'
import { evaluateAnswer } from '../lib/evaluateAnswer'
import { decideFollowUp } from '../lib/followUpEngine'
import { loadUserCustomTerms, normalizeTranscript, findSuggestion, type CustomTerm } from '../lib/transcriptNormalizer'
import { MODE_TO_CATEGORY } from '../constants'
import type { InterviewPhase, LastFeedback } from '../types'
import type { ParsedResume } from '@/lib/resume/types'
import { buildResumeMainQuestions } from '@/lib/resume/resumeQuestions'
import { buildResumeFollowUps } from '@/lib/resume/followUpSynth'

const RESUME_STORAGE_KEY = 'kmove_resume'

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
  const [isFinalQuestion, setIsFinalQuestion] = useState(false)
  const askedFollowUpsRef = useRef<Set<string>>(new Set())
  const resumeExtraRulesRef = useRef<BankFollowUp[]>([])
  const resumeExtraQuestionsRef = useRef<BankQuestion[]>([])

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

      // 이력서 업로드(/interview/resume)를 거쳤다면 그 결과에서 뽑은 질문·꼬리질문을 기존
      // 무작위 풀과 섞어 쓴다. 로그인 사용자는 Supabase(user_resumes)에서, 게스트는
      // sessionStorage에서만 읽는다(게스트 데이터는 Supabase에 절대 쓰지 않음).
      let parsedResume: ParsedResume | null = null
      if (guest) {
        try {
          const raw = sessionStorage.getItem(RESUME_STORAGE_KEY)
          parsedResume = raw ? (JSON.parse(raw) as ParsedResume) : null
        } catch {
          parsedResume = null
        }
      } else {
        const { data: resumeRow } = await supabase
          .from('user_resumes')
          .select('parsed_data')
          .eq('user_id', data.user.id)
          .maybeSingle()
        parsedResume = (resumeRow?.parsed_data as ParsedResume | undefined) ?? null
      }

      const categories = MODE_TO_CATEGORY[mode] ?? ['personality']
      const isRealMode = mode === 'real'

      let resumeMainQuestions: BankQuestion[] = []
      if (parsedResume) {
        // 이력서 질문도 다른 메인 풀과 똑같이 모드의 카테고리 필터를 따라야 한다 — 그렇지 않으면
        // "기술 면접"(categories=['technical']) 모드에도 personality/culture_fit인 자소서
        // 질문이 섞여 들어와 모드 취지에 어긋난다.
        resumeMainQuestions = buildResumeMainQuestions(parsedResume).filter((q) => categories.includes(q.category))
        const synth = buildResumeFollowUps(parsedResume)
        resumeExtraRulesRef.current = synth.rules
        resumeExtraQuestionsRef.current = synth.questions
      }

      // 질문 은행이 대폭 늘어난 것을 세션에도 반영해 한 번에 더 다양한 질문이 나오게 한다.
      // 모드별로 실제 이용 가능한 풀 크기가 다르므로(예: technical 모드는 technical 카테고리만
      // 씀) 모드마다 poolSize를 다르게 둔다 — 풀 크기에 너무 가까우면 세션마다 거의 같은
      // 조합만 나오게 된다. (카테고리별 실제 보유 개수는 data/questions.json 참고 — 늘어나면
      // 이 값도 다시 검토할 것.)
      const poolSize = isRealMode ? 16 : mode === 'technical' ? 18 : 20
      // 이력서 질문 개수만큼 무작위 풀에서 뺀 나머지로 채워 세션 총 질문 수는 그대로 유지한다.
      const randomPool = shuffle(getMainQuestionsByCategory(categories)).slice(
        0,
        Math.max(poolSize - resumeMainQuestions.length, 0)
      )
      const pool = shuffle([...resumeMainQuestions, ...randomPool])
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
      await supabase.from('session_answers').insert({
        session_id: sessionId,
        question_id: isFollowUp ? null : currentQuestion.id,
        follow_up_question_id: isFollowUp ? currentQuestion.id : null,
        stt_raw_text: rawText,
        corrected_answer_text: finalText,
        question_text_snapshot: currentQuestion.textJa,
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
        askedFollowUpsRef.current,
        resumeExtraRulesRef.current,
        resumeExtraQuestionsRef.current,
        analysis
      )
      if (followUpQuestion) {
        askedFollowUpsRef.current.add(followUpQuestion.id)
        setIsFollowUp(true)
        // 꼬리질문을 큐에 실제로 끼워 넣어서(현재 위치 바로 다음) "질문 X / Y"에 꼬리질문까지
        // 포함되게 한다 — 이전에는 currentQuestion만 바꾸고 questions/queueIndex는 그대로라
        // 꼬리질문이 진행 표시에 전혀 반영되지 않았다.
        setQuestions((prev) => {
          const next = [...prev]
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
