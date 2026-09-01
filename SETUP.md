# 데모 실행 & 배포 가이드

`readme_3.md` 최종 제안서를 바탕으로 만든 실제 동작 데모입니다. Next.js 16(App Router) + React 19 + Supabase +
브라우저 Web Speech API로 구성되어 있으며, 로컬 실행과 Vercel + Supabase 연결 모두 이 문서 순서대로 진행하면 됩니다.
(`npm install` 시 `npm audit`에서 알려진 취약점이 없는 최신 안정 버전으로 고정해 두었습니다.)

**필요 환경**: Node.js 20 이상 권장 (Vercel 배포 시에는 자동으로 적절한 Node 런타임을 사용하므로 별도 설정 불필요).

---

## 0. 폴더 구성

```
app/                  Next.js App Router 페이지
  page.tsx            홈
  login/               공유 비밀번호 입력 → 익명 로그인 (이메일 발송 없음)
  level-check/         최초 레벨 체크(자가 신고 + 장음/경어 진단)
  interview/           모드 선택 → 면접 진행 → 결과 리포트
  dashboard/           마이페이지 (세션 목록, STT 보정 사전)
components/           재사용 UI 컴포넌트
lib/                  Supabase 클라이언트, Web Speech 훅, 피드백/꼬리질문 규칙 엔진
supabase/
  schema.sql          테이블 + RLS 정책
  seed.sql            샘플 질문/꼬리질문 데이터
```

---

## 1. Supabase 프로젝트 준비

1. https://supabase.com 에서 새 프로젝트 생성 (무료 티어).
2. 왼쪽 메뉴 **SQL Editor** 에서 `supabase/schema.sql` 내용을 붙여넣고 실행.
3. 이어서 `supabase/seed.sql` 내용을 붙여넣고 실행 (샘플 질문/꼬리질문 데이터가 들어갑니다).
   - `seed.sql`은 재실행하면 `follow_up_rules`가 중복 삽입될 수 있으니 **1회만 실행**하세요.
4. 왼쪽 메뉴 **Authentication → Sign In / Providers → Anonymous Sign-Ins** 를 켜주세요(Enable).
   이 데모는 이메일을 전혀 보내지 않습니다 — 화면에서 공유 비밀번호(`kmove13`)를 확인한 뒤
   `supabase.auth.signInAnonymously()`로 세션만 발급합니다. 이메일/비밀번호 Provider나 URL
   Redirect 설정을 따로 만질 필요가 없습니다.
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

## 5. 화면 구성 & UI 요소

- **홈**: 좌우로 기울어진 호버 카드(`HeroCard`)로 "JP · 日本語面接練習プログラム" 타이틀을 보여줍니다.
- **로그인**: 공유 비밀번호 입력 폼(네오브루탈리즘 스타일) 하나뿐입니다. 이메일 발송(가입 확인 메일,
  매직 링크 등)이 전혀 없고, 비밀번호가 맞으면 Supabase 익명 로그인으로 즉시 세션을 발급합니다.
- **내부 화면 공통 프레임**: 레벨 체크·면접·결과·마이페이지는 macOS 창 스타일 프레임(`MacWindow`, 빨강/노랑/초록
  트래픽 라이트)으로 감쌌습니다.
- **레벨 체크 / 면접 진행**: 경어·장음 자신감, JLPT 수준 선택은 슬라이딩 세그먼트 버튼(`PillRadio`)으로,
  마이크 시작/중지는 오디오 스펙트럼 느낌의 토글 스위치(`MicToggle`)로 조작합니다.
- **로딩 상태**: 질문을 불러오거나 저장하는 동안 통통 튀는 점 3개짜리 로더(`LoadingDots`)를 보여줍니다.
- **배경 연출**: 카타카나가 흘러내리는 은은한 배경(`MatrixBackground`, 불투명도 약 14%)을 홈/로그인/레벨체크/
  모드선택/결과/마이페이지에 깔아두었고, **실제 면접이 진행되는 화면(`/interview/run/...`)에서는 자동으로
  숨겨집니다** (경로를 감지해 렌더링하지 않는 방식).
- 이 UI 컴포넌트들은 모두 `components/` 아래 별도 파일로 있고 스타일은 `app/globals.css`에 정리해 두었으니,
  색상/문구 등은 자유롭게 손봐도 됩니다.

---

## 6. 이 데모의 범위 (readme_3.md 대비 단순화한 부분)

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
- 꼬리질문은 `supabase/seed.sql`에 포함된 4개 규칙만 예시로 들어있습니다. 실제 사용 전에 질문/꼬리질문을
  더 추가하는 것을 권장합니다 (Supabase 테이블 편집기에서 직접 추가 가능).

---

## 7. 알려진 제한사항

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
