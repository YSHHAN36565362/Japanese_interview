import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import MarkdownExportButton from '@/components/MarkdownExportButton'
import MacWindow from '@/components/MacWindow'
import LikeButton from '@/components/LikeButton'
import { getQuestionById } from '@/lib/questionBank'
import { formatKST } from '@/lib/formatDate'
import { computeSessionScore, computeCompositeScore } from '@/lib/sessionScore'

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
    return (
      <div className="card">
        <p>세션을 찾을 수 없습니다.</p>
        <p className="muted small">
          번호 없이 게스트로 진행한 세션은 저장되지 않아 결과를 다시 볼 수 없습니다. 기록을 남기고
          싶으시면 마이페이지에서 고유 번호로 입장한 뒤 면접을 진행해주세요.
        </p>
        <Link className="btn" href="/dashboard">
          마이페이지로 돌아가기
        </Link>
      </div>
    )
  }

  // 질문 텍스트는 기본적으로 로컬 data/questions.json(질문 은행)에서 가져온다. 이력서 기반
  // 질문(resume_*)은 그 파일에 없으므로, 답변 당시 저장해 둔 question_text_snapshot을 우선 쓴다.
  const rows = (answers ?? []).map((r) => {
    const isFollowUp = !!r.follow_up_question_id
    const question = getQuestionById((isFollowUp ? r.follow_up_question_id : r.question_id) ?? '')
    return {
      ...r,
      isFollowUp,
      questionTextJa: r.question_text_snapshot ?? question?.textJa ?? '(삭제되었거나 알 수 없는 질문)',
      expectedDurationSec: question?.expectedDurationSec ?? null,
    }
  })

  const avgDuration = rows.length
    ? (rows.reduce((sum, r) => sum + (r.duration_seconds ?? 0), 0) / rows.length).toFixed(1)
    : '0'
  const totalFillers = rows.reduce((sum, r) => {
    const counts = (r.filler_counts ?? {}) as Record<string, number>
    return sum + Object.values(counts).reduce((a, b) => a + b, 0)
  }, 0)
  const answerTexts = rows.map((r) => r.corrected_answer_text ?? r.stt_raw_text ?? '')
  const totalChars = answerTexts.reduce((sum, t) => sum + t.length, 0)

  // 2026-09-02 개편: 예전에는 질문마다 이미 계산해둔 정중체 비율을 그냥 평균 냈는데, 이건
  // 답변 길이와 무관하게 질문마다 같은 가중치를 줘서 통계적으로 부정확했다. 이제는 세션의
  // 모든 문장을 한 번에 모아(pool) 계산한다(computeSessionScore) — 개선된 정중체/반말체
  // 판정 규칙(ます형 활용, 사전형 동사 등도 인식)을 함께 적용해 더 정확하다.
  const score = computeSessionScore(answerTexts)
  // 종합 점수 = 말투 정확도(정중체 판정에 결함 없는 문장 비율) 70% + 필러 적음 정도 30%.
  // "종합"이라는 이름에 맞게 말투 하나만이 아니라 필러(간투사) 비율도 반영했다 — 답변 시간
  // 적정성은 질문별로 이미 배지(길어요/짧아요/적당해요)로 보여주고 있어 중복으로 넣지 않았다.
  const composite = computeCompositeScore(score.toneScorePercent, totalFillers, totalChars)

  const scoreBand = (percent: number | null) =>
    percent == null ? '' : percent >= 80 ? 'score-card-good' : percent >= 50 ? 'score-card-mid' : 'score-card-bad'
  const politenessPercent = score.politenessRatio != null ? Math.round(score.politenessRatio * 100) : null

  return (
    <MacWindow title="mensetsu-dojo — result">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <h1 style={{ marginTop: 0 }}>세션 리포트</h1>
          <p className="muted">
            모드: {session.mode} · {formatKST(session.created_at)}
          </p>
        </div>
        <LikeButton />
      </div>

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
      </div>

      <div className="score-row">
        <div className={`score-card ${scoreBand(politenessPercent)}`}>
          <strong>{politenessPercent != null ? `${politenessPercent}%` : '—'}</strong>
          <span>정중체 비율(추정)</span>
          <p className="score-card-detail">
            {score.judgedSentenceCount > 0
              ? `판정 가능한 ${score.judgedSentenceCount}문장 중 정중체 ${score.politeSentenceCount}문장`
              : '정중체/반말체를 판정할 문장이 없습니다'}
          </p>
        </div>
        <div className={`score-card ${scoreBand(composite.overallPercent)}`}>
          <strong>{composite.overallPercent != null ? `${composite.overallPercent}점` : '—'}</strong>
          <span>종합 점수(추정, 저장 안 됨)</span>
          <p className="score-card-detail">
            말투 정확도 {score.toneScorePercent ?? '—'}점(70%) + 필러 적음 정도 {composite.fillerScorePercent}점(30%)
          </p>
        </div>
      </div>

      <p className="muted small">
        경어 오류(반말 종결) {score.casualSentenceCount}회 · 장음 인식 오류 {score.choonDefectCount}회 · 전체{' '}
        {score.totalSentences}문장 중 {score.wellSaidCount}문장 양호. 정중체 비율은 질문마다 따로 평균 내지 않고
        세션의 모든 문장을 한 번에 모아 계산합니다. 이 점수는 이 화면에서만 계산되며 어디에도 저장되지
        않습니다 — 텍스트 전체는 아래 Markdown 다운로드나 마이페이지에서 언제든 다시 볼 수 있습니다.
      </p>

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
            <span className={`badge${r.isFollowUp ? ' badge-followup' : ''}`}>{r.isFollowUp ? '꼬리 질문' : '질문'}</span>
            <p className="question-ja">{r.questionTextJa}</p>
            <p>{r.corrected_answer_text}</p>
            {r.duration_seconds != null && (
              <p className="qa-duration-badge">
                답변 시간 {Math.round(r.duration_seconds)}초
                {r.expectedDurationSec != null && (
                  <>
                    {' '}
                    / 목표 {r.expectedDurationSec}초
                    <span
                      className={
                        r.duration_seconds > r.expectedDurationSec * 1.3
                          ? ' qa-duration-tag qa-duration-tag-long'
                          : r.duration_seconds < r.expectedDurationSec * 0.5
                            ? ' qa-duration-tag qa-duration-tag-short'
                            : ' qa-duration-tag qa-duration-tag-ok'
                      }
                    >
                      {r.duration_seconds > r.expectedDurationSec * 1.3
                        ? '길어요'
                        : r.duration_seconds < r.expectedDurationSec * 0.5
                          ? '짧아요'
                          : '적당해요'}
                    </span>
                  </>
                )}
              </p>
            )}
            <p className="muted small">
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
