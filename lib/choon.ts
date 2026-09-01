// 장음(長音) 발음 연습용 최소 대립쌍. 한국어 화자가 장음을 짧게 발음해
// STT가 다른 단어로 오인식하는 문제를 훈련 대상으로 다룬다 (readme_3.md §5-3).
export type ChoonWord = {
  word: string
  reading: string
  mistakenAs: string
  meaning: string
}

export const CHOON_PRACTICE_WORDS: ChoonWord[] = [
  { word: 'おばあさん', reading: 'obaasan', mistakenAs: 'おばさん', meaning: '할머니 (짧게 읽으면 "아주머니"로 오인식)' },
  { word: 'おじいさん', reading: 'ojiisan', mistakenAs: 'おじさん', meaning: '할아버지 (짧게 읽으면 "아저씨"로 오인식)' },
  { word: '学校', reading: 'がっこう', mistakenAs: 'がっこ', meaning: '학교' },
  { word: '先生', reading: 'せんせい', mistakenAs: 'せんせ', meaning: '선생님' },
  { word: '空気', reading: 'くうき', mistakenAs: 'くき', meaning: '공기' },
]
