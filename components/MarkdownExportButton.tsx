'use client'

import { formatKST } from '@/lib/formatDate'

type AnswerRow = {
  corrected_answer_text: string | null
  duration_seconds: number | null
  politeness_score_ratio: number | null
  question?: { text_ja: string } | null
  follow_up?: { text_ja: string } | null
}

type SessionRow = {
  id: string
  mode: string
  created_at: string
}

export default function MarkdownExportButton({
  session,
  answers,
}: {
  session: SessionRow
  answers: AnswerRow[]
}) {
  function download() {
    const lines: string[] = []
    lines.push('# 면접 세션 리포트')
    lines.push('')
    lines.push(`- 모드: ${session.mode}`)
    lines.push(`- 일시: ${formatKST(session.created_at)}`)
    lines.push('')

    answers.forEach((a, i) => {
      const q = a.question?.text_ja ?? a.follow_up?.text_ja ?? ''
      lines.push(`## ${i + 1}. ${q}`)
      lines.push('')
      lines.push(a.corrected_answer_text ?? '')
      lines.push('')
      lines.push(
        `> 답변 시간: ${a.duration_seconds ? Math.round(a.duration_seconds) + '초' : '—'} / 정중체 비율(추정): ${
          a.politeness_score_ratio ?? '—'
        }`
      )
      lines.push('')
    })

    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `interview-session-${session.id}.md`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button className="btn" onClick={download}>
      Markdown 다운로드
    </button>
  )
}
