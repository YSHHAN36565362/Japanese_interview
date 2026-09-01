'use client'

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

const MIN_W = 120
const MIN_H = 90
const MAX_W = 480
const MAX_H = 360

// 셀프 카메라(또는 파형) 미리보기. 드래그로 이동, 모서리로 크기 조절이 가능하다.
// 기본 위치는 스테이지 하단.
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
  const [pos, setPos] = useState({ x: 24, y: 0 })
  const [size, setSize] = useState({ w: 220, h: 150 })
  const [positioned, setPositioned] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const dragState = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null)
  const resizeState = useRef<{ startX: number; startY: number; origW: number; origH: number } | null>(null)

  // 처음 렌더링될 때 부모(스테이지) 기준 하단 중앙 근처에 배치한다.
  useEffect(() => {
    if (positioned) return
    const parent = wrapRef.current?.offsetParent as HTMLElement | null
    if (parent) {
      const rect = parent.getBoundingClientRect()
      setPos({ x: Math.max(16, rect.width - size.w - 24), y: Math.max(16, rect.height - size.h - 24) })
    }
    setPositioned(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positioned])

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = cameraOn ? cameraStream : null
    }
  }, [cameraOn, cameraStream])

  function onDragPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    dragState.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  function onDragPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!dragState.current) return
    const dx = e.clientX - dragState.current.startX
    const dy = e.clientY - dragState.current.startY
    setPos({ x: Math.max(0, dragState.current.origX + dx), y: Math.max(0, dragState.current.origY + dy) })
  }
  function onDragPointerUp() {
    dragState.current = null
  }

  function onResizePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    e.stopPropagation()
    resizeState.current = { startX: e.clientX, startY: e.clientY, origW: size.w, origH: size.h }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  function onResizePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!resizeState.current) return
    e.stopPropagation()
    const dx = e.clientX - resizeState.current.startX
    const dy = e.clientY - resizeState.current.startY
    setSize({
      w: Math.min(MAX_W, Math.max(MIN_W, resizeState.current.origW + dx)),
      h: Math.min(MAX_H, Math.max(MIN_H, resizeState.current.origH + dy)),
    })
  }
  function onResizePointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    e.stopPropagation()
    resizeState.current = null
  }

  return (
    <div
      ref={wrapRef}
      className="room-self-preview"
      style={{ left: pos.x, top: pos.y, width: size.w, height: size.h }}
      onPointerDown={onDragPointerDown}
      onPointerMove={onDragPointerMove}
      onPointerUp={onDragPointerUp}
      data-testid="self-preview"
    >
      {cameraOn ? (
        <video ref={videoRef} autoPlay muted playsInline className="room-self-video" />
      ) : (
        <div className="room-self-fallback">
          <span className="room-self-initial">{initial}</span>
        </div>
      )}
      {/* 카메라 on/off와 무관하게 말하는 크기를 물결(막대)로 항상 보여준다 */}
      <div className="room-self-waveform" aria-hidden="true">
        {Array.from({ length: 5 }).map((_, i) => (
          <span
            key={i}
            className="room-self-waveform-bar"
            style={{ height: `${8 + Math.round(audioLevel * 24 * (0.6 + 0.1 * i))}px` }}
          />
        ))}
      </div>
      <span className="room-self-label">내 화면</span>
      <div
        className="room-self-resize-handle"
        onPointerDown={onResizePointerDown}
        onPointerMove={onResizePointerMove}
        onPointerUp={onResizePointerUp}
      />
    </div>
  )
}
