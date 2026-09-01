'use client'

import { useEffect, useRef } from 'react'

// 가이드 §2 표: 데스크톱 240×135 / 태블릿 200×112 / 모바일 112×150 — 크기는 CSS 미디어쿼리로 처리한다.
// 카메라가 꺼져 있으면 평가용이 아닌 셀프 체크 용도로 파형 카드를 대신 보여준다.
export default function SelfPreview({
  cameraOn,
  cameraStream,
  audioLevel,
  initial,
}: {
  cameraOn: boolean
  cameraStream: MediaStream | null
  audioLevel: number
  initial: string
}) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = cameraOn ? cameraStream : null
    }
  }, [cameraOn, cameraStream])

  return (
    <div className="room-self-preview" data-testid="self-preview">
      {cameraOn ? (
        <video ref={videoRef} autoPlay muted playsInline className="room-self-video" />
      ) : (
        <div className="room-self-fallback">
          <span className="room-self-initial">{initial}</span>
          <div className="room-self-waveform">
            {Array.from({ length: 5 }).map((_, i) => (
              <span
                key={i}
                className="room-self-waveform-bar"
                style={{ height: `${8 + Math.round(audioLevel * 24 * (0.6 + 0.1 * i))}px` }}
              />
            ))}
          </div>
        </div>
      )}
      <span className="room-self-label">내 화면</span>
    </div>
  )
}
