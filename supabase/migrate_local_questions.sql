-- 기존에 schema.sql(구버전) + seed.sql을 이미 실행해 questions/follow_up_rules 테이블이
-- 있는 프로젝트를, "질문은 로컬 data/questions.json으로 관리" 구조로 전환하는 1회성 마이그레이션.
--
-- 새로 Supabase 프로젝트를 만드는 경우에는 이 파일을 실행할 필요가 없습니다 (schema.sql만 실행).
--
-- 주의: 이전에 저장된 세션 답변의 question_id/follow_up_question_id 값(uuid)은 이제
-- data/questions.json의 문자열 id 체계와 맞지 않아 세션 리포트에서 질문 텍스트가
-- "(삭제되었거나 알 수 없는 질문)"으로 보일 수 있습니다. 테스트 단계이므로 문제 없다면 그대로 진행하세요.

drop policy if exists "questions_select_public_or_own" on questions;
drop policy if exists "questions_insert_own_custom" on questions;
drop policy if exists "questions_update_own_custom" on questions;
drop policy if exists "questions_delete_own_custom" on questions;
drop policy if exists "follow_up_rules_select_all" on follow_up_rules;

alter table session_answers drop constraint if exists session_answers_question_id_fkey;
alter table session_answers drop constraint if exists session_answers_follow_up_question_id_fkey;

alter table session_answers alter column question_id type text using question_id::text;
alter table session_answers alter column follow_up_question_id type text using follow_up_question_id::text;

drop table if exists follow_up_rules;
drop table if exists questions;
