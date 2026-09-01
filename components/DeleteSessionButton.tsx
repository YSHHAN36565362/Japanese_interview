'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function DeleteSessionButton({ sessionId }: { sessionId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    if (!window.confirm('이 세션 기록을 삭제하시겠습니까? 되돌릴 수 없습니다.')) return
    setLoading(true)
    const supabase = createClient()
    await supabase.from('session_answers').delete().eq('session_id', sessionId)
    await supabase.from('sessions').delete().eq('id', sessionId)
    setLoading(false)
    router.refresh()
  }

  return (
    <button className="btn btn-small" onClick={handleDelete} disabled={loading}>
      {loading ? '삭제 중...' : '삭제'}
    </button>
  )
}
