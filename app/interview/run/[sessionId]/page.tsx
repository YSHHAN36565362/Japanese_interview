'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { speakJapanese } from '@/lib/webSpeech'
import { useSpeechRecognition } from '@/lib/useSpeechRecognition'
import { analyzeAnswer } from '@/lib/feedback'
import { matchFollowUpRule } from '@/lib/followUp'
import { TECH_TERM_MAP } from '@/lib/techTerms'
import WaveformVisualizer from '@/components/WaveformVisualizer'
import type { FollowUpRule, Question, UserSettings } from '@/lib/types'

const MODE_TO_CATEGORY: Record<string, string[]> = {
  practice: ['personality', 'technical', 'culture_fit'],
  real: ['personality', 'technical', 'culture_fit'],
  technical: ['technical'],
  reverse: ['reverse'],
}

export default function InterviewRunPage() {
  const params = useParams<{ sessionId: string }>()
  const searchParams = useSearchParams()
  const mode = searchParams.get('mode') ?? 'practice'
  const router = useRouter()

  const [userId, setUserId] = useState<string | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [rulesByQuestion, setRulesByQuestion] = useState<Record<string, FollowUpRule[]>>({})
  const [loading, setLoading] = useState(true)

  const [queueIndex, setQueueIndex] = useState(0)
  const [activeQuestion, setActiveQuestion] = useState<Question | null>(null)
  const [isFollowUp, setIsFollowUp] = useState(false)
  const [askedFollowUps, setAskedFollowUps] = useState<Set<string>>(new Set())

  const [answerText, setAnswerText] = useState('')
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [suggestion, setSuggestion] = useState<{ from: string; to: string } | null>(null)

  const [saving, setSaving] = useState(false)
  const [finished, setFinished] = useState(false)

  const rec = useSpeechRecognition()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.replace('/login')
        return
      }
      setUserId(data.user.id)

      const { data: settingsRow } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', data.user.id)
        .maybeSingle()
      const settings = settingsRow as UserSettings | null

      const categories = MODE_TO_CATEGORY[mode] ?? ['personality']
      const jlptLevel = settings?.jlpt_level_estimate

      let query = supabase
        .from('questions')
        .select('*')
        .in('category', categories)
        .order('created_at', { ascending: true })
        .limit(6)
      if (jlptLevel) {
        query = query.eq('jlpt_level', jlptLevel)
      }

      let { data: qs } = await query
      if (!qs || qs.length === 0) {
        const fallback = await supabase.from('questions').select('*').in('category', categories).limit(6)
        qs = fallback.data ?? []
      }
      setQuestions((qs ?? []) as Question[])

      if (qs && qs.length > 0) {
        const ids = qs.map((q) => q.id)
        const { data: rules } = await supabase.from('follow_up_rules').select('*').in('parent_question_id', ids)
        const grouped: Record<string, FollowUpRule[]> = {}
        for (const r of (rules ?? []) as FollowUpRule[]) {
          grouped[r.parent_question_id] = grouped[r.parent_question_id] ?? []
          grouped[r.parent_question_id].push(r)
        }
        setRulesByQuestion(grouped)
        setActiveQuestion(qs[0] as Question)
      }
      setLoading(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  useEffect(() => {
    if (activeQuestion) {
      resetForNewQuestion()
      speakJapanese(activeQuestion.text_ja)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeQuestion])

  useEffect(() => {
    if (finished) {
      router.push(`/interview/result/${params.sessionId}`)
    }
  }, [finished, params.sessionId, router])

  function resetForNewQuestion() {
    setAnswerText('')
    setStartedAt(Date.now())
    setSuggestion(null)
    rec.setTranscript('')
  }

  function handleStartMic() {
    setStartedAt((prev) => prev ?? Date.now())
    rec.start()
  }

  function handleStopMic() {
    rec.stop()
    setAnswerText(rec.transcript)
    checkSuggestion(rec.transcript)
  }

  function checkSuggestion(text: string) {
    for (const [from, to] of Object.entries(TECH_TERM_MAP)) {
      if (text.includes(from)) {
        setSuggestion({ from, to })
        return
      }
    }
    setSuggestion(null)
  }

  function applySuggestion() {
    if (!suggestion) return
    setAnswerText((prev) => (prev || rec.transcript).split(suggestion.from).join(suggestion.to))
    setSuggestion(null)
  }

  async function submitAnswer() {
    if (!activeQuestion || !userId) return
    setSaving(true)
    const supabase = createClient()
    const finalText = answerText || rec.transcript
    const durationSeconds = startedAt ? (Date.now() - startedAt) / 1000 : 0
    const latency =
      startedAt && rec.firstSpeechAt ? Number(((rec.firstSpeechAt - startedAt) / 1000).toFixed(2)) : null
    const analysis = analyzeAnswer(finalText)

    await supabase.from('session_answers').insert({
      session_id: params.sessionId,
      question_id: isFollowUp ? null : activeQuestion.id,
      follow_up_question_id: isFollowUp ? activeQuestion.id : null,
      stt_raw_text: rec.transcript,
      corrected_answer_text: finalText,
      duration_seconds: durationSeconds,
      latency_to_first_speech_sec: latency,
      politeness_score_ratio: analysis.politenessRatio,
      filler_counts: analysis.fillerBreakdown,
      feedback_result: analysis,
    })

    if (suggestion) {
      await supabase.from('user_custom_terms').upsert(
        {
          user_id: userId,
          spoken_variation: suggestion.from,
          correct_term: suggestion.to,
          category: 'tech',
        },
        { onConflict: 'user_id,spoken_variation' }
      )
    }

    setSaving(false)
    advance(finalText, durationSeconds)
  }

  function advance(answeredText: string, durationSeconds: number) {
    if (!isFollowUp && activeQuestion) {
      const rules = rulesByQuestion[activeQuestion.id] ?? []
      const availableRules = rules.filter((r) => !askedFollowUps.has(r.follow_up_question_id))
      const matched = matchFollowUpRule(availableRules, answeredText, durationSeconds, activeQuestion.expected_duration_sec)
      if (matched) {
        setAskedFollowUps((prev) => new Set(prev).add(matched.follow_up_question_id))
        loadFollowUpQuestion(matched.follow_up_question_id)
        return
      }
    }
    goToNextMainQuestion()
  }

  async function loadFollowUpQuestion(id: string) {
    const supabase = createClient()
    const { data } = await supabase.from('questions').select('*').eq('id', id).maybeSingle()
    if (data) {
      setIsFollowUp(true)
      setActiveQuestion(data as Question)
    } else {
      goToNextMainQuestion()
    }
  }

  function goToNextMainQuestion() {
    setIsFollowUp(false)
    const nextIndex = queueIndex + 1
    if (nextIndex >= questions.length) {
      setFinished(true)
      return
    }
    setQueueIndex(nextIndex)
    setActiveQuestion(questions[nextIndex])
  }

  if (loading) return <p>질문을 불러오는 중입니다...</p>
  if (questions.length === 0) {
    return <p>표시할 질문이 없습니다. supabase/seed.sql이 실행되었는지 확인해주세요.</p>
  }
  if (!activeQuestion) return null

  return (
    <div className="interview-layout">
      <div className="card">
        <span className="badge">{isFollowUp ? '꼬리 질문' : `${queueIndex + 1} / ${questions.length}`}</span>
        <h2 className="question-ja">{activeQuestion.text_ja}</h2>
        {activeQuestion.text_ko && <p className="muted">{activeQuestion.text_ko}</p>}
        <button className="btn" onClick={() => speakJapanese(activeQuestion.text_ja)}>
          다시 듣기 (TTS)
        </button>
      </div>

      <div className="card">
        <div className="mic-row">
          <button className="btn btn-primary" onClick={handleStartMic} disabled={rec.listening}>
            🎤 답변 시작
          </button>
          <button className="btn" onClick={handleStopMic} disabled={!rec.listening}>
            ⏹ 인식 중지
          </button>
          {rec.listening && <WaveformVisualizer />}
        </div>
        {!rec.supported && (
          <p className="badge badge-warn">
            이 브라우저는 음성 인식을 지원하지 않습니다. 아래 텍스트창에 답변을 직접 입력해주세요.
          </p>
        )}
        <textarea
          className="answer-box"
          rows={5}
          value={answerText || rec.transcript}
          onChange={(e) => setAnswerText(e.target.value)}
          placeholder="음성 인식 결과가 여기에 실시간으로 표시됩니다. 필요하면 직접 수정하세요."
        />
        {suggestion && (
          <p className="badge badge-warn">
            혹시 &quot;{suggestion.to}&quot;를 의도하셨나요?
            <button className="btn btn-small" onClick={applySuggestion}>
              적용
            </button>
          </p>
        )}
        <button
          className="btn btn-primary"
          onClick={submitAnswer}
          disabled={saving || !(answerText || rec.transcript)}
        >
          {saving ? '저장 중...' : '답변 제출'}
        </button>
      </div>
    </div>
  )
}
