import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import LogoutButton from '@/components/LogoutButton'
import ChangeNumberForm from '@/components/ChangeNumberForm'
import SessionList from '@/components/SessionList'
import CustomTermManager from '@/components/CustomTermManager'
import { emailToIdNumber } from '@/lib/authNumber'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className="card">
        <p>로그인 후 이용할 수 있습니다.</p>
        <Link className="btn btn-primary" href="/login?redirect=/dashboard">
          로그인
        </Link>
      </div>
    )
  }

  // 보관기한이 지난 음성 로그를 pg_cron 대신 접속 시점에 정리한다 (readme_3.md §4 참고).
  const nowIso = new Date().toISOString()
  const { data: expired } = await supabase
    .from('session_answers')
    .select('id, audio_path')
    .lt('audio_expires_at', nowIso)
    .not('audio_path', 'is', null)

  if (expired && expired.length > 0) {
    const paths = expired.map((e) => e.audio_path).filter(Boolean) as string[]
    if (paths.length > 0) {
      await supabase.storage.from('interview-audio').remove(paths)
    }
    await supabase
      .from('session_answers')
      .update({ audio_path: null, audio_expires_at: null })
      .in(
        'id',
        expired.map((e) => e.id)
      )
  }

  const { data: sessions } = await supabase
    .from('sessions')
    .select('*, session_answers(duration_seconds, feedback_result)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const { data: terms } = await supabase
    .from('user_custom_terms')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const sessionRows = sessions ?? []
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const weekSessions = sessionRows.filter((s) => new Date(s.created_at).getTime() >= oneWeekAgo)
  const weekAnswers = weekSessions.flatMap((s) => (s.session_answers ?? []) as { duration_seconds: number | null }[])
  const weekDurations = weekAnswers.map((a) => a.duration_seconds).filter((v): v is number => v != null)
  const avgDurationSec = weekDurations.length
    ? Math.round(weekDurations.reduce((a, b) => a + b, 0) / weekDurations.length)
    : null

  // "고유 번호"는 별도 테이블에 저장하지 않는다 — id-{번호}@... 형식의 결정적 이메일에서
  // 그대로 복원한다(lib/authNumber.ts). 게스트(익명 로그인)는 이메일이 없어 null이 된다.
  const userCode = emailToIdNumber(user.email)

  return (
    <div className="mypage-page">
      <div className="mypage-head">
        <div>
          <h1 className="mode-page-title">마이페이지</h1>
          <p className="mode-page-subtitle">マイページ · 고유번호 하나로 기기를 옮겨도 기록이 따라옵니다.</p>
        </div>
        <LogoutButton />
      </div>

      <div className="mypage-grid">
        <div className="mypage-side">
          <div className="mypage-card">
            <div className="mypage-card-title">내 고유번호</div>
            <div className="mypage-code-box">{userCode ?? '게스트 (번호 없음)'}</div>
            <ChangeNumberForm />
            <div className="mypage-hint">이 번호를 메모해두세요. 번호를 잃으면 기록을 복구할 수 없습니다.</div>
          </div>

          <div className="mypage-card mypage-card-muted">
            <div className="mypage-card-title">이번 주</div>
            <div className="mypage-stat-row">
              <span>완료한 면접</span>
              <span className="mypage-stat-value">{weekSessions.length}회</span>
            </div>
            <div className="mypage-stat-row">
              <span>답변한 문항</span>
              <span className="mypage-stat-value">{weekAnswers.length}</span>
            </div>
            <div className="mypage-stat-row">
              <span>평균 답변 길이</span>
              <span className="mypage-stat-value">{avgDurationSec != null ? `${avgDurationSec}초` : '—'}</span>
            </div>
          </div>
        </div>

        <div className="mypage-main">
          <div className="mypage-card mypage-list-card">
            <div className="mypage-list-head">
              <span className="mypage-card-title">저장된 면접</span>
              <span className="mypage-list-sub">최근 순</span>
            </div>
            <SessionList sessions={sessionRows} />
          </div>
        </div>
      </div>

      <div className="mypage-card" style={{ marginTop: 20 }}>
        <div className="mypage-card-title">내 STT 보정 사전</div>
        <p className="muted small">
          답변 중 &quot;적용&quot;을 누른 기술 용어 표기가 자동으로 쌓이고, 이름처럼 카타카나·영어라
          인식이 잘 안 되는 표현은 아래에서 직접 추가할 수도 있습니다. 다음 면접부터 확정 답변에
          자동으로 반영됩니다.
        </p>
        <CustomTermManager terms={terms ?? []} />
      </div>
    </div>
  )
}
