import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import MarkdownExportButton from '@/components/MarkdownExportButton'
import MacWindow from '@/components/MacWindow'
import { getQuestionById } from '@/lib/questionBank'
import { formatKST } from '@/lib/formatDate'

export default async function ResultPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params
  const supabase = await createClient()

  const { data: session } = await supabase.from('sessions').select('*').eq('id', sessionId).maybeSingle()

  const { data: answers } = await supabase
    .from('session_answers')
    .select('*')
    .eq('session_id', sessionId)
    .order('answered_at', { ascending: true })

  if (!session) {
    return <p>세션을 찾을 수 없습니다.</p>
  }

  // 질문 텍스트는 Supabase가 아니라 로컬 data/questions.json(질문 은행)에서 가져온다.
  const rows = (answers ?? []).map((r) => {
    const isFollowUp = !!r.follow_up_question_id
    const question = getQuestionById((isFollowUp ? r.follow_up_question_id : r.question_id) ?? '')
    return { ...r, isFollowUp, questionTextJa: question?.textJa ?? '(삭제되었거나 알 수 없는 질문)' }
  })

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
        모드: {session.mode} · {formatKST(session.created_at)}
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

      <MarkdownExportButton
        session={session}
        answers={rows.map((r) => ({
          corrected_answer_text: r.corrected_answer_text,
          duration_seconds: r.duration_seconds,
          politeness_score_ratio: r.politeness_score_ratio,
          question: { text_ja: r.questionTextJa },
        }))}
      />

      <div className="qa-list">
        {rows.map((r) => (
          <div key={r.id} className="card">
            <span className="badge">{r.isFollowUp ? '꼬리 질문' : '질문'}</span>
            <p className="question-ja">{r.questionTextJa}</p>
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
