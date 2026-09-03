'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  REAL_MODE_INTRO_QUESTION,
  getBasicTrackQuestions,
  getQuestionById,
  getQuestionsByCategory,
  getRandomClosingQuestion,
  sampleMainQuestions,
  shuffle,
  type BankFollowUp,
  type BankQuestion,
  type JobTrack,
} from '@/lib/questionBank'
import { applyResumePriority } from '@/lib/resumeKeywords'
import { RESUME_PRIORITY_STORAGE_KEY } from '@/lib/resumePriorityStorage'
import { evaluateAnswer } from '../lib/evaluateAnswer'
import { decideFollowUp } from '../lib/followUpEngine'
import { loadUserCustomTerms, normalizeTranscript, findSuggestion, type CustomTerm } from '../lib/transcriptNormalizer'
import { MODE_TO_CATEGORY } from '../constants'
import type { InterviewPhase, LastFeedback } from '../types'
import type { ParsedResume } from '@/lib/resume/types'
import { buildResumeMainQuestions } from '@/lib/resume/resumeQuestions'
import { buildResumeFollowUps } from '@/lib/resume/followUpSynth'

const RESUME_STORAGE_KEY = 'kmove_resume'

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

      // 모드별로 실제 이용 가능한 풀 크기가 다르므로(기술 면접은 technical 단독) 모드마다
      // poolSize를 다르게 둔다 — 풀 크기에 너무 가까우면 세션마다 거의 같은 조합만 나오게 된다.
      // 2026-09-02: "16개는 너무 적다, 꼬리질문 제외 30개 정도는 되어야 한다"는 요청으로
      // 세 모드 모두 상당히 늘렸다(대분류 총량이 149→170개로 늘어난 것도 반영).
      const poolSize = isRealMode ? 28 : mode === 'technical' ? 24 : 30
      // 비슷한 주제의 질문(예: 스트레스 해소법 여러 버전)이 한 세션에 같이 나오지 않도록,
      // group이 같은 질문 중 하나만 무작위로 골라서 풀을 구성한다. 실전 모드에서 지원 직무
      // (소프트웨어/반도체)를 골랐다면 그 track과 안 맞는 전용 질문은 애초에 후보에서 뺀다.
      // "기본 모드"(general)는 무작위 추출이 아니라, 실제 면접에서 거의 항상 나오는 대표
      // 질문 12개를 정해진 순서 그대로 쓴다(getBasicTrackQuestions).
      const isBasicTrack = isRealMode && track === 'general'
      // 실전 모드는 REAL_MODE_INTRO_QUESTION이 이미 자기소개 역할을 하므로, 대분류 풀에
      // 있는 self_intro("自己紹介をお願いします。")가 무작위로 또 뽑혀서 자기소개를 두 번
      // 묻는 일이 없도록 실전 모드에서만 제외한다.
      // (docx 이력서) 질문 개수만큼 무작위 풀에서 뺀 나머지로 채워 세션 총 질문 수는 그대로
      // 유지한다 — 기본 트랙은 고정 12개라 이 크기 조정 대상이 아니다.
      const randomPoolSize = Math.max(poolSize - resumeMainQuestions.length, 0)
      let pool = isBasicTrack
        ? getBasicTrackQuestions()
        : sampleMainQuestions(
            categories,
            randomPoolSize,
            isRealMode ? track : undefined,
            isRealMode ? ['self_intro'] : undefined
          )
      // 실전 모드(기본 트랙 제외) 시작 직전에 이력서/자기소개를 붙여넣었다면(ResumeInputStep,
      // app/interview/page.tsx), 그 키워드로 매칭된 질문을 세션 풀에 우선 포함시킨다.
      // 기본 모드는 고정 목록이라 적용하지 않는다.
      if (isRealMode && !isBasicTrack && typeof window !== 'undefined') {
        const raw = window.sessionStorage.getItem(RESUME_PRIORITY_STORAGE_KEY)
        window.sessionStorage.removeItem(RESUME_PRIORITY_STORAGE_KEY)
        if (raw) {
          try {
            const priorityIds = JSON.parse(raw) as string[]
            pool = applyResumePriority(pool, priorityIds)
          } catch {
            // 파싱 실패 시 그냥 원래 풀을 그대로 쓴다.
          }
        }
      }
      // .docx로 업로드한 이력서(app/interview/resume)에서 뽑은 질문(자소서/경력/희망직종)을
      // 무작위 풀과 섞는다. ResumeInputStep(텍스트 붙여넣기, 위 블록)이 이미 pool의 순서를
      // 조정했더라도 이 질문들은 그와 별개로 항상 포함된다 — 서로 다른 자료(파싱된 구조 vs
      // 붙여넣은 원문)에서 나온 것이라 하나를 배제할 이유가 없다. 기본 트랙(고정 12개, 항상
      // 같은 순서)은 이 취지를 해치므로 섞지 않는다.
      if (resumeMainQuestions.length > 0 && !isBasicTrack) {
        pool = shuffle([...resumeMainQuestions, ...pool])
      }
      // 실전 모드는 자기소개로 시작한다. 마무리는 기본 모드만 "마지막으로 하고 싶은 말"
      // (final_word)로 끝내고, 소프트웨어/반도체 트랙은 그대로 역질문
      // ("最後に、何か質問はありますか。")으로 마무리한다.
      const closingQuestions = isRealMode
        ? isBasicTrack
          ? [getQuestionById('final_word')].filter((q): q is BankQuestion => !!q)
          : getQuestionsByCategory(['reverse'])
        : []
      const finalQuestions = isRealMode ? [REAL_MODE_INTRO_QUESTION, ...pool, ...closingQuestions] : pool

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
        question_text_snapshot: currentQuestion.textJa,
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
