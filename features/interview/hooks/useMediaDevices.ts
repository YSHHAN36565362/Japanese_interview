'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// 카메라/마이크 장치를 화면과 분리해서 관리하는 훅 (가이드 §7-1, §4의 "MediaStream은 useRef로만").
// 카메라는 기본 off이며, 사용자가 버튼을 눌렀을 때만 getUserMedia(video)를 요청한다.
export function useMediaDevices() {
  const [micStream, setMicStream] = useState<MediaStream | null>(null)
  const [micError, setMicError] = useState<string | null>(null)
  const [cameraOn, setCameraOn] = useState(false)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)

  const micStreamRef = useRef<MediaStream | null>(null)
  const cameraStreamRef = useRef<MediaStream | null>(null)

  // 프리플라이트에서 "마이크 테스트 시작"을 눌렀을 때만 호출한다.
  const requestMic = useCallback(async () => {
    setMicError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      micStreamRef.current = stream
      setMicStream(stream)
      return true
    } catch {
      setMicError('마이크를 사용할 수 없습니다. 텍스트 모드로 계속 진행할 수 있습니다.')
      return false
    }
  }, [])

  const toggleCamera = useCallback(async () => {
    if (cameraOn) {
      cameraStreamRef.current?.getTracks().forEach((t) => t.stop())
      cameraStreamRef.current = null
      setCameraStream(null)
      setCameraOn(false)
      return
    }
    setCameraError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      cameraStreamRef.current = stream
      setCameraStream(stream)
      setCameraOn(true)
    } catch {
      setCameraError('카메라를 사용할 수 없습니다. 권한을 확인해주세요.')
    }
  }, [cameraOn])

  // 컴포넌트가 사라지면(면접 종료/페이지 이탈) 모든 트랙을 확실히 정리한다.
  useEffect(() => {
    return () => {
      micStreamRef.current?.getTracks().forEach((t) => t.stop())
      cameraStreamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  return {
    micStream,
    micError,
    requestMic,
    cameraOn,
    cameraStream,
    cameraError,
    toggleCamera,
  }
}
