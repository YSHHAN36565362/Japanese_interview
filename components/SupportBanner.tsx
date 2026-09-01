'use client'

import { useEffect, useState } from 'react'
import { checkSupport, type SupportStatus } from '@/lib/webSpeech'

export default function SupportBanner() {
  const [status, setStatus] = useState<SupportStatus | null>(null)

  useEffect(() => {
    setStatus(checkSupport())
  }, [])

  if (!status) return null

  if (status.sttSupported && status.ttsSupported) {
    return <p className="badge badge-ok">이 브라우저는 음성 인식/합성을 모두 지원합니다. (Chrome, Edge 권장)</p>
  }

  return (
    <p className="badge badge-warn">
      이 브라우저는 음성 기능 일부를 지원하지 않을 수 있습니다. Chrome 또는 Edge 사용을 권장하며, 미지원
      시에는 답변창에 텍스트를 직접 입력해 계속 진행할 수 있습니다.
    </p>
  )
}
