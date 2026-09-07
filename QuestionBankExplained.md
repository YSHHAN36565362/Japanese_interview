# 질문이 왜 세션마다 다 나오지 않고 일부만 나오나요?

"전체 질문은 몇 개인데 왜 화면엔 일부만 보이지?"와 "카테고리 체크박스는 어떻게 동작하지?"에
대한 설명입니다. `npm run merge-data`로 질문을 추가할 때마다 아래 숫자는 바뀔 수 있으니
참고용 스냅샷입니다(마지막 갱신 기준 총 213개, 대분류 208개, 2026-09-07).

**2026-09-07 개편**: 답변 키워드로 자동으로 이어지던 "꼬리질문" 기능을 **완전히 제거**했습니다
— 로직이 기대만큼 자연스럽게 진행되지 않는다는 피드백 때문입니다. 대신 세션 시작 전에
사용자가 "연습할 주제"를 체크박스로 직접 고르는 화면을 추가했습니다. 이에 맞춰 질문마다
`topicCategory`라는 세부 주제 필드가 새로 생겼고, 사람이 검토하기 쉽도록 카테고리별 질문
목록을 `data/Question/{日本,Software,半導体}/*.md`에 정리해 두었습니다. 자세한 내용은 아래
§1, §3.

---

## 1. 질문 은행(213개)은 두 종류로 나뉩니다

| 종류 | 태그 | 개수 | 언제 나오나 |
|---|---|---|---|
| **대분류 질문** | (태그 없음, `topicCategory` 있음) | 208개 | 세션 시작 시 카테고리 체크박스로 고른 주제에서 무작위로 뽑히는 질문 |
| **마무리 전용** | `closing` | 5개 | "마지막 질문하기" 버튼을 눌렀을 때만 무작위로 1개 |

대분류 질문 208개의 큰 분류(`category` 필드) 구성은 personality/technical/culture_fit/reverse
로 예전과 같지만, 화면의 체크박스는 이보다 더 세분화된 `topicCategory`(13종) 기준으로
동작합니다 — 아래 §3 참고.

---

## 2. 화면에 "질문 X / Y"로 보이는 Y는 어떻게 정해지나요

세션이 시작될 때, 사용자가 체크박스로 고른 `topicCategory`에 속한 질문들만 후보로 남기고
그중 **모드마다 정해진 개수만큼** 무작위로 뽑습니다(`features/interview/hooks/useInterviewMachine.ts`의
`poolSize`, 실제로는 `lib/questionBank.ts`의 `sampleMainQuestions()`가 그룹 중복·지원 직무(track)
불일치·선택한 topicCategory까지 걸러서 뽑습니다).

| 모드 | 뽑는 범위 | poolSize(최소) |
|---|---|---|
| 연습 모드 | personality+technical+culture_fit 중 체크한 topicCategory, 트랙 필터 없음 | 30 |
| 기술 면접 | technical 중 체크한 topicCategory, 트랙 필터 없음 | 24 |
| 실전 모드(소프트웨어) | 위 중 소프트웨어 트랙에 맞는 것 | 자기소개(1) + 28 + 역질문(1) |
| 실전 모드(반도체) | 위 중 반도체 트랙에 맞는 것 | 자기소개(1) + 28 + 역질문(1) |
| 실전 모드(기본) | 무작위 아님 — `basic_track` 태그 12개 고정(§6), 체크박스 화면 자체를 건너뜀 | 자기소개(1) + 12 + 마지막 한마디(1) |

체크박스에서 아무것도 빼지 않고 전체 선택한 채로 시작하면, 예전(꼬리질문 도입 전)과 똑같이
전체 후보 풀에서 무작위로 뽑힙니다. 체크박스에서 일부 주제를 뺀 경우에는 그 주제에 속한
질문은 애초에 후보에서 제외됩니다.

세션 도중 질문이 늘어나는 일은 이제 없습니다 — 꼬리질문이 제거되면서 세션 시작 시 뽑힌
개수(Y)가 끝까지 고정됩니다("마지막 질문하기"를 누르면 +1개만 늘어납니다).

---

## 3. 카테고리 체크박스 화면 — `topicCategory`

세션 시작 전(모드/지원 직무 선택 다음 단계) `CategoryPickerStep` 화면에서, 사용자가 연습하고
싶은 세부 주제를 체크박스로 고릅니다. 기본값은 전체 선택이고, "전체 선택"/"전체 해제" 버튼으로
빠르게 조정할 수 있습니다. 최소 1개는 선택해야 시작할 수 있습니다.

카테고리 목록(`lib/questionBank.ts`의 `TOPIC_CATEGORIES`):

| id | 라벨 | scope | 폴더(사람이 보는 문서) |
|---|---|---|---|
| `self_personality` | 자기소개·성격 | common | `data/Question/日本/self_personality.md` |
| `episodes` | 경험·에피소드 | common | `data/Question/日本/episodes.md` |
| `common_technical` | 공통 직무 경험 | common | `data/Question/日本/common_technical.md` |
| `japan_life_adapt` | 일본 환경 적응(생활·거주) | common | `data/Question/日本/japan_life_adapt.md` |
| `japan_culture` | 일본 사회·문화 이해 | common | `data/Question/日本/japan_culture.md` |
| `japan_motivation` | 일본에서 일하고 싶은 이유·지원동기 | common | `data/Question/日本/japan_motivation.md` |
| `company_fit` | 회사 선택 기준·근무 조건 | common | `data/Question/日本/company_fit.md` |
| `career_future` | 커리어·입사 후 계획 | common | `data/Question/日本/career_future.md` |
| `reverse` | 역질문 | common | `data/Question/日本/reverse.md` (체크박스엔 안 보임 — 실전 모드 마지막에 자동으로 붙음) |
| `sw_dev` | 소프트웨어 개발 경험·역량 | software | `data/Question/Software/sw_dev.md` |
| `sw_ml` | 머신러닝·AI | software | `data/Question/Software/sw_ml.md` |
| `semi_industry` | 반도체 산업·기술 이해 | semiconductor | `data/Question/半導体/semi_industry.md` |
| `semi_field` | 반도체 현장 적응 | semiconductor | `data/Question/半導体/semi_field.md` |

모드/지원 직무에 따라 실제로 보여주는 카테고리가 다릅니다(`getSelectableTopicCategories()`):
- **연습 모드**: `reverse`를 뺀 12개 전부(소프트웨어/반도체 주제도 함께 고를 수 있음 — 지원
  직무를 안 묻는 모드라서).
- **기술 면접**: `common_technical` + `sw_dev` + `sw_ml` + `semi_industry` + `semi_field` 5개만.
- **실전 모드(소프트웨어)**: 공통 8개 + `sw_dev` + `sw_ml`.
- **실전 모드(반도체)**: 공통 8개 + `semi_industry` + `semi_field`.
- **실전 모드(기본)**: 체크박스 화면 자체를 건너뜁니다(§6, 고정 목록이라 주제 선택이 의미 없음).

체크박스에서 고른 id들은 URL 쿼리(`?...&categories=self_personality,episodes,...`)로 면접
화면(`/interview/run/[sessionId]`)에 전달되고, `useInterviewMachine`이 `sampleMainQuestions()`
호출 시 그대로 넘겨서 후보를 좁힙니다.

새 질문을 추가할 때는 반드시 `topicCategory`를 지정해야 합니다 — 없으면 `npm run merge-data`가
병합을 건너뛰고 이유를 출력합니다(`HowToInputData.md` 참고). 어느 카테고리에 넣을지 애매하면
`data/Question/` 아래 비슷한 주제의 `.md` 파일을 열어 기존 질문들과 비교해보세요.

---

## 4. 비슷한 질문이 한 세션에 같이 나오지 않게 하는 group 필드

"스트레스 해소법이 뭔가요"와 "스트레스에 어떻게 대처하나요"처럼 사실상 같은 질문이 한
세션에서 둘 다 나오면 어색합니다. 이를 막기 위해 `data/questions.json`의 질문에 선택적
`group` 필드를 추가했습니다 — 같은 `group` 값을 가진 질문들은 **한 세션에 그 중 하나만**
무작위로 뽑힙니다 (`lib/questionBank.ts`의 `sampleMainQuestions()`). `group`이 없는
질문은 자기 자신의 `id`가 곧 그룹이라, 다른 질문과 절대 묶이지 않습니다.

새 질문을 추가할 때 기존 질문과 주제가 거의 겹친다면, `data/questions.json`에서 두 질문에
같은 `group` 문자열만 넣어주면 됩니다(스키마 변경 없이 바로 적용됩니다).

---

## 5. 지원 직무(소프트웨어/반도체)에 안 맞는 질문은 어떻게 걸러지나요

실전 모드를 시작할 때 "지원 직무를 골라주세요" 화면에서 소프트웨어/반도체 중 하나를 고르면
(`app/interview/page.tsx`), 그 선택이 URL 쿼리(`?mode=real&track=software`)로 면접 화면에
전달되고, `useInterviewMachine`이 `sampleMainQuestions(categories, poolSize, track, ...)`을
호출할 때 그대로 넘어갑니다.

질문마다 선택적 `track` 필드(`'software' | 'semiconductor'`)를 가질 수 있습니다:
- `track`이 없는 질문(자기소개, 지원동기, 스트레스 해소법, 팀 프로젝트 경험 등 대부분의
  인성/컬처핏 질문과 일부 범용 기술 질문) → **어떤 트랙에서도** 그대로 나옵니다.
- `track: 'software'`인 질문 → 반도체 지원자에게는 나오지 않습니다(체크박스에도 `sw_dev`/`sw_ml`
  자체가 안 보입니다).
- `track: 'semiconductor'`인 질문 → 소프트웨어 지원자에게는 나오지 않습니다.

연습 모드와 기술 면접 모드는 지원 직무를 묻지 않으므로, 이 필터링 없이 모든 track의 질문이
섞여서 나올 수 있습니다(체크박스로 둘 다 고를 수 있음) — "여러 직무를 두루 연습해보고 싶을
때"는 이 두 모드를 쓰면 됩니다.

---

## 6. "기본 모드"는 왜 다르게 동작하나요

소프트웨어/반도체 트랙은 체크한 카테고리 안에서 매번 무작위로 뽑지만, **기본 모드는
무작위가 아닙니다.** 실제 면접에서 거의 항상 나오는 대표 질문 12개를 `lib/questionBank.ts`의
`BASIC_TRACK_QUESTION_IDS`에 정해진 순서 그대로 고정해뒀고, `getBasicTrackQuestions()`가
이 순서 그대로 반환합니다. 카테고리 체크박스 화면도 건너뜁니다 — 고정 목록이라 주제 선택이
의미가 없기 때문입니다(`app/interview/page.tsx`의 `handleTrackChosen` 참고).

앞뒤로는 다른 트랙과 마찬가지로 자기소개(`REAL_MODE_INTRO_QUESTION`, 항상 첫 질문)가
붙지만, **마무리는 역질문이 아니라 "最後に一言お願いします。"(`final_word`)로 끝납니다** —
소프트웨어/반도체 트랙만 "最後に、何か質問はありますか。"(역질문)로 마무리합니다
(`features/interview/hooks/useInterviewMachine.ts`의 `isBasicTrack` 분기 참고).

목록을 바꾸고 싶으면 `BASIC_TRACK_QUESTION_IDS` 배열의 순서를 바꾸거나 id를 추가/삭제하면
됩니다 — 이 배열에 있는 순서 그대로 나오므로, 무작위 셔플이 필요 없다면 이 방식이 가장
간단합니다.

---

## 7. 질문을 더 추가하고 싶다면

`HowToInputData.md`를 참고하세요 — `data/` 폴더에 초안 파일을 만들고 `topicCategory`를
반드시 지정한 뒤 `npm run merge-data`만 실행하면 자동으로 병합됩니다.

세션당 보이는 개수(poolSize) 자체를 더 늘리거나 줄이고 싶다면
`features/interview/hooks/useInterviewMachine.ts`의 `poolSize` 값만 바꾸면 됩니다.
