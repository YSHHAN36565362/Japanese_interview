import './globals.css'
import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'
import MatrixBackground from '@/components/MatrixBackground'
import SiteChrome from '@/components/SiteChrome'

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
        <SiteChrome userEmail={user?.email ?? null} isLoggedIn={!!user}>
          {children}
        </SiteChrome>
      </body>
    </html>
  )
}
