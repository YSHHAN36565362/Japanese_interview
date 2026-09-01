# 데모 실행 & 배포 가이드

`readme_3.md` 최종 제안서를 바탕으로 만든 실제 동작 데모입니다. Next.js 16(App Router) + React 19 + Supabase +
브라우저 Web Speech API로 구성되어 있으며, 로컬 실행과 Vercel + Supabase 연결 모두 이 문서 순서대로 진행하면 됩니다.
(`npm install` 시 `npm audit`에서 알려진 취약점이 없는 최신 안정 버전으로 고정해 두었습니다.)

**필요 환경**: Node.js 20 이상 권장 (Vercel 배포 시에는 자동으로 적절한 Node 런타임을 사용하므로 별도 설정 불필요).

> ⚠️ **가장 먼저 확인하세요**: 비밀번호(`kmove13`)를 입력했는데 "Anonymous sign-ins are disabled"
> 오류가 뜨면, Supabase 대시보드 → **Authentication → Sign In / Providers → Anonymous Sign-Ins**
> 토글을 켜지 않은 것입니다. 아래 1장의 3번 단계를 먼저 완료하세요. 이 토글 하나만 켜면 바로 해결됩니다.

---

## 0. 폴더 구성

```
app/                  Next.js App Router 페이지
  page.tsx            홈
  login/               공유 비밀번호 입력 → 익명 로그인 (이메일 발송 없음)
  level-check/         최초 레벨 체크(자가 신고 + 장음/경어 진단)
  interview/           모드 선택 → 면접 진행 → 결과 리포트
  dashboard/           마이페이지 (세션 목록, STT 보정 사전, 로그아웃)
components/           재사용 UI 컴포넌트
lib/                  Supabase 클라이언트, Web Speech 훅, 질문 은행 로더, 피드백/꼬리질문 규칙 엔진
data/
  questions.json      ★ 질문 · 꼬리질문 원본 (git으로 관리, 여기를 직접 수정/추가하세요)
supabase/
  schema.sql                     테이블 + RLS 정책 (세션/답변 등 "개인별 기록"만 저장)
  migrate_local_questions.sql    구버전(questions 테이블 사용)에서 전환할 때만 1회 실행
```

---

## 1. Supabase 프로젝트 준비

1. https://supabase.com 에서 새 프로젝트 생성 (무료 티어).
2. 왼쪽 메뉴 **SQL Editor** 에서 `supabase/schema.sql` 내용을 붙여넣고 실행.
   - 질문/꼬리질문 데이터는 이제 Supabase에 넣지 않습니다. `data/questions.json`(이 저장소 안의 파일)이
     원본이고, 앱이 그 파일을 직접 읽습니다. Supabase에는 세션/답변 등 "개인별 기록"만 저장됩니다.
   - 예전에 이미 이 프로젝트에서 `questions`/`follow_up_rules` 테이블을 만든 적이 있다면(구버전
     schema.sql + seed.sql을 실행했던 경우), `supabase/migrate_local_questions.sql`을 딱 1번 실행해
     정리하세요. 처음 만드는 프로젝트라면 이 단계는 건너뛰어도 됩니다.
3. 왼쪽 메뉴 **Authentication → Sign In / Providers → Anonymous Sign-Ins** 를 켜주세요(Enable).
   이 데모는 이메일을 전혀 보내지 않습니다 — 화면에서 공유 비밀번호(`kmove13`)를 확인한 뒤
   `supabase.auth.signInAnonymously()`로 세션만 발급합니다. 이메일/비밀번호 Provider나 URL
   Redirect 설정을 따로 만질 필요가 없습니다.
4. **Project Settings → API** 에서 `Project URL`과 `anon public` 키를 복사해둡니다 (다음 단계에서 사용).

---

## 2. 로컬 실행

```bash
npm install
cp .env.local.example .env.local
# .env.local 을 열어 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 값을 채우기
npm run dev
```

브라우저에서 `http://localhost:3000` 접속 → 비밀번호(`kmove13`) 입력 → 레벨 체크 → 면접 시작 순으로
테스트합니다. 비밀번호는 `app/login/page.tsx`의 `SHARED_PASSWORD` 상수에 있으니 원하는 값으로 바꿔도 됩니다.

> 음성 기능은 Chrome 또는 Edge에서 가장 안정적으로 동작합니다. 마이크 권한을 허용해야 합니다.

---

## 3. GitHub Desktop 커밋 & 푸시

1. 이 폴더를 GitHub Desktop에서 로컬 저장소로 추가 (또는 새 저장소로 초기화).
2. `.env.local`은 `.gitignore`에 포함되어 있어 커밋되지 않습니다 — 실수로 올리지 않도록 확인만 해주세요.
3. 커밋 후 원격 저장소(GitHub)로 푸시.

---

## 4. Vercel 배포

1. https://vercel.com 에서 방금 푸시한 GitHub 저장소를 Import.
2. **Environment Variables**에 아래 두 값을 등록 (Production/Preview/Development 모두):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Deploy.
4. 이메일을 전혀 사용하지 않으므로 Redirect URL 등록 없이 바로 접속해서 비밀번호를 입력하면 됩니다.

---

## 5. 질문 · 꼬리질문 편집하기 (`data/questions.json`)

질문과 꼬리질문은 Supabase가 아니라 이 저장소의 **`data/questions.json`** 파일에 있습니다. 이 파일을
직접 수정한 뒤 GitHub Desktop으로 커밋/푸시하면 Vercel이 자동으로 재배포합니다 — 즉 "로컬에서 고치고
GitHub에 올리면 끝"입니다. Supabase에는 각자의 실제 면접 답변(텍스트)만 쌓입니다.

### 파일 구조

```json
{
  "questions": [
    {
      "id": "team_project",                 // 다른 질문과 겹치지 않는 영문 slug
      "category": "technical",              // personality | technical | culture_fit | reverse
      "expectedDurationSec": 90,             // 권장 답변 시간(초)
      "textJa": "チームで取り組んだプロジェクトについて教えてください。",
      "tags": ["team_project"]
    }
  ],
  "followUps": [
    {
      "parentId": "team_project",           // 이 질문에 답한 뒤에
      "triggerType": "keyword",             // 답변에 아래 keywords 중 하나라도 있으면
      "keywords": ["チーム", "プロジェクト", "担当"],
      "targetId": "role_detail",            // 이 질문(questions[]의 id)을 이어서 묻는다
      "priority": 1                          // 여러 규칙이 동시에 맞으면 숫자가 큰 것부터 검사
    }
  ]
}
```

질문에는 JLPT 난이도나 한국어 번역을 넣지 않습니다. 실제 면접관은 지원자 수준과 무관하게 항상
경어(です・ます체)로 질문하므로, 난이도로 질문을 나눌 필요가 없고 화면에는 일본어 질문만 보여줍니다.
새 질문을 추가할 때도 `textJa`는 항상 경어로 작성해주세요.

### 꼬리질문은 어떻게 동작하나요? (AI 없이)

1. 사용자가 메인 질문에 음성으로 답하고 "답변 제출"을 누르면, 인식된 텍스트가 그대로
   `followUps` 배열에서 `parentId`가 그 질문인 규칙들과 비교됩니다.
2. `triggerType: "keyword"`면 `keywords` 중 하나라도 답변 텍스트에 포함되어 있는지
   (`answerText.includes(keyword)`) 단순 문자열 검사만 합니다 — 서버나 AI 호출이 전혀 없습니다.
3. 조건을 만족하는 규칙이 있으면 `targetId`에 해당하는 질문을 다음 질문으로 바로 이어서 보여줍니다.
   같은 세션에서 이미 물어본 꼬리질문은 다시 나오지 않습니다.
4. 여러 규칙이 동시에 맞으면 `priority` 숫자가 큰 규칙을 우선합니다.
5. 이 로직은 `lib/followUp.ts`(매칭 함수)와 `lib/questionBank.ts`(데이터 로딩)에 있습니다.

### 실전 모드 첫 질문은 코드에 고정되어 있습니다

실전 모드(`real`)의 첫 번째 질문은 항상 "簡単に自己紹介をお願いします。"(간단한 자기소개를 부탁드립니다)로
고정되어 있으며, 이 문장은 `data/questions.json`이 아니라 **`lib/questionBank.ts`의
`REAL_MODE_INTRO_QUESTION` 상수**에 하드코딩되어 있습니다. `data/questions.json`을 아무리 고쳐도 이
질문은 항상 실전 모드 맨 앞에 그대로 나옵니다.

### 질문 순서

같은 카테고리에 속한 질문들은 세션을 시작할 때마다 무작위로 섞여서 6개(실전 모드는 고정 자기소개
1개 + 5개)가 출제됩니다. `data/questions.json`에 질문을 더 추가할수록 매번 다른 조합이 나옵니다.

---

## 6. 화면 구성 & UI 요소

- **홈**: 좌우로 기울어진 호버 카드(`HeroCard`)로 "JP · 日本語面接練習プログラム" 타이틀을 보여줍니다.
- **로그인**: 공유 비밀번호 입력 폼(네오브루탈리즘 스타일) 하나뿐입니다. 이메일 발송(가입 확인 메일,
  매직 링크 등)이 전혀 없고, 비밀번호가 맞으면 Supabase 익명 로그인으로 즉시 세션을 발급합니다.
- **내부 화면 공통 프레임**: 레벨 체크·면접·결과·마이페이지·상단바·모드 선택 카드는 모두 실제 macOS
  Safari 창처럼 "트래픽 라이트 타이틀바 + 주소창 느낌의 툴바" 2단 구조(`MacWindow`, `.topbar-*`,
  `.mode-card-*`)로 통일했습니다.
- **레벨 체크 / 면접 진행**: 경어·장음 자신감, JLPT 수준 선택은 슬라이딩 세그먼트 버튼(`PillRadio`)으로,
  마이크 시작/중지는 오디오 스펙트럼 느낌의 토글 스위치(`MicToggle`)로 조작합니다.
- **마이페이지**: 세션 목록/STT 보정 사전과 함께 로그아웃 버튼(`LogoutButton`)이 있습니다.
- **로딩 상태**: 질문을 불러오거나 저장하는 동안 통통 튀는 점 3개짜리 로더(`LoadingDots`)를 보여줍니다.
- **배경 연출**: 카타카나가 흘러내리는 은은한 배경(`MatrixBackground`, 불투명도 약 14%)을 홈/로그인/레벨체크/
  모드선택/결과/마이페이지에 깔아두었고, **실제 면접이 진행되는 화면(`/interview/run/...`)에서는 자동으로
  숨겨집니다** (경로를 감지해 렌더링하지 않는 방식).
- 이 UI 컴포넌트들은 모두 `components/` 아래 별도 파일로 있고 스타일은 `app/globals.css`에 정리해 두었으니,
  색상/문구 등은 자유롭게 손봐도 됩니다.

---

## 7. 이 데모의 범위 (readme_3.md 대비 단순화한 부분)

`readme_3.md`의 핵심 개념(0원 원칙, 레벨 체크, 꼬리질문 규칙 엔진, 규칙 기반 피드백, 장음/경어 대응)은
모두 동작하는 코드로 구현되어 있습니다. 다만 실제 서비스로 키우기 전에 알아두면 좋은 단순화 지점:
 
- **음성 녹음(오디오 파일) 업로드는 아직 연결되어 있지 않습니다.** `session_answers.audio_path` /
  `audio_expires_at` 컬럼과 마이페이지의 만료 정리 로직은 준비되어 있으므로, `MediaRecorder`로 녹음한
  Blob을 Supabase Storage에 업로드하는 부분만 추가하면 됩니다. (readme_3.md Phase 2 항목)
- **적응형 난이도 자동 제안 배너(§5-4)는 구현하지 않았습니다.** 요청하신 대로 "어려우면 생략"에
  해당하는 옵션 기능이며, 현재는 레벨 체크 결과를 수동으로 반영하는 방식까지만 구현했습니다.
- **레이더 차트·히트맵 등 고급 시각화는 없습니다.** 대신 세션 리포트에 숫자 기반 통계 카드로 대체했습니다.
- 장음 인식 체크, 경어 문장 재현 유사도는 **문자열 비교 기반의 근사치**입니다. 언어학적으로 정밀한
  발음 평가가 아니므로, 화면에도 "추정치"로 표기해 두었습니다.
- 꼬리질문은 `data/questions.json`에 포함된 4개 규칙만 예시로 들어있습니다. §5를 참고해 직접 추가하세요.
- 질문 난이도(JLPT)/한국어 번역은 질문 은행에서 뺐습니다. 실제 면접관은 지원자 수준과 무관하게 항상
  경어로 질문하므로, 질문 자체를 난이도별로 나눌 필요가 없다고 판단했습니다 (레벨 체크의 JLPT 자가
  신고는 `keigo_mode` 추천에는 계속 쓰입니다).

---

## 8. 알려진 제한사항

- Web Speech API는 브라우저·OS에 따라 지원 여부와 인식 품질이 다릅니다 (Chrome/Edge 권장).
- 브라우저에 따라 `SpeechRecognition`이 서버 기반 인식 엔진을 사용할 수 있어, 완전한 오프라인 처리를
  보장하지는 않습니다 (API 과금은 없지만 "완전 로컬"과는 별개입니다).
- 면접 진행 화면의 파형 시각화는 별도로 마이크 스트림을 요청하므로, 일부 브라우저에서 마이크 권한
  팝업이 두 번 뜰 수 있습니다.
- Supabase 무료 프로젝트는 7일간 활동이 없으면 일시 정지될 수 있습니다. 오랜만에 접속했는데 로딩이
  오래 걸린다면 프로젝트가 깨어나는 중일 가능성이 높습니다.
- **공유 비밀번호는 브라우저 코드에 그대로 들어있는 클라이언트 측 확인일 뿐입니다.** 실제 계정 인증이
  아니라 "아무나 못 들어오게 막는" 수준의 가벼운 문지기입니다. 5~10명 규모의 비공개 데모에는 충분하지만,
  더 엄격한 접근 제어가 필요해지면 Supabase Auth의 이메일/비밀번호 또는 OAuth 로그인으로 교체하세요.
