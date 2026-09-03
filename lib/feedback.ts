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
// 2026-09-02 개선: 기존 정규식은 です/ます/だ/である 같은 "사전형" 어미만 잡아서, 실제
// 답변에서 훨씬 자주 나오는 ます형 활용(〜ました/〜ません/〜ませんでした/〜でした)이나
// 사전형 동사·형용사로 끝나는 반말체(〜する/〜した/〜ない/〜い 등)를 전혀 못 잡고 있었다
// — 그 결과 대부분의 답변이 정중체/반말체 어느 쪽으로도 판정되지 않고 그냥 빠져서,
// 정중체 비율과 종합 점수 둘 다 실제보다 부정확했다(주로 과대평가).
const POLITE_ENDING = /(ませんでした|ました|ません|でした|でしょう|ございました|ございます|です|ます)[。！？\s]*$/
const CASUAL_ENDING = /(ではない|じゃない|なかった|だった|である|だから|ない|だ|た|[うくぐすつぬぶむるい])[。！？\s]*$/
const CONCLUSION_MARKERS = ['結論から申し上げますと', '結論から言うと', '私の強みは', '志望理由は']
const NUMBER_PATTERN = /[0-9０-９]+\s*(%|人|件|回|年|ヶ月|万|億)?/

// 키는 features/interview/components/CoachingPanel.tsx의 STAGES 배열(한국어 표시 라벨)과
// 반드시 일치해야 한다. 이전에는 여기 키가 일본어(結論/理由/事例/まとめ)였는데
// CoachingPanel은 한국어 라벨로 includes() 검사를 해서, 4개 체크리스트 항목이 실제로는
// 절대 체크되지 않는 버그가 있었다. 값(배열)은 사용자의 일본어 답변에서 찾는 표현이라 그대로 둔다.
const STAGE_MARKERS: Record<string, string[]> = {
  결론: ['結論から言うと', '結論として', '結論としては', '一言で言うと', '端的に申し上げますと', '私が最も大切にしていることは'],
  이유: ['理由は', 'なぜなら', 'という理由からです', 'ためです'],
  사례: ['具体的には', '例えば', '実際に', '一例として'],
  정리: ['したがって', '以上のことから', '学びました', 'この経験から', '今後も', 'これからも', '活かしていきたい', '生かしていきたい'],
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
