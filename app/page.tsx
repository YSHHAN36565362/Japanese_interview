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
        {user ? (
          <span className="hero-card-wrap">
            <Link className="btn-3d btn-3d-lg" href="/interview">
              바로 면접 시작
            </Link>
          </span>
        ) : (
          <span className="hero-card-wrap">
            <Link className="btn-3d btn-3d-lg" href="/login">
              시작하기
            </Link>
          </span>
        )}
      </div>
    </div>
  )
}
