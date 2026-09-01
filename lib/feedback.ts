// 규칙 기반 자가 피드백 엔진. 정규식/사전 매칭만 사용하며 LLM 호출이 전혀 없다.
export type FeedbackResult = {
  charCount: number
  sentenceCount: number
  fillerCount: number
  fillerBreakdown: Record<string, number>
  politenessRatio: number | null
  hasConclusionFirst: boolean
  hasNumberOrResult: boolean
  detectedFrameworkStages: string[]
}

const FILLERS = ['えー', 'あの', 'その', 'えっと', 'まあ']
const POLITE_ENDING = /(です|ます|ございます)[。！？\s]*$/
const CASUAL_ENDING = /(だ|である|だから)[。！？\s]*$/
const CONCLUSION_MARKERS = ['結論から申し上げますと', '結論から言うと', '私の強みは', '志望理由は']
const NUMBER_PATTERN = /[0-9０-９]+\s*(%|人|件|回|年|ヶ月|万|億)?/

const STAGE_MARKERS: Record<string, string[]> = {
  結論: ['結論から言うと', '結論として'],
  理由: ['理由は', 'なぜなら'],
  事例: ['具体的には', '例えば'],
  まとめ: ['したがって', '以上のことから', '学びました'],
}

export function analyzeAnswer(text: string): FeedbackResult {
  const sentences = text
    .split(/[。！？]/)
    .map((s) => s.trim())
    .filter(Boolean)

  const fillerBreakdown: Record<string, number> = {}
  let fillerCount = 0
  for (const filler of FILLERS) {
    const count = (text.match(new RegExp(filler, 'g')) || []).length
    if (count > 0) fillerBreakdown[filler] = count
    fillerCount += count
  }

  let politeCount = 0
  let casualCount = 0
  for (const s of sentences) {
    if (POLITE_ENDING.test(s)) politeCount++
    else if (CASUAL_ENDING.test(s)) casualCount++
  }
  const totalEndings = politeCount + casualCount
  const politenessRatio = totalEndings > 0 ? Number((politeCount / totalEndings).toFixed(2)) : null

  const hasConclusionFirst = sentences.slice(0, 2).some((s) => CONCLUSION_MARKERS.some((m) => s.includes(m)))
  const hasNumberOrResult = NUMBER_PATTERN.test(text)

  const detectedFrameworkStages = Object.entries(STAGE_MARKERS)
    .filter(([, markers]) => markers.some((m) => text.includes(m)))
    .map(([stage]) => stage)

  return {
    charCount: text.length,
    sentenceCount: sentences.length,
    fillerCount,
    fillerBreakdown,
    politenessRatio,
    hasConclusionFirst,
    hasNumberOrResult,
    detectedFrameworkStages,
  }
}

// 두 일본어 문장의 문자 단위 유사도(0~1). 정밀한 언어학적 채점이 아니라
// "레벨 체크"용 근사치임을 UI에 항상 명시해야 한다 (readme_3.md §3 참고).
export function charOverlapSimilarity(target: string, spoken: string): number {
  const clean = (s: string) => s.replace(/[\s。、！？]/g, '')
  const a = clean(target)
  const b = clean(spoken).split('')
  if (!a.length || !b.length) return 0

  let matches = 0
  for (const ch of a.split('')) {
    const idx = b.indexOf(ch)
    if (idx >= 0) {
      matches++
      b.splice(idx, 1)
    }
  }
  return Number((matches / Math.max(a.length, b.length + matches)).toFixed(2))
}
