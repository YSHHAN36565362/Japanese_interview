import { getFollowUpsFor, getQuestionById, type BankQuestion } from '@/lib/questionBank'
import { matchFollowUpRule } from '@/lib/followUp'

// 방금 답한 질문 id + 답변 텍스트로 다음에 물을 꼬리질문(있다면)을 결정한다.
// AI 호출 없이 public/data/follow_ups.txt의 키워드 규칙만 사용한다 (lib/followUp.ts).
export async function decideFollowUp(
  parentQuestionId: string,
  answerText: string,
  durationSeconds: number,
  expectedDurationSec: number,
  alreadyAsked: Set<string>
): Promise<BankQuestion | null> {
  const allRules = await getFollowUpsFor(parentQuestionId)
  const rules = allRules.filter((r) => !alreadyAsked.has(r.targetId))
  const matched = matchFollowUpRule(rules, answerText, durationSeconds, expectedDurationSec)
  if (!matched) return null
  return getQuestionById(matched.targetId) ?? null
}
