// 질문/꼬리질문 관련 타입은 lib/questionBank.ts (data/questions.json 기반)를 참고하세요.
// 이 파일에는 Supabase에 실제로 저장되는 사용자별 데이터 타입만 둡니다.
export type JlptLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1'
export type KeigoMode = 'forced' | 'flexible' | 'casual_allowed'

export interface InterviewSession {
  id: string
  user_id: string
  mode: string
  created_at: string
}

export interface SessionAnswer {
  id: string
  session_id: string
  question_id: string | null
  follow_up_question_id: string | null
  stt_raw_text: string | null
  corrected_answer_text: string | null
  duration_seconds: number | null
  latency_to_first_speech_sec: number | null
  politeness_score_ratio: number | null
  choon_mismatch_count: number
  filler_counts: Record<string, number> | null
  repeated_terms: string[] | null
  feedback_result: any
  improvement_goal: string | null
  audio_path: string | null
  audio_expires_at: string | null
  answered_at: string
}

export interface UserSettings {
  user_id: string
  preferred_language: string
  default_interview_mode: string
  default_duration_seconds: number
  save_audio_default: boolean
  audio_retention_days: number
  target_job_family: string | null
  target_company_names: string[] | null
  jlpt_self_report: string | null
  jlpt_level_estimate: JlptLevel | null
  keigo_mode: KeigoMode
  choon_risk_flag: boolean
  current_difficulty_level: string | null
  diagnostic_completed_at: string | null
  updated_at: string
}

export interface DiagnosticResult {
  id: string
  user_id: string
  self_reported_jlpt: string | null
  self_reported_keigo: string | null
  self_reported_choon: string | null
  measured_politeness_ratio: number | null
  measured_answer_length_sec: number | null
  measured_choon_mismatch_count: number | null
  measured_keigo_similarity: number | null
  recommended_level: string | null
  recommended_keigo_mode: string | null
  created_at: string
}
