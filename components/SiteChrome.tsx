'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

// 면접 진행 화면("면접실")은 가이드가 말하는 "집중 모드"를 위해 사이트 공통 상단바/푸터를
// 완전히 숨기고 전체 화면을 사용한다. 그 외 화면은 "面接道場" 브랜드 헤더를 유지한다.
export default function SiteChrome({
  children,
  userEmail,
  isLoggedIn,
  isGuest,
}: {
  children: ReactNode
  userEmail: string | null
  isLoggedIn: boolean
  isGuest: boolean
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
            <span className="topbar-brand-mark" aria-hidden="true" />
            <span className="topbar-brand-kanji">面接道場</span>
            <span className="topbar-brand-en">Mensetsu Dojo</span>
          </Link>
          <nav className="nav">
            <Link href="/interview">면접 시작</Link>
            <Link href="/dashboard">마이페이지</Link>
            {isLoggedIn ? (
              <span className="topbar-account-pill">
                <span className={`topbar-account-dot${isGuest ? ' is-guest' : ''}`} aria-hidden="true" />
                {isGuest ? '게스트' : userEmail ?? '번호 저장됨'}
              </span>
            ) : (
              <Link href="/login" className="topbar-enter-link">
                입장하기
              </Link>
            )}
          </nav>
        </div>
      </header>
      <main className="container main">{children}</main>
    </>
  )
}
