'use client'

import { useMemo } from 'react'

const BAR_COUNT = 24

// 막대마다 고정된 "기본 굵기"를 미리 정해 둔다 — 매번 랜덤이면 리렌더될 때마다 파형이
// 들쭉날쭉 다시 그려져 산만해 보이고, 전부 같은 높이면 실제 음성 파형처럼 안 보인다.
// 사인파 몇 개를 겹쳐서 사용자가 준 참고 이미지처럼 "덩어리(burst)"가 몇 군데 뭉친
// 모양이 나오게 한다.
function buildBarWeights(count: number): number[] {
  const weights: number[] = []
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1)
    const cluster =
      Math.abs(Math.sin(t * Math.PI * 3.1)) * 0.7 + Math.abs(Math.sin(t * Math.PI * 7.3)) * 0.3
    weights.push(0.25 + cluster * 0.75)
  }
  return weights
}

// 실전 면접에서 말할 때 음성 인식 상태를 막대 파형으로 보여준다. 마이크 레벨(0~1) 하나만
// 있으면 되고, 진짜 주파수 분석 없이도 고정된 막대별 가중치에 실시간 레벨을 곱해서
// 자연스러운 파형처럼 보이게 한다 (0원 운영 원칙상 별도 분석 라이브러리 없이 구현).
export default function VoiceWaveform({ level, active }: { level: number; active: boolean }) {
  const weights = useMemo(() => buildBarWeights(BAR_COUNT), [])

  return (
    <div className={`voice-waveform${active ? ' active' : ''}`} aria-hidden="true">
      {weights.map((w, i) => {
        const boosted = active ? Math.min(1, level * 1.6) : 0
        const heightPct = Math.round((0.12 + w * (0.2 + boosted * 0.8)) * 100)
        return (
          <span
            key={i}
            className="voice-waveform-bar"
            style={{
              height: `${Math.min(100, heightPct)}%`,
              animationDelay: `${(i % 8) * 0.08}s`,
            }}
          />
        )
      })}
    </div>
  )
}
