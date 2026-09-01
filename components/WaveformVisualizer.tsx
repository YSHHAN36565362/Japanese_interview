'use client'

import { useEffect, useRef } from 'react'

// Web Audio API(AnalyserNode)만 사용하는 순수 클라이언트 시각화. 서버 호출 없음.
export default function WaveformVisualizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let stream: MediaStream | null = null
    let audioCtx: AudioContext | null = null
    let animationId = 0

    async function setup() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        audioCtx = new AudioContext()
        const source = audioCtx.createMediaStreamSource(stream)
        const analyser = audioCtx.createAnalyser()
        analyser.fftSize = 256
        source.connect(analyser)

        const data = new Uint8Array(analyser.frequencyBinCount)
        const canvas = canvasRef.current
        const ctx = canvas?.getContext('2d')

        function draw() {
          animationId = requestAnimationFrame(draw)
          if (!ctx || !canvas) return
          analyser.getByteTimeDomainData(data)
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          ctx.beginPath()
          const sliceWidth = canvas.width / data.length
          let x = 0
          for (let i = 0; i < data.length; i++) {
            const v = data[i] / 128.0
            const y = (v * canvas.height) / 2
            if (i === 0) ctx.moveTo(x, y)
            else ctx.lineTo(x, y)
            x += sliceWidth
          }
          ctx.strokeStyle = '#4f7cff'
          ctx.lineWidth = 2
          ctx.stroke()
        }
        draw()
      } catch {
        // 마이크 권한 거부 또는 다른 프로세스가 사용 중인 경우 조용히 무시한다.
      }
    }

    setup()

    return () => {
      cancelAnimationFrame(animationId)
      stream?.getTracks().forEach((t) => t.stop())
      audioCtx?.close()
    }
  }, [])

  return <canvas ref={canvasRef} width={220} height={40} className="waveform" />
}
