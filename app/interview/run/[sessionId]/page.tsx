'use client'

import { useParams, useSearchParams } from 'next/navigation'
import InterviewRoom from '@/features/interview/components/InterviewRoom'
import { TOPIC_CATEGORIES, type JobTrack, type TopicCategoryId } from '@/lib/questionBank'

const TOPIC_CATEGORY_IDS = new Set(TOPIC_CATEGORIES.map((c) => c.id))

export default function InterviewRunPage() {
  const params = useParams<{ sessionId: string }>()
  const searchParams = useSearchParams()
  const mode = searchParams.get('mode') ?? 'practice'
  const trackParam = searchParams.get('track')
  const track: JobTrack | undefined =
    trackParam === 'software' || trackParam === 'semiconductor' || trackParam === 'general' ? trackParam : undefined
  // 카테고리 체크박스 화면(app/interview/page.tsx)에서 고른 세부 주제, 쉼표로 구분된 id 목록.
  const categoriesParam = searchParams.get('categories')
  const topicCategories: TopicCategoryId[] | undefined = categoriesParam
    ? (categoriesParam.split(',').filter((id) => TOPIC_CATEGORY_IDS.has(id as TopicCategoryId)) as TopicCategoryId[])
    : undefined

  return <InterviewRoom sessionId={params.sessionId} mode={mode} track={track} topicCategories={topicCategories} />
}
