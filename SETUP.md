# 데모 실행 & 배포 가이드

`readme_3.md` 최종 제안서를 바탕으로 만든 실제 동작 데모입니다. Next.js 16(App Router) + React 19 + Supabase +
브라우저 Web Speech API로 구성되어 있으며, 로컬 실행과 Vercel + Supabase 연결 모두 이 문서 순서대로 진행하면 됩니다.
(`npm install` 시 `npm audit`에서 알려진 취약점이 없는 최신 안정 버전으로 고정해 두었습니다.)

**필요 환경**: Node.js 20 이상 권장 (Vercel 배포 시에는 자동으로 적절한 Node 런타임을 사용하므로 별도 설정 불필요).

> ⚠️ **가장 먼저 확인하세요**: 로그인 화면에는 두 가지 입장 방법이 있고, 둘 다 Supabase 설정이
> 하나씩 필요합니다.
> - 고유 번호 입장 → "이메일 회원가입이 꺼져 있습니다" 오류가 뜨면, **Authentication → Providers →
>   Email**에서 **Confirm email**을 꺼주세요(Disable). 진짜 이메일을 보내지 않고(가짜 `.local`
>   주소를 내부적으로만 씁니다) 번호만으로 즉시 로그인/가입 처리를 하므로, 이 토글이 켜져 있으면
>   계정은 만들어지고도 로그인이 완료되지 않습니다.
> - "번호 없이 시작하기" → "Anonymous sign-ins are disabled" 오류가 뜨면, **Authentication →
>   Sign In / Providers → Anonymous Sign-Ins**를 켜주세요(Enable). 기록을 남기지 않는 게스트
>   입장은 이 방식을 그대로 씁니다.
> 아래 1장의 3번 단계 참고.

---

## 0. 폴더 구성

```
app/                  Next.js App Router 페이지
  page.tsx            홈
  login/               고유 번호 입력 → 그 번호로 Supabase 이메일/비밀번호 로그인·가입 (이메일 발송 없음)
  interview/           모드 선택 화면 (면접 진행 자체는 features/interview 참고)
    run/[sessionId]/   InterviewRoom을 렌더링하는 얇은 로더
  dashboard/           마이페이지 (세션 목록·삭제, 고유 번호 변경, STT 보정 사전, 로그아웃)
components/           사이트 공통 재사용 UI 컴포넌트 (SiteChrome, MacWindow, HeroCard 등)
features/interview/    ★ 면접 진행 화면("면접실") 전용 — 상태 머신, 훅, 하위 컴포넌트
                       (zoom_style_frontend_implementation_guide.md 기반, 자세한 내용은 readme_4.md §3-4·§9)
lib/                  Supabase 클라이언트, Web Speech 훅, 질문 은행 로더, 피드백/꼬리질문 규칙 엔진
data/
  questions.json      ★ 질문 원본 (git으로 관리, 여기를 직접 수정/추가하세요)
public/data/
  follow_ups.txt      ★ 꼬리질문 규칙 원본 (일반 텍스트, git으로 관리)
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
3. 왼쪽 메뉴 **Authentication → Providers → Email**에서 두 가지를 확인하세요.
   - **Confirm email**(가입 확인 메일 요구) → **꺼주세요(Disable)**. 이 데모는 사용자가 입력한
     "고유 번호"로 `id-번호@voiceinterviewjp.local` 같은 가짜 이메일을 만들어 Supabase
     이메일/비밀번호 인증에 그대로 씁니다(진짜 메일함이 없으므로 확인 메일이 절대 오지 않습니다).
     이 토글이 켜져 있으면 회원가입은 되지만 로그인이 완료되지 않습니다.
   - **Secure email change**(이메일 변경 시 재확인 요구) → 켜져 있다면 **꺼주세요**. 마이페이지의
     "고유 번호 변경" 기능은 내부적으로 계정의 이메일/비밀번호를 바꾸는 방식인데, 이 토글이 켜져
     있으면 마찬가지로 도착하지 않을 확인 메일을 기다리게 됩니다.
   - 그 외 이메일 Provider의 Signup(가입 허용) 자체는 켜져 있어야 합니다(기본값 On).
4. 왼쪽 메뉴 **Authentication → Sign In / Providers → Anonymous Sign-Ins**도 켜주세요(Enable).
   로그인 화면의 "번호 없이 시작하기"(기록을 남기지 않는 게스트 입장)가 이 방식을 씁니다.
5. **Project Settings → API** 에서 `Project URL`과 `anon public` 키를 복사해둡니다 (다음 단계에서 사용).

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

## 5. 질문 · 꼬리질문 편집하기

질문과 꼬리질문 모두 Supabase가 아니라 이 저장소 안의 파일로 관리합니다. 수정한 뒤 GitHub Desktop으로
커밋/푸시하면 Vercel이 자동으로 재배포합니다 — "로컬에서 고치고 GitHub에 올리면 끝"입니다. Supabase에는
각자의 실제 면접 답변(텍스트)만 쌓입니다.

- **질문**: `data/questions.json` (구조화된 데이터라 JSON을 그대로 씁니다)
- **꼬리질문 규칙**: `public/data/follow_ups.txt` (JSON 문법 몰라도 되는 일반 텍스트 파일)

### 질문 파일 구조 (`data/questions.json`)

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
  ]
}
```

질문에는 JLPT 난이도나 한국어 번역을 넣지 않습니다. 실제 면접관은 지원자 수준과 무관하게 항상
경어(です・ます체)로 질문하므로, 난이도로 질문을 나눌 필요가 없고 화면에는 일본어 질문만 보여줍니다.
새 질문을 추가할 때도 `textJa`는 항상 경어로 작성해주세요.

### 꼬리질문 파일 구조 (`public/data/follow_ups.txt`, 일반 텍스트)

```
# 형식: 원래질문id | 감지할단어1,감지할단어2,... | 다음질문id | 우선순위(선택)
team_project | チーム,プロジェクト,担当 | role_detail | 1
```

- `#`으로 시작하는 줄과 빈 줄은 무시됩니다.
- 원래질문id / 다음질문id는 `data/questions.json`에 있는 질문의 `id` 값입니다.
- 감지할 단어는 쉼표로 여러 개 나열할 수 있습니다.

### 꼬리질문은 어떻게 동작하나요? (AI 없이)

1. 사용자가 메인 질문에 음성으로 답하고 "답변 제출"을 누르면, 인식된 텍스트가 그대로
   `follow_ups.txt`에서 방금 질문의 id와 같은 규칙들과 비교됩니다.
2. 지정한 단어들 중 하나라도 답변 텍스트에 포함되어 있는지(`answerText.includes(keyword)`)
   단순 문자열 검사만 합니다 — 서버나 AI 호출이 전혀 없습니다.
3. 조건을 만족하는 규칙이 있으면 그 줄의 "다음질문id"를 다음 질문으로 바로 이어서 보여줍니다.
   같은 세션에서 이미 물어본 꼬리질문은 다시 나오지 않습니다.
4. 여러 규칙이 동시에 맞으면 우선순위 숫자가 큰 규칙을 우선합니다.
5. 이 로직은 `lib/followUp.ts`(매칭 함수)와 `lib/questionBank.ts`(파일 읽기/파싱)에 있습니다.
   `follow_ups.txt`는 `public/` 아래에 있어 브라우저가 `fetch`로 직접 읽어옵니다(빌드 시 다시
   번들링할 필요 없이, 파일 저장 즉시 로컬 개발 서버에도 반영됩니다).

### 실전 모드 첫 질문은 코드에 고정되어 있습니다

실전 모드(`real`)의 첫 번째 질문은 항상 "簡単に自己紹介をお願いします。"(간단한 자기소개를 부탁드립니다)로
고정되어 있으며, 이 문장은 `data/questions.json`이 아니라 **`lib/questionBank.ts`의
`REAL_MODE_INTRO_QUESTION` 상수**에 하드코딩되어 있습니다. `data/questions.json`을 아무리 고쳐도 이
질문은 항상 실전 모드 맨 앞에 그대로 나옵니다.

### 질문 순서

같은 카테고리에 속한 질문들은 세션을 시작할 때마다 무작위로 섞여서 10개(연습/기술 면접 모드) 또는
자기소개 1개 + 8개 + 역질문 1개 = 10개(실전 모드)가 출제됩니다. `data/questions.json`에 질문을
더 추가할수록 매번 다른 조합이 나옵니다.

---

## 6. 화면 구성 & UI 요소

- **홈**: 좌우로 기울어진 호버 카드(`HeroCard`)로 "JP · 日本語面接練習プログラム" 타이틀을 보여줍니다.
- **로그인**: "고유 번호" 입력창과 "번호 없이 시작하기" 버튼 두 가지입니다. 고유 번호는 그 번호로
  Supabase 이메일/비밀번호 계정을 만들거나 로그인해, 다른 기기에서도 같은 번호로 기록을 이어볼 수
  있게 합니다(진짜 이메일 발송은 전혀 없습니다). "번호 없이 시작하기"는 예전의 익명 로그인 방식 그대로,
  기록을 남기지 않는 1회성 게스트 입장입니다.
- **내부 화면 공통 프레임**: 레벨 체크·면접·결과·마이페이지·상단바·모드 선택 카드는 모두 실제 macOS
  Safari 창처럼 "트래픽 라이트 타이틀바 + 주소창 느낌의 툴바" 2단 구조(`MacWindow`, `.topbar-*`,
  `.mode-card-*`)로 통일했습니다.
- **레벨 체크 / 면접 진행**: 경어·장음 자신감, JLPT 수준 선택은 슬라이딩 세그먼트 버튼(`PillRadio`)으로,
  마이크 시작/중지는 오디오 스펙트럼 느낌의 토글 스위치(`MicToggle`)로 조작합니다.
- **마이페이지**: 세션 목록/STT 보정 사전과 함께 로그아웃 버튼(`LogoutButton`)이 있습니다.
- **면접 진행 화면(Zoom 스타일)**: 질문은 Zoom의 참가자 화면처럼 어두운 톤 타일(`.zoom-tile`)에
  "면접관" 라벨과 함께 표시됩니다. 상단의 컨트롤 바(`ZoomControlBar`)에서 카메라 on/off, 화상 녹화,
  음성 녹음을 각각 켜고 끌 수 있습니다. 카메라를 켜면 Zoom의 셀프 뷰처럼 화면 위에 떠 있는 미리보기
  창(`CameraPreview`)이 나타나고, 드래그로 위치를 옮기거나 오른쪽 아래 모서리를 끌어 크기를 조절할
  수 있습니다. 화상/음성 녹화는 **서버로 전혀 전송되지 않고**, 종료 버튼을 누르는 즉시 브라우저가
  파일을 만들어 사용자 기기에 바로 다운로드합니다 (Supabase Storage 미사용 — 무료 티어 용량 걱정 없음).
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
 
- **화상/음성 녹화는 의도적으로 Supabase Storage에 올리지 않습니다.** 무료 티어 저장 용량을 쓰지
  않도록, 녹화 종료 시 브라우저가 바로 사용자 기기에 파일을 저장(다운로드)하는 방식으로만
  구현했습니다. `session_answers.audio_path` 컬럼은 향후 서버 저장이 필요해질 때를 위해 남겨뒀지만,
  현재 코드는 이 컬럼을 쓰지 않습니다.
- **적응형 난이도 자동 제안 배너(§5-4)는 구현하지 않았습니다.** 요청하신 대로 "어려우면 생략"에
  해당하는 옵션 기능이며, 현재는 레벨 체크 결과를 수동으로 반영하는 방식까지만 구현했습니다.
- **레이더 차트·히트맵 등 고급 시각화는 없습니다.** 대신 세션 리포트에 숫자 기반 통계 카드로 대체했습니다.
- 장음 인식 체크, 경어 문장 재현 유사도는 **문자열 비교 기반의 근사치**입니다. 언어학적으로 정밀한
  발음 평가가 아니므로, 화면에도 "추정치"로 표기해 두었습니다.
- 꼬리질문은 `public/data/follow_ups.txt`에 포함된 4개 규칙만 예시로 들어있습니다. §5를 참고해 직접 추가하세요.
- **카메라 미리보기는 "셀프 뷰"일 뿐, 실제 화상통화(다른 사람과 연결)는 아닙니다.** 면접관 쪽 영상이
  따로 있는 게 아니라, 본인 카메라를 스스로 보면서 표정/자세를 점검하는 용도입니다.
- 질문 난이도(JLPT)/한국어 번역은 질문 은행에서 뺐습니다. 실제 면접관은 지원자 수준과 무관하게 항상
  경어로 질문하므로, 질문 자체를 난이도별로 나눌 필요가 없다고 판단했습니다 (레벨 체크의 JLPT 자가
  신고는 `keigo_mode` 추천에는 계속 쓰입니다).

---

## 8. 알려진 제한사항

- Web Speech API는 브라우저·OS에 따라 지원 여부와 인식 품질이 다릅니다 (Chrome/Edge 권장).
- 브라우저에 따라 `SpeechRecognition`이 서버 기반 인식 엔진을 사용할 수 있어, 완전한 오프라인 처리를
  보장하지는 않습니다 (API 과금은 없지만 "완전 로컬"과는 별개입니다).
- 면접 진행 화면에서는 음성 인식(STT), 파형 시각화, 카메라 미리보기, 화상/음성 녹화가 각각
  독립적으로 마이크/카메라 권한을 요청할 수 있어, 브라우저 권한 팝업이 여러 번 뜰 수 있습니다.
  한 번 허용하면 이후에는 다시 묻지 않는 브라우저가 대부분입니다.
- Supabase 무료 프로젝트는 7일간 활동이 없으면 일시 정지될 수 있습니다. 오랜만에 접속했는데 로딩이
  오래 걸린다면 프로젝트가 깨어나는 중일 가능성이 높습니다.
- **고유 번호는 사실상 비밀번호 역할을 겸합니다.** 번호를 알거나 추측하는 사람은 그 번호의 저장 기록을
  보고 지울 수 있습니다(복구 수단 없음). 약 20명 규모의 개인 연습용 데모라는 전제하에 의도적으로 선택한
  가벼운 구조입니다 — 더 엄격한 접근 제어가 필요해지면 실제 이메일 인증이나 OAuth 로그인으로 교체하세요.
