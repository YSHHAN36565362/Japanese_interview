// 규칙 기반 일본어 문법 교정 엔진. lib/feedback.ts와 동일한 원칙으로 정규식/사전 매칭만
// 사용하며 LLM 호출은 전혀 없다. 한국어 화자가 자주 틀리는 조사·문체·STT 오인식 패턴을
// 잡아내는 것이 목적이며, 완전한 문법 파서가 아니므로 "참고용 힌트"로만 다뤄야 한다.
import { TECH_TERM_MAP } from './techTerms'
import { CHOON_PRACTICE_WORDS } from './choon'

export type GrammarIssueType = 'particle' | 'style_mixing' | 'filler' | 'tech_term' | 'choon' | 'repetition'
export type GrammarIssueSeverity = 'error' | 'warning' | 'info'

export interface GrammarIssue {
  type: GrammarIssueType
  severity: GrammarIssueSeverity
  start: number
  end: number
  matchedText: string
  message: string
  /** null = 자동 교정안 없음(설명만). ''는 "통째로 삭제"를 의미한다. */
  suggestion: string | null
  /** 왜 틀렸는지 이해할 수 있도록 붙이는 한국어 뜻/설명. 없으면 null. */
  translation: string | null
}

export interface GrammarCheckResult {
  issues: GrammarIssue[]
  correctedText: string
  countsByType: Record<GrammarIssueType, number>
}

const ISSUE_TYPES: GrammarIssueType[] = ['particle', 'style_mixing', 'filler', 'tech_term', 'choon', 'repetition']

// --- 1) 조사 오용: 특정 동사/형용사와 짝지어지는 조사가 고정된 경우, 한국어 화자가
// "~을/를"을 그대로 を로 옮기면서 틀리는 대표적인 패턴들. 표제어별로 한국어 뜻을 붙여둬서
// "왜" 틀렸는지(무슨 뜻의 표현인지) 바로 보여줄 수 있게 한다. -----------------------------
interface ParticlePredicate {
  /** 메시지에 표시할 대표 표기 */
  root: string
  /** 실제 텍스트에 나타날 수 있는 활용형들 */
  forms: string[]
  /** 한국어 뜻 */
  meaning: string
  correctParticle: 'が' | 'に'
}

// 好き/得意/わかる/できる 류는 대상에 が를 쓴다 (パンが好きです / 日本語ができます).
const GA_PREDICATES: ParticlePredicate[] = [
  { root: '好き', forms: ['好きです', '好きな', '好き'], meaning: '좋아하다', correctParticle: 'が' },
  { root: '大好き', forms: ['大好きです', '大好き'], meaning: '아주 좋아하다', correctParticle: 'が' },
  { root: '嫌い', forms: ['嫌いです', '嫌い'], meaning: '싫어하다', correctParticle: 'が' },
  { root: '大嫌い', forms: ['大嫌いです', '大嫌い'], meaning: '아주 싫어하다', correctParticle: 'が' },
  { root: '得意', forms: ['得意です', '得意'], meaning: '잘하다/자신 있다', correctParticle: 'が' },
  { root: '苦手', forms: ['苦手です', '苦手'], meaning: '서투르다/잘 못하다', correctParticle: 'が' },
  { root: '上手', forms: ['上手です', '上手'], meaning: '능숙하다/잘하다', correctParticle: 'が' },
  { root: '下手', forms: ['下手です', '下手'], meaning: '서투르다', correctParticle: 'が' },
  { root: '必要', forms: ['必要です', '必要'], meaning: '필요하다', correctParticle: 'が' },
  { root: '欲しい', forms: ['欲しいです', '欲しい'], meaning: '갖고 싶다/원하다', correctParticle: 'が' },
  {
    root: 'できる',
    forms: ['できます', 'できません', 'できました', 'できる', 'できない'],
    meaning: '할 수 있다',
    correctParticle: 'が',
  },
  {
    root: 'わかる',
    forms: [
      'わかります', 'わかりません', 'わかりました', 'わかる', 'わからない',
      '分かります', '分かりません', '分かりました', '分かる', '分からない',
    ],
    meaning: '이해하다/알다',
    correctParticle: 'が',
  },
]
// 会う/乗る/住む/似る/就職する 류는 대상에 に를 쓴다 (先輩に会う / 会社に就職する).
const NI_PREDICATES: ParticlePredicate[] = [
  {
    root: '会う',
    forms: ['会います', '会えません', '会いました', '会う', '会って', '会った'],
    meaning: '만나다',
    correctParticle: 'に',
  },
  {
    root: '乗る',
    forms: ['乗ります', '乗れません', '乗りました', '乗る', '乗って', '乗った'],
    meaning: '타다',
    correctParticle: 'に',
  },
  {
    root: '住む',
    forms: ['住んでいます', '住みます', '住みました', '住む', '住んでいた'],
    meaning: '살다/거주하다',
    correctParticle: 'に',
  },
  { root: '似る', forms: ['似ています', '似ました', '似る'], meaning: '닮다', correctParticle: 'に' },
  { root: '就職する', forms: ['就職しました', '就職します', '就職する'], meaning: '취직하다', correctParticle: 'に' },
  { root: '入社する', forms: ['入社しました', '入社します', '入社する'], meaning: '입사하다', correctParticle: 'に' },
]

function checkParticleIssues(text: string): GrammarIssue[] {
  const issues: GrammarIssue[] = []

  for (const predicate of [...GA_PREDICATES, ...NI_PREDICATES]) {
    const regex = new RegExp(`を(${predicate.forms.join('|')})`, 'g')
    for (const m of text.matchAll(regex)) {
      const start = m.index ?? 0
      const particle = predicate.correctParticle
      issues.push({
        type: 'particle',
        severity: 'error',
        start,
        end: start + m[0].length,
        matchedText: m[0],
        message: `"${m[1]}" 앞에는 조사 "を"가 아니라 "${particle}"를 씁니다.`,
        suggestion: `${particle}${m[1]}`,
        translation: `${predicate.root} = "${predicate.meaning}" — 이 뜻일 때는 항상 ${particle}를 씁니다.`,
      })
    }
  }

  // 興味: "〜に興味があります"가 맞는 형태 (〜を興味を持っています는 を가 맞으므로 별개로 다룬다).
  const interestRegex = /を興味が(あります|ありません|ある|ない)/g
  for (const m of text.matchAll(interestRegex)) {
    const start = m.index ?? 0
    issues.push({
      type: 'particle',
      severity: 'error',
      start,
      end: start + m[0].length,
      matchedText: m[0],
      message: '"興味が' + m[1] + '" 앞에는 조사 "を"가 아니라 "に"를 씁니다 (〜に興味があります).',
      suggestion: `に興味が${m[1]}`,
      translation: '興味がある = "관심이 있다" — 관심의 대상에는 に를 씁니다.',
    })
  }

  return issues
}

// --- 2) 문체 혼용: 정중체(です/ます) 답변 중간에 반말체 종결이 섞이는 경우. --------------
const CASUAL_ENDING = /(だ|である|だから)([。！？]?)$/
const CASUAL_TO_POLITE: Record<string, string> = { だ: 'です', である: 'です', だから: 'ですから' }
const CASUAL_MEANING: Record<string, string> = {
  だ: '"~다/~야" (반말 단정형)',
  である: '"~이다" (문어체 반말)',
  だから: '"~니까/~이기 때문에" (반말)',
}

function checkStyleMixingIssues(text: string): GrammarIssue[] {
  const issues: GrammarIssue[] = []
  const sentenceRegex = /[^。！？]+[。！？]?/g
  for (const m of text.matchAll(sentenceRegex)) {
    const sentence = m[0]
    if (!sentence.trim()) continue
    const sentenceStart = m.index ?? 0
    const casual = CASUAL_ENDING.exec(sentence.trim())
    if (!casual) continue
    const trimmedOffset = sentence.indexOf(sentence.trim())
    const localStart = trimmedOffset + casual.index
    const start = sentenceStart + localStart
    const ending = casual[1]
    const punctuation = casual[2] ?? ''
    issues.push({
      type: 'style_mixing',
      severity: 'warning',
      start,
      end: start + casual[0].length,
      matchedText: casual[0],
      message: `문장이 반말체("${ending}")로 끝났습니다. 면접 답변에서는 정중체(です/ます)로 통일하는 것이 자연스럽습니다.`,
      suggestion: `${CASUAL_TO_POLITE[ending]}${punctuation}`,
      translation: `${ending} = ${CASUAL_MEANING[ending]}`,
    })
  }
  return issues
}

// --- 3) 필러(간투사). あの/その는 지시어로도 쓰이므로 단정하지 않고 참고 수준으로만 표시한다. --
const FILLER_MEANING: Record<string, string> = {
  'えー': '"어~" (망설일 때 내는 소리)',
  'あの': '"저..." (망설임) — 단, "저 사람"처럼 지시어로 쓰였을 수도 있습니다',
  'その': '"그..." (망설임) — 단, "그 사람"처럼 지시어로 쓰였을 수도 있습니다',
  'えっと': '"음~/어~" (망설일 때 내는 소리)',
  'まあ': '"뭐/글쎄" (가벼운 완곡 표현)',
}
const FILLERS = Object.keys(FILLER_MEANING)

function checkFillerIssues(text: string): GrammarIssue[] {
  const issues: GrammarIssue[] = []
  for (const filler of FILLERS) {
    const regex = new RegExp(filler, 'g')
    for (const m of text.matchAll(regex)) {
      const start = m.index ?? 0
      issues.push({
        type: 'filler',
        severity: 'info',
        start,
        end: start + filler.length,
        matchedText: filler,
        message: `"${filler}"는 대표적인 필러(간투사)입니다. 지시어로 쓴 것이 아니라면 문장에서 빼면 더 간결해집니다.`,
        suggestion: '',
        translation: `${filler} = ${FILLER_MEANING[filler]}`,
      })
    }
  }
  return issues
}

// --- 4) STT 오인식: 기술 용어 표기(lib/techTerms.ts)와 장음 축약(lib/choon.ts). -----------
function checkTechTermIssues(text: string): GrammarIssue[] {
  const issues: GrammarIssue[] = []
  for (const [from, to] of Object.entries(TECH_TERM_MAP)) {
    const regex = new RegExp(from, 'g')
    for (const m of text.matchAll(regex)) {
      const start = m.index ?? 0
      issues.push({
        type: 'tech_term',
        severity: 'warning',
        start,
        end: start + from.length,
        matchedText: from,
        message: `"${from}"는 STT가 자주 오인식하는 기술 용어 표기입니다. "${to}"를 의도하셨다면 교정하세요.`,
        suggestion: to,
        translation: `${from} → ${to} (IT 기술 용어 표기 오인식)`,
      })
    }
  }
  return issues
}

function checkChoonIssues(text: string): GrammarIssue[] {
  const issues: GrammarIssue[] = []
  for (const word of CHOON_PRACTICE_WORDS) {
    const regex = new RegExp(word.mistakenAs, 'g')
    for (const m of text.matchAll(regex)) {
      const start = m.index ?? 0
      issues.push({
        type: 'choon',
        severity: 'info',
        start,
        end: start + word.mistakenAs.length,
        matchedText: word.mistakenAs,
        message: `"${word.mistakenAs}"는 장음을 짧게 발음했을 때 STT가 인식하는 형태입니다. "${word.word}"(${word.meaning})을 의도했다면 확인해보세요.`,
        suggestion: word.word,
        translation: `${word.word} = "${word.meaning}"`,
      })
    }
  }
  return issues
}

// --- 5) 반복: STT가 같은 구간을 중복 인식했을 때 남는 흔적. いろいろ/だんだん처럼 원래
// 반복이 정상인 단어는 오탐을 막기 위해 화이트리스트로 제외한다. --------------------------
const LEGITIMATE_REPETITIONS = new Set([
  'いろいろ', 'だんだん', 'わざわざ', 'たまたま', 'なかなか', 'どんどん', 'ますます',
  'そろそろ', 'しみじみ', 'じわじわ', '時々', '人々', '我々', '日々', '刻々',
  '一人一人', '一つ一つ', '一歩一歩', '色々', '様々', '度々',
])

function checkRepetitionIssues(text: string): GrammarIssue[] {
  const issues: GrammarIssue[] = []
  const regex = /([\p{L}ー]{2,10})\1+/gu
  for (const m of text.matchAll(regex)) {
    if (LEGITIMATE_REPETITIONS.has(m[0])) continue
    const start = m.index ?? 0
    issues.push({
      type: 'repetition',
      severity: 'warning',
      start,
      end: start + m[0].length,
      matchedText: m[0],
      message: `"${m[0]}"처럼 같은 표현이 연속으로 인식되었습니다. STT 중복 인식일 수 있으니 확인해보세요.`,
      suggestion: m[1],
      translation: null,
    })
  }
  return issues
}

// --- 병합: 시작 위치 순으로 정렬한 뒤 서로 겹치는 구간은 먼저 나온 것만 채택한다. -----------
function resolveOverlaps(issues: GrammarIssue[]): GrammarIssue[] {
  const sorted = [...issues].sort((a, b) => a.start - b.start)
  const accepted: GrammarIssue[] = []
  let lastEnd = -1
  for (const issue of sorted) {
    if (issue.start < lastEnd) continue
    accepted.push(issue)
    lastEnd = issue.end
  }
  return accepted
}

function buildCorrectedText(text: string, issues: GrammarIssue[]): string {
  let result = ''
  let cursor = 0
  for (const issue of issues) {
    result += text.slice(cursor, issue.start)
    result += issue.suggestion ?? text.slice(issue.start, issue.end)
    cursor = issue.end
  }
  result += text.slice(cursor)
  return result
}

export function checkGrammar(text: string): GrammarCheckResult {
  const countsByType = Object.fromEntries(ISSUE_TYPES.map((t) => [t, 0])) as Record<GrammarIssueType, number>
  if (!text || !text.trim()) {
    return { issues: [], correctedText: text ?? '', countsByType }
  }

  const rawIssues = [
    ...checkParticleIssues(text),
    ...checkStyleMixingIssues(text),
    ...checkTechTermIssues(text),
    ...checkChoonIssues(text),
    ...checkRepetitionIssues(text),
    ...checkFillerIssues(text),
  ]

  const issues = resolveOverlaps(rawIssues)
  for (const issue of issues) countsByType[issue.type]++

  return { issues, correctedText: buildCorrectedText(text, issues), countsByType }
}
