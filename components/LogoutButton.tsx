'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LogoutButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleLogout() {
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    setLoading(false)
    router.push('/')
    router.refresh()
  }

  return (
    <button className="btn" onClick={handleLogout} disabled={loading}>
      {loading ? '로그아웃 중...' : '로그아웃'}
    </button>
  )
}
