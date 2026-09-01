'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { speakJapanese } from '@/lib/webSpeech'
import { useSpeechRecognition } from '@/lib/useSpeechRecognition'
import { useMediaRecorder } from '@/lib/useMediaRecorder'
import { analyzeAnswer } from '@/lib/feedback'
import { matchFollowUpRule } from '@/lib/followUp'
import { TECH_TERM_MAP } from '@/lib/techTerms'
import {
  REAL_MODE_INTRO_QUESTION,
  getFollowUpsFor,
  getQuestionById,
  getQuestionsByCategory,
  shuffle,
  type BankQuestion,
} from '@/lib/questionBank'
import WaveformVisualizer from '@/components/WaveformVisualizer'
import MacWindow from '@/components/MacWindow'
import LoadingDots from '@/components/LoadingDots'
import MicToggle from '@/components/MicToggle'
import CameraPreview from '@/components/CameraPreview'
import ZoomControlBar from '@/components/ZoomControlBar'

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
  const [questions, setQuestions] = useState<BankQuestion[]>([])
  const [loading, setLoading] = useState(true)

  const [queueIndex, setQueueIndex] = useState(0)
  const [activeQuestion, setActiveQuestion] = useState<BankQuestion | null>(null)
  const [isFollowUp, setIsFollowUp] = useState(false)
  const [askedFollowUps, setAskedFollowUps] = useState<Set<string>>(new Set())

  const [answerText, setAnswerText] = useState('')
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [suggestion, setSuggestion] = useState<{ from: string; to: string } | null>(null)

  const [saving, setSaving] = useState(false)
  const [finished, setFinished] = useState(false)

  const [cameraOn, setCameraOn] = useState(false)

  const rec = useSpeechRecognition()
  const videoRecorder = useMediaRecorder({ video: true, audio: true }, 'interview-video')
  const audioRecorder = useMediaRecorder({ audio: true }, 'interview-audio')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace('/login')
        return
      }
      setUserId(data.user.id)

      // 질문은 Supabase가 아니라 로컬 data/questions.json(git 관리)에서 불러온다.
      // 세션마다 순서가 매번 달라지도록 셔플한다.
      const categories = MODE_TO_CATEGORY[mode] ?? ['personality']
      const isRealMode = mode === 'real'
      const poolSize = isRealMode ? 5 : 6
      const pool = shuffle(getQuestionsByCategory(categories)).slice(0, poolSize)
      const finalQuestions = isRealMode ? [REAL_MODE_INTRO_QUESTION, ...pool] : pool

      setQuestions(finalQuestions)
      setActiveQuestion(finalQuestions[0] ?? null)
      setLoading(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  useEffect(() => {
    if (activeQuestion) {
      resetForNewQuestion()
      speakJapanese(activeQuestion.textJa)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeQuestion])

  useEffect(() => {
    if (finished) {
      router.push(`/interview/result/${params.sessionId}`)
    }
  }, [finished, params.sessionId, router])

  // 화면을 벗어날 때 녹화가 켜져 있으면 정리한다.
  useEffect(() => {
    return () => {
      if (videoRecorder.recording) videoRecorder.stop()
      if (audioRecorder.recording) audioRecorder.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  function toggleCamera() {
    setCameraOn((prev) => !prev)
  }

  function toggleVideoRecording() {
    if (videoRecorder.recording) videoRecorder.stop()
    else videoRecorder.start()
  }

  function toggleAudioRecording() {
    if (audioRecorder.recording) audioRecorder.stop()
    else audioRecorder.start()
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

    await advance(finalText, durationSeconds)
    setSaving(false)
  }

  async function advance(answeredText: string, durationSeconds: number) {
    if (!isFollowUp && activeQuestion) {
      const allRules = await getFollowUpsFor(activeQuestion.id)
      const rules = allRules.filter((r) => !askedFollowUps.has(r.targetId))
      const matched = matchFollowUpRule(rules, answeredText, durationSeconds, activeQuestion.expectedDurationSec)
      if (matched) {
        const target = getQuestionById(matched.targetId)
        if (target) {
          setAskedFollowUps((prev) => new Set(prev).add(matched.targetId))
          setIsFollowUp(true)
          setActiveQuestion(target)
          return
        }
      }
    }
    goToNextMainQuestion()
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

  if (loading) return <LoadingDots label="질문을 불러오는 중입니다..." />
  if (questions.length === 0) {
    return <p>표시할 질문이 없습니다. data/questions.json에 해당 카테고리 질문이 있는지 확인해주세요.</p>
  }
  if (!activeQuestion) return null

  return (
    <MacWindow title="voice-interview-jp — interview">
      <CameraPreview active={cameraOn} />

      <div className="interview-layout">
        <ZoomControlBar
          cameraOn={cameraOn}
          onToggleCamera={toggleCamera}
          videoRecording={videoRecorder.recording}
          onToggleVideoRecording={toggleVideoRecording}
          audioRecording={audioRecorder.recording}
          onToggleAudioRecording={toggleAudioRecording}
        />
        {(videoRecorder.error || audioRecorder.error) && (
          <p className="badge badge-error">{videoRecorder.error || audioRecorder.error}</p>
        )}
        <p className="muted small">
          화상/음성 녹화는 서버에 올라가지 않고, 종료하는 즉시 이 기기에 파일로 바로 저장됩니다.
        </p>

        <div className="zoom-tile">
          <div className="zoom-tile-avatar">面</div>
          <span className="badge">{isFollowUp ? '꼬리 질문' : `${queueIndex + 1} / ${questions.length}`}</span>
          <h2 className="question-ja">{activeQuestion.textJa}</h2>
          <button className="btn" onClick={() => speakJapanese(activeQuestion.textJa)}>
            다시 듣기 (TTS)
          </button>
          <span className="zoom-tile-name">면접관</span>
        </div>

        <div className="card">
          <div className={`mic-row${rec.listening ? ' mic-row-active' : ''}`}>
            <MicToggle
              checked={rec.listening}
              onChange={(v) => (v ? handleStartMic() : handleStopMic())}
              label="답변 시작"
            />
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
          {saving ? (
            <LoadingDots label="저장 중..." />
          ) : (
            <button className="btn btn-primary" onClick={submitAnswer} disabled={!(answerText || rec.transcript)}>
              답변 제출
            </button>
          )}
        </div>
      </div>
    </MacWindow>
  )
}
