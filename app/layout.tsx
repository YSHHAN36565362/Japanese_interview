import './globals.css'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import MatrixBackground from '@/components/MatrixBackground'

export const metadata = {
  title: 'Voice Interview JP (데모)',
  description: '일본 IT 면접 대비 무료 음성 모의 면접 트레이너 데모',
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  // Supabase 프로젝트에 아직 연결되지 않았거나(URL 오류 등) 일시적으로 응답이 없어도
  // 전체 페이지가 500 에러로 죽지 않도록 방어적으로 처리한다.
  const user = await supabase
    .auth.getUser()
    .then(({ data }) => data.user)
    .catch(() => null)

  return (
    <html lang="ko">
      <body>
        <div className="page-bg-fill" aria-hidden="true" />
        <MatrixBackground />
        <header className="topbar">
          <div className="topbar-titlebar">
            <span className="mac-dot red" />
            <span className="mac-dot yellow" />
            <span className="mac-dot green" />
            <Link href="/" className="topbar-tabtitle">
              Voice Interview JP
            </Link>
          </div>
          <div className="topbar-toolbar-outer">
            <div className="container topbar-toolbar">
              <nav className="nav">
                <Link href="/interview">면접 시작</Link>
                <Link href="/level-check">레벨 체크</Link>
                <Link href="/dashboard">마이페이지</Link>
              </nav>
              {user ? (
                <span className="user-email">{user.email ?? '게스트 세션'}</span>
              ) : (
                <Link href="/login" className="topbar-enter-link">
                  입장하기
                </Link>
              )}
            </div>
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
