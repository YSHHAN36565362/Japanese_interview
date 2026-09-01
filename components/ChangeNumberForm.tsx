'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { sanitizeIdNumber, idNumberToEmail, idNumberToPassword } from '@/lib/authNumber'

export default function ChangeNumberForm() {
  const router = useRouter()
  const [idNumber, setIdNumber] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setDone(false)

    const id = sanitizeIdNumber(idNumber)
    if (!id) {
      setError('숫자나 영문으로 된 고유 번호를 입력해주세요.')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({
      email: idNumberToEmail(id),
      password: idNumberToPassword(id),
    })
    setLoading(false)

    if (updateError) {
      if (updateError.message.toLowerCase().includes('already registered')) {
        setError('이미 다른 사람이 사용 중인 번호입니다. 다른 번호를 입력해주세요.')
      } else {
        setError(updateError.message)
      }
      return
    }

    setIdNumber('')
    setDone(true)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <input
        className="auth-input"
        style={{ maxWidth: 200, height: 36 }}
        type="text"
        inputMode="numeric"
        value={idNumber}
        onChange={(e) => setIdNumber(e.target.value)}
        placeholder="새 고유 번호"
      />
      <button className="btn btn-primary" type="submit" disabled={loading}>
        {loading ? '변경 중...' : '번호 변경'}
      </button>
      {done && <span className="badge badge-ok">변경되었습니다. 다음부터 새 번호로 입장하세요.</span>}
      {error && <span className="badge badge-error">{error}</span>}
    </form>
  )
}
