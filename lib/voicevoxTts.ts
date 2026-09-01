// 무료 VOICEVOX 음성을 tts.quest의 공개 프록시(api.tts.quest)로 재생한다.
// 주의: 이 서비스는 공식적으로 API 키 발급을 요구하고(포인트 기반 요청 제한), 키 없이 쓰는
// 경로는 비공식 폴백이라 예고 없이 막힐 수 있다. 그래서 "추가" 선택지로만 제공하고, 실패하면
// 조용히 넘어가도록(면접 진행에 지장 없게) 설계했다. 완전 무료·서명 필요 없는 브라우저 기본
// 음성(useSpeechSynthesis)이 항상 기본값이다.
const SYNTHESIS_URL = 'https://api.tts.quest/v3/voicevox/synthesis'

export const VOICEVOX_SPEAKERS: { id: number; name: string }[] = [
  { id: 2, name: '四国めたん' },
  { id: 3, name: 'ずんだもん' },
  { id: 8, name: '春日部つむぎ' },
  { id: 9, name: '波音リツ' },
  { id: 10, name: '雨晴はう' },
  { id: 11, name: '玄野武宏' },
]

export const VOICEVOX_PREFIX = 'voicevox:'

async function waitForAudio(url: string, signal: AbortSignal, timeoutMs = 9000): Promise<string> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (signal.aborted) throw new Error('aborted')
    try {
      const res = await fetch(url, { method: 'GET', signal })
      if (res.ok) {
        const blob = await res.blob()
        if (blob.size > 0) return URL.createObjectURL(blob)
      }
    } catch {
      // 아직 준비 안 됐을 수 있음 — 잠시 후 재시도
    }
    await new Promise((r) => setTimeout(r, 700))
  }
  throw new Error('voicevox synthesis timed out')
}

export async function synthesizeVoicevox(text: string, speakerId: number, signal: AbortSignal): Promise<string> {
  const url = `${SYNTHESIS_URL}?text=${encodeURIComponent(text)}&speaker=${speakerId}`
  const res = await fetch(url, { signal })
  const data = await res.json()
  if (!data?.success || !data?.mp3DownloadUrl) {
    throw new Error(data?.errorMessage ? `voicevox error ${data.errorMessage}` : 'voicevox synthesis failed')
  }
  return waitForAudio(data.mp3DownloadUrl, signal)
}
