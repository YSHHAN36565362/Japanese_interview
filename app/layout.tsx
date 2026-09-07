import './globals.css'
import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'
import SiteChrome from '@/components/SiteChrome'

export const metadata = {
  title: 'Mensetsu Dojo',
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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&family=Noto+Serif+KR:wght@500;700;900&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="page-bg-fill" aria-hidden="true" />
        <SiteChrome userEmail={user?.email ?? null} isLoggedIn={!!user} isGuest={user?.is_anonymous ?? false}>
          {children}
        </SiteChrome>
      </body>
    </html>
  )
}
