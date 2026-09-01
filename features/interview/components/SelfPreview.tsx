'use client'

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

const MIN_W = 120
const MIN_H = 90
const MAX_W = 480
const MAX_H = 360

// 셀프 카메라(또는 파형) 미리보기. 드래그로 이동, 모서리로 크기 조절이 가능하다.
// 기본 위치는 스테이지 하단. 화면 밖으로 완전히 드래그되면 되찾을 방법이 없었던 문제를
// 막기 위해 이동/크기조절 모두 부모(스테이지) 영역 안으로 clamp하고, 되돌리기 버튼도 뒀다.
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
  const wrapRef = useRef<HTMLDivElement>(null)

  // 좁은 화면(모바일)에서는 기본 크기를 더 작게 시작한다.
  const defaultSizeRef = useRef(
    typeof window !== 'undefined' && window.innerWidth < 480 ? { w: 150, h: 104 } : { w: 220, h: 150 }
  )

  const [pos, setPos] = useState({ x: 24, y: 0 })
  const [size, setSize] = useState(defaultSizeRef.current)
  const [positioned, setPositioned] = useState(false)

  const dragState = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null)
  const resizeState = useRef<{ startX: number; startY: number; origW: number; origH: number } | null>(null)

  function getParentRect() {
    const parent = wrapRef.current?.offsetParent as HTMLElement | null
    return parent ? parent.getBoundingClientRect() : null
  }

  function defaultPositionFor(w: number, h: number) {
    const rect = getParentRect()
    if (!rect) return { x: 24, y: 0 }
    return { x: Math.max(16, rect.width - w - 24), y: Math.max(16, rect.height - h - 24) }
  }

  // 처음 렌더링될 때 부모(스테이지) 기준 하단 중앙 근처에 배치한다.
  useEffect(() => {
    if (positioned) return
    setPos(defaultPositionFor(size.w, size.h))
    setPositioned(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positioned])

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = cameraOn ? cameraStream : null
    }
  }, [cameraOn, cameraStream])

  // 드래그로 화면 밖에 버려두거나 이상하게 리사이즈한 경우를 위한 되돌리기.
  function resetLayout() {
    const def = defaultSizeRef.current
    setSize(def)
    setPos(defaultPositionFor(def.w, def.h))
  }

  function onDragPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    dragState.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  function onDragPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!dragState.current) return
    const dx = e.clientX - dragState.current.startX
    const dy = e.clientY - dragState.current.startY
    const rect = getParentRect()
    const maxX = rect ? Math.max(0, rect.width - size.w) : Infinity
    const maxY = rect ? Math.max(0, rect.height - size.h) : Infinity
    setPos({
      x: Math.min(maxX, Math.max(0, dragState.current.origX + dx)),
      y: Math.min(maxY, Math.max(0, dragState.current.origY + dy)),
    })
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
    const rect = getParentRect()
    // 부모(스테이지) 영역보다 커지지 않게, 그리고 왼쪽/위 여백(pos)을 고려해 clamp한다.
    const maxW = rect ? Math.max(MIN_W, rect.width - pos.x) : MAX_W
    const maxH = rect ? Math.max(MIN_H, rect.height - pos.y) : MAX_H
    setSize({
      w: Math.min(MAX_W, maxW, Math.max(MIN_W, resizeState.current.origW + dx)),
      h: Math.min(MAX_H, maxH, Math.max(MIN_H, resizeState.current.origH + dy)),
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
      onDoubleClick={resetLayout}
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
      <button
        type="button"
        className="room-self-reset-btn"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={resetLayout}
        title="위치/크기 되돌리기"
        aria-label="내 화면 위치와 크기 되돌리기"
      >
        ↺
      </button>
      <div
        className="room-self-resize-handle"
        onPointerDown={onResizePointerDown}
        onPointerMove={onResizePointerMove}
        onPointerUp={onResizePointerUp}
      />
    </div>
  )
}
