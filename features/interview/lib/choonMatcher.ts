import { CHOON_PRACTICE_WORDS, type ChoonWord } from '@/lib/choon'

// 장음(長音)을 짧게 발음했을 때 STT가 오인식하는 형태와 실제 인식 결과를 비교한다.
// 정밀한 발음 평가가 아니라 "인식 안정성"을 보여주기 위한 근사치 비교다.
export function matchesChoonMistake(recognizedText: string, word: ChoonWord = CHOON_PRACTICE_WORDS[0]): boolean {
  return recognizedText.trim() === word.mistakenAs
}

export { CHOON_PRACTICE_WORDS }
export type { ChoonWord }
