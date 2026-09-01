'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import MacWindow from '@/components/MacWindow'

// 소규모(5~10명) 비공개 데모용 공유 비밀번호. 이메일 발송(회원가입/매직 링크 등)이 전혀 없고,
// 이 값만 클라이언트에서 확인한 뒤 Supabase 익명 로그인으로 세션을 발급한다.
const SHARED_PASSWORD = 'kmove13'

export default function LoginPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password !== SHARED_PASSWORD) {
      setError('비밀번호가 틀렸습니다.')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInAnonymously()
    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }
    router.push('/level-check')
    router.refresh()
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <MacWindow title="voice-interview-jp — enter">
        <form onSubmit={handleSubmit} className="auth-form">
          <p className="auth-form-title">
            면접 연습 입장
            <span>비밀번호를 입력하면 별도 이메일 인증 없이 바로 시작합니다.</span>
          </p>

          <input
            className="auth-input"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호"
            autoFocus
          />

          <button className="auth-confirm-btn" type="submit" disabled={loading}>
            {loading ? '입장하는 중...' : 'ENTER'}
          </button>

          {error && <p className="badge badge-error">{error}</p>}
        </form>
      </MacWindow>
    </div>
  )
}
