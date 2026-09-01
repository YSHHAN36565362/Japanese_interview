// 일본어 STT가 자주 오인식하는 IT 기술 용어 기본 매핑.
// 사용자가 "적용"을 누르면 user_custom_terms 테이블에 개인 사전으로 누적된다.
export const TECH_TERM_MAP: Record<string, string> = {
  パイソン: 'Python',
  シーケル: 'SQL',
  エスキューエル: 'SQL',
  コベルト: 'KoBERT',
  ギットハブ: 'GitHub',
  ジャバスクリプト: 'JavaScript',
  リアクト: 'React',
  ネクスト: 'Next.js',
  スーパーベース: 'Supabase',
}
