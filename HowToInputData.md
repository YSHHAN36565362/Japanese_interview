# HowToInputData — data/ 폴더만 고치면 자동으로 반영되는 법

`data/` 폴더 안에 질문 후보 파일을 넣고 `npm run merge-data` 한 번만 실행하면, 실제로 앱이
쓰는 `data/questions.json`과 `public/data/follow_ups.txt`에 자동으로 합쳐집니다. **파일을 직접
열어서 복사/붙여넣기 할 필요가 없습니다.**

---

## 1. 지금 당장 할 수 있는 것 — 3줄 요약

1. `data/` 폴더 어딘가에 새 질문이 담긴 `.json` 파일(스키마는 §2 참고)을 둔다.
2. 터미널에서 `npm run merge-data` 실행.
3. `data/questions.json`이 자동으로 갱신된다. 뭐가 추가됐는지 터미널에 그대로 출력된다.

방금 이 방식으로 `data/questions_ver1.json`에 있던 질문 45개가 실제로 `data/questions.json`에
자동 병합되어, 지금 `data/questions.json`은 총 **59개** 질문을 가지고 있습니다 (기존 14개 + 새 45개).

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
| `category` | ✅ | `personality` \| `technical` \| `culture_fit` \| `reverse` |
| `textJa` | ✅ | 일본어 질문 문장. 항상 です・ます체(경어)로 작성. |
| `expectedDurationSec` | ❌ (생략 시 60) | 권장 답변 시간(초) |
| `tags` | ❌ | 자유 태그. 꼬리질문 대상이면 관례적으로 `"follow_up"` 포함 |

파일 이름은 자유입니다 (`questions_ver2.json`, `my_new_questions.json` 등). **`data/questions.json`
이라는 이름만 아니면** 스크립트가 찾아서 읽습니다.

`npm run merge-data`를 실행하면:
- 새 `id`는 `data/questions.json`에 추가됩니다.
- 이미 있는 `id`, 혹은 `id`/`category`/`textJa` 중 하나라도 빠진 항목은 **건너뛰고 이유를
  터미널에 출력**합니다 (조용히 무시하지 않습니다).
- 원본 초안 파일(`questions_ver1.json` 등)은 그대로 남아있습니다. 지워지지 않습니다.

---

## 3. 꼬리질문 규칙을 추가하고 싶을 때 — `.txt` 파일

파일 이름에 **`follow up`(또는 `follow_up`, `followup`, 대소문자 무관)이 들어간** `.txt` 파일을
`data/` 폴더 아래 아무 곳에나 두면 됩니다. 예: `data/drafts/team_follow_ups.txt`

```
# 형식: 원래질문id | 감지할단어1,감지할단어2,... | 다음질문id | 우선순위(선택)
why_this_company | 安定,安定性 | why_not_other_company | 1
```

- `#`으로 시작하는 줄, 빈 줄은 무시됩니다.
- `원래질문id`와 `다음질문id`는 `data/questions.json`에 **이미 존재하는 id**여야 실제로 동작합니다
  (스크립트가 id 존재 여부까지 검사하지는 않으니, 병합 후 오타가 없는지 직접 한 번 확인하세요).
- `npm run merge-data`를 실행하면 이 줄들이 `public/data/follow_ups.txt` 맨 끝에 그대로
  추가됩니다. **이미 똑같은 줄이 있으면 중복 추가하지 않습니다.**

지금은 `data/` 안에 이런 `follow up` 이름이 붙은 `.txt` 파일이 없어서, 방금 실행에서는 꼬리질문
쪽은 0개가 병합되었습니다. `data/questions_ver1.json`의 여러 질문에 `"follow_up"` 태그가 붙어
있는데, 이 질문들을 실제로 어떤 메인 질문 뒤에 이어지게 할지는 아직 정해지지 않았기 때문에
사람이 판단해서 위 형식으로 `.txt` 파일을 만들어야 합니다 (`readme_5.md` §7에 후보 목록이 있습니다).

---

## 4. 실행 방법

```bash
npm run merge-data
```

실행하면 아래처럼 무엇을 스캔했고, 무엇을 추가했고, 무엇을 왜 건너뛰었는지 전부 터미널에
출력됩니다.

```
[질문] 스캔한 초안 파일: 1개
  - data/questions_ver1.json
[질문] 새로 추가됨: 45개
  + self_pr  (data/questions_ver1.json)
  ...
[꼬리질문] 스캔한 초안 파일: 0개
[꼬리질문] 새로 추가됨: 0개
```

이 명령은 **로컬에서만** 실행하면 됩니다 — Vercel 배포 과정에는 포함되어 있지 않습니다. 즉,
`npm run merge-data`로 `data/questions.json`을 갱신한 뒤 그 결과 파일을 GitHub Desktop으로
커밋/푸시해야 실제 배포본에 반영됩니다.

---

## 5. 병합 후 확인할 것

1. `git status` / `git diff data/questions.json`으로 실제로 뭐가 추가됐는지 확인.
2. 새로 추가된 질문에 개인정보·민감정보가 없는지 다시 한 번 확인 (`readme_5.md` §5 체크리스트).
3. `"follow_up"` 태그가 붙은 질문은 §3 형식대로 `.txt` 파일을 만들어 한 번 더 `npm run merge-data`를
   돌리거나, `public/data/follow_ups.txt`에 직접 한 줄 추가.
4. 문제 없으면 `data/questions.json`(그리고 바뀌었다면 `public/data/follow_ups.txt`)만
   커밋/푸시. `data/questions_ver1.json` 같은 초안 파일은 `.gitignore`에 이미 등록되어 있어
   실수로 같이 올라가지 않습니다.

---

## 6. 이 자동화가 하지 않는 것 (알아두면 좋은 한계)

- **개인정보를 자동으로 걸러내지 않습니다.** 초안 파일에 실명·학교명 같은 민감한 내용이 있어도
  스크립트는 그대로 병합합니다. 병합 *전에* 사람이 직접 걸러내야 합니다 (`readme_5.md` §5).
- **id 중복 외의 내용 검증은 하지 않습니다.** 예를 들어 같은 질문을 문구만 살짝 바꿔 다른 id로
  두 번 넣으면 중복으로 잡히지 않고 둘 다 들어갑니다.
- **`missing_keyword`/`answer_length` 같은 다른 트리거 타입은 아직 `.txt` 파일로 못 씁니다.**
  지금 `public/data/follow_ups.txt` 파서는 `keyword` 트리거 한 줄짜리 형식만 이해합니다
  (`readme_5.md` §7 참고). 다른 트리거가 필요해지면 알려주시면 스크립트/파서를 함께 확장하겠습니다.
- Supabase에 있는 개인별 실제 면접 기록(세션/답변)은 이 스크립트와 전혀 관계없습니다. 이 스크립트는
  오직 "질문 은행"(`data/questions.json`, `public/data/follow_ups.txt`)만 다룹니다.
