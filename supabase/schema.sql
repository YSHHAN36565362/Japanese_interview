-- Voice Interview JP — Supabase 스키마
-- Supabase 대시보드 > SQL Editor 에서 이 파일 전체를 실행하세요.
--
-- 질문/꼬리질문 데이터는 더 이상 Supabase에 저장하지 않습니다.
-- 저장소의 data/questions.json(git으로 관리)이 원본이며, 앱이 실행 시 그 파일을 직접 읽습니다.
-- Supabase에는 사용자별 실제 면접 답변 로그(sessions/session_answers 등)만 저장합니다.
-- 기존에 questions/follow_up_rules 테이블을 이미 만든 적이 있다면
-- supabase/migrate_local_questions.sql을 먼저 실행해 정리하세요.

create extension if not exists pgcrypto;

-- ============================================================
-- sessions / session_answers: 면접 세션 및 답변 로그
-- question_id / follow_up_question_id는 Supabase 테이블이 아니라
-- data/questions.json에 있는 질문의 id(문자열)를 그대로 저장하는 텍스트 필드다.
-- ============================================================
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null default 'practice',
  created_at timestamptz not null default now()
);

create table if not exists session_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  question_id text,
  follow_up_question_id text,
  stt_raw_text text,
  corrected_answer_text text,
  duration_seconds numeric,
  latency_to_first_speech_sec numeric(5, 2),
  politeness_score_ratio numeric(3, 2),
  choon_mismatch_count int not null default 0,
  filler_counts jsonb,
  repeated_terms text[],
  feedback_result jsonb,
  improvement_goal text,
  audio_path text,
  audio_expires_at timestamptz,
  answered_at timestamptz not null default now()
);

-- ============================================================
-- user_custom_terms: STT 오인식 보정 개인 사전 (기술 용어 · 장음 등)
-- ============================================================
create table if not exists user_custom_terms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  spoken_variation text not null,
  correct_term text not null,
  category text not null default 'tech',
  created_at timestamptz not null default now(),
  unique (user_id, spoken_variation)
);

-- ============================================================
-- user_settings: 레벨 체크 결과 및 사용자별 기본 설정
-- ============================================================
create table if not exists user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preferred_language text not null default 'ko',
  default_interview_mode text not null default 'practice',
  default_duration_seconds int not null default 60,
  save_audio_default boolean not null default false,
  audio_retention_days int not null default 7,
  target_job_family text,
  target_company_names text[],
  jlpt_self_report text,
  jlpt_level_estimate text check (jlpt_level_estimate in ('N5', 'N4', 'N3', 'N2', 'N1')),
  keigo_mode text not null default 'flexible' check (keigo_mode in ('forced', 'flexible', 'casual_allowed')),
  choon_risk_flag boolean not null default false,
  current_difficulty_level text,
  diagnostic_completed_at timestamptz,
  updated_at timestamptz not null default now()
);

-- ============================================================
-- diagnostic_results: 최초 레벨 체크(자가 신고 + 진단) 결과 이력
-- ============================================================
create table if not exists diagnostic_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  self_reported_jlpt text,
  self_reported_keigo text,
  self_reported_choon text,
  measured_politeness_ratio numeric(3, 2),
  measured_answer_length_sec numeric,
  measured_choon_mismatch_count int,
  measured_keigo_similarity numeric(3, 2),
  recommended_level text,
  recommended_keigo_mode text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table sessions enable row level security;
alter table session_answers enable row level security;
alter table user_custom_terms enable row level security;
alter table user_settings enable row level security;
alter table diagnostic_results enable row level security;

drop policy if exists "sessions_owner_all" on sessions;
create policy "sessions_owner_all" on sessions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "session_answers_owner_all" on session_answers;
create policy "session_answers_owner_all" on session_answers
  for all using (
    exists (select 1 from sessions s where s.id = session_answers.session_id and s.user_id = auth.uid())
  ) with check (
    exists (select 1 from sessions s where s.id = session_answers.session_id and s.user_id = auth.uid())
  );

drop policy if exists "user_custom_terms_owner_all" on user_custom_terms;
create policy "user_custom_terms_owner_all" on user_custom_terms
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "user_settings_owner_all" on user_settings;
create policy "user_settings_owner_all" on user_settings
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "diagnostic_results_owner_all" on diagnostic_results;
create policy "diagnostic_results_owner_all" on diagnostic_results
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
