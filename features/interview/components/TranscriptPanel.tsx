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
  // 2026-09-02 재수정: 예전에는 "듣는 중"일 때 박스 값 자체를 transcript || interimTranscript로
  // 채웠는데, 이러면 사용자가 말하는 도중에 키보드로 텍스트를 지워도(draftTranscript가 빈
  // 문자열이 됨) 마이크가 계속 인식 중이라 interimTranscript가 곧바로 다시 채워 넣어서
  // "지운 게 하나도 안 지워지는" 것처럼 보였다(듣는 중이 아닐 때만 고치던 이전 수정으로는
  // 이 경우가 해결되지 않았음). 이제는 편집 가능한 박스 값은 항상 transcript(draftTranscript)
  // 하나만 쓰고, 실시간 인식 중인 내용은 박스 아래 별도의 미리보기 줄로만 보여준다 — 그래서
  // 키보드로 지우면 언제나 확실히 지워지고, 그래도 지금 인식되고 있는 내용은 계속 볼 수 있다.
  const showInterimPreview = isListening && interimTranscript.trim().length > 0 && interimTranscript !== transcript

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
        value={transcript}
        onChange={(e) => onChange(e.target.value)}
        placeholder="음성 인식 결과가 여기에 실시간으로 표시됩니다. 클릭하지 않아도 자동으로 채워지고, 오타나 오인식은 키보드로 자유롭게 지우고 고칠 수 있습니다."
      />
      {showInterimPreview && (
        <p className="room-transcript-interim muted small" aria-live="polite">
          듣는 중: {interimTranscript}
        </p>
      )}
      <p className="muted small">제출 전에 자유롭게 고칠 수 있습니다. 인식 오류는 평가에 불이익이 없습니다.</p>
    </div>
  )
}
