-- 꼬리질문/추가질문 알고리즘 튜닝용 집계 쿼리 모음.
-- Supabase 대시보드 > SQL Editor 에서 아래 쿼리들을 하나씩(또는 필요한 것만) 실행하세요.
-- 각 쿼리 결과를 캡처해서 대화에 붙여주면, 그걸 기반으로 lib/questionBank.ts와
-- public/data/follow_ups.txt의 우선순위/키워드/범용 폴백 배정을 실제 데이터로 조정할 수 있습니다.
--
-- 주의: 여기 나오는 question_id/follow_up_question_id는 Supabase 테이블이 아니라
-- data/questions.json(혹은 이력서 기반이면 resume_* id)의 문자열 id를 그대로 저장한
-- 텍스트 필드입니다. 부모→자식 매핑 자체는 git의 public/data/follow_ups.txt에만 있어서
-- SQL만으로는 "발동률(=자식이 실제로 나온 비율)"까지는 못 구하고, 아래는 "얼마나 자주
-- 나왔는지(빈도)"까지만 구합니다 — 그걸로 상위/하위 항목을 추리고, 발동률은 그 목록을
-- 놓고 follow_ups.txt와 대조해서 판단하면 됩니다.

-- ============================================================
-- 0. 전체 규모 확인 (아래 결과들을 해석하기 전에 먼저 봐야 할 기준치)
-- ============================================================
select
  count(*) as total_answers,
  count(distinct session_id) as total_sessions,
  count(*) filter (where follow_up_question_id is not null) as total_follow_up_answers
from session_answers;

-- ============================================================
-- 1. 메인 질문(대분류) 빈도 — 어떤 질문이 실제로 자주 나오는지
--    (추천 리스트 #3 "고빈도 질문부터 전용 꼬리질문으로 교체"의 근거 데이터)
-- ============================================================
select
  question_id,
  count(*) as asked_count
from session_answers
where question_id is not null
group by question_id
order by asked_count desc
limit 30;

-- ============================================================
-- 2. 꼬리질문(자식) 빈도 — 어떤 규칙이 실제로 자주/거의 안 발동하는지
--    175개 규칙 중 상위권은 우선순위·키워드가 잘 맞는다는 뜻이고,
--    0건인 target은 조건이 너무 까다롭거나 애초에 그 부모 질문 자체가 잘 안 나온다는 뜻입니다.
-- ============================================================
select
  follow_up_question_id,
  count(*) as triggered_count,
  round(avg(duration_seconds)::numeric, 1) as avg_duration_sec
from session_answers
where follow_up_question_id is not null
group by follow_up_question_id
order by triggered_count desc;

-- ============================================================
-- 3. 새로 추가한 범용 폴백 2종이 실제로 얼마나 쓰이는지
--    (elaborate_reason=answer_length, concrete_example_request=missing_keyword,
--     concrete_results_numbers=키워드+missing_number 둘 다 겹쳐서 씀)
-- ============================================================
select
  follow_up_question_id,
  count(*) as triggered_count
from session_answers
where follow_up_question_id in ('elaborate_reason', 'concrete_example_request', 'concrete_results_numbers', 'if_not_selected')
group by follow_up_question_id
order by triggered_count desc;

-- ============================================================
-- 4. 메인 질문별로 "그 다음 답변이 꼬리질문이었는지" 세션 단위로 근사 확인
--    (완벽한 발동률은 아니지만, 같은 세션에서 해당 질문 직후 꼬리질문이 몇 번 등장했는지 대략치)
-- ============================================================
select
  question_id,
  count(*) as asked_count,
  count(*) filter (
    where exists (
      select 1 from session_answers f
      where f.session_id = session_answers.session_id
        and f.answered_at > session_answers.answered_at
        and f.follow_up_question_id is not null
        and f.answered_at = (
          select min(f2.answered_at) from session_answers f2
          where f2.session_id = session_answers.session_id
            and f2.answered_at > session_answers.answered_at
        )
    )
  ) as immediately_followed_by_any_follow_up
from session_answers
where question_id is not null
group by question_id
order by asked_count desc
limit 30;
