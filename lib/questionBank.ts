import bank from '@/data/questions.json'

export type QuestionCategory = 'personality' | 'technical' | 'culture_fit' | 'reverse'
export type FollowUpTriggerType = 'keyword' | 'missing_keyword' | 'answer_length' | 'random'

export interface BankQuestion {
  id: string
  category: QuestionCategory
  expectedDurationSec: number
  textJa: string
  tags?: string[]
  // (선택) 비슷한 주제/거의 같은 질문끼리 묶는 그룹 id. sampleMainQuestions()가 세션 풀을
  // 뽑을 때 같은 group의 질문은 절대 함께 뽑지 않고, 그 그룹 중 하나만 무작위로 고른다.
  // 없으면 그 질문 하나가 곧 그룹(자기 자신하고만 겹치지 않으면 됨)이다.
  group?: string
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

// data/questions.json 전체 질문 은행 크기(대분류 + 꼬리질문 전용 + 마무리 전용 모두 합산).
// RoomHeader에 "질문 X / Y (전체 Z개)"처럼 은행 규모를 함께 보여줄 때 쓴다.
export function getTotalQuestionCount(): number {
  return questions.length
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

// 세션 질문 풀을 뽑을 때 "거의 같은 질문"(예: 스트레스 해소법 vs 스트레스 대처법, 학창시절
// 힘쓴 일 vs 어린 시절 힘쓴 일)이 한 세션에 함께 나오지 않도록, group이 같은 질문들 중
// 하나만 무작위로 골라 뽑는다. group이 없는 질문은 자기 자신의 id를 그룹으로 취급한다.
export function sampleMainQuestions(categories: string[], poolSize: number): BankQuestion[] {
  const candidates = getMainQuestionsByCategory(categories)
  const groups = new Map<string, BankQuestion[]>()
  for (const q of candidates) {
    const key = q.group ?? q.id
    const list = groups.get(key)
    if (list) list.push(q)
    else groups.set(key, [q])
  }
  const representatives = shuffle([...groups.values()]).map(
    (members) => members[Math.floor(Math.random() * members.length)]
  )
  return shuffle(representatives).slice(0, poolSize)
}

// "마지막 질문하기" 버튼용 — 'closing' 태그가 붙은 질문 중 하나를 무작위로 고른다.
export function getRandomClosingQuestion(): BankQuestion | undefined {
  const closingQuestions = questions.filter((q) => (q.tags ?? []).includes('closing'))
  if (closingQuestions.length === 0) return undefined
  return closingQuestions[Math.floor(Math.random() * closingQuestions.length)]
}

// 꼬리질문 규칙은 JSON이 아니라 public/data/follow_ups.txt(일반 텍스트)에서 읽는다.
// public/ 아래 파일은 정적 자산으로 그대로 서빙되므로 fetch로 원문을 가져와 파싱한다.
// 형식: 원래질문id | 키워드1,키워드2,... | 다음질문id | 우선순위(선택)
let followUpsCache: BankFollowUp[] | null = null

function parseFollowUpsText(text: string): BankFollowUp[] {
  const rules: BankFollowUp[] = []
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const parts = line.split('|').map((p) => p.trim())
    if (parts.length < 3) continue
    const [parentId, keywordsRaw, targetId, priorityRaw] = parts
    if (!parentId || !targetId) continue
    rules.push({
      parentId,
      triggerType: 'keyword',
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
