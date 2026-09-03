import bank from '@/data/questions.json'

export type QuestionCategory = 'personality' | 'technical' | 'culture_fit' | 'reverse'
// missing_number: lib/feedback.ts의 analyzeAnswer()가 이미 계산해 둔 hasNumberOrResult
// 신호를 재사용한다 — 답변에 숫자/성과 표현이 하나도 없을 때 발동(키워드 목록 불필요).
export type FollowUpTriggerType = 'keyword' | 'missing_keyword' | 'answer_length' | 'random' | 'missing_number'

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

export function getQuestionById(id: string): BankQuestion | undefined {
  if (id === REAL_MODE_INTRO_QUESTION.id) return REAL_MODE_INTRO_QUESTION
  return questions.find((q) => q.id === id)
}

export function getQuestionsByCategory(categories: string[]): BankQuestion[] {
  return questions.filter((q) => categories.includes(q.category))
}

// 세션 시작 시 "대분류" 질문 풀을 뽑을 때 쓴다. tags에 'follow_up'(꼬리질문 전용) 또는
// 'closing'(마무리 전용, 예: final_word)이 붙은 질문은 무작위 첫 질문 풀에서 제외한다 —
// 이런 질문들은 decideFollowUp()의 getQuestionById로만 등장해야 한다.
const NON_MAIN_TAGS = new Set(['follow_up', 'closing'])

export function getMainQuestionsByCategory(categories: string[]): BankQuestion[] {
  return getQuestionsByCategory(categories).filter(
    (q) => !(q.tags ?? []).some((t) => NON_MAIN_TAGS.has(t))
  )
}

// "마지막 질문하기" 버튼용 — 'closing' 태그가 붙은 질문 중 하나를 무작위로 고른다.
export function getRandomClosingQuestion(): BankQuestion | undefined {
  const closingQuestions = questions.filter((q) => (q.tags ?? []).includes('closing'))
  if (closingQuestions.length === 0) return undefined
  return closingQuestions[Math.floor(Math.random() * closingQuestions.length)]
}

// 꼬리질문 규칙은 JSON이 아니라 public/data/follow_ups.txt(일반 텍스트)에서 읽는다.
// public/ 아래 파일은 정적 자산으로 그대로 서빙되므로 fetch로 원문을 가져와 파싱한다.
// 형식: 원래질문id | 키워드1,키워드2,... | 다음질문id | 우선순위(선택) | 트리거타입(선택)
// 트리거타입을 생략하면 기존과 같이 'keyword'(키워드 중 하나라도 나오면 발동)로 취급한다.
// - keyword(기본값): 키워드 목록 중 하나라도 답변에 포함되면 발동
// - missing_keyword: 키워드 목록이 전부 답변에 없으면 발동(예: 구체적 사례 표현이 하나도 없을 때)
// - answer_length: 키워드와 무관하게, 답변 시간이 권장 시간의 절반 미만이면 발동(짧은 답변 감지)
// - missing_number: 키워드 목록 불필요. lib/feedback.ts의 analyzeAnswer()가 계산한
//   hasNumberOrResult가 false일 때(답변에 숫자·성과 표현이 하나도 없을 때) 발동
const VALID_TRIGGER_TYPES: FollowUpTriggerType[] = ['keyword', 'missing_keyword', 'answer_length', 'random', 'missing_number']
let followUpsCache: BankFollowUp[] | null = null

function parseFollowUpsText(text: string): BankFollowUp[] {
  const rules: BankFollowUp[] = []
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const parts = line.split('|').map((p) => p.trim())
    if (parts.length < 3) continue
    const [parentId, keywordsRaw, targetId, priorityRaw, triggerTypeRaw] = parts
    if (!parentId || !targetId) continue
    const triggerType = VALID_TRIGGER_TYPES.includes(triggerTypeRaw as FollowUpTriggerType)
      ? (triggerTypeRaw as FollowUpTriggerType)
      : 'keyword'
    rules.push({
      parentId,
      triggerType,
      keywords: keywordsRaw
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean),
      targetId,
      priority: priorityRaw ? Number(priorityRaw) || 0 : 0,
    })
  }
  return rules
}

async function loadFollowUps(): Promise<BankFollowUp[]> {
  if (followUpsCache) return followUpsCache
  try {
    const res = await fetch('/data/follow_ups.txt', { cache: 'no-store' })
    const text = await res.text()
    followUpsCache = parseFollowUpsText(text)
  } catch {
    followUpsCache = []
  }
  return followUpsCache
}

export async function getFollowUpsFor(parentId: string): Promise<BankFollowUp[]> {
  const all = await loadFollowUps()
  return all.filter((f) => f.parentId === parentId)
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
