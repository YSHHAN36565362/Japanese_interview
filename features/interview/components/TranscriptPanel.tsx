'use client'

export default function TranscriptPanel({
  transcript,
  interimTranscript,
  onChange,
  sttSupported,
}: {
  transcript: string
  interimTranscript: string
  onChange: (text: string) => void
  sttSupported: boolean
}) {
  return (
    <div className="room-transcript-panel" data-testid="transcript-panel">
      {!sttSupported && (
        <p className="badge badge-warn">
          이 브라우저에서는 음성 인식을 사용할 수 없습니다. 아래에 답변을 직접 입력해주세요.
        </p>
      )}
      <textarea
        className="answer-box room-transcript-input"
        rows={8}
        value={transcript || interimTranscript}
        onChange={(e) => onChange(e.target.value)}
        placeholder="음성 인식 결과가 여기에 실시간으로 표시됩니다. 필요하면 직접 수정하세요."
      />
      <p className="muted small">제출 전에 자유롭게 고칠 수 있습니다. 인식 오류는 평가에 불이익이 없습니다.</p>
    </div>
  )
}
