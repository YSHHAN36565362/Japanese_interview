'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

// 면접 진행 화면("면접실")은 가이드가 말하는 "집중 모드"를 위해 사이트 공통 상단바/푸터를
// 완전히 숨기고 전체 화면을 사용한다. 그 외 화면은 기존 macOS Safari 스타일 상단바를 유지한다.
export default function SiteChrome({
  children,
  userEmail,
  isLoggedIn,
}: {
  children: ReactNode
  userEmail: string | null
  isLoggedIn: boolean
}) {
  const pathname = usePathname()
  const isRoom = pathname?.startsWith('/interview/run')

  if (isRoom) {
    return <>{children}</>
  }

  return (
    <>
      <header className="topbar">
        <div className="container topbar-toolbar">
          <Link href="/" className="topbar-brand">
            Voice Interview JP
          </Link>
          <nav className="nav">
            <Link href="/interview">면접 시작</Link>
            <Link href="/level-check">레벨 체크</Link>
            <Link href="/dashboard">마이페이지</Link>
          </nav>
          {isLoggedIn ? (
            <span className="user-email">{userEmail ?? '게스트 세션'}</span>
          ) : (
            <Link href="/login" className="topbar-enter-link">
              입장하기
            </Link>
          )}
        </div>
      </header>
      <main className="container main">{children}</main>
      <footer className="footer">
        <div className="container">무료 배포 데모 · Next.js + Vercel + Supabase + Web Speech API</div>
      </footer>
    </>
  )
}
