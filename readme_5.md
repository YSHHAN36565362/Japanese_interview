# Voice Interview JP — 데이터 저장 방식 총정리 (readme_5.md)

> "질문 데이터를 어디에, 어떻게 저장하면 좋을지"를 한 곳에 정리한 문서입니다. `readme_4.md`가
> "지금 앱이 뭘 하는지"를 정리한 문서라면, 이 문서는 **데이터(질문·꼬리질문·개인 준비자료·실제 면접
> 기록)를 어디에 두고 어떻게 다뤄야 하는지**에 집중합니다.

---

## 1. 데이터는 4갈래로 나눠서 관리합니다

| 종류 | 저장 위치 | git 커밋 | 앱이 읽는가 |
|---|---|---|---|
| ① 질문 원본 | `data/questions.json` | ✅ 커밋 | ✅ 빌드에 번들링되어 사용 |
| ② 꼬리질문 규칙 | `public/data/follow_ups.txt` | ✅ 커밋 | ✅ 브라우저가 fetch로 읽음 |
| ③ 개인 실제 면접 기록 | Supabase (`sessions`, `session_answers` 등) | ❌ (DB에 저장, 저장소 파일 아님) | ✅ 로그인한 본인 것만 |
| ④ 질문 초안 / 개인 준비 자료 | `data/drafts/` (로컬 전용) | ❌ **커밋 금지** | ❌ 앱이 직접 읽지 않음 |

이 네 가지를 섞지 않는 것이 핵심입니다. **①·②는 "완성되어 앱이 실제로 쓰는 데이터"**이고,
**③은 "각자의 개인 기록"**이며, **④는 "아직 다듬는 중인 재료"**입니다. ④를 ①에 그대로 합치거나,
④를 실수로 git에 커밋하는 것이 가장 흔한 실수 지점입니다.

---

## 2. ① 질문 원본 — `data/questions.json`

```json
{
  "questions": [
    {
      "id": "team_project",
      "category": "technical",
      "expectedDurationSec": 90,
      "textJa": "チームで取り組んだプロジェクトについて教えてください。",
      "tags": ["team_project"]
    }
  ]
}
```

- `id`: 영문 slug, **파일 전체에서 유일해야 함**. `follow_ups.txt`가 이 id로 질문을 참조합니다.
- `category`: `personality | technical | culture_fit | reverse`
- `expectedDurationSec`: 권장 답변 시간(초). 사실 확인성 질문은 60초, 설명·사례가 필요한 질문은 90초
  정도가 적당합니다 (`questions_ver1.json`에서도 이 기준을 따랐습니다).
- `textJa`: **일본어 질문 문장만**. JLPT 난이도 태그나 한국어 번역은 넣지 않습니다 — 실제 면접관은
  지원자 수준과 무관하게 항상 경어로 질문하므로 난이도 구분이 의미가 없다고 판단했기 때문입니다
  (`readme_4.md` §3-2 참고). 새 질문을 쓸 때도 **항상 です・ます체(경어)**로 작성하세요.
- `tags`: 자유 태그. 이 질문이 다른 질문의 "꼬리질문 대상"으로 쓰일 예정이면 관례적으로
  `"follow_up"` 태그를 함께 붙입니다 (필수는 아니고, 사람이 파일을 훑어볼 때 알아보기 위한 표시).

**이 파일은 앱이 빌드 시점에 통째로 읽어들이는 파일입니다.** 수정 후 로컬에서는 저장만 해도
`npm run dev`에 바로 반영되고, 배포본은 git commit/push 후 Vercel이 자동 재배포하면 반영됩니다.

---

## 3. ② 꼬리질문 규칙 — `public/data/follow_ups.txt`

```
# 형식: 원래질문id | 감지할단어1,감지할단어2,... | 다음질문id | 우선순위(선택)
team_project | チーム,プロジェクト,担当 | role_detail | 1
```

- `#`으로 시작하는 줄과 빈 줄은 무시됩니다.
- **원래질문id / 다음질문id는 반드시 `data/questions.json`에 실제로 존재하는 `id`여야 합니다.**
  오타가 나면 조용히 무시될 뿐 에러가 나지 않으니, 병합 후 한 번씩 id가 맞는지 확인하세요.
- 감지할 단어는 쉼표로 여러 개 나열 가능하며, 사용자의 STT 인식 텍스트에 이 중 하나라도 포함되면
  발동합니다 (AI 호출 없는 단순 문자열 포함 검사, `lib/followUp.ts`).
- 이 파일은 `public/` 아래에 있어 **브라우저가 fetch로 직접 읽습니다.** JSON으로 다시 번들링할
  필요가 없어 저장 즉시 로컬 개발 서버에도 반영됩니다.

**주의**: `questions.json`에 `"tags": ["follow_up"]`이 붙어 있다고 자동으로 꼬리질문이 되는 것은
**아닙니다.** 그 질문을 실제로 "언제, 어떤 질문 다음에" 물을지는 반드시 `follow_ups.txt`에 별도로
한 줄을 추가해야 동작합니다. (§5에서 `questions_ver1.json` 병합 시 이 부분을 자세히 설명합니다.)

---

## 4. ③ 개인 실제 면접 기록 — Supabase

`sessions`, `session_answers`, `user_settings`, `diagnostic_results`, `user_custom_terms` 테이블에
로그인한 사용자 본인의 답변·피드백·설정만 저장됩니다. 이 데이터는 저장소(git) 파일이 아니라 각자의
Supabase 프로젝트 DB에 있으며, RLS로 본인 것만 볼 수 있게 되어 있습니다 (`readme_4.md` §5 참고).
**질문·꼬리질문(①·②)과 절대 같은 곳에 두지 마세요** — ①·②는 "모두가 공유하는 문제집"이고, ③은
"각자의 답안지"입니다.

---

## 5. ④ 질문 초안 / 개인 준비 자료 — `data/drafts/` (신규 규칙, git 제외)

방금 다른 세션에서 개인 모의면접 준비 자료(`Question data/YounsuHan.txt`)를 바탕으로 개인정보를
제거한 질문 후보 목록(`questions_ver1.json`)을 만드신 것을 확인했습니다. 아주 좋은 접근입니다 —
다만 이런 "아직 다듬는 중인 자료"는 **①·②와 섞이지 않는 별도 위치에, git에는 올라가지 않게** 두는
것을 권장합니다.

### 권장 폴더 구조

```
data/
  questions.json          ← ① 완성본. 이것만 git에 커밋됨
  drafts/                 ← ④ 초안 전용 폴더 (.gitignore로 통째로 제외)
    Question data/         원본 개인 준비 자료 (실명·학교명 등 포함될 수 있음)
    questions_ver1.json     사람이 검토 중인 후보 목록
```

지금 두신 `data/Question data/`, `data/questions_ver1.json`, `data/readme_4 복사본.md`은 위치는
그대로 두셔도 되지만(강제로 옮기지 않았습니다), **`.gitignore`에 이 경로들을 추가해 커밋되지 않도록
방금 처리해 두었습니다.** 다음에 새 초안 파일을 만드실 때는 이름을 일일이 gitignore에 추가하지
않아도 되도록, 앞으로는 `data/drafts/` 폴더 하나에 몰아넣는 것을 권장합니다 (그 폴더 자체를
통째로 무시하도록 이미 등록해뒀습니다).

### 왜 git에서 빼야 하나요?

`Question data/YounsuHan.txt` 같은 원본 준비 자료에는 실명, 출신 학교, 특정 장소/일화, 병역 여부처럼
**개인을 특정할 수 있는 정보**가 들어있을 가능성이 높습니다. 이 저장소가 GitHub에 올라가는 순간
공개 여부와 무관하게 커밋 이력에 영구히 남으므로,애초에 git이 추적하지 않게 막는 것이 안전합니다.
`questions_ver1.json`처럼 이미 정제된 후보 파일도, 검토가 끝나기 전까지는 같은 이유로 커밋하지
않는 것을 권장합니다.

### 개인정보·민감정보 제거 체크리스트

방금 만들어진 `questions_ver1.json`의 `_excluded_for_privacy_or_sensitivity` 항목이 좋은 기준이
되므로 그대로 정리해둡니다. 앞으로 새 준비 자료를 정리할 때도 이 기준을 적용하세요.

- [ ] 지원자 실명, 출신 학교명이 드러나는 질문/답변 문장
- [ ] 특정 장소·특정 일화(예: 특정 지명, 특정 사건)가 드러나는 문장
- [ ] 병역(군 복무) 등 개인 신상과 결부되는 민감한 주제
- [ ] 특정 회사명이 그대로 노출되는 문장
- [ ] 실제 프로젝트의 정확한 수치·점수 등 식별 가능한 성과 지표 (필요하면 일반화해서 남기기)
- [ ] **지원자 개인의 실제 답변 내용 자체** — 이 프로젝트에서는 "질문/꼬리질문"만 모으고, 개인
      답변은 절대 `data/questions.json`에 넣지 않습니다 (개인 답변은 오직 ③ Supabase에, 그것도
      본인 세션에만 남아야 합니다)

---

## 6. 새 질문을 추가하는 표준 절차

1. (선택) 개인 준비 자료가 있다면 `data/drafts/`에 원본을 두고, 위 체크리스트로 개인정보를 뺀
   질문/꼬리질문 후보만 골라 `data/drafts/questions_verN.json` 같은 이름으로 정리합니다
   (`questions_ver1.json`이 이미 좋은 예시입니다).
2. 후보 목록에서 실제로 쓸 질문들을 골라 **`data/questions.json`의 `questions` 배열에 병합**합니다.
   - id가 기존 항목과 겹치지 않는지 확인 (`questions_ver1.json`은 이미 기존 14개와 겹치지 않게
     만들어져 있습니다).
   - `textJa`가 경어(です・ます체)인지 확인.
3. 병합한 질문 중 "꼬리질문으로 쓸 질문"(보통 `tags`에 `follow_up`이 붙어있는 것들)이 있다면,
   **`public/data/follow_ups.txt`에 그 질문을 가리키는 규칙 한 줄을 반드시 추가**합니다. 이 단계를
   빼먹으면 질문은 은행에 들어가 있어도 실제로는 절대 출제되지 않습니다(꼬리질문이든 메인
   질문이든, 메인 카테고리 질문 목록에는 잡히지 않도록 `follow_up` 태그된 것들은 보통 메인 셋에서
   무작위로 뽑히지 않게 별도 카테고리/태그로 구분해두는 것이 좋습니다. 지금 스키마에는 "이 질문은
   꼬리질문 전용"이라는 강제 규칙은 없으므로, 메인 목록에 섞여 무작위로 뽑히길 원치 않으면 직접
   구분해서 관리해야 합니다).
4. `data/drafts/` 안의 원본/후보 파일은 그대로 두거나 정리해서 로컬에만 보관합니다 (git에는
   올라가지 않습니다).
5. `data/questions.json`과 `public/data/follow_ups.txt`(변경했다면)만 GitHub Desktop으로
   커밋/푸시합니다.

---

## 7. 지금 있는 `questions_ver1.json`을 병합할 때 참고할 점

- 45개 질문 후보가 `personality / technical / culture_fit` 카테고리로 이미 잘 분류되어 있고,
  기존 14개 id와 겹치지 않아 `npm run merge-data`로 전부 자동 병합되었습니다 (현재 `data/questions.json`
  총 59개).
- `"tags": ["...", "follow_up"]`이 붙은 항목들(`why_not_other_company`, `explain_oop`,
  `skill_other_context`, `why_important_value`, `specific_feedback_received`,
  `non_negotiable_standard`, `opinion_split_decision`, `long_term_reason_beyond_stability`,
  `if_not_selected`, `concrete_results_numbers`)은 **아직 `follow_ups.txt`에 규칙이 없는 상태**라
  병합만 해서는 출제되지 않습니다. 어떤 메인 질문 뒤에, 어떤 키워드가 나오면 이 질문들을 이어서
  물을지 §3의 형식대로 `follow_ups.txt`에 추가해야 실제로 작동합니다.
- 예를 들어 `why_this_company`(지원 동기) 답변에 특정 키워드가 없을 때
  `why_not_other_company`("그건 타사에서도 할 수 있지 않나요?")를 잇는다면
  `missing_keyword` 트리거가 필요한데, 지금 텍스트 규칙 엔진은 `keyword`/`missing_keyword` 둘 다
  지원하므로 (`lib/followUp.ts`) 이런 규칙도 만들 수 있습니다. 다만 `follow_ups.txt`의 현재 파서는
  `keyword` 트리거만 파싱하도록 만들어져 있어서, `missing_keyword`를 텍스트 파일에서 쓰려면
  `lib/questionBank.ts`의 파서를 함께 확장해야 합니다 — 지금 당장 필요하지 않다면 이 부분은
  나중에 요청해 주세요.

---

## 8. 요약 체크리스트

- [ ] 완성된 질문 → `data/questions.json`에만
- [ ] 완성된 꼬리질문 규칙 → `public/data/follow_ups.txt`에만
- [ ] 개인 실제 답변 → Supabase에만 (파일로 남기지 않음)
- [ ] 다듬는 중인 원본/후보 → `data/drafts/`에 (git에 올라가지 않도록 이미 처리됨)
- [ ] 새 질문에 개인정보·민감정보 없는지 §5 체크리스트로 확인
- [ ] 꼬리질문 대상 질문은 `follow_ups.txt`에 규칙을 추가했는지 확인
- [ ] 커밋 전에 `git status`로 `data/drafts/`류가 올라가려 하지 않는지 한 번 확인
