export type SupportStatus = {
  sttSupported: boolean
  ttsSupported: boolean
}

export function checkSupport(): SupportStatus {
  if (typeof window === 'undefined') return { sttSupported: false, ttsSupported: false }
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  return {
    sttSupported: !!SR,
    ttsSupported: 'speechSynthesis' in window,
  }
}

// 브라우저 내장 TTS로 일본어 문장을 낭독한다. API 호출 없음 (서버 비용 0원).
// 단, 브라우저에 따라 음성 인식/합성이 서버 기반 엔진을 사용할 수 있어
// "완전 로컬"을 항상 보장하지는 않는다 (readme_3.md §1 참고).
export function speakJapanese(text: string, onEnd?: () => void) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    onEnd?.()
    return
  }
  window.speechSynthesis.cancel()
  const utter = new SpeechSynthesisUtterance(text)
  utter.lang = 'ja-JP'
  utter.rate = 0.95
  if (onEnd) utter.onend = onEnd
  window.speechSynthesis.speak(utter)
}
