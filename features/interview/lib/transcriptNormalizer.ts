import { createClient } from '@/lib/supabase/client'
import { TECH_TERM_MAP } from '@/lib/techTerms'

export interface CustomTerm {
  spoken_variation: string
  correct_term: string
}

// 사용자가 이전에 "적용"해서 승인한 STT 보정 사전(user_custom_terms)을 불러온다.
export async function loadUserCustomTerms(userId: string): Promise<CustomTerm[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('user_custom_terms')
    .select('spoken_variation, correct_term')
    .eq('user_id', userId)
  return data ?? []
}

// 원문 전사(stt_raw_text)에 이미 승인된 보정 사전을 자동 적용해 확정 답변 초안을 만든다.
// 아직 사전에 없는 새 용어는 여기서 자동으로 바꾸지 않고, 화면에서 "적용" 제안으로만 보여준다.
export function normalizeTranscript(rawText: string, knownTerms: CustomTerm[]): string {
  let result = rawText
  for (const term of knownTerms) {
    if (term.spoken_variation && result.includes(term.spoken_variation)) {
      result = result.split(term.spoken_variation).join(term.correct_term)
    }
  }
  return result
}

// 아직 사전에 없는 기술 용어 오인식 후보를 찾아 "이 단어로 바꿀까요?" 제안을 만든다.
export function findSuggestion(text: string, knownTerms: CustomTerm[]): { from: string; to: string } | null {
  const known = new Set(knownTerms.map((t) => t.spoken_variation))
  for (const [from, to] of Object.entries(TECH_TERM_MAP)) {
    if (known.has(from)) continue
    if (text.includes(from)) return { from, to }
  }
  return null
}
