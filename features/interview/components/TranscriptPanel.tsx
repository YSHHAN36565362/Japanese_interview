'use client'

export default function TranscriptPanel({
  transcript,
  interimTranscript,
  onChange,
  sttSupported,
  isListening,
}: {
  transcript: string
  interimTranscript: string
  onChange: (text: string) => void
  sttSupported: boolean
  isListening: boolean
}) {
  // 마이크가 실제로 듣고 있는 동안에는 실시간 미리보기(interimTranscript)를 함께 보여주지만,
  // 그 외(답변 검토 단계 등)에는 transcript만 보여준다 — 그렇지 않으면 사용자가 키보드로
  // 전부 지워도(빈 문자열) 오래된 interimTranscript로 다시 채워져서 완전히 지울 수 없었다.
  const displayValue = isListening ? transcript || interimTranscript : transcript

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
        value={displayValue}
        onChange={(e) => onChange(e.target.value)}
        placeholder="음성 인식 결과가 여기에 실시간으로 표시됩니다. 클릭하지 않아도 자동으로 채워지고, 오타나 오인식은 키보드로 자유롭게 지우고 고칠 수 있습니다."
      />
      <p className="muted small">제출 전에 자유롭게 고칠 수 있습니다. 인식 오류는 평가에 불이익이 없습니다.</p>
    </div>
  )
}
