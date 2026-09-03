import type { BankFollowUp } from './questionBank'
import type { FeedbackResult } from './feedback'

// 꼬리질문 규칙 매칭. AI가 답변을 "이해"해서 생성하는 방식이 아니라
// 키워드/조건 매칭만으로 다음 꼬리질문을 결정한다 (readme_3.md §7 규칙 엔진).
// analysis는 evaluateAnswer()가 답변마다 이미 계산해 둔 구조화된 신호(hasNumberOrResult 등)를
// 그대로 재사용하기 위한 것 — missing_number 트리거 타입이 이걸 쓴다. 호출부가 안 넘기면
// (analysis 미지정) missing_number 규칙은 그냥 매칭되지 않고 다음 규칙으로 넘어간다.
export function matchFollowUpRule(
  rules: BankFollowUp[],
  answerText: string,
  durationSeconds: number,
  expectedDurationSec: number,
  analysis?: Pick<FeedbackResult, 'hasNumberOrResult'>
): BankFollowUp | null {
  const sorted = [...rules].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))

  for (const rule of sorted) {
    if (rule.triggerType === 'keyword') {
      const keywords = rule.keywords ?? []
      if (keywords.some((k) => answerText.includes(k))) return rule
    } else if (rule.triggerType === 'missing_keyword') {
      const keywords = rule.keywords ?? []
      if (keywords.length > 0 && !keywords.some((k) => answerText.includes(k))) return rule
    } else if (rule.triggerType === 'answer_length') {
      if (durationSeconds > 0 && durationSeconds < expectedDurationSec * 0.5) return rule
    } else if (rule.triggerType === 'missing_number') {
      if (analysis && !analysis.hasNumberOrResult) return rule
    } else if (rule.triggerType === 'random') {
      if (Math.random() < 0.5) return rule
    }
  }
  return null
}
