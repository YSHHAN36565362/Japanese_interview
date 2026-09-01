'use client'

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

const MIN_W = 160
const MIN_H = 120
const MAX_W = 480
const MAX_H = 360

// Zoom처럼 화면 위에 떠서 드래그로 이동, 모서리로 크기 조절이 가능한 셀프 카메라 미리보기.
// 서버로 전송되지 않고 브라우저 안에서만 스트리밍된다.
export default function CameraPreview({ active }: { active: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [pos, setPos] = useState({ x: 24, y: 90 })
  const [size, setSize] = useState({ w: 220, h: 165 })
  const [error, setError] = useState<string | null>(null)

  const dragState = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null)
  const resizeState = useRef<{ startX: number; startY: number; origW: number; origH: number } | null>(null)

  useEffect(() => {
    let stream: MediaStream | null = null
    let cancelled = false

    async function setup() {
      if (!active) return
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        if (videoRef.current) videoRef.current.srcObject = stream
      } catch {
        setError('카메라를 켤 수 없습니다. 권한을 확인해주세요.')
      }
    }
    setup()

    return () => {
      cancelled = true
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [active])

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

  if (!active) return null

  return (
    <div
      className="camera-preview"
      style={{ left: pos.x, top: pos.y, width: size.w, height: size.h }}
      onPointerDown={onDragPointerDown}
      onPointerMove={onDragPointerMove}
      onPointerUp={onDragPointerUp}
    >
      {error ? (
        <div className="camera-preview-error">{error}</div>
      ) : (
        <video ref={videoRef} autoPlay muted playsInline className="camera-preview-video" />
      )}
      <span className="camera-preview-label">내 화면</span>
      <div
        className="camera-preview-resize-handle"
        onPointerDown={onResizePointerDown}
        onPointerMove={onResizePointerMove}
        onPointerUp={onResizePointerUp}
      />
    </div>
  )
}
