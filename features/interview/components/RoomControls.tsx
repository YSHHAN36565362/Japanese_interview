'use client'

import type { InterviewPhase } from '../types'

export default function RoomControls({
  phase,
  sttSupported,
  micOn,
  onToggleMic,
  cameraOn,
  onToggleCamera,
  panelOpen,
  onTogglePanel,
  onReplay,
  videoRecording,
  onToggleVideoRecording,
  audioRecording,
  onToggleAudioRecording,
  onPrimaryAction,
  onFinalQuestion,
  onEndFollowUp,
  onEnd,
  saving,
}: {
  phase: InterviewPhase
  sttSupported: boolean
  micOn: boolean
  onToggleMic: () => void
  cameraOn: boolean
  onToggleCamera: () => void
  panelOpen: boolean
  onTogglePanel: () => void
  onReplay: () => void
  videoRecording: boolean
  onToggleVideoRecording: () => void
  audioRecording: boolean
  onToggleAudioRecording: () => void
  onPrimaryAction: () => void
  onFinalQuestion: () => void
  onEndFollowUp: () => void
  onEnd: () => void
  saving: boolean
}) {
  const primaryLabel = phase === 'listening' ? '답변 완료' : phase === 'answerReview' ? '다음 질문' : '답변 완료'
  // 텍스트 모드(sttSupported=false)에는 'listening' 단계가 아예 없으므로(마이크 버튼 자체가
  // 비활성화됨), questionReady 단계에서 바로 확정할 수 있어야 한다 — 안 그러면 텍스트로만
  // 답변할 수 있는 사용자가 "답변 완료"를 영영 누를 수 없게 된다.
  const primaryDisabled = sttSupported
    ? phase !== 'listening' && phase !== 'answerReview'
    : phase !== 'questionReady' && phase !== 'answerReview'
  const endFollowUpDisabled = phase !== 'answerReview' || saving
  const finalQuestionDisabled = phase !== 'answerReview' || saving

  return (
    <footer className="room-controls" data-testid="room-controls">
      <div className="room-controls-left">
        <button
          className={`room-control-btn${micOn ? ' active' : ''}`}
          onClick={onToggleMic}
          disabled={!sttSupported || phase === 'interviewerSpeaking' || phase === 'saving'}
          aria-pressed={micOn}
          aria-label={micOn ? '마이크 끄기' : '마이크 켜기'}
        >
          {micOn ? '마이크 켜짐' : '마이크'}
        </button>

        <button
          className={`room-control-btn${cameraOn ? ' active' : ''}`}
          onClick={onToggleCamera}
          aria-pressed={cameraOn}
          aria-label={cameraOn ? '카메라 끄기' : '카메라 켜기'}
        >
          {cameraOn ? '카메라 켜짐' : '카메라'}
        </button>

        <button className={`room-control-btn${panelOpen ? ' active' : ''}`} onClick={onTogglePanel} aria-pressed={panelOpen}>
          패널
        </button>

        <button className="room-control-btn" onClick={onReplay}>
          다시 듣기
        </button>

        <button
          className={`room-control-btn${videoRecording ? ' recording' : ''}`}
          onClick={onToggleVideoRecording}
          disabled={!cameraOn}
          title={!cameraOn ? '카메라를 먼저 켜주세요 (로컬 저장 전용)' : '로컬 저장 전용, 서버 업로드 없음'}
        >
          {videoRecording ? '화상 녹화 중지' : '화상 녹화(로컬)'}
        </button>

        <button
          className={`room-control-btn${audioRecording ? ' recording' : ''}`}
          onClick={onToggleAudioRecording}
          title="로컬 저장 전용, 서버 업로드 없음"
        >
          {audioRecording ? '음성 녹음 중지' : '음성 녹음(로컬)'}
        </button>

        <button
          className={`room-record-dot-btn${audioRecording ? ' recording' : ''}`}
          onClick={onToggleAudioRecording}
          aria-label={audioRecording ? '음성 녹음 중지' : '음성 녹음 시작'}
          title={audioRecording ? '음성 녹음 중지' : '음성 녹음 시작'}
        >
          <span className="room-record-dot" aria-hidden="true" />
        </button>
      </div>

      <div className="room-controls-right">
        <button
          className="room-control-btn end-followup"
          onClick={onFinalQuestion}
          disabled={finalQuestionDisabled}
          title="지금까지의 질문을 마치고, 마지막으로 하고 싶은 말을 묻습니다"
        >
          마지막 질문하기
        </button>
        <button
          className="room-control-btn end-followup"
          onClick={onEndFollowUp}
          disabled={endFollowUpDisabled}
          title="지금까지의 꼬리질문을 마치고 다른 대분류 질문으로 넘어갑니다"
        >
          꼬리질문 종료
        </button>
        <button
          className="btn btn-primary"
          onClick={onPrimaryAction}
          disabled={primaryDisabled || saving}
          title="단축키: Space"
        >
          {saving ? '저장 중...' : primaryLabel}
          {!primaryDisabled && !saving && <span className="room-shortcut-hint"> (Space)</span>}
        </button>
        <button className="room-end-btn" onClick={onEnd} aria-label="면접 종료">
          종료
        </button>
      </div>
    </footer>
  )
}
