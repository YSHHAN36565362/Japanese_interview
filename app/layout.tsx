import './globals.css'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export const metadata = {
  title: 'Voice Interview JP (데모)',
  description: '일본 IT 면접 대비 무료 음성 모의 면접 트레이너 데모',
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <html lang="ko">
      <body>
        <header className="topbar">
          <div className="container topbar-inner">
            <Link href="/" className="brand">
              Voice Interview JP
            </Link>
            <nav className="nav">
              <Link href="/interview">면접 시작</Link>
              <Link href="/level-check">레벨 체크</Link>
              <Link href="/dashboard">마이페이지</Link>
              {user ? <span className="user-email">{user.email}</span> : <Link href="/login">로그인</Link>}
            </nav>
          </div>
        </header>
        <main className="container main">{children}</main>
        <footer className="footer">
          <div className="container">무료 배포 데모 · Next.js + Vercel + Supabase + Web Speech API</div>
        </footer>
      </body>
    </html>
  )
}
