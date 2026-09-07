'use client'

import { useEffect, useRef, useState } from 'react'
import { useMediaRecorder } from '@/lib/useMediaRecorder'
import { useInterviewMachine } from '../hooks/useInterviewMachine'
import { useMediaDevices } from '../hooks/useMediaDevices'
import { useAudioLevel } from '../hooks/useAudioLevel'
import type { BankQuestion, JobTrack, TopicCategoryId } from '@/lib/questionBank'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis'
import { useSessionTimer } from '../hooks/useSessionTimer'
import { AUX_TABS, AUX_TAB_LABEL, type AuxTab } from '../constants'
import PreflightDialog from './PreflightDialog'
import RoomHeader from './RoomHeader'
import InterviewStage from './InterviewStage'
import SelfPreview from './SelfPreview'
import TranscriptPanel from './TranscriptPanel'
import CoachingPanel from './CoachingPanel'
import GrammarPanel from './GrammarPanel'
import RoomControls from './RoomControls'
import LoadingDots from '@/components/LoadingDots'

export default function InterviewRoom({
  sessionId,
  mode,
  track,
  topicCategories,
}: {
  sessionId: string
  mode: string
  track?: JobTrack
  topicCategories?: TopicCategoryId[]
}) {
  const machine = useInterviewMachine({ sessionId, mode, track, topicCategories })
  const media = useMediaDevices()
  const micLevel = useAudioLevel(media.micStream)

  const [panelOpen, setPanelOpen] = useState(true)
  const [activeTab, setActiveTab] = useState<AuxTab>('transcript')
  const [notes, setNotes] = useState('')

  // 모바일 화면에서는 보조 패널(대화/STAR/메모)이 화면을 너무 많이 가리므로 기본값을 닫힘으로
  // 시작한다. 필요할 때만 "패널" 버튼으로 열 수 있다. (서버 렌더링 시점엔 window가 없으므로
  // 마운트 후 클라이언트에서만 판단한다.)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setPanelOpen(false)
    }
  }, [])

  const tts = useSpeechSynthesis({
    onStart: machine.handleTtsStarted,
    onEnd: machine.handleTtsEnded,
  })

  const stt = useSpeechRecognition({
    enabled: machine.phase === 'listening',
    onFinal: machine.handleFinalTranscript,
    onInterim: machine.setInterimTranscript,
    onError: machine.handleSpeechError,
    onFirstSpeech: machine.handleFirstSpeech,
  })

  const videoRecorder = useMediaRecorder({ video: true, audio: true }, 'interview-video')
  const audioRecorder = useMediaRecorder({ audio: true }, 'interview-audio')

  const timer = useSessionTimer(machine.currentQuestion?.id ?? 'none')

  // "면접 점수" — 질문 하나하나는 여전히 100점에서 시작해 힌트(블러 공개, -20)·다시 듣기
  // (-10/회)·답변 시간 초과(3초당 -1)로 깎이고, 화면에 보여주는 건 지금까지 거쳐 간 질문들의
  // 평균이다. 전체 100점을 세션 전체가 나눠 쓰는 방식이었을 때는 질문이 많은 세션(주제를
  // 넓게 고르면 200개 가까이 나옴)에서 힌트 한 번만 봐도 전체 점수의 20%가 날아가 버렸다 —
  // 평균으로 바꾸면 질문 수와 무관하게 "감점 하나의 무게"가 항상 같다. 어디에도 저장하지
  // 않는다 — 화면을 벗어나면 사라지는 그 자리 지표.
  const [hintRevealedIds, setHintRevealedIds] = useState<Set<string>>(new Set())
  const [replayCounts, setReplayCounts] = useState<Record<string, number>>({})
  const [committedScores, setCommittedScores] = useState<number[]>([])
  const questionStartRef = useRef<number>(Date.now())
  const prevQuestionRef = useRef<BankQuestion | null>(null)

  function scoreFor(question: BankQuestion, elapsedSecondsOnIt: number) {
    const hintPenalty = hintRevealedIds.has(question.id) ? 20 : 0
    const replayPenalty = (replayCounts[question.id] ?? 0) * 10
    const overtime = Math.max(0, elapsedSecondsOnIt - question.expectedDurationSec)
    const timePenalty = Math.floor(overtime / 3)
    return Math.max(0, 100 - hintPenalty - replayPenalty - timePenalty)
  }

  useEffect(() => {
    const prev = prevQuestionRef.current
    if (prev) {
      const elapsedOnPrev = (Date.now() - questionStartRef.current) / 1000
      setCommittedScores((scores) => [...scores, scoreFor(prev, elapsedOnPrev)])
    }
    questionStartRef.current = Date.now()
    prevQuestionRef.current = machine.currentQuestion
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [machine.currentQuestion?.id])

  function handleHintRevealed() {
    const id = machine.currentQuestion?.id
    if (!id) return
    setHintRevealedIds((prev) => (prev.has(id) ? prev : new Set(prev).add(id)))
  }

  const currentLiveScore = machine.currentQuestion ? scoreFor(machine.currentQuestion, timer.elapsedSeconds) : null
  const allScores = currentLiveScore != null ? [...committedScores, currentLiveScore] : committedScores
  const interviewScore =
    allScores.length > 0 ? Math.round(allScores.reduce((sum, s) => sum + s, 0) / allScores.length) : 100

  // 질문마다 딱 한 번만 자동 낭독한다. TTS 종료 후 phase가 다시 questionReady로
  // 돌아오더라도 같은 질문이면 재생하지 않는다 (무한 재생 방지). 반복 재생은
  // "다시 듣기" 버튼(handleReplay)으로만 한다.
  const spokenForRef = useRef<string | null>(null)
  useEffect(() => {
    if (machine.phase === 'preflight' || !machine.currentQuestion) return
    if (spokenForRef.current === machine.currentQuestion.id) return
    spokenForRef.current = machine.currentQuestion.id
    tts.speak(machine.currentQuestion.textJa)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [machine.currentQuestion?.id, machine.phase])

  useEffect(() => {
    return () => {
      if (videoRecorder.recording) videoRecorder.stop()
      if (audioRecorder.recording) audioRecorder.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 스페이스바로 "답변 완료"/"다음 질문"을 누를 수 있게 한다. 전사·메모 입력창에 포커스가
  // 있을 때는 원래 스페이스(공백 입력)로 동작해야 하므로 그 경우엔 단축키를 끈다.
  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      if (e.code !== 'Space') return
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return
      const sttAvailable = stt.supported && machine.sttSupported
      const actionable = sttAvailable
        ? machine.phase === 'listening' || machine.phase === 'answerReview'
        : machine.phase === 'questionReady' || machine.phase === 'answerReview'
      if (!actionable) return
      e.preventDefault()
      handlePrimaryAction()
    }
    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [machine.phase, stt.supported, machine.sttSupported])

  function handleReplay() {
    if (!machine.currentQuestion) return
    const id = machine.currentQuestion.id
    setReplayCounts((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }))
    tts.speak(machine.currentQuestion.textJa)
  }

  function handleToggleMic() {
    if (machine.phase === 'listening') machine.stopListening()
    else machine.startListening()
  }

  function handlePrimaryAction() {
    if (machine.phase === 'listening') {
      machine.stopListening()
      return
    }
    if (machine.phase === 'answerReview') {
      machine.confirmAnswer(currentLiveScore ?? undefined)
      return
    }
    // 텍스트 모드는 'listening' 단계를 거치지 않으므로, questionReady에서 바로 확정한다.
    const sttAvailable = stt.supported && machine.sttSupported
    if (!sttAvailable && machine.phase === 'questionReady') {
      machine.confirmAnswer(currentLiveScore ?? undefined)
    }
  }

  async function handleRequestMic() {
    return media.requestMic()
  }

  function handleEnd() {
    machine.requestEnd()
  }

  if (machine.loading) return <LoadingDots label="면접실을 준비하고 있습니다..." />
  if (machine.questions.length === 0) {
    return <p>표시할 질문이 없습니다. data/questions.json에 해당 카테고리 질문이 있는지 확인해주세요.</p>
  }

  return (
    <div className="room-shell">
      {machine.phase === 'preflight' && (
        <PreflightDialog
          mode={mode}
          micLevel={micLevel}
          isGuest={machine.isGuest}
          onRequestMic={handleRequestMic}
          onComplete={machine.completePreflight}
        />
      )}

      {machine.currentQuestion && machine.phase !== 'preflight' && (
        <div className="room-page-inner">
        <div className="room-card">
          <RoomHeader
            mode={mode}
            track={track}
            questionIndex={machine.queueIndex + 1}
            totalQuestions={machine.questions.length}
            timerFormatted={timer.formatted}
            recording={videoRecorder.recording || audioRecorder.recording}
            onExit={handleEnd}
          />

          <div className="room-progress-track" aria-hidden="true">
            <div
              className="room-progress-fill"
              style={{ width: `${Math.round(((machine.queueIndex + 1) / Math.max(1, machine.questions.length)) * 100)}%` }}
            />
            <div className="room-progress-current-track">
              <div
                className="room-progress-current-fill"
                style={{
                  width: `${Math.min(
                    100,
                    Math.round((timer.elapsedSeconds / Math.max(1, machine.currentQuestion.expectedDurationSec)) * 100)
                  )}%`,
                }}
              />
            </div>
          </div>

          <div className="room-body">
            <div className="room-stage-wrap">
              <InterviewStage
                question={machine.currentQuestion}
                phase={machine.phase}
                blurQuestion={mode === 'real'}
                score={interviewScore}
                onHintRevealed={handleHintRevealed}
                onReplay={handleReplay}
                voices={tts.voices}
                voiceURI={tts.voiceURI}
                onVoiceChange={tts.setVoiceURI}
                volume={tts.volume}
                onVolumeChange={tts.setVolume}
                micListening={stt.listening}
                micLevel={micLevel}
                speakingBoundary={tts.speakingBoundary}
                rate={tts.rate}
                onRateChange={tts.setRate}
                defaultRate={tts.defaultRate}
                minRate={tts.minRate}
                maxRate={tts.maxRate}
                pitch={tts.pitch}
                onPitchChange={tts.setPitch}
                defaultPitch={tts.defaultPitch}
                minPitch={tts.minPitch}
                maxPitch={tts.maxPitch}
              />
              <SelfPreview
                cameraOn={media.cameraOn}
                cameraStream={media.cameraStream}
                audioLevel={micLevel}
                initial="私"
              />
              {media.cameraError && <p className="badge badge-error">{media.cameraError}</p>}
              {(videoRecorder.error || audioRecorder.error) && (
                <p className="badge badge-error">{videoRecorder.error || audioRecorder.error}</p>
              )}
              {machine.error && <p className="badge badge-error">{machine.error}</p>}
            </div>

            {panelOpen && (
              <>
                {/* 모바일에서 패널이 화면 대부분을 덮는 바텀시트로 바뀌므로, 바깥을 탭하면
                    바로 닫히는 배경(backdrop)을 함께 둔다. 데스크톱 사이드 패널에서는
                    CSS로 숨겨진다(app/globals.css 참고). */}
                <div className="room-aux-backdrop" onClick={() => setPanelOpen(false)} aria-hidden="true" />
                <aside className="room-aux-panel">
                  <div className="room-aux-tabs" role="tablist">
                    {AUX_TABS.map((tab) => (
                      <button
                        key={tab}
                        role="tab"
                        aria-selected={activeTab === tab}
                        className={`room-aux-tab${activeTab === tab ? ' active' : ''}`}
                        onClick={() => setActiveTab(tab)}
                      >
                        {AUX_TAB_LABEL[tab]}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="room-aux-close-btn"
                      onClick={() => setPanelOpen(false)}
                      aria-label="패널 닫기"
                    >
                      ✕
                    </button>
                  </div>

                {activeTab === 'transcript' && (
                  <TranscriptPanel
                    transcript={machine.draftTranscript}
                    interimTranscript={machine.interimTranscript}
                    onChange={machine.setDraftTranscript}
                    sttSupported={stt.supported && machine.sttSupported}
                    isListening={machine.phase === 'listening'}
                  />
                )}

                {activeTab === 'star' && (
                  <CoachingPanel
                    draftText={machine.draftTranscript || machine.interimTranscript}
                    suggestion={machine.suggestion}
                    onApplySuggestion={machine.applySuggestion}
                  />
                )}

                {activeTab === 'grammar' && (
                  <GrammarPanel
                    draftText={machine.draftTranscript || machine.interimTranscript}
                    onChangeText={machine.setDraftTranscript}
                  />
                )}

                {activeTab === 'notes' && (
                  <div className="room-notes-panel">
                    <textarea
                      className="answer-box"
                      rows={10}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="이 면접 세션에 대한 개인 메모 (저장되지 않고 이 화면을 벗어나면 사라집니다)"
                    />
                    <p className="muted small">이 메모는 서버에 저장되지 않습니다.</p>
                  </div>
                )}
                </aside>
              </>
            )}
          </div>

          <RoomControls
            phase={machine.phase}
            sttSupported={stt.supported && machine.sttSupported}
            micOn={stt.listening}
            onToggleMic={handleToggleMic}
            cameraOn={media.cameraOn}
            onToggleCamera={media.toggleCamera}
            panelOpen={panelOpen}
            onTogglePanel={() => setPanelOpen((v) => !v)}
            videoRecording={videoRecorder.recording}
            onToggleVideoRecording={() => (videoRecorder.recording ? videoRecorder.stop() : videoRecorder.start())}
            audioRecording={audioRecorder.recording}
            onToggleAudioRecording={() => (audioRecorder.recording ? audioRecorder.stop() : audioRecorder.start())}
            onPrimaryAction={handlePrimaryAction}
            onFinalQuestion={machine.requestFinalQuestion}
            onEnd={handleEnd}
            saving={machine.saving}
          />
        </div>
        </div>
      )}
    </div>
  )
}
