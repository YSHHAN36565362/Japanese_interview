import Link from 'next/link'
import SupportBanner from '@/components/SupportBanner'
import { createClient } from '@/lib/supabase/server'
import { getMainQuestionCount } from '@/lib/questionBank'

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const isLoggedIn = !!user
  const isGuest = user?.is_anonymous ?? false

  return (
    <div className="home-hero">
      <div className="home-hero-main">
        <SupportBanner />

        <h1 className="home-headline">
          일본 면접,
          <br />
          혼자서도 실전처럼.
        </h1>
        <p className="home-lede">
          면접관이 일본어로 질문하고, 당신의 답변을 실시간으로 받아 적습니다. 제한 시간 안에 답하고, 끝나면 문항별로
          무엇이 부족했는지 남습니다.
        </p>
        <p className="home-lede-ja">面接官が日本語で質問し、回答をリアルタイムで文字にします。</p>

        <div className="home-cta-row">
          <Link className="btn-dojo btn-dojo-primary" href={isLoggedIn ? '/interview' : '/login'}>
            면접 시작하기
          </Link>
          <Link className="btn-dojo btn-dojo-secondary" href={isLoggedIn ? '/dashboard' : '/login'}>
            고유번호로 기록 열기
          </Link>
        </div>

        <div className="home-stats-row">
          <div className="home-stat-card">
            <div className="home-stat-value">{getMainQuestionCount()}</div>
            <div className="home-stat-label">수록 질문 · 8개 대분류</div>
          </div>
          <div className="home-stat-card">
            <div className="home-stat-value">3</div>
            <div className="home-stat-label">모드 · 연습 / 실전 / 기술</div>
          </div>
          <div className="home-stat-card">
            <div className="home-stat-value">0円</div>
            <div className="home-stat-label">브라우저 음성 사용 · 추가 비용 없음</div>
          </div>
        </div>
      </div>

      <div className="home-hero-side">
        <div className="home-steps-card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/hero-illustration.svg"
            alt="면접 장면 일러스트"
            className="home-steps-illustration-img"
          />
          <div className="home-steps-body">
            <div className="home-steps-title">3단계로 끝납니다</div>
            <div className="home-steps-list">
              <div className="home-step-row">
                <span className="home-step-num">01</span>
                <span>모드를 고릅니다 · 처음이면 연습 모드</span>
              </div>
              <div className="home-step-row">
                <span className="home-step-num">02</span>
                <span>마이크를 테스트합니다 · 없으면 텍스트로</span>
              </div>
              <div className="home-step-row">
                <span className="home-step-num">03</span>
                <span>질문에 답합니다 · 남은 시간은 항상 상단에</span>
              </div>
            </div>
          </div>
        </div>

        {isGuest && (
          <div className="home-guest-notice">
            <span className="home-guest-dot" aria-hidden="true" />
            <div>
              기록을 남기려면 고유번호가 필요합니다. 저장하지 않으면 세션이 끝날 때 사라집니다.{' '}
              <Link href="/dashboard" className="home-guest-link">
                고유번호 저장하기 →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
