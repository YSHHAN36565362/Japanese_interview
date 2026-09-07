# HowToInputData — data/ 폴더만 고치면 자동으로 반영되는 법

`data/` 폴더 안에 질문 후보 파일을 넣고 `npm run merge-data` 한 번만 실행하면, 실제로 앱이
쓰는 `data/questions.json`에 자동으로 합쳐집니다. **파일을 직접 열어서 복사/붙여넣기 할 필요가
없습니다.**

2026-09-07부로 꼬리질문(답변 키워드로 자동으로 이어지는 후속 질문) 기능은 완전히
제거되었습니다. 대신 세션 시작 전에 사용자가 "연습할 주제"를 체크박스로 직접 고르는 방식으로
바뀌었습니다 — 그래서 새 질문마다 아래 §2의 `topicCategory` 필드가 **필수**입니다.

---

## 1. 지금 당장 할 수 있는 것 — 3줄 요약

1. `data/` 폴더 어딘가에 새 질문이 담긴 `.json` 파일(스키마는 §2 참고)을 둔다.
2. 터미널에서 `npm run merge-data` 실행.
3. `data/questions.json`이 자동으로 갱신된다. 뭐가 추가/건너뛰어졌는지 터미널에 그대로 출력된다.

---

## 2. 질문을 추가하고 싶을 때 — `.json` 파일

`data/` 폴더 아래 어디에나(바로 아래든, `data/drafts/` 안이든) `questions.json`이 **아닌** 이름으로
`.json` 파일을 만들고, 아래 형식으로 질문을 적으면 됩니다.

```json
{
  "questions": [
    {
      "id": "새로운_질문_id",
      "category": "personality",
      "topicCategory": "self_personality",
      "expectedDurationSec": 60,
      "textJa": "일본어 질문 문장 (반드시 경어체)",
      "tags": ["선택사항"]
    }
  ]
}
```

| 필드 | 필수 | 설명 |
|---|---|---|
| `id` | ✅ | 영문 slug. `data/questions.json`에 이미 있는 id와 겹치면 **자동으로 건너뜁니다** (덮어쓰지 않음). |
| `category` | ✅ | `personality` \| `technical` \| `culture_fit` \| `reverse` (예전부터 있던 큰 분류, 지금은 주로 참고용) |
| `topicCategory` | ✅ | 체크박스 화면에서 이 질문이 속할 세부 주제 id. `lib/questionBank.ts`의 `TOPIC_CATEGORIES` 배열에 있는 값 중 하나여야 하며, **없으면 병합 시 건너뜁니다**(체크박스 화면에 절대 안 나오게 되므로). 어느 카테고리가 있는지는 `data/Question/{日本,Software,半導体}/*.md`를 참고하세요. |
| `textJa` | ✅ | 일본어 질문 문장. 항상 です・ます체(경어)로 작성. |
| `expectedDurationSec` | ❌ (생략 시 60) | 권장 답변 시간(초) |
| `group` | ❌ | 비슷한 주제의 질문끼리 묶는 그룹 id. 같은 그룹은 한 세션에 하나만 나옵니다. |
| `track` | ❌ | `software` \| `semiconductor`. 특정 지원 직무 전용 질문이면 지정(공통이면 생략). |
| `tags` | ❌ | 자유 태그. `"closing"`을 넣으면 "마지막 질문하기" 버튼 전용(무작위 첫 질문 풀에서 제외)이 됩니다. |

파일 이름은 자유입니다 (`questions_ver2.json`, `my_new_questions.json` 등). **`data/questions.json`
이라는 이름만 아니면** 스크립트가 찾아서 읽습니다.

`npm run merge-data`를 실행하면:
- 새 `id`는 `data/questions.json`에 추가됩니다.
- 이미 있는 `id`, `id`/`category`/`textJa` 중 하나라도 빠진 항목, 또는 `topicCategory`가 없는
  항목은 **건너뛰고 이유를 터미널에 출력**합니다 (조용히 무시하지 않습니다).
- 원본 초안 파일은 그대로 남아있습니다. 지워지지 않습니다.

---

## 3. 실행 방법

```bash
npm run merge-data
```

실행하면 아래처럼 무엇을 스캔했고, 무엇을 추가했고, 무엇을 왜 건너뛰었는지 전부 터미널에
출력됩니다.

```
[질문] 스캔한 초안 파일: 1개
  - data/drafts/my_new_questions.json
[질문] 새로 추가됨: 3개
  + self_pr_v2  (data/drafts/my_new_questions.json)
  ...
```

이 명령은 **로컬에서만** 실행하면 됩니다 — Vercel 배포 과정에는 포함되어 있지 않습니다. 즉,
`npm run merge-data`로 `data/questions.json`을 갱신한 뒤 그 결과 파일을 커밋/푸시해야 실제
배포본에 반영됩니다.

---

## 4. 병합 후 확인할 것

1. `git status` / `git diff data/questions.json`으로 실제로 뭐가 추가됐는지 확인.
2. 새로 추가된 질문에 개인정보·민감정보가 없는지 다시 한 번 확인.
3. 새 질문이 속한 `data/Question/{日本,Software,半導体}/` 아래 해당 카테고리 `.md` 파일도 함께
   손으로 갱신(선택이지만, 사람이 검토하기 쉬워집니다 — 자동 갱신되지 않습니다).
4. 문제 없으면 `data/questions.json`만 커밋/푸시. `data/drafts/*.json` 같은 초안 파일은
   `.gitignore`에 이미 등록되어 있어 실수로 같이 올라가지 않습니다.

---

## 5. 이 자동화가 하지 않는 것 (알아두면 좋은 한계)

- **개인정보를 자동으로 걸러내지 않습니다.** 초안 파일에 실명·학교명 같은 민감한 내용이 있어도
  스크립트는 그대로 병합합니다. 병합 *전에* 사람이 직접 걸러내야 합니다.
- **id 중복 외의 내용 검증은 하지 않습니다.** 예를 들어 같은 질문을 문구만 살짝 바꿔 다른 id로
  두 번 넣으면 중복으로 잡히지 않고 둘 다 들어갑니다.
- **`data/Question/*.md` 참고 문서는 자동 갱신되지 않습니다.** 병합 스크립트는 `data/questions.json`만
  건드립니다 — 사람이 읽는 카테고리별 목록은 새 질문을 추가할 때 손으로 함께 갱신해주세요.
- Supabase에 있는 개인별 실제 면접 기록(세션/답변)은 이 스크립트와 전혀 관계없습니다. 이 스크립트는
  오직 "질문 은행"(`data/questions.json`)만 다룹니다.
