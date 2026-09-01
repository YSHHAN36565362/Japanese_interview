'use client'

import { useState, type FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    setLoading(false)
    if (error) setError(error.message)
    else setSent(true)
  }

  return (
    <div className="card narrow">
      <h1>로그인</h1>
      <p className="muted small">이메일로 매직 링크를 보내드립니다. 별도 비밀번호가 필요 없습니다.</p>
      {sent ? (
        <p className="badge badge-ok">메일함을 확인해 로그인 링크를 클릭해주세요.</p>
      ) : (
        <form onSubmit={handleSubmit} className="form">
          <label>
            이메일
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? '전송 중...' : '매직 링크 받기'}
          </button>
          {error && <p className="badge badge-error">{error}</p>}
        </form>
      )}
    </div>
  )
}
