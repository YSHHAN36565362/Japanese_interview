import type { FollowUpRule } from './types'

// 꼬리질문 규칙 매칭. AI가 답변을 "이해"해서 생성하는 방식이 아니라
// 키워드/조건 매칭만으로 다음 꼬리질문을 결정한다 (readme_3.md §7 규칙 엔진).
export function matchFollowUpRule(
  rules: FollowUpRule[],
  answerText: string,
  durationSeconds: number,
  expectedDurationSec: number
): FollowUpRule | null {
  const sorted = [...rules].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))

  for (const rule of sorted) {
    if (rule.trigger_type === 'keyword') {
      const keywords: string[] = rule.trigger_value ?? []
      if (keywords.some((k) => answerText.includes(k))) return rule
    } else if (rule.trigger_type === 'missing_keyword') {
      const keywords: string[] = rule.trigger_value ?? []
      if (keywords.length > 0 && !keywords.some((k) => answerText.includes(k))) return rule
    } else if (rule.trigger_type === 'answer_length') {
      const ratio = typeof rule.trigger_value === 'number' ? rule.trigger_value : 0.5
      if (durationSeconds > 0 && durationSeconds < expectedDurationSec * ratio) return rule
    } else if (rule.trigger_type === 'random') {
      if (Math.random() < 0.5) return rule
    }
  }
  return null
}
