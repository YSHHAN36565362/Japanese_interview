'use client'

import { useParams, useSearchParams } from 'next/navigation'
import InterviewRoom from '@/features/interview/components/InterviewRoom'
import type { JobTrack } from '@/lib/questionBank'

export default function InterviewRunPage() {
  const params = useParams<{ sessionId: string }>()
  const searchParams = useSearchParams()
  const mode = searchParams.get('mode') ?? 'practice'
  const trackParam = searchParams.get('track')
  const track: JobTrack | undefined = trackParam === 'software' || trackParam === 'semiconductor' ? trackParam : undefined

  return <InterviewRoom sessionId={params.sessionId} mode={mode} track={track} />
}
