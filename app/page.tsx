import Link from 'next/link'
import SupportBanner from '@/components/SupportBanner'
import HeroCard from '@/components/HeroCard'
import MacWindow from '@/components/MacWindow'
import { createClient } from '@/lib/supabase/server'

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'center', margin: '20px 0 40px' }}>
        <HeroCard />
      </div>

      <MacWindow title="voice-interview-jp — home">
        <h1 style={{ marginTop: 0, fontSize: 24 }}>
          일본 IT 면접을 일본어로, 반복해서, 비용 부담 없이 연습하세요.
        </h1>
        <p className="muted">브라우저 음성 인식/합성만 사용하는 완전 무료 모의 면접 트레이너 데모입니다.</p>
        <SupportBanner />
        <div className="cta-row">
          {user ? (
            <>
              <Link className="btn btn-primary" href="/level-check">
                레벨 체크 시작
              </Link>
              <Link className="btn" href="/interview">
                바로 면접 시작
              </Link>
            </>
          ) : (
            <Link className="btn btn-primary" href="/login">
              비밀번호 입력하고 시작하기
            </Link>
          )}
        </div>
      </MacWindow>

      <MacWindow>
        <h2 style={{ marginTop: 0 }}>이 데모에 포함된 기능</h2>
        <ul className="feature-list">
          <li>Web Speech API 기반 일본어 질문 낭독(TTS) · 실시간 답변 인식(STT)</li>
          <li>최초 레벨 체크: JLPT 자가 신고 + 짧은 진단(장음·경어 발음 확인)</li>
          <li>규칙(키워드) 기반 꼬리질문</li>
          <li>필러 · 정중체 비율 · 구체성 등 규칙 기반 자가 피드백</li>
          <li>Supabase에 세션 로그 저장 + 마이페이지 복습 · Markdown 내보내기</li>
          <li>STT 기술 용어 보정 사전 (사용자별 개인화)</li>
        </ul>
        <p className="muted small">
          자세한 기획 배경과 데모 범위는 저장소의 <code>readme_3.md</code>, <code>SETUP.md</code>를 참고하세요.
        </p>
      </MacWindow>
    </div>
  )
}
