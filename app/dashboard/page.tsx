import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import MacWindow from '@/components/MacWindow'
import LogoutButton from '@/components/LogoutButton'
import ChangeNumberForm from '@/components/ChangeNumberForm'
import SessionList from '@/components/SessionList'
import CustomTermManager from '@/components/CustomTermManager'
import { formatKST } from '@/lib/formatDate'

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
    .select('*, session_answers(count)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const { data: terms } = await supabase
    .from('user_custom_terms')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <MacWindow title="mensetsu-dojo — my page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ marginTop: 0 }}>마이페이지</h1>
        <LogoutButton />
      </div>

      <section className="card">
        <h2>고유 번호 변경</h2>
        <p className="muted small">
          번호를 바꿔도 지금까지의 기록은 그대로 유지됩니다. 다음부터는 새 번호로 입장하세요.
        </p>
        <ChangeNumberForm />
      </section>

      <section className="card">
        <h2>지난 세션</h2>
        <SessionList sessions={sessions ?? []} />
      </section>

      <section className="card">
        <h2>내 STT 보정 사전</h2>
        <p className="muted small">
          답변 중 &quot;적용&quot;을 누른 기술 용어 표기가 자동으로 쌓이고, 이름처럼 카타카나·영어라
          인식이 잘 안 되는 표현은 아래에서 직접 추가할 수도 있습니다. 다음 면접부터 확정 답변에
          자동으로 반영됩니다.
        </p>
        <CustomTermManager terms={terms ?? []} />
      </section>
    </MacWindow>
  )
}
