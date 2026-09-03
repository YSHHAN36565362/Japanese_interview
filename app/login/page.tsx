'use client'

import { useState, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { sanitizeIdNumber, idNumberToEmail, idNumberToPassword } from '@/lib/authNumber'
import MacWindow from '@/components/MacWindow'

export default function LoginPage() {
  const router = useRouter()
  // 마이페이지처럼 로그인이 필요한 화면에서 "로그인" 버튼을 눌러 여기로 온 경우, 로그인 후
  // 항상 /interview로 보내면 원래 가려던 곳(예: 마이페이지)에 다시 못 들어가는 것처럼
  // 느껴진다 — redirect 쿼리로 원래 목적지를 받아서 로그인 후 그리로 돌려보낸다.
  const searchParams = useSearchParams()
  // redirect 쿼리가 없는 일반 로그인이면 이력서 업로드 단계(app/interview/resume)를 먼저
  // 거치게 한다 — 마이페이지 등 특정 화면 때문에 로그인하러 온 경우(redirect 쿼리 있음)는
  // 그 화면으로 바로 돌려보내고 이력서 업로드로 가로막지 않는다.
  const redirectTo = searchParams.get('redirect') || '/interview/resume'
  const [idNumber, setIdNumber] = useState('')
  const [loading, setLoading] = useState(false)
  const [guestLoading, setGuestLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGuestEnter() {
    setError(null)
    setGuestLoading(true)
    const supabase = createClient()
    const { error: anonError } = await supabase.auth.signInAnonymously()
    setGuestLoading(false)

    if (anonError) {
      if (anonError.message.toLowerCase().includes('anonymous sign-ins are disabled')) {
        setError(
          '이 Supabase 프로젝트에서 "번호 없이 시작하기"(Anonymous Sign-Ins)가 꺼져 있습니다. ' +
            'Supabase 대시보드 → Authentication → Sign In / Providers → Anonymous Sign-Ins를 켜주세요 (SETUP.md 참고).'
        )
      } else {
        setError(anonError.message)
      }
      return
    }
    router.push(redirectTo)
    router.refresh()
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    const id = sanitizeIdNumber(idNumber)
    if (!id) {
      setError('숫자나 영문으로 된 고유 번호를 입력해주세요.')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const email = idNumberToEmail(id)
    const password = idNumberToPassword(id)

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    if (signInError) {
      // 처음 쓰는 번호면 새 계정을 만든다.
      const { error: signUpError } = await supabase.auth.signUp({ email, password })
      if (signUpError) {
        setLoading(false)
        if (signUpError.message.toLowerCase().includes('signups not allowed')) {
          setError(
            '이 Supabase 프로젝트에서 이메일 회원가입이 꺼져 있어 입장할 수 없습니다. ' +
              'Supabase 대시보드 → Authentication → Providers → Email 설정을 확인해주세요 (SETUP.md 1-3 참고).'
          )
        } else {
          setError(signUpError.message)
        }
        return
      }
    }

    setLoading(false)
    router.push(redirectTo)
    router.refresh()
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <MacWindow title="mensetsu-dojo — enter">
        <form onSubmit={handleSubmit} className="auth-form">
          <p className="auth-form-title">
            면접 연습 입장
            <span>
              기억하기 쉬운 고유 번호(예: 생일)를 입력하면 바로 시작합니다. 같은 번호를 입력하면 다른
              기기에서도 저장된 기록을 이어서 볼 수 있습니다. 기록을 남기고 싶지 않다면 번호 없이도
              바로 시작할 수 있습니다.
            </span>
          </p>

          <input
            className="auth-input"
            type="text"
            inputMode="numeric"
            required
            value={idNumber}
            onChange={(e) => setIdNumber(e.target.value)}
            placeholder="고유 번호 (예: 010721)"
            autoFocus
          />

          <button className="auth-confirm-btn" type="submit" disabled={loading || guestLoading}>
            {loading ? '입장하는 중...' : 'ENTER'}
          </button>

          <button
            type="button"
            className="btn"
            onClick={handleGuestEnter}
            disabled={loading || guestLoading}
          >
            {guestLoading ? '입장하는 중...' : '번호 없이 시작하기 (기록 저장 안 됨)'}
          </button>

          {error && <p className="badge badge-error">{error}</p>}
        </form>
      </MacWindow>
    </div>
  )
}
