import bank from '@/data/questions.json'

export type QuestionCategory = 'personality' | 'technical' | 'culture_fit' | 'reverse'

// 'general'(기본 모드)은 다른 두 트랙과 달리 큰 풀에서 무작위로 뽑지 않고, 아래
// BASIC_TRACK_QUESTION_IDS에 정해둔 소수의 "면접에서 거의 100% 나오는" 질문만 고정된
// 순서로 그대로 쓴다 — getBasicTrackQuestions() 참고.
export type JobTrack = 'software' | 'semiconductor' | 'general'

// 세션 시작 전 "카테고리 체크박스" 화면에서 사용자가 직접 고르는 세부 주제 id.
// data/Question/{日本,Software,半導体}/*.md 에 카테고리별로 사람이 읽을 수 있는 질문
// 목록을 정리해 두었다 — 새 질문을 추가/재분류할 때 그 문서도 함께 갱신하면 좋다.
export type TopicCategoryId =
  | 'self_personality'
  | 'episodes'
  | 'common_technical'
  | 'japan_life_adapt'
  | 'japan_culture'
  | 'japan_motivation'
  | 'company_fit'
  | 'career_future'
  | 'reverse'
  | 'sw_dev'
  | 'sw_ml'
  | 'semi_industry'
  | 'semi_field'

export interface TopicCategory {
  id: TopicCategoryId
  label: string
  // 'common': 지원 직무와 무관하게 항상 선택 가능. 'software'/'semiconductor': 그 트랙을
  // 골랐을 때(또는 지원 직무를 안 묻는 연습 모드에서)만 체크박스로 보여준다.
  scope: 'common' | 'software' | 'semiconductor'
}

// 체크박스 화면에 표시되는 순서 그대로. 'reverse'는 화면에 보여주지 않는다(실전 모드 마지막에
// 자동으로 붙는 역질문 전용이라 사용자가 직접 고르는 항목이 아니다) — app/interview/page.tsx 참고.
export const TOPIC_CATEGORIES: TopicCategory[] = [
  { id: 'self_personality', label: '자기소개·성격', scope: 'common' },
  { id: 'episodes', label: '경험·에피소드', scope: 'common' },
  { id: 'common_technical', label: '공통 직무 경험', scope: 'common' },
  { id: 'japan_life_adapt', label: '일본 환경 적응(생활·거주)', scope: 'common' },
  { id: 'japan_culture', label: '일본 사회·문화 이해', scope: 'common' },
  { id: 'japan_motivation', label: '일본에서 일하고 싶은 이유·지원동기', scope: 'common' },
  { id: 'company_fit', label: '회사 선택 기준·근무 조건', scope: 'common' },
  { id: 'career_future', label: '커리어·입사 후 계획', scope: 'common' },
  { id: 'reverse', label: '역질문', scope: 'common' },
  { id: 'sw_dev', label: '소프트웨어 개발 경험·역량', scope: 'software' },
  { id: 'sw_ml', label: '머신러닝·AI', scope: 'software' },
  { id: 'semi_industry', label: '반도체 산업·기술 이해', scope: 'semiconductor' },
  { id: 'semi_field', label: '반도체 현장 적응', scope: 'semiconductor' },
]

// 카테고리 체크박스 화면(app/interview/page.tsx)에 모드·지원 직무별로 어떤 카테고리를 보여줄지
// 결정한다. 'reverse'는 항상 제외한다(실전 모드 마지막에 자동으로 붙는 전용 항목).
// - '기술 면접' 모드: 기술 색채의 카테고리만(공통 기술 + 소프트웨어 2개 + 반도체 2개).
// - '실전' 모드: 고른 지원 직무와 맞지 않는 소프트웨어/반도체 전용 카테고리는 뺀다.
// - '연습' 모드(또는 그 외): 지원 직무를 안 물으므로 전부 보여준다.
export function getSelectableTopicCategories(mode: string, track?: JobTrack): TopicCategory[] {
  const nonReverse = TOPIC_CATEGORIES.filter((c) => c.id !== 'reverse')
  if (mode === 'technical') {
    return nonReverse.filter((c) => c.id === 'common_technical' || c.scope === 'software' || c.scope === 'semiconductor')
  }
  if (mode === 'real' && track === 'software') return nonReverse.filter((c) => c.scope !== 'semiconductor')
  if (mode === 'real' && track === 'semiconductor') return nonReverse.filter((c) => c.scope !== 'software')
  return nonReverse
}

export interface BankQuestion {
  id: string
  category: QuestionCategory
  expectedDurationSec: number
  textJa: string
  // (선택) 한국어 대역. 면접실에서 블러 처리된 채로 질문 아래에 따로 보여준다(어휘가 어려운
  // 트랙 질문 위주로 채워져 있음). 없으면 그 줄 자체를 렌더링하지 않는다.
  textKo?: string
  tags?: string[]
  // (선택) 비슷한 주제/거의 같은 질문끼리 묶는 그룹 id. sampleMainQuestions()가 세션 풀을
  // 뽑을 때 같은 group의 질문은 절대 함께 뽑지 않고, 그 그룹 중 하나만 무작위로 고른다.
  // 없으면 그 질문 하나가 곧 그룹(자기 자신하고만 겹치지 않으면 됨)이다.
  group?: string
  // (선택) 특정 지원 직무 트랙에서만 나오는 질문이면 지정. 없으면(공통) 어떤 트랙에서도
  // 나올 수 있다. 실전 모드 시작 시 사용자가 고른 트랙과 다르면 sampleMainQuestions()가
  // 제외한다(예: 반도체 지원자에게 Git/CI-CD 같은 소프트웨어 전용 질문이 안 나오게).
  track?: JobTrack
  // (대분류 질문만) 체크박스 화면에서 이 질문이 속한 세부 주제. 'closing'(마무리 전용)
  // 질문에는 없다 — 체크박스 대상이 아니기 때문이다.
  topicCategory?: TopicCategoryId
}

// 실전 모드 첫 질문은 항상 이 고정 자기소개 질문으로 시작한다.
// 사용자가 편집하는 data/questions.json에는 넣지 않고 코드에 고정해 둔다.
export const REAL_MODE_INTRO_QUESTION: BankQuestion = {
  id: '__real_mode_intro__',
  category: 'personality',
  expectedDurationSec: 60,
  textJa: '簡単に自己紹介をお願いします。',
  textKo: '간단히 자기소개를 부탁드립니다.',
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

// data/questions.json 전체 질문 은행 크기(대분류 + 마무리 전용 모두 합산).
// "총 몇 개"를 물었을 때 참고용으로만 쓰고, 화면에는 아래 getMainQuestionCount()를 쓴다 —
// 여기엔 조건부로만 나오는 마무리 전용까지 섞여 있어서 오히려 헷갈리기 쉽다
// (2026-09-02: 사용자가 이 숫자를 "세션당 나오는 질문 수"로 반복해서 오해했다).
export function getTotalQuestionCount(): number {
  return questions.length
}

// 대분류(태그 없음) 질문만의 개수 — "질문이 실제로 몇 개나 준비되어 있나"에 대한 가장
// 직관적인 답. RoomHeader에 "질문 X / Y (대분류 총 Z개)"처럼 보여줄 때 이걸 쓴다.
export function getMainQuestionCount(): number {
  return questions.filter((q) => !(q.tags ?? []).some((t) => NON_MAIN_TAGS.has(t))).length
}

// 세션 시작 시 "대분류" 질문 풀을 뽑을 때 쓴다. tags에 'closing'(마무리 전용, 예: final_word)이
// 붙은 질문은 무작위 첫 질문 풀에서 제외한다 — 이런 질문은 "마지막 질문하기" 버튼(requestFinalQuestion)
// 을 눌렀을 때만 getRandomClosingQuestion()으로 등장해야 한다.
const NON_MAIN_TAGS = new Set(['closing'])

export function getMainQuestionsByCategory(categories: string[]): BankQuestion[] {
  return getQuestionsByCategory(categories).filter(
    (q) => !(q.tags ?? []).some((t) => NON_MAIN_TAGS.has(t))
  )
}

// "기본 모드" 전용 — 실제 면접에서 거의 항상 나오는 대표 질문만 정해진 순서로 고정한
// 목록. 다른 트랙(소프트웨어/반도체)처럼 큰 풀에서 무작위로 뽑지 않고, 이 11개를 그대로
// 순서대로 쓴다(자기소개는 REAL_MODE_INTRO_QUESTION이, 마무리는 final_word가 별도로 앞뒤에
// 붙는다 — useInterviewMachine.ts 참고). '기본' 트랙은 지원 직무를 특정하지 않는 일반
// 지원자용이라, IT 연수 참가 이유를 묻는 it_training_reason(소프트웨어/반도체 지망생 전용
// 느낌이 강한 질문)은 2026-09-07에 목록에서 뺐다.
const BASIC_TRACK_QUESTION_IDS = [
  'job_role_desired',
  'motivation',
  'how_found_job_posting',
  'why_japan',
  'company_choice_criteria',
  'why_this_industry',
  'effort_in_school_days',
  'extracurricular_activities',
  'hardship_experience',
  'strengths_and_weaknesses',
  'post_join_aspiration',
]

export function getBasicTrackQuestions(): BankQuestion[] {
  return BASIC_TRACK_QUESTION_IDS.map((id) => getQuestionById(id)).filter(
    (q): q is BankQuestion => !!q
  )
}

// 세션 질문 풀을 뽑을 때 쓴다. topicCategories가 주어지면(체크박스 화면에서 사용자가 고른
// 세부 주제), data/questions.json 전체에서 그 topicCategory에 속한 질문만 후보로 남긴다 —
// 이때는 옛 대분류(categories, personality/technical/culture_fit 같은 굵은 분류)는 무시한다.
// topicCategory가 이미 208개 질문 전부를 빠짐없이 13종으로 정확히 나눠두고 있어서, 굵은
// 분류로 한 번 더 거르면 오히려 특정 카테고리(예: 반도체 현장 적응 — culture_fit/personality로
// 태깅된 질문이 섞여 있음)의 질문이 부당하게 걸러지는 버그가 있었다(2026-09-07 발견).
// topicCategories를 안 넘기면(비어있으면) 기존처럼 categories로만 거른다.
export function sampleMainQuestions(
  categories: string[],
  poolSize: number,
  track?: JobTrack,
  excludeIds?: string[],
  topicCategories?: TopicCategoryId[],
  // dedupeGroups: false면 group이 같은 질문도 전부 후보에 남긴다 — "선택한 주제의 질문을
  // 전부 보여준다"(2026-09-07 개편)는 모드에서, 화면에 표시되는 개수가 실제 선택한 후보
  // 개수와 정확히 일치하게 하려고 기본값을 true(기존처럼 그룹당 1개만)로 둔다.
  opts?: { dedupeGroups?: boolean }
): BankQuestion[] {
  const all =
    topicCategories && topicCategories.length > 0
      ? questions.filter((q) => q.topicCategory && topicCategories.includes(q.topicCategory))
      : getMainQuestionsByCategory(categories)
  // track이 주어지면, 다른 track 전용으로 태깅된 질문만 제외한다(track이 없는 공통 질문은
  // 그대로 포함). track을 아예 안 넘기면(연습/기술 면접 모드) 필터링 없이 전부 후보가 된다.
  const trackFiltered = track ? all.filter((q) => !q.track || q.track === track) : all
  const excludeSet = new Set(excludeIds ?? [])
  const candidates = excludeSet.size ? trackFiltered.filter((q) => !excludeSet.has(q.id)) : trackFiltered
  if (opts?.dedupeGroups === false) return shuffle(candidates).slice(0, poolSize)
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

// 실전 모드에서 특정 지원 직무를 골랐을 때 실제로 나올 수 있는 대분류 질문 총 개수 —
// app/interview/page.tsx의 지원 직무 버튼에 "(N문제)"로 보여줄 때 쓴다. 세션에 항상 붙는
// 자기소개(REAL_MODE_INTRO_QUESTION)와 마무리(역질문/final_word)는 세지 않는다(대분류 풀과
// 별개로 항상 고정으로 붙기 때문). '기본' 트랙은 무작위 풀이 아니라 고정 목록이므로 그 개수를
// 그대로 반환한다.
export function getTrackQuestionCount(track: JobTrack): number {
  if (track === 'general') return getBasicTrackQuestions().length
  return questions.filter(
    (q) => q.topicCategory && q.topicCategory !== 'reverse' && q.id !== 'self_intro' && (!q.track || q.track === track)
  ).length
}

// '연습 모드'/'기술 면접'처럼 지원 직무를 안 묻는 모드의 카드에 "최대 N문항"을 보여줄 때 쓴다
// — 체크박스를 전부 선택했을 때 나올 수 있는 최대 개수(getSelectableTopicCategories가 그
// 모드에서 보여주는 카테고리 전부에 속한 질문 수)를 그대로 계산한다.
export function getModeQuestionCount(mode: string): number {
  const ids = new Set(getSelectableTopicCategories(mode).map((c) => c.id))
  return questions.filter((q) => q.topicCategory && ids.has(q.topicCategory)).length
}

// "마지막 질문하기" 버튼용 — 'closing' 태그가 붙은 질문 중 하나를 무작위로 고른다.
export function getRandomClosingQuestion(): BankQuestion | undefined {
  const closingQuestions = questions.filter((q) => (q.tags ?? []).includes('closing'))
  if (closingQuestions.length === 0) return undefined
  return closingQuestions[Math.floor(Math.random() * closingQuestions.length)]
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
