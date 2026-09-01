import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import MarkdownExportButton from '@/components/MarkdownExportButton'
import MacWindow from '@/components/MacWindow'

export default async function ResultPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params
  const supabase = await createClient()

  const { data: session } = await supabase.from('sessions').select('*').eq('id', sessionId).maybeSingle()

  const { data: answers } = await supabase
    .from('session_answers')
    .select(
      '*, question:questions!session_answers_question_id_fkey(text_ja, text_ko), follow_up:questions!session_answers_follow_up_question_id_fkey(text_ja, text_ko)'
    )
    .eq('session_id', sessionId)
    .order('answered_at', { ascending: true })

  if (!session) {
    return <p>세션을 찾을 수 없습니다.</p>
  }

  const rows = answers ?? []
  const avgDuration = rows.length
    ? (rows.reduce((sum, r) => sum + (r.duration_seconds ?? 0), 0) / rows.length).toFixed(1)
    : '0'
  const totalFillers = rows.reduce((sum, r) => {
    const counts = (r.filler_counts ?? {}) as Record<string, number>
    return sum + Object.values(counts).reduce((a, b) => a + b, 0)
  }, 0)
  const politenessValues = rows.map((r) => r.politeness_score_ratio).filter((v): v is number => v != null)
  const avgPoliteness = politenessValues.length
    ? (politenessValues.reduce((a, b) => a + b, 0) / politenessValues.length).toFixed(2)
    : '—'

  return (
    <MacWindow title="voice-interview-jp — result">
      <h1 style={{ marginTop: 0 }}>세션 리포트</h1>
      <p className="muted">
        모드: {session.mode} · {new Date(session.created_at).toLocaleString('ko-KR')}
      </p>

      <div className="stat-row">
        <div className="stat-card">
          <strong>{rows.length}</strong>
          <span>답변 수</span>
        </div>
        <div className="stat-card">
          <strong>{avgDuration}s</strong>
          <span>평균 답변 시간</span>
        </div>
        <div className="stat-card">
          <strong>{totalFillers}</strong>
          <span>필러 총합</span>
        </div>
        <div className="stat-card">
          <strong>{avgPoliteness}</strong>
          <span>평균 정중체 비율(추정치)</span>
        </div>
      </div>

      <MarkdownExportButton session={session} answers={rows as any} />

      <div className="qa-list">
        {rows.map((r) => (
          <div key={r.id} className="card">
            <span className="badge">{r.follow_up ? '꼬리 질문' : '질문'}</span>
            <p className="question-ja">{r.question?.text_ja ?? r.follow_up?.text_ja}</p>
            <p>{r.corrected_answer_text}</p>
            <p className="muted small">
              {r.duration_seconds != null && <>답변 {Math.round(r.duration_seconds)}초 · </>}
              {r.politeness_score_ratio != null && <>정중체 비율(추정) {r.politeness_score_ratio} · </>}
              필러 {Object.values((r.filler_counts ?? {}) as Record<string, number>).reduce((a, b) => a + b, 0)}회
            </p>
          </div>
        ))}
      </div>

      <Link className="btn" href="/dashboard">
        마이페이지로 돌아가기
      </Link>
    </MacWindow>
  )
}
