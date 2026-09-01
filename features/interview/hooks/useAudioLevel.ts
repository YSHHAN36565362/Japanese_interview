'use client'

import { useEffect, useRef, useState } from 'react'

// 마이크 스트림의 음량을 0~1 사이 값으로 근사해 반환한다. 점수/평가용이 아니라
// "입력이 감지되고 있다"는 것만 보여주기 위한 시각 피드백이다 (가이드 §7-3).
export function useAudioLevel(stream: MediaStream | null): number {
  const [level, setLevel] = useState(0)
  const frameRef = useRef<number>(0)

  useEffect(() => {
    if (!stream) {
      setLevel(0)
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
      setLevel(Math.min(1, rms * 4))
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
