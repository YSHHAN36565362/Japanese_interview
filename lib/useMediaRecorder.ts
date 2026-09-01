import { useCallback, useRef, useState } from 'react'

const CANDIDATE_MIME_TYPES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
  'audio/webm;codecs=opus',
  'audio/webm',
]

function pickMimeType() {
  if (typeof MediaRecorder === 'undefined') return undefined
  return CANDIDATE_MIME_TYPES.find((t) => MediaRecorder.isTypeSupported(t))
}

// 화상/음성 녹화를 서버 업로드 없이 브라우저 안에서만 처리하고,
// 종료 시 사용자의 기기(다운로드 폴더)에 바로 저장한다 (Supabase Storage 미사용).
export function useMediaRecorder(constraints: MediaStreamConstraints, filePrefix: string) {
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  const start = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream
      const mimeType = pickMimeType()
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'application/octet-stream' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${filePrefix}-${Date.now()}.webm`
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
        streamRef.current?.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }

      recorder.start()
      recorderRef.current = recorder
      setRecording(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : '녹화를 시작할 수 없습니다.')
      setRecording(false)
    }
  }, [constraints, filePrefix])

  const stop = useCallback(() => {
    recorderRef.current?.stop()
    recorderRef.current = null
    setRecording(false)
  }, [])

  return { recording, start, stop, error }
}
