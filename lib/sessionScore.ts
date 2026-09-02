import { CHOON_PRACTICE_WORDS } from './choon'

// 세션 리포트 화면에서만 계산하고 절대 저장하지 않는 점수. 답변 텍스트(이미 저장되어 있는
// corrected_answer_text/stt_raw_text)를 그때그때 다시 분석해서 만든다 — 저장된 텍스트만
// 남고 점수는 화면을 벗어나면 사라진다.
//
// 정중체/반말체 판정 정규식은 lib/feedback.ts와 동일한 기준을 쓴다(2026-09-02 개선 —
// 기존에는 です/ます/だ/である 같은 "사전형" 어미만 잡아서, 실제 답변에서 훨씬 자주 나오는
// ます형 활용(〜ました/〜ません/〜ませんでした)이나 사전형 동사·형용사로 끝나는 반말체
// (〜する/〜した/〜ない/〜い 등)를 거의 못 잡고 있었다 — 그 결과 대부분의 문장이 판정 밖으로
// 빠져서 정중체 비율과 종합 점수 둘 다 실제보다 낙관적으로 나오는 문제가 있었다).
const SENTENCE_SPLIT = /[。！？]/
const POLITE_ENDING = /(ませんでした|ました|ません|でした|でしょう|ございました|ございます|です|ます)[。！？\s]*$/
const CASUAL_ENDING = /(ではない|じゃない|なかった|だった|である|だから|ない|だ|た|[うくぐすつぬぶむるい])[。！？\s]*$/

export type SessionScore = {
  totalSentences: number
  // 정중체/반말체 어느 쪽으로도 판정 가능했던 문장 수(politeSentenceCount + casualSentenceCount).
  // 감탄사만 있거나 어미가 애매한 문장은 판정에서 제외된다.
  judgedSentenceCount: number
  politeSentenceCount: number
  casualSentenceCount: number
  choonDefectCount: number
  wellSaidCount: number
  // 전체 판정 가능 문장 중 정중체 비율 — 예전에는 질문별로 이미 계산해둔 비율을 그냥
  // 평균 냈는데(답변 길이와 무관하게 질문마다 똑같은 가중치를 줌), 이제는 세션 전체
  // 문장을 한 번에 모아서(pool) 계산해 통계적으로 더 정확하다.
  politenessRatio: number | null
  // 정중체/반말체 판정과 장음 오인식 결함이 하나도 없는 문장의 비율(0~100).
  toneScorePercent: number | null
}

export function computeSessionScore(texts: string[]): SessionScore {
  let totalSentences = 0
  let politeSentenceCount = 0
  let casualSentenceCount = 0
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

      if (POLITE_ENDING.test(sentence)) {
        politeSentenceCount++
      } else if (CASUAL_ENDING.test(sentence)) {
        casualSentenceCount++
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
  const toneScorePercent = totalSentences > 0 ? Math.round((wellSaidCount / totalSentences) * 100) : null
  const judgedSentenceCount = politeSentenceCount + casualSentenceCount
  const politenessRatio = judgedSentenceCount > 0 ? Number((politeSentenceCount / judgedSentenceCount).toFixed(2)) : null

  return {
    totalSentences,
    judgedSentenceCount,
    politeSentenceCount,
    casualSentenceCount,
    choonDefectCount,
    wellSaidCount,
    politenessRatio,
    toneScorePercent,
  }
}

export type CompositeScore = {
  toneScorePercent: number | null
  fillerRatioPer100Chars: number
  fillerScorePercent: number
  // 종합 점수 = 말투 정확도(정중체 판정 결함 없음) 70% + 필러 적음 정도 30%.
  // 두 구성 요소를 그대로 노출해서, 화면에서 "왜 이 점수인지" 설명할 수 있게 한다.
  overallPercent: number | null
}

// 종합 점수는 말투 정확도만으로는 "종합"이라 부르기 부족해서(2026-09-02 검토), 이미 별도로
// 추적하고 있는 필러(간투사) 비율을 30% 가중치로 더했다. 답변 시간 적정성은 질문별로 이미
// 배지(길어요/짧아요/적당해요)로 따로 보여주고 있어 여기서는 중복으로 넣지 않았다.
export function computeCompositeScore(toneScorePercent: number | null, totalFillers: number, totalChars: number): CompositeScore {
  const fillerRatioPer100Chars = totalChars > 0 ? (totalFillers / totalChars) * 100 : 0
  const fillerScorePercent = Math.max(0, Math.min(100, Math.round(100 - fillerRatioPer100Chars * 15)))
  const overallPercent =
    toneScorePercent != null ? Math.round(toneScorePercent * 0.7 + fillerScorePercent * 0.3) : null
  return { toneScorePercent, fillerRatioPer100Chars, fillerScorePercent, overallPercent }
}
