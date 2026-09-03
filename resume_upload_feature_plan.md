# 이력서(K-Move 워드 양식) 기반 질문/꼬리질문 생성 — 구현 계획

작성일: 2026-09-02. 아직 구현 전, 다음 세션에 이어서 진행하기 위한 계획 문서.

## 배경 / 목적

- K-Move 프로그램 지원자는 전원 **동일한 고정 워드(.docx) 이력서·자기소개서 양식**을 제출한다(임의 포맷이 아님).
- 이 앱은 LLM/AI를 쓰지 않는 "0원 운영" 원칙(`readme_3.md` 참고)을 따르며, 꼬리질문·피드백은 전부 규칙/키워드 매칭이다(`lib/feedback.ts`, `lib/followUp.ts`, `public/data/follow_ups.txt`).
- 양식이 고정이라는 점을 이용해, 이력서를 업로드하면 그 사람만의 경력/기술스택/자기소개서 내용에서 **정확한 필드 추출 + 맞춤 질문·꼬리질문 자동 생성**이 알고리즘만으로 충분히 가능하다고 판단했다.
- 레벨 체크 기능(`app/level-check/page.tsx`)은 "평가 기준이 없다"는 이유로 이미 삭제된 상태이며, 이번 기능과는 무관하게 그대로 둔다(부활시키지 않음).

## 확정된 제품 결정 (사용자 승인 완료)

1. 업로드는 **모드 선택 페이지(`app/interview/page.tsx`) 진입 전, 별도 신규 페이지**에서 받는다.
2. 이력서에서 뽑은 질문은 **기존 무작위 질문 풀과 섞어서** 사용한다(이력서 전용 모드를 새로 만들지 않음).
3. **로그인 사용자**: 파싱 결과를 계정에 저장해 이후 세션에서 재사용(재업로드 시 덮어씀).
4. **게스트(익명 로그인)**: 업로드 가능하지만 파싱 결과는 **브라우저 메모리(sessionStorage)에만** 유지하고 Supabase에는 절대 쓰지 않음(기존 게스트 세션이 `session_answers`를 안 쓰는 것과 동일한 원칙).
5. **양식이 아니거나 파싱 실패 시**: 명확한 에러를 보여주고 업로드를 거부한다. 일반 질문 풀로 조용히 대체하지 않는다.

## 실제 샘플 파일로 검증한 K-Move 워드 양식 구조

`KMOVE13기_イ・ジェグン- 履歴書.docx` (프로젝트 루트)를 직접 압축 해제해 `word/document.xml`을 확인함. 표 기반 문서이며, `<w:tbl>` 8개가 있지만 `<w:tr>` 단위로 평탄화해서 순회하면 충분하다.

- **인적사항 블록**: 라벨 셀 → 값 셀 패턴이지만 **열 위치가 고정이 아님**(`名前` 라벨이 3행에 걸쳐 병합되고 그 안에 漢字/英文/カタカナ 서브 라벨이 있음, `希望勤務 :日本勤務`처럼 한 셀에 라벨:값이 같이 들어간 경우도 있음). → **각 행의 셀을 왼쪽부터 스캔하며, 셀 텍스트가 알려진 라벨과 정확히 일치하면 바로 다음 비어있지 않은 셀을 값으로 취급**하는 방식 + `라벨[:：]값` 정규식 폴백 병행 필요.
- **학력/자격증/경력/기술표**는 반대로 **헤더 행 + 그 뒤 데이터 행들이 열 위치로 정렬**되는 전형적인 표 구조 (`入学年度,卒業年度,学校/教育機関,専攻,学位,卒業区分` 등). → 헤더 행을 찾아 그 다음 데이터 행들을 컬럼 인덱스로 매핑.
- **개별 기술 소개서 표**: `区分/製品/機種名/使用水準(1~9,0)/活用` 구조. 실제로는 숫자 레벨 칸이 대부분 비어 있고, **신뢰할 수 있는 신호는 "製品/機種名 칸에 값이 있고 活用 칸도 비어있지 않은 행"** 뿐. 이 샘플에서 뽑히는 스택: `Windows, HTML/CSS, JSP, Java, JavaScript, C++, Python, MySQL, Postgresql, Visual Studio Code, React, GitHub, Eclipse`.
- **경력(`* 経歴詳細`)**: 이 샘플은 1행(`2024年09月~2025年08月, コンビニ, (부서/직위 공란), レジ・会計業務`)뿐 — 部署/職位가 비어있을 수 있으므로 질문 템플릿은 그 경우를 자연스럽게 처리해야 함.
- **자기소개서(自 己 紹 介)**: 정확히 5개 고정 헤더, 각각 한 셀짜리 헤더 행 바로 다음에 한 셀짜리 답변 행이 옴.
  1. `* 成長過程` (성장과정)
  2. `* 性格の長所・短所` (성격 장단점)
  3. `* 日本に就職したい理由` (일본 취업 이유)
  4. `* 日本ＩＴ研修に参加した理由` (K-Move 참여 이유)
  5. `* 抱負・計画` (포부·계획)
  - 실제 샘플의 `抱負・計画` 답변에 `個人プロジェクトである「Pourfect」において、FastAPIやPostgreSQLなどを活用して...`처럼 **본인만의 고유명사(프로젝트명 "Pourfect")와 기술 키워드**가 그대로 들어있음 → 이게 이 기능의 핵심 재료.
  - 문서 내 실제 배너 텍스트는 `自  己  紹  介`처럼 글자 사이에 공백이 들어간 형태라, 구조 검증 정규식은 공백을 정규화한 뒤 매칭해야 함.
  - 기술 키워드는 대소문자 표기가 갈릴 수 있음(표에는 `Postgresql`, 자소서 본문엔 `PostgreSQL`) → 매칭은 대소문자 무시.

## 재사용할 기존 아키텍처 (건드리지 않고 확장만)

- `lib/questionBank.ts`: `BankQuestion{id,category,expectedDurationSec,textJa,tags?}`, `BankFollowUp{parentId,triggerType,keywords?,targetId,priority?}`. `REAL_MODE_INTRO_QUESTION`(24-30행)이 `data/questions.json`에 없는 코드 정의 "오프뱅크" 질문이 이미 정상 동작 중 — 이력서 질문도 같은 패턴으로 큐 배열에 수동 병합하면 됨. `getMainQuestionsByCategory()`가 무작위 풀에서 `follow_up`/`closing` 태그 질문을 제외.
- `lib/followUp.ts` `matchFollowUpRule()`: rules 배열만 받아 우선순위순으로 keyword/missing_keyword/answer_length/random 매칭. **변경 불필요**.
- `features/interview/lib/followUpEngine.ts` `decideFollowUp()`: `public/data/follow_ups.txt` 규칙 + `matchFollowUpRule`을 연결. 여기에 **선택 인자 2개(`extraRules`, `extraQuestions`)만 추가**해서 이력서 기반 동적 규칙을 파일 규칙과 합쳐 매칭하도록 확장.
- `features/interview/hooks/useInterviewMachine.ts`:
  - 큐 생성은 `useEffect([mode])` (50-82행): `pool = shuffle(getMainQuestionsByCategory(categories)).slice(0, poolSize)` (71행), 실전 모드는 `REAL_MODE_INTRO_QUESTION` 앞에 붙이고 역질문 뒤에 붙임(74-75행). **이력서 질문 삽입 지점** — pool 구성 전에 이력서 질문을 섞어 넣고, poolSize에서 이력서 질문 개수만큼 뺀 나머지를 기존 무작위 풀에서 채우면 세션 총 질문 수는 그대로 유지됨.
  - `confirmAnswer()` (154-232행): 154-181행에서 `session_answers` insert(게스트는 스킵, 169행), 202-208행에서 `decideFollowUp` 호출, 매칭되면 215-219행에서 `questions` 배열에 직접 splice — **임의의 `BankQuestion` 모양 객체를 큐 중간에 끼워 넣는 메커니즘이 이미 존재**하므로 그대로 재사용 가능.
- `app/interview/page.tsx`: 모드 선택, 로그인 사용자는 `sessions` insert 후 `/interview/run/[id]`로 이동, 게스트는 로컬 uuid만 생성.
- `lib/supabase/client.ts`(브라우저)/`lib/supabase/server.ts`(서버, Next 15+ 비동기 `cookies()`) — 새 Route Handler는 서버 클라이언트 사용.
- `supabase/schema.sql`: 모든 테이블이 `auth.uid()` 기반 owner-only RLS. `questions` 테이블 자체가 Supabase에 없음(질문 은행은 git의 `data/questions.json`뿐). Storage 사용 예는 `app/dashboard/page.tsx:69`의 오디오 삭제뿐, 업로드 패턴은 아직 이 저장소에 없음(이번이 최초).
- `package.json`: 의존성이 `@supabase/ssr`, `@supabase/supabase-js`, `next`, `react`, `react-dom`뿐. `app/api/**/route.ts`도 아직 없음(이번이 최초 Route Handler).

## 신규 구현 설계

### 1. 파싱 — 신규 의존성 2개만 추가

- **`jszip`**: .docx(zip 컨테이너)에서 `word/document.xml` 추출.
- **`fast-xml-parser`**: XML을 트리로 파싱해 `w:tbl > w:tr > w:tc > w:p > w:r > w:t` 구조를 정확히 순회(정규식 문자열 슬라이싱보다 워드 버전별 태그 직렬화 차이에 안전).
- `mammoth`(docx→HTML 변환) 등 범용 라이브러리는 **추가하지 않음** — 양식이 고정이므로 손수 만든 파서가 더 정확하고 의존성도 가볍다.
- 새 파일 `lib/resume/docxParser.ts`: 행을 평탄화한 뒤 (1) 라벨-앵커 스캔(인적사항), (2) 헤더+포지셔널 스캔(학력/자격증/경력/기술표), (3) 자기소개서 5문항 헤더 매칭, 총 3가지 전략을 조합.

### 2. 파싱 실행 위치 — `app/api/resume/parse/route.ts` (Node 런타임, 이 저장소 최초 Route Handler)

- `multipart/form-data`로 파일 하나(`file`) 수신.
- `lib/supabase/server.ts`의 서버 클라이언트로 `supabase.auth.getUser()` 호출 — 게스트도 익명 로그인 세션은 있으므로(이미 `app/login/page.tsx`의 `signInAnonymously()`) "세션은 있어야 하지만 비-익명일 필요는 없음"으로 처리.
- 파싱 + 구조 검증(§4) 실행.
  - 실패 시 `422 { error: 'invalid_template', message, missingSections }`.
  - 성공 시: `user.is_anonymous === false`면 `user_resumes`에 upsert(onConflict user_id), `true`면 Supabase에 아무것도 쓰지 않음. **두 경우 모두** 파싱 결과(`ParsedResume`)를 그대로 클라이언트에 반환 — 게스트 쪽은 클라이언트가 받아서 `sessionStorage`에 저장.

### 3. 데이터 모델 (`supabase/schema.sql`에 추가)

```sql
create table if not exists user_resumes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  parsed_data jsonb not null,
  source_filename text,
  updated_at timestamptz not null default now()
);
alter table user_resumes enable row level security;
create policy "user_resumes_owner_all" on user_resumes
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table session_answers add column if not exists question_text_snapshot text;
```

- **단일 jsonb 컬럼**으로 결정한 이유: 이 데이터는 항상 `useInterviewMachine.ts` 큐 생성 시 통째로 읽히고(자소서 전문 필요, 경력 전체 필요, 기술스택 전체 필요), SQL 단에서 개별 필드로 필터링하는 곳이 전혀 없음 — 기존 `session_answers.feedback_result jsonb` 컬럼과 동일한 관례.
- `session_answers.question_text_snapshot` 추가 이유: **결과 페이지(`app/interview/result/[sessionId]/page.tsx:38-42`)가 질문 텍스트를 Supabase가 아니라 `data/questions.json`(`getQuestionById`)에서만 가져오는데, 이력서 기반 질문은 그 파일에 없으므로 이 컬럼 없이는 결과 화면에 "(삭제되었거나 알 수 없는 질문)"으로 깨져서 나온다.** 이번 기능에 필수로 딸려오는 수정.

`lib/resume/types.ts`:

```ts
export interface ParsedResumeCareer {
  company: string
  role?: string
  department?: string
  duties?: string
  startYm?: string
  endYm?: string
}

export interface ParsedResume {
  personal: {
    nameKanji?: string; nameRomaji?: string; nameKana?: string
    hobby?: string; desiredJob?: string; desiredDuty?: string
  }
  careers: ParsedResumeCareer[]
  techStack: string[]
  essays: {
    growth: string
    personality: string
    whyJapan: string
    whyProgram: string
    aspiration: string
  }
}
```

### 4. 질문/꼬리질문 생성 로직

**(a) 자기소개서 5문항 → 고정 `BankQuestion` 5개** (`lib/resume/resumeQuestions.ts`, `REAL_MODE_INTRO_QUESTION`과 동일 패턴):

```ts
export const RESUME_ESSAY_QUESTIONS: Record<keyof ParsedResume['essays'], BankQuestion> = {
  growth:      { id: 'resume_essay_growth',      category: 'personality', expectedDurationSec: 90, textJa: '成長過程について教えてください。', tags: ['resume_derived'] },
  personality: { id: 'resume_essay_personality', category: 'personality', expectedDurationSec: 90, textJa: 'ご自身の性格の長所と短所について教えてください。', tags: ['resume_derived'] },
  whyJapan:    { id: 'resume_essay_why_japan',   category: 'culture_fit', expectedDurationSec: 90, textJa: '日本で就職したい理由を教えてください。', tags: ['resume_derived'] },
  whyProgram:  { id: 'resume_essay_why_program', category: 'culture_fit', expectedDurationSec: 90, textJa: 'このK-MOVE日本IT研修に参加された理由を教えてください。', tags: ['resume_derived'] },
  aspiration:  { id: 'resume_essay_aspiration',  category: 'personality', expectedDurationSec: 90, textJa: '入社後の抱負や今後の計画について教えてください。', tags: ['resume_derived'] },
}
```

자소서 원문 자체는 그대로 질문으로 쓰지 않고, 꼬리질문 키워드 추출용 재료로만 쓴다.

**(b) 경력 항목 → 회사당 템플릿 질문 1개** (최대 3개, `buildCareerQuestions()`):

```ts
`履歴書によると、${company}で${role}として勤務されていたとのことですが、そこでの業務について具体的に教えてください。`
// role이 없으면 "…勤務経験があるとのことですが…" 형태로 폴백
```

**(c) 자소서 고유명사 → 동적 꼬리질문 생성** (`lib/resume/followUpSynth.ts`) — 이 기능의 핵심:

- 추출: `「」『』"'` 괄호 인용구(프로젝트명 후보) + 기술 키워드 사전(기존 `follow_ups.txt`에 이미 나오는 Python/SQL/機械学習/データ 등을 base로, 본인 기술표에서 뽑힌 스택까지 합집합) 대소문자 무시 매칭.
- 문항당 최대 2개(괄호 인용구 우선), 각각에 대해:
  - `BankFollowUp` 합성: `{parentId: 해당 자소서 질문 id, triggerType: 'keyword', keywords: [토큰], targetId: 합성 id, priority: 프로젝트명이면 5 아니면 2}`
  - `BankQuestion` 합성: `「${token}」について、具体的にどのように取り組みましたか。工夫した点や苦労した点も教えてください。` (프로젝트명) / `${token}について、実務や学習の中でどのように活用しましたか。` (기술 키워드)
- **ID 네임스페이스**: 합성 질문/규칙 id는 전부 `resume_` 접두사(`resume_essay_*`, `resume_career_*`, `resume_followup_*`). `data/questions.json`에는 이 접두사가 전혀 없어 충돌 위험 없음.

**(d) 기존 엔진과의 연결**:

- `lib/questionBank.ts`, `lib/followUp.ts`는 **수정 없음**.
- `decideFollowUp()`에 선택 인자 2개 추가:
  ```ts
  export async function decideFollowUp(
    parentQuestionId, answerText, durationSeconds, expectedDurationSec, alreadyAsked,
    extraRules: BankFollowUp[] = [], extraQuestions: BankQuestion[] = []
  ) {
    const fileRules = await getFollowUpsFor(parentQuestionId)
    const rules = [...fileRules, ...extraRules.filter(r => r.parentId === parentQuestionId)]
      .filter(r => !alreadyAsked.has(r.targetId))
    const matched = matchFollowUpRule(rules, answerText, durationSeconds, expectedDurationSec)
    if (!matched) return null
    return getQuestionById(matched.targetId) ?? extraQuestions.find(q => q.id === matched.targetId) ?? null
  }
  ```
- `useInterviewMachine.ts` 큐 생성 effect: `guest` 판별 직후 이력서 로드(로그인 → `user_resumes` select, 게스트 → `sessionStorage.getItem('kmove_resume')`), 있으면 `RESUME_ESSAY_QUESTIONS` 5개 + `buildCareerQuestions()` 결과를 `resumeMainQuestions`로 만들고, `poolSize - resumeMainQuestions.length`만큼만 기존 무작위 풀에서 채워 합침(총 질문 수 유지). `buildResumeFollowUps()` 결과는 새 ref(`resumeExtraRulesRef`, `resumeExtraQuestionsRef`)에 저장해두고, `confirmAnswer()`의 `decideFollowUp(...)` 호출에 두 ref를 추가 인자로 전달. `session_answers` insert에 `question_text_snapshot: currentQuestion.textJa` 추가.
- `app/interview/result/[sessionId]/page.tsx` 41행: `questionTextJa: r.question_text_snapshot ?? question?.textJa ?? '(삭제되었거나 알 수 없는 질문)'`로 변경.

### 5. "양식이 아님" 에러 처리

`lib/resume/docxParser.ts`에서 다음 중 하나라도 걸리면 422로 거부(일반 풀로 대체하지 않음):

- zip이 아니거나 `word/document.xml`이 없음 → "올바른 .docx 파일이 아닙니다".
- 공백 정규화한 문서 텍스트에 자기소개서 배너/5개 헤더 중 4개 미만만 발견됨.
- 헤더는 다 찾았지만 모든 자소서 답변 칸이 비어있음(양식은 맞는데 미작성).
- 인적사항 필수 라벨(名前/生年月日/性別) 3개 미만 발견 → "다른 종류의 문서인 것 같습니다".

### 6. 파일 목록

**신규**
- `lib/resume/types.ts`
- `lib/resume/docxParser.ts`
- `lib/resume/resumeQuestions.ts`
- `lib/resume/followUpSynth.ts`
- `app/api/resume/parse/route.ts`
- `app/interview/resume/page.tsx` (업로드 페이지: 파일 선택 → 미리보기 → 계속/건너뛰기, `/interview`로 이동)
- `supabase/schema.sql`에 `user_resumes` 테이블 + `session_answers.question_text_snapshot` 컬럼 추가

**수정**
- `package.json` — `jszip`, `fast-xml-parser` 추가
- `app/login/page.tsx` — `handleGuestEnter`/`handleSubmit`의 `router.push('/interview')` 2곳을 `/interview/resume`로
- `features/interview/lib/followUpEngine.ts` — `decideFollowUp()` 인자 확장
- `features/interview/hooks/useInterviewMachine.ts` — 이력서 로드/병합, `decideFollowUp` 호출부, `session_answers` insert 필드 추가
- `app/interview/result/[sessionId]/page.tsx` — 질문 텍스트 폴백에 `question_text_snapshot` 우선 사용

**수정 불필요**: `lib/questionBank.ts`, `lib/followUp.ts`, `app/dashboard/page.tsx`, `components/MarkdownExportButton.tsx`

## 검증 계획

1. `npx tsc --noEmit`, `npm run build` (새 Route Handler/의존성 타입 문제 확인).
2. 파서 단독 스모크 테스트: 실제 샘플 `KMOVE13기_イ・ジェグン- 履歴書.docx`를 직접 파싱해 `personal.nameKanji === '李在根'`, `techStack`에 13개 항목, `careers[0].company === 'コンビニ'`, `essays.aspiration`에 `Pourfect` 포함 등을 확인.
3. 실패 케이스: 무관한 파일/일부 섹션 삭제한 파일로 422 응답 확인.
4. E2E 수동 확인: 로그인 → `/interview/resume` 업로드 → 미리보기 확인 → 연습 모드 시작 → 큐에 `resume_essay_*`/`resume_career_*` id 포함 확인 → "Pourfect" 언급 답변 시 꼬리질문 발동 확인 → 로그아웃 후 재로그인 시 재업로드 없이 저장된 이력서 노출 확인 → 결과 페이지에서 질문 텍스트가 정상 노출되는지 확인(스냅샷 수정 검증).
5. 게스트 경로: 같은 흐름을 게스트로 반복, Supabase `user_resumes`/`session_answers`에 아무 행도 안 써지는지 확인.
6. 회귀 확인: `/interview/resume`를 거치지 않거나 "건너뛰기"를 누른 경우 기존 모드들이 이전과 동일하게 동작하는지 확인.

## 다음 세션에서 시작할 지점

위 "신규 구현 설계" §1~§6을 순서대로 구현하면 된다. 구현 시작 전 이 문서를 다시 읽고, 특히 실제 `.docx` 샘플 파일(프로젝트 루트)로 파서를 먼저 검증한 뒤 나머지를 진행할 것.
