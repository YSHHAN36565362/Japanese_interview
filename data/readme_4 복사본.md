# Voice Interview JP — 현재 구현 기능 총정리 (readme_4.md)

> `readme_3.md`가 "기획안"이었다면, 이 문서는 **2026-09-01 기준 실제로 코드에 구현되어 있는 기능**을
> 화면/기능/데이터 단위로 정리한 스냅샷입니다. 다른 탭에서 질문·꼬리질문 데이터를 작성하실 때
> 참고할 파일 위치도 이 문서 안에 모아뒀습니다 (§7). 문서 끝에는 최근 공유해주신 "Zoom형 프런트엔드
> 가이드"(Manus 작성) 대비 지금 구현이 어디까지 와 있는지도 정리했습니다 (§9).

---

## 1. 한눈에 보는 스택

| 영역 | 실제 사용 중인 것 |
|---|---|
| 프런트엔드 | Next.js 16.3.4 (App Router, Turbopack) + React 19.2.8 + TypeScript |
| 스타일 | 순수 CSS (`app/globals.css` 한 파일, Tailwind 미사용) |
| 백엔드/인증 | Supabase (`@supabase/supabase-js` 2.112.4, `@supabase/ssr` 0.12.5) — 익명 로그인 |
| 음성 | 브라우저 Web Speech API (`SpeechRecognition` STT, `SpeechSynthesis` TTS) |
| 화상/녹화 | 브라우저 `getUserMedia` + `MediaRecorder` (전부 클라이언트, 서버 업로드 없음) |
| 질문 데이터 | 로컬 파일 (`data/questions.json`, `public/data/follow_ups.txt`) — git으로 관리, Supabase 미사용 |
| 배포 대상 | Vercel (무료 Hobby) + Supabase (무료 티어) |

0원 운영 원칙은 계속 유지됩니다: LLM/AI API 호출이 코드 어디에도 없고, 모든 "지능적으로 보이는" 동작
(꼬리질문, 피드백, 레벨 추천)은 정규식/문자열 비교/규칙 기반입니다.

---

## 2. 인증 — 공유 비밀번호 + 익명 로그인

- 이메일을 전혀 사용하지 않습니다 (회원가입 확인 메일, 매직 링크 전부 없음).
- `app/login/page.tsx`에서 클라이언트 코드가 입력값을 고정 문자열(`SHARED_PASSWORD = 'kmove13'`)과
  비교합니다. 일치하면 `supabase.auth.signInAnonymously()`를 호출해 Supabase 익명 세션을 발급받습니다.
- Supabase 프로젝트에서 **Authentication → Anonymous Sign-Ins**가 켜져 있어야 동작합니다.
- 로그아웃: 마이페이지의 `LogoutButton` → `supabase.auth.signOut()`.
- 이 비밀번호는 클라이언트 코드에 그대로 있는 "가벼운 문지기"이며, 실제 계정 인증이 아닙니다
  (5~10명 규모 비공개 데모 용도).

---

## 3. 화면별 기능

### 3-1. 홈 (`/`)
- 기울어진 호버 카드(`HeroCard`)에 "JP · 日本語面接練習プログラム" 타이틀.
- 브라우저 STT/TTS 지원 여부를 실시간으로 검사해 배지로 표시 (`SupportBanner`).
- 로그인 여부에 따라 "비밀번호 입력하고 시작하기" 또는 "레벨 체크 시작 / 바로 면접 시작" 버튼.
- 배경에 카타카나 매트릭스 애니메이션(`MatrixBackground`), 콘텐츠는 macOS Safari 스타일 창
  (`MacWindow`)에 담겨 있음.

### 3-2. 레벨 체크 (`/level-check`)
로그인 후 진입. 4단계 진행:
1. **자가 신고**: JLPT 수준(N1~N5/모름), 경어 자신감, 장음 자신감을 세그먼트 버튼(`PillRadio`)으로 선택.
2. **장음 체크**: 장음 최소 대립쌍 단어(예: おばあさん/おばさん)를 듣고 따라 말하면, 인식된 텍스트가
   "짧게 발음했을 때의 오인식 형태"와 일치하는지 비교해 장음 위험 플래그를 계산.
3. **경어 문장 체크**: 정해진 경어 문장을 따라 말하면, 문자 단위 유사도(근사치)와 정중체 비율을 계산.
4. **결과**: 위 신호를 종합해 추천 난이도(N1~N5)와 경어 모드(강제/자율/보통체 허용)를 제시하고,
   `diagnostic_results`에 기록 + `user_settings`에 반영 후 `/interview`로 이동.
- 모든 계산은 문자열 비교 기반 근사치이며, 화면에 "추정치"로 명시되어 있습니다.
- ⚠️ 참고: 질문 은행 자체는 더 이상 JLPT로 필터링하지 않습니다(§4 참고). 이 레벨 체크의 JLPT 값은
  주로 `keigo_mode`(경어 강제/자율/허용) 추천에만 쓰입니다 — 실제 면접관은 지원자 수준과 무관하게
  항상 경어로 질문하기 때문에, 질문 난이도 자체를 나눌 필요가 없다고 판단했습니다.

### 3-3. 면접 모드 선택 (`/interview`)
- 4가지 모드: 연습 / 실전 / 기술 면접 / 역질문.
- 각 모드 카드는 macOS Safari 미니 창처럼 트래픽 라이트 타이틀바가 달린 버튼(`.mode-card`)입니다.
- 모드를 클릭하면 Supabase `sessions` 테이블에 새 세션 행을 만들고 `/interview/run/[sessionId]`로 이동.

### 3-4. 면접 진행 (`/interview/run/[sessionId]`) — Zoom 스타일
가장 복잡한 화면이며, 아래 기능이 모두 통합되어 있습니다.

**질문 진행**
- 질문은 Supabase가 아니라 로컬 `data/questions.json`에서 카테고리별로 불러와 매 세션 무작위로
  셔플한 뒤 6개(실전 모드는 고정 자기소개 1개 + 5개) 출제합니다.
- **실전 모드의 첫 질문은 항상 "簡単に自己紹介をお願いします。"로 고정**되어 있고, 이 문장은
  `lib/questionBank.ts`의 `REAL_MODE_INTRO_QUESTION` 상수에 코드로 박혀 있어 `data/questions.json`을
  아무리 고쳐도 바뀌지 않습니다.
- 질문이 바뀔 때마다 자동으로 TTS(`speechSynthesis`)가 낭독하고, "다시 듣기" 버튼으로 재생 가능.
- 질문은 Zoom 참가자 화면처럼 어두운 톤 타일(`.zoom-tile`)에 아바타 원(面)과 "면접관" 라벨을 붙여
  표시합니다.

**답변 입력**
- `MicToggle`(오디오 스펙트럼 느낌의 토글 스위치)을 켜면 `SpeechRecognition`이 `ja-JP`로 실시간
  인식하며, 텍스트가 화면에 즉시 스트리밍되고 사용자가 직접 수정할 수 있습니다.
- 인식 중에는 파형 시각화(`WaveformVisualizer`, Web Audio API `AnalyserNode`)와 답변 영역 테두리
  강조(`.mic-row-active`)로 "지금 녹음 중"임을 뚜렷하게 표시합니다.
- STT 미지원 브라우저에서는 안내 배지를 띄우고 텍스트 직접 입력으로 계속 진행 가능합니다.
- 답변에 알려진 IT 용어의 흔한 STT 오인식(`パイソン` 등)이 포함되면 "혹시 'Python'을 의도하셨나요?"
  제안 배지가 뜨고, 적용을 누르면 `user_custom_terms`(개인 STT 보정 사전)에 저장됩니다.

**Zoom 스타일 화상 기능 (신규)**
- `ZoomControlBar`: 카메라 on/off, 화상 녹화, 음성 녹음 3개 버튼.
- `CameraPreview`: 카메라를 켜면 화면 위에 떠 있는 셀프 뷰가 나타나고, 드래그로 위치 이동,
  모서리 드래그로 크기 조절(160×120 ~ 480×360)이 가능합니다. 서버로 전송되지 않습니다.
- 화상 녹화(카메라+마이크)와 음성 녹화(마이크만)는 `MediaRecorder`로 처리되며, **종료 버튼을 누르는
  즉시 브라우저가 파일을 만들어 사용자 기기에 바로 다운로드**합니다. Supabase Storage 업로드
  코드는 없습니다 (무료 티어 용량과 무관).
- 카메라가 꺼져 있으면 화상 녹화 버튼은 비활성화됩니다.

**꼬리질문**
- 답변 제출 시, 방금 질문의 id로 `public/data/follow_ups.txt`(§4)를 조회해 답변 텍스트에 지정된
  단어가 하나라도 포함되어 있으면 다음 질문으로 바로 이어집니다 (AI 호출 없음, 단순 포함 검사).
- 같은 세션에서 이미 물어본 꼬리질문은 다시 나오지 않고, 여러 규칙이 동시에 맞으면 우선순위가
  높은 규칙이 이깁니다.

**피드백 계산 (제출 시점)**
- `lib/feedback.ts`의 `analyzeAnswer()`가 답변 텍스트에서 다음을 계산해 `session_answers`에 저장:
  필러 횟수(`えー/あの/その/えっと/まあ`), 정중체(です・ます) vs 보통체 비율, 결론 선행 여부,
  숫자/성과 포함 여부, STAR/PREP 단계 마커 감지.
- 응답 지연 시간(`latency_to_first_speech_sec`, TTS 종료~`onspeechstart`까지)도 함께 저장.

### 3-5. 세션 리포트 (`/interview/result/[sessionId]`)
- 답변 수 / 평균 답변 시간 / 필러 총합 / 평균 정중체 비율(추정치)을 통계 카드로 표시.
- 질문 텍스트는 Supabase 조인이 아니라 `lib/questionBank.ts`의 `getQuestionById()`로 로컬 데이터에서
  가져옵니다.
- Markdown 다운로드 버튼(`MarkdownExportButton`)으로 세션 전체를 `.md` 파일로 내보낼 수 있습니다.
- macOS Safari 스타일 창(`MacWindow`)에 담겨 있고, 결과 화면이라 매트릭스 배경도 함께 보입니다.

### 3-6. 마이페이지 (`/dashboard`)
- 지난 세션 목록(날짜/모드/답변 수, 클릭 시 리포트로 이동).
- 내 STT 보정 사전 목록 (`user_custom_terms`).
- 로그아웃 버튼.
- 페이지 진입 시, 보관기한이 지난 음성 로그(`audio_expires_at` 지난 행)를 클라이언트 접속 시점에
  자동 정리합니다(Supabase 무료 티어에 `pg_cron` 대신 채택한 방식). 다만 현재는 화상/음성이 서버에
  업로드되지 않으므로 이 컬럼은 사실상 비어 있습니다(§8 참고).

---

## 4. 로컬 데이터 파일 (git으로 관리, Supabase 아님)

### 4-1. `data/questions.json` — 질문 원본
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
- `id`: 영문 slug, 다른 질문과 겹치면 안 됨. `follow_ups.txt`에서 이 id로 참조.
- `category`: `personality | technical | culture_fit | reverse`
- `expectedDurationSec`: 권장 답변 시간(초), 타이머/짧은 답변 판정 기준.
- `textJa`: 일본어 질문만 있습니다 (JLPT 난이도 태그, 한국어 번역 없음 — §3-2 참고).
- 현재 14개 질문(메인 10개 + 꼬리질문 대상 4개)이 예시로 들어 있습니다.

### 4-2. `public/data/follow_ups.txt` — 꼬리질문 규칙 (일반 텍스트)
```
# 형식: 원래질문id | 감지할단어1,감지할단어2,... | 다음질문id | 우선순위(선택)
strength | チーム,協力 | role | 1
team_project | チーム,プロジェクト,担当 | role_detail | 1
team_project | Python,SQL,機械学習,データ | tech_reason | 2
problem_solving | エラー,失敗,課題 | how_solved | 1
```
- `#`으로 시작하는 줄과 빈 줄은 무시.
- `public/` 아래에 있어 브라우저가 `fetch('/data/follow_ups.txt')`로 직접 읽습니다 — 다른 곳을
  안 건드리고 이 파일만 고쳐도 꼬리질문 규칙을 바로 추가/수정할 수 있습니다.
- 파싱/매칭 로직: `lib/questionBank.ts`(읽기·파싱) → `lib/followUp.ts`(매칭).

**다른 탭에서 예상질문·꼬리질문을 작성하실 때는 이 두 파일(`data/questions.json`,
`public/data/follow_ups.txt`)만 편집하시면 됩니다.** 편집 후 GitHub Desktop으로 커밋/푸시하면
Vercel이 자동 재배포합니다. Supabase SQL을 다시 실행할 필요는 없습니다.

---

## 5. Supabase에 실제로 저장되는 것 (개인별 기록만)

| 테이블 | 용도 |
|---|---|
| `sessions` | 면접 세션 1건 (사용자, 모드, 시작 시각) |
| `session_answers` | 질문/꼬리질문별 답변 텍스트, 시간, 피드백 결과(JSON), STT 원문/수정본 |
| `user_settings` | 레벨 체크 결과, 경어 모드, 기본 설정 |
| `diagnostic_results` | 레벨 체크 진단 이력 |
| `user_custom_terms` | 사용자별 STT 오인식 보정 사전 |

`questions` / `follow_up_rules` 테이블은 더 이상 사용하지 않습니다(§4 참고). 기존에 구버전으로
만들어 둔 프로젝트는 `supabase/migrate_local_questions.sql`을 1회 실행해 정리합니다.

---

## 6. 디자인 시스템 요약

| 컴포넌트 | 용도 |
|---|---|
| `MacWindow` | macOS Safari 스타일 2단 창(트래픽 라이트 타이틀바 + 주소창 pill 툴바). 레벨체크/면접/결과/마이페이지 공통 래퍼. |
| `HeroCard` | 홈 화면의 기울어진 호버 타이틀 카드 |
| `PillRadio` | 슬라이딩 인디케이터가 있는 세그먼트 버튼 (JLPT/경어/장음 선택 등) |
| `MicToggle` | 오디오 스펙트럼 느낌의 마이크 on/off 토글 (STT용) |
| `LoadingDots` | 통통 튀는 점 3개 로더 |
| `MatrixBackground` | 카타카나 낙하 배경. `/interview/run/*` 에서는 자동 숨김 |
| `LogoutButton` | 로그아웃 |
| `CameraPreview` | 드래그·리사이즈 가능한 셀프 카메라 미리보기 (Zoom 스타일) |
| `ZoomControlBar` | 카메라/화상 녹화/음성 녹음 컨트롤 바 |
| `WaveformVisualizer` | 답변 중 마이크 입력 파형 |
| `SupportBanner` | 브라우저 STT/TTS 지원 배지 |
| `MarkdownExportButton` | 세션 리포트 Markdown 다운로드 |

전역 스타일은 전부 `app/globals.css` 한 파일에 있습니다 (Tailwind 등 별도 프레임워크 없음).

---

## 7. 지금 다른 탭에서 작업하실 때 참고할 경로 요약

```
data/questions.json                 ← 질문 추가/수정 (JSON)
public/data/follow_ups.txt          ← 꼬리질문 규칙 추가/수정 (일반 텍스트)
```
두 파일 다 이 저장소(git) 안에 있고, Supabase나 코드 변경 없이 이 파일들만 고쳐도 앱에 바로
반영됩니다(로컬 개발 서버는 저장 즉시, 배포본은 커밋/푸시 후 자동 재배포).

---

## 8. 알려진 제한사항 (요약, 자세한 내용은 SETUP.md)

- 화상/음성 녹화는 의도적으로 서버에 올리지 않음 (로컬 다운로드만).
- 레벨 체크의 장음/경어 유사도 계산은 문자열 비교 기반 근사치.
- 적응형 난이도 자동 제안, 레이더 차트/히트맵 등 고급 시각화는 미구현.
- 카메라 미리보기는 "셀프 뷰"일 뿐 실제 화상통화(면접관 쪽 영상)는 아님.
- 공유 비밀번호는 클라이언트 측 확인일 뿐 실제 계정 인증이 아님.

---

## 9. 공유해주신 "Zoom형 프런트엔드 가이드"(Manus) 대비 현재 구현 상태

가이드가 제시한 개념과 현재 코드를 비교하면 아래와 같습니다. "이미 있음"은 그대로 유지하면 되고,
"부분적"/"없음"은 질문 데이터 작업이 끝난 뒤 단계적으로 반영할 수 있는 후보입니다.

| 가이드의 개념 | 현재 상태 | 비고 |
|---|---|---|
| 중앙 면접관 스테이지 + 질문 | ✅ 있음 | `.zoom-tile` |
| 우상단/플로팅 셀프 카메라 | ✅ 있음 (형태는 다름: 드래그 가능한 플로팅 창) | `CameraPreview` |
| 하단 고정 컨트롤 바 | 🟡 부분적 | `ZoomControlBar`는 카메라/녹화만. 마이크는 별도 `MicToggle` 영역에 있음 (한 바로 통합되어 있지 않음) |
| 우측 보조 패널(전사/STAR/메모) | ❌ 없음 | 지금은 답변 textarea 하나로 전사·편집을 겸함. 별도 전사 패널·STAR 체크리스트 패널 없음 |
| 명시적 상태 머신(`InterviewPhase`) | ❌ 없음 | 지금은 `isFollowUp`, `saving`, `finished` 등 개별 `useState`로 관리 |
| 프리플라이트(장치 확인 다이얼로그) | ❌ 없음 | 마이크/카메라 버튼을 누르는 시점에 바로 권한 요청 |
| `features/interview` 폴더 분리 | ❌ 없음 | 현재는 `app/interview/run/[sessionId]/page.tsx` 한 파일에 로직 대부분 존재 |
| 텍스트 모드 폴백 | ✅ 있음 | STT 미지원 시 안내 배지 + textarea 직접 입력 |
| TTS 재생 중 마이크 자동 시작 금지 | ✅ 있음 (수동 토글이라 애초에 자동 시작 없음) | |
| 모바일 반응형 레이아웃 규칙(표 2) | ❌ 없음 | 현재는 데스크톱 기준 레이아웃, 별도 모바일 브레이크포인트 미적용 |
| 답변 확정 시점에만 서버 저장 | ✅ 있음 | 중간 전사는 로컬 상태에만, 제출 시 `session_answers` insert |
| 개인정보 고지 문구(카메라 미저장 등) | 🟡 부분적 | SETUP.md/readme에는 있으나, 화면 내 프리플라이트 고지 문구는 별도로 없음 |

**결론**: 가이드가 말하는 "면접실 메타포"의 핵심(중앙 스테이지 + 셀프 카메라 + 고정 컨트롤 + 서버는
확정된 답변만 저장)은 이미 구현 방향과 일치합니다. 차이는 주로 **정리 수준**(상태 머신, 폴더 분리,
보조 패널 UI, 프리플라이트 다이얼로그)에 있으며, 지금 상태에서도 기능은 정상 동작합니다. 전면 리팩터링
여부는 질문 데이터 작업 이후 별도로 논의해 결정하는 것을 권장합니다.
