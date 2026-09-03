import Link from 'next/link'
import SupportBanner from '@/components/SupportBanner'
import HeroCard from '@/components/HeroCard'
import { createClient } from '@/lib/supabase/server'

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div className="home-hero">
      <HeroCard />

      <h1 className="home-title">Mensetsu Dojo</h1>
      <p className="muted">상단의 마이페이지에서 고유번호를 저장해, 면접을 저장해보세요.</p>
      <SupportBanner />

      <div className="cta-row cta-row-hero">
        <span className="button-wrapper">
          <Link className="spiderverse-button" href={user ? '/interview' : '/login'}>
            {user ? '바로 면접 시작' : '시작하기'}
          </Link>
          <span className="glitch-layers" aria-hidden="true">
            <span className="glitch-layer layer-1">{user ? '바로 면접 시작' : '시작하기'}</span>
            <span className="glitch-layer layer-2">{user ? '바로 면접 시작' : '시작하기'}</span>
          </span>
          <span className="noise" aria-hidden="true" />
          <span className="glitch-slice" aria-hidden="true" />
        </span>
      </div>
    </div>
  )
}
