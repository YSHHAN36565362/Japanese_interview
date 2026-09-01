'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useMediaRecorder } from '@/lib/useMediaRecorder'
import { useInterviewMachine } from '../hooks/useInterviewMachine'
import { useMediaDevices } from '../hooks/useMediaDevices'
import { useAudioLevel } from '../hooks/useAudioLevel'
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
import RoomControls from './RoomControls'
import LoadingDots from '@/components/LoadingDots'

export default function InterviewRoom({ sessionId, mode }: { sessionId: string; mode: string }) {
  const machine = useInterviewMachine({ sessionId, mode })
  const media = useMediaDevices()
  const micLevel = useAudioLevel(media.micStream)

  const [levelLabel, setLevelLabel] = useState<string | null>(null)
  const [keigoMode, setKeigoMode] = useState<string | null>(null)
  const [subtitleOn, setSubtitleOn] = useState(true)
  const [panelOpen, setPanelOpen] = useState(true)
  const [activeTab, setActiveTab] = useState<AuxTab>('transcript')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      const { data: settings } = await supabase
        .from('user_settings')
        .select('jlpt_level_estimate, keigo_mode')
        .eq('user_id', data.user.id)
        .maybeSingle()
      setLevelLabel(settings?.jlpt_level_estimate ?? null)
      setKeigoMode(settings?.keigo_mode ?? null)
    })
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

  function handleReplay() {
    if (!machine.currentQuestion) return
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
      machine.confirmAnswer()
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
          onRequestMic={handleRequestMic}
          onComplete={machine.completePreflight}
        />
      )}

      {machine.currentQuestion && machine.phase !== 'preflight' && (
        <>
          <RoomHeader
            mode={mode}
            levelLabel={levelLabel}
            keigoMode={keigoMode}
            questionIndex={machine.queueIndex + 1}
            totalQuestions={machine.questions.length}
            timerFormatted={timer.formatted}
            onExit={handleEnd}
          />

          <div className="room-body">
            <div className="room-stage-wrap">
              <InterviewStage
                question={machine.currentQuestion}
                phase={machine.phase}
                isFollowUp={machine.isFollowUp}
                interimTranscript={machine.interimTranscript}
                showSubtitle={subtitleOn}
                blurQuestion={mode === 'real'}
                onReplay={handleReplay}
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
            </div>

            {panelOpen && (
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
                </div>

                {activeTab === 'transcript' && (
                  <TranscriptPanel
                    question={machine.currentQuestion}
                    transcript={machine.draftTranscript}
                    interimTranscript={machine.interimTranscript}
                    onChange={machine.setDraftTranscript}
                    sttSupported={stt.supported && machine.sttSupported}
                  />
                )}

                {activeTab === 'star' && (
                  <CoachingPanel
                    draftText={machine.draftTranscript || machine.interimTranscript}
                    suggestion={machine.suggestion}
                    onApplySuggestion={machine.applySuggestion}
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
            )}
          </div>

          <RoomControls
            phase={machine.phase}
            sttSupported={stt.supported && machine.sttSupported}
            micOn={stt.listening}
            onToggleMic={handleToggleMic}
            cameraOn={media.cameraOn}
            onToggleCamera={media.toggleCamera}
            subtitleOn={subtitleOn}
            onToggleSubtitle={() => setSubtitleOn((v) => !v)}
            panelOpen={panelOpen}
            onTogglePanel={() => setPanelOpen((v) => !v)}
            onReplay={handleReplay}
            videoRecording={videoRecorder.recording}
            onToggleVideoRecording={() => (videoRecorder.recording ? videoRecorder.stop() : videoRecorder.start())}
            audioRecording={audioRecorder.recording}
            onToggleAudioRecording={() => (audioRecorder.recording ? audioRecorder.stop() : audioRecorder.start())}
            onPrimaryAction={handlePrimaryAction}
            onEndFollowUp={machine.endFollowUp}
            onEnd={handleEnd}
            saving={machine.saving}
          />
        </>
      )}
    </div>
  )
}
