-- Voice Interview JP — Supabase 스키마 (readme_3.md 최종 데이터 모델 기준)
-- Supabase 대시보드 > SQL Editor 에서 이 파일 전체를 실행하세요.

create extension if not exists pgcrypto;

-- ============================================================
-- questions: 질문 풀 (공개 질문 + 사용자 커스텀 질문)
-- ============================================================
create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('personality', 'technical', 'culture_fit', 'reverse')),
  jlpt_level text check (jlpt_level in ('N5', 'N4', 'N3', 'N2', 'N1')),
  keigo_required boolean not null default true,
  difficulty text,
  text_ja text not null,
  text_ko text,
  company_stage text,
  job_family text,
  expected_duration_sec int not null default 60,
  answer_framework text,
  evaluation_points jsonb,
  tags text[],
  core_keywords text[],
  sample_answer_ja text,
  sample_answer_ko text,
  is_custom boolean not null default false,
  owner_user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ============================================================
-- follow_up_rules: 꼬리질문 규칙 그래프 (AI 없이 키워드/조건 매칭)
-- ============================================================
create table if not exists follow_up_rules (
  id uuid primary key default gen_random_uuid(),
  parent_question_id uuid not null references questions(id) on delete cascade,
  trigger_type text not null check (trigger_type in ('keyword', 'missing_keyword', 'answer_length', 'order', 'random')),
  trigger_value jsonb,
  priority int not null default 0,
  cooldown_count int not null default 1,
  follow_up_question_id uuid not null references questions(id) on delete cascade,
  feedback_hint_ja text,
  feedback_hint_ko text
);

-- ============================================================
-- sessions / session_answers: 면접 세션 및 답변 로그
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
  question_id uuid references questions(id),
  follow_up_question_id uuid references questions(id),
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
alter table questions enable row level security;
alter table follow_up_rules enable row level security;
alter table sessions enable row level security;
alter table session_answers enable row level security;
alter table user_custom_terms enable row level security;
alter table user_settings enable row level security;
alter table diagnostic_results enable row level security;

drop policy if exists "questions_select_public_or_own" on questions;
create policy "questions_select_public_or_own" on questions
  for select using (is_custom = false or owner_user_id = auth.uid());

drop policy if exists "questions_insert_own_custom" on questions;
create policy "questions_insert_own_custom" on questions
  for insert with check (is_custom = true and owner_user_id = auth.uid());

drop policy if exists "questions_update_own_custom" on questions;
create policy "questions_update_own_custom" on questions
  for update using (owner_user_id = auth.uid());

drop policy if exists "questions_delete_own_custom" on questions;
create policy "questions_delete_own_custom" on questions
  for delete using (owner_user_id = auth.uid());

drop policy if exists "follow_up_rules_select_all" on follow_up_rules;
create policy "follow_up_rules_select_all" on follow_up_rules
  for select using (true);

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
