'use client'

import { useParams, useSearchParams } from 'next/navigation'
import InterviewRoom from '@/features/interview/components/InterviewRoom'

export default function InterviewRunPage() {
  const params = useParams<{ sessionId: string }>()
  const searchParams = useSearchParams()
  const mode = searchParams.get('mode') ?? 'practice'

  return <InterviewRoom sessionId={params.sessionId} mode={mode} />
}
