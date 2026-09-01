import bank from '@/data/questions.json'

export type QuestionCategory = 'personality' | 'technical' | 'culture_fit' | 'reverse'
export type FollowUpTriggerType = 'keyword' | 'missing_keyword' | 'answer_length' | 'random'

export interface BankQuestion {
  id: string
  category: QuestionCategory
  expectedDurationSec: number
  textJa: string
  tags?: string[]
}

export interface BankFollowUp {
  parentId: string
  triggerType: FollowUpTriggerType
  keywords?: string[]
  targetId: string
  priority?: number
}

// 실전 모드 첫 질문은 항상 이 고정 자기소개 질문으로 시작한다.
// 사용자가 편집하는 data/questions.json에는 넣지 않고 코드에 고정해 둔다.
export const REAL_MODE_INTRO_QUESTION: BankQuestion = {
  id: '__real_mode_intro__',
  category: 'personality',
  expectedDurationSec: 60,
  textJa: '簡単に自己紹介をお願いします。',
  tags: ['fixed_intro'],
}

const questions = bank.questions as BankQuestion[]
const followUps = bank.followUps as BankFollowUp[]

export function getQuestionById(id: string): BankQuestion | undefined {
  if (id === REAL_MODE_INTRO_QUESTION.id) return REAL_MODE_INTRO_QUESTION
  return questions.find((q) => q.id === id)
}

export function getQuestionsByCategory(categories: string[]): BankQuestion[] {
  return questions.filter((q) => categories.includes(q.category))
}

export function getFollowUpsFor(parentId: string): BankFollowUp[] {
  return followUps.filter((f) => f.parentId === parentId)
}

// Fisher-Yates 셔플. 매 세션마다 질문 순서/구성이 달라지도록 한다.
export function shuffle<T>(input: T[]): T[] {
  const arr = [...input]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}
