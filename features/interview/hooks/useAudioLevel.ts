'use client'

import { useEffect, useRef, useState } from 'react'

// 마이크 스트림의 음량을 0~1 사이 값으로 근사해 반환한다. 점수/평가용이 아니라
// "입력이 감지되고 있다"는 것만 보여주기 위한 시각 피드백이다 (가이드 §7-3).
//
// 절대 음량(rms)에 고정 배율을 곱하는 방식은 마이크 게인이 낮은 기기에서 크게 말해도
// 거의 안 움직이는 문제가 있었다. 대신 "최근 조용했던 바닥값"과 "최근 가장 컸던 값"을
// 계속 추적해서, 그 구간 안에서 지금 소리가 상대적으로 얼마나 커졌는지로 정규화한다
// (바닥은 천천히 올라가고 조용해지면 바로 내려가며, 천장은 크게 말하면 바로 올라가고
// 시간이 지나면 천천히 내려간다).
export function useAudioLevel(stream: MediaStream | null): number {
  const [level, setLevel] = useState(0)
  const frameRef = useRef<number>(0)
  const floorRef = useRef(0)
  const ceilingRef = useRef(0.05)

  useEffect(() => {
    if (!stream) {
      setLevel(0)
      floorRef.current = 0
      ceilingRef.current = 0.05
      return
    }

    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
    const audioCtx: AudioContext = new AudioCtx()
    // 브라우저 자동재생 정책상 useEffect 안에서 만든 AudioContext는 'suspended' 상태로
    // 시작될 수 있다 — resume하지 않으면 analyser가 항상 무음(레벨 0)만 반환한다.
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {})
    }
    const analyser = audioCtx.createAnalyser()
    analyser.fftSize = 256
    const source = audioCtx.createMediaStreamSource(stream)
    source.connect(analyser)
    const data = new Uint8Array(analyser.frequencyBinCount)

    function tick() {
      analyser.getByteTimeDomainData(data)
      let sumSquares = 0
      for (const value of data) {
        const centered = (value - 128) / 128
        sumSquares += centered * centered
      }
      const rms = Math.sqrt(sumSquares / data.length)

      // 바닥(무음/주변 소음): 조용해지면 바로 따라 내려가고, 시끄러워져도 천천히만 올라간다.
      if (rms < floorRef.current) {
        floorRef.current = rms
      } else {
        floorRef.current += (rms - floorRef.current) * 0.02
      }

      // 천장(최근 가장 컸던 소리): 커지면 바로 따라 올라가고, 조용해지면 천천히만 내려간다.
      if (rms > ceilingRef.current) {
        ceilingRef.current = rms
      } else {
        ceilingRef.current -= (ceilingRef.current - floorRef.current) * 0.01
      }

      const range = Math.max(ceilingRef.current - floorRef.current, 0.01)
      const normalized = (rms - floorRef.current) / range
      setLevel(Math.max(0, Math.min(1, normalized)))
      frameRef.current = requestAnimationFrame(tick)
    }
    tick()

    return () => {
      cancelAnimationFrame(frameRef.current)
      source.disconnect()
      audioCtx.close().catch(() => {})
    }
  }, [stream])

  return level
}
