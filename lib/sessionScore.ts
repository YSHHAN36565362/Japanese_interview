import { CHOON_PRACTICE_WORDS } from './choon'

// 세션 리포트 화면에서만 계산하고 절대 저장하지 않는 점수. 답변 텍스트(이미 저장되어 있는
// corrected_answer_text/stt_raw_text)를 그때그때 다시 분석해서 만든다 — 저장된 텍스트만
// 남고 점수는 화면을 벗어나면 사라진다.
//
// "잘 말한 비율" = 전체 문장 중, 아래 두 감점 요소가 하나도 없는 문장의 비율.
// - 경어 오류: 문장이 반말 종결(だ/である/だから)로 끝남
// - 장음 인식 오류: STT가 장음을 짧게 오인식했을 때 나오는 형태(おばさん 등)가 포함됨
const SENTENCE_SPLIT = /[。！？]/
const CASUAL_ENDING = /(だ|である|だから)[。！？\s]*$/

export type SessionScore = {
  totalSentences: number
  casualDefectCount: number
  choonDefectCount: number
  wellSaidCount: number
  scorePercent: number | null
}

export function computeSessionScore(texts: string[]): SessionScore {
  let totalSentences = 0
  let casualDefectCount = 0
  let choonDefectCount = 0
  let defectiveSentenceCount = 0

  for (const text of texts) {
    const sentences = (text || '')
      .split(SENTENCE_SPLIT)
      .map((s) => s.trim())
      .filter(Boolean)

    for (const sentence of sentences) {
      totalSentences++
      let defective = false

      if (CASUAL_ENDING.test(sentence)) {
        casualDefectCount++
        defective = true
      }
      if (CHOON_PRACTICE_WORDS.some((w) => sentence.includes(w.mistakenAs))) {
        choonDefectCount++
        defective = true
      }
      if (defective) defectiveSentenceCount++
    }
  }

  const wellSaidCount = totalSentences - defectiveSentenceCount
  const scorePercent = totalSentences > 0 ? Math.round((wellSaidCount / totalSentences) * 100) : null

  return { totalSentences, casualDefectCount, choonDefectCount, wellSaidCount, scorePercent }
}
