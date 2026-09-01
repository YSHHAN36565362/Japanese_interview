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

      <h1 className="home-title">일본 IT 면접을 일본어로, 반복해서, 비용 부담 없이 연습하세요.</h1>
      <p className="muted">브라우저 음성 인식/합성만 사용하는 완전 무료 모의 면접 트레이너 데모입니다.</p>
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
