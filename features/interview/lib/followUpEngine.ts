import { getFollowUpsFor, getQuestionById, type BankFollowUp, type BankQuestion } from '@/lib/questionBank'
import { matchFollowUpRule } from '@/lib/followUp'
import type { FeedbackResult } from '@/lib/feedback'

// 방금 답한 질문 id + 답변 텍스트로 다음에 물을 꼬리질문(있다면)을 결정한다.
// AI 호출 없이 public/data/follow_ups.txt의 키워드 규칙만 사용한다 (lib/followUp.ts).
// extraRules/extraQuestions는 이력서 기반으로 합성된 규칙·질문(id는 resume_ 접두사)이다 —
// data/questions.json에는 없으므로 getQuestionById로 못 찾으면 extraQuestions에서 찾는다.
// analysis는 evaluateAnswer()가 이미 계산해 둔 신호(hasNumberOrResult 등)를 missing_number
// 트리거 타입에 그대로 넘겨주기 위한 것 — 여기선 그냥 통과시키기만 한다.
export async function decideFollowUp(
  parentQuestionId: string,
  answerText: string,
  durationSeconds: number,
  expectedDurationSec: number,
  alreadyAsked: Set<string>,
  extraRules: BankFollowUp[] = [],
  extraQuestions: BankQuestion[] = [],
  analysis?: Pick<FeedbackResult, 'hasNumberOrResult'>
): Promise<BankQuestion | null> {
  const fileRules = await getFollowUpsFor(parentQuestionId)
  const rules = [...fileRules, ...extraRules.filter((r) => r.parentId === parentQuestionId)].filter(
    (r) => !alreadyAsked.has(r.targetId)
  )
  const matched = matchFollowUpRule(rules, answerText, durationSeconds, expectedDurationSec, analysis)
  if (!matched) return null
  return getQuestionById(matched.targetId) ?? extraQuestions.find((q) => q.id === matched.targetId) ?? null
}
