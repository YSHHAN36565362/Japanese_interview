import { useCallback, useRef, useState } from 'react'

// ja-JP 실시간 음성 인식 훅. 서버 호출 없이 브라우저 SpeechRecognition만 사용한다.
export function useSpeechRecognition() {
  const recognitionRef = useRef<any>(null)
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [firstSpeechAt, setFirstSpeechAt] = useState<number | null>(null)
  const [supported, setSupported] = useState(true)

  const start = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) {
      setSupported(false)
      return
    }

    const recognition = new SR()
    recognition.lang = 'ja-JP'
    recognition.continuous = true
    recognition.interimResults = true

    let finalText = ''

    recognition.onspeechstart = () => {
      setFirstSpeechAt(Date.now())
    }

    recognition.onresult = (event: any) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const chunk = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalText += chunk
        } else {
          interim += chunk
        }
      }
      setTranscript(finalText + interim)
    }

    recognition.onerror = () => {
      setListening(false)
    }

    recognition.onend = () => {
      setListening(false)
    }

    recognitionRef.current = recognition
    setTranscript('')
    setFirstSpeechAt(null)
    recognition.start()
    setListening(true)
  }, [])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
    setListening(false)
  }, [])

  return { start, stop, listening, transcript, setTranscript, firstSpeechAt, supported }
}
