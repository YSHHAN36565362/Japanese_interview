# Voice Interview JP — 최종 제안서

일본 IT 기업 취업을 준비하는 한국인 지원자를 위한 **완전 무료(0원) 음성 모의 면접 트레이너**.

> `OT.txt`(초기 메모) → `readme.md`(1차 기획안 + 다른 LLM의 검토/확장 의견)를 거쳐, 중복을 정리하고 기술적으로 부정확한 부분을 수정해 정리한 **최종 제안서**입니다. 이 문서를 검토한 뒤 구현을 시작합니다.

---

## 1. 목적 및 핵심 원칙

- **목적**: 일본어 음성으로 질문을 듣고, 일본어로 말하며 답변하는 모의 면접을 브라우저에서 무료로 반복 연습.
- **핵심 방향**: AI 면접관(LLM)을 붙이는 대신, **규칙 기반 진행 로직 + 측정 가능한 자가 피드백**으로 "AI 없이도 정밀한 훈련 도구"를 만든다.

### 0원 운영 원칙 (최우선, 반드시 지킬 것)

- 유료로 전환될 수 있는 요소는 처음부터 설계에 넣지 않는다 (LLM API, 유료 STT/TTS API, 유료 DB/호스팅 플랜 등).
- 답변 분석·꼬리질문·피드백은 전부 **정규식/사전/규칙 기반**으로 클라이언트에서 처리한다. 서버 연산·외부 API 호출이 없다.
- 데이터 저장은 **Supabase 무료 티어** 한도 안에서만, 배포는 **Vercel Hobby(무료)** 로 고정한다.
- "꼬리 질문" 기능은 **AI가 답변을 이해해서 새 질문을 생성하는 방식이 아니라**, 사전 정의된 꼬리질문 세트 + 키워드/조건 매칭 규칙으로 구현한다 (§4-2).

### 정정 사항: "서버 호출 없음"의 정확한 의미

1차 기획안의 "Web Speech API는 서버 호출이 전혀 없다"는 표현은 부정확하므로 아래로 정정한다.

> 본 서비스는 별도의 유료 STT API 키나 자체 음성 처리 서버를 사용하지 않는다 (**API 과금 없음은 사실**). 다만 브라우저의 `SpeechRecognition`은 브라우저·OS에 따라 **서버 기반 인식 엔진을 사용할 수 있어**, 음성 데이터가 브라우저 제조사 서버로 전송될 가능성이 있다. 지원 환경에서는 `processLocally` 등 온디바이스 옵션을 시도할 수 있으나 항상 보장되지는 않는다. 즉 "비용 0원"과 "완전 로컬 처리"는 별개의 주장이며, 이 문서와 서비스 내 개인정보 고지는 이를 구분해 표기한다.

---

## 2. 기술 스택 (100% 무료 티어)

| 영역 | 선택 | 비고 |
|---|---|---|
| 프런트엔드 | Next.js (App Router) | Vercel과 가장 궁합이 좋음 |
| 배포/호스팅 | **Vercel Hobby (무료)** | 개인·비상업 포트폴리오 용도로 명시 (공식적으로 비상업 용도 대상) |
| 백엔드/DB | **Supabase Free Tier** | PostgreSQL, Auth, Storage 포함 |
| 인증 | Supabase Auth (무료) | 월 5만 MAU까지 무료 |
| 음성 인식(STT) | 브라우저 `Web Speech API` (`SpeechRecognition`) | ja-JP 실시간 타이핑, API 과금 없음 (단 §1 정정사항 참고) |
| 음성 합성(TTS) | 브라우저 `Web Speech API` (`SpeechSynthesis`) | 질문 낭독, API 과금 없음 |
| 음성 파형 시각화 | `Web Audio API` (`AnalyserNode`) | 표준 클라이언트 패턴, 서버 호출 없음 |
| 음성 파일 저장(선택) | Supabase Storage 무료 1GB | 옵트인, IndexedDB 1차 캐싱 후 업로드 |

**의도적으로 배제한 것**: LLM API(OpenAI/Gemini 등), 유료 클라우드 STT/TTS, Supabase/Vercel 유료 플랜 승급이 필요한 기능 전부.

---

## 3. Supabase 무료 티어 한도와 설계 대응

- DB 500MB, Storage 1GB, 월 Auth MAU 5만 — 개인/소규모 다중 사용자 용도로 충분.
- **무료 프로젝트는 7일 이상 비활성 시 일시 정지(pause)** 될 수 있음. 앱에 "데이터베이스가 절전 상태에서 깨어나는 중입니다. 잠시 후 다시 시도해 주세요" 안내 화면을 기본 제공한다.
  - GitHub Actions 등으로 인위적으로 깨우는 "유지용 핑"은 채택하지 않는다. 실제 사용이 없는데 휴면 정책을 우회하는 방식이라 판단, 대신 정지 가능성을 README/앱에 투명하게 안내하고, 중요 데이터는 사용자가 Markdown/JSON으로 내보낼 수 있게 한다.
- 음성 녹음 파일 저장은 **기본 비활성화(옵트인)**. IndexedDB에 1차 캐싱 후, 사용자가 명시적으로 동의할 때만 Supabase Storage에 업로드한다.
- **TTL(보관기한) 자동 삭제는 `pg_cron`에 의존하지 않는다.** pg_cron 자체의 무료 티어 지원 여부도 출처마다 엇갈리지만, 더 근본적으로 무료 프로젝트가 7일 비활성으로 일시정지되면 예약 작업도 함께 멈춰 신뢰할 수 없다. 대신 `session_answers.audio_expires_at` 컬럼을 두고, **사용자가 마이페이지에 접속하는 시점에 클라이언트가 만료된 레코드를 찾아 삭제 요청을 보내는 방식**으로 구현한다.

---

## 4. 주요 기능

### 4-1. 면접 모드 세분화

기본/기술/커스텀 3분류에서 아래처럼 세분화한다.

| 모드 | 구성 | 사용자 가치 |
|---|---|---|
| 연습 모드 | 질문 미리보기, 다시 듣기, 자막, 시간 무제한 | 부담 없이 익히기 |
| 실전 모드 | 질문 미리보기 금지, TTS 1회 낭독, 제한 시간, 수정은 종료 후에만 | 실제 면접 긴장감 재현 |
| 약점 보완 모드 | 과거 세션 중 답변이 짧았거나 반복 표현이 많았던 질문/카테고리 재출제 | 반복 연습 효율 향상 |
| 모의 1차 면접 | 자기소개 → 지원동기 → 강점/약점 → 경험 → 역질문 | 일본 면접 기본 흐름 훈련 |
| 기술 면접 | 프로젝트 설명 → 역할 → 기술 선택 이유 → 문제 해결 → 성과/회고 | 데이터/IT 직무 포트폴리오 연결 |
| 압박 꼬리질문 모드 | 같은 주제에 2~3회 연속 후속 질문 | "왜?", "구체적으로?" 대응 훈련 |
| 逆質問 모드 | 역질문만 집중 훈련 | 실전 활용도 높음 |

단순 랜덤 출제보다 **면접 순서와 맥락을 가진 시나리오형 세션**(프로젝트 설명 → 역할 → 지표 선정 이유 → 한계)을 기본으로 한다.

### 4-2. 꼬리 질문(Follow-up) 규칙 엔진 — 무료·AI 미사용

각 질문에 규칙 기반으로 연결되는 꼬리질문 그래프. `follow_up_rules` 테이블로 관리한다 (§7).

| 규칙 유형(`trigger_type`) | 예시 | 연결 꼬리질문 |
|---|---|---|
| keyword | `チーム`, `協力` 등장 | "チーム内でのあなた自身の役割は何でしたか。" |
| keyword(기술 용어) | `Python`, `SQL` 등장 | "その技術を選定した理由を教えてください。" |
| missing_keyword | 숫자·성과 표현 부재 | "成果をどのような指標で測定しましたか。" |
| answer_length | 답변이 기준 시간/글자수 미달 | "もう少し具体的な例を挙げていただけますか。" |
| missing_keyword(역할) | `担当`, `役割` 언급 부재 | "その中で、あなたが担当した部分は何ですか。" |
| keyword(실패) | `失敗`, `課題`, `エラー` 등장 | "その課題をどのように解決しましたか。" |
| order/random | 앞 꼬리질문 답변 완료 | "その経験から学んだことは何ですか。" |

사용자는 자신의 커스텀 질문에 원하는 꼬리질문을 직접 등록할 수도 있다. 답변 내용을 실제로 "이해"해 새 질문을 생성하는 LLM 방식은 채택하지 않는다.

### 4-3. 동적 질문 출제 & 커스텀 질문

- 카테고리(인성/기술/컬처핏/역질문) × 난이도별 랜덤 세트 조합, 5~10문항.
- 사용자가 목표 기업 JD/이력서에 맞춘 커스텀 질문 추가/수정/삭제.
- `job_family`(frontend/backend/data/AI_ML 등), `tags`(Python, SQL, EDA, NLP 등)로 필터링해 "Python + 데이터 전처리 + 1차 면접" 같은 세트 구성 가능.
- 질문 한국어 번역 토글, 다시 듣기(TTS).

### 4-4. 규칙 기반 자가 피드백 엔진 (AI 미사용)

LLM 첨삭 없이, STT 텍스트에 대한 정규식/사전 매칭/카운팅만으로 아래 지표를 산출한다.

- 답변 시간(목표 대비 과부족), 글자 수/문장 수
- 필러 사용 횟수: `えー`, `あの`, `その`, `えっと` 등
- 반복 표현(같은 단어·어미 반복)
- 결론 선행 여부: 첫 1~2문장에 `結論から申し上げますと`, `私の強みは` 등 존재 여부
- 구체성 신호: 숫자·기간·팀 규모·역할·도구명·결과 포함 여부
- STAR/PREP 구조 신호 감지
- **정중체(です・ます) vs 보통체(だ・である) 혼용 감지**: 문말 어미 패턴 매칭 기반. 다만 이는 정밀 측정이 아닌 근사치이므로, UI에는 항상 "정중체 일관성: 약 82% (문말 어미 기준 추정치)"처럼 **추정치임을 명시**한다.
- 쿠션어(クッション言葉) 사용 여부: `恐れ入りますが`, `差し支えなければ` 등
- 御社/貴社 등 겸양·존경 표현 가이드 체크

결과는 **총점(예: 82점)처럼 단일 점수로 제시하지 않는다.** STT 오인식이 일본어 실력 점수처럼 오인될 위험이 있기 때문이다. 대신 "개선 우선순위 1개 + 유지할 점 1개 + 다음 답변 목표 + 추천 꼬리질문" 형태의 **훈련 신호**로 제시한다.

### 4-5. STT 기술 용어 보정 사전 (핵심 차별화 포인트)

일본어 STT가 한국어/영어 IT 용어를 엉뚱하게 인식하는 문제를 사용자 개인 사전으로 해결한다.

- 초기 배포 시 20~30개 기본 매핑 제공: `パイソン → Python`, `シーケル/エスキューエル → SQL`, `コベルト → KoBERT`, `ギットハブ → GitHub` 등.
- `stt_raw_text`(원문)와 `corrected_answer_text`(수정본)를 분리 저장 → 사용자가 원클릭으로 치환 수정하면 `user_custom_terms`에 자동 누적되어, 다음 세션부터 개인화된 보정 사전으로 활용.

### 4-6. 실시간 음성 인터페이스 & 트레이닝 UX

- 마이크 입력 시작 → 실시간 스트리밍 타이핑, 제한 시간 타이머(1분/2분), 인식 텍스트 수동 보정.
- **응답 지연(latency) 측정**: TTS 종료 시점과 `SpeechRecognition`의 `onspeechstart` 이벤트 발생 시점의 차이를 계산해 "질문을 듣고 답변을 시작하기까지 걸린 시간"을 측정. 3~5초 초과 시 쿠션어 활용 팁 제공.
- **STAR/PREP 실시간 체크리스트**: 인식 텍스트에 구조 접속사(`結論から言うと` 등)가 감지되면 체크박스가 실시간 활성화.
- **음성 파형 시각화**: `AnalyserNode` + `getByteTimeDomainData()`로 캔버스에 렌더링, 마이크 입력 여부를 시각적으로 즉시 인지.
- **답변 템플릿 코치**: 자기소개/지원동기/프로젝트/강점/약점/실패 경험/역질문별 답변 골격 힌트. 실전 모드에서는 숨기고 연습 모드에서만 노출.

### 4-7. 세션 기록, 복습 & 성장 분석

- 세션 종료 시 질문-꼬리질문-답변 전체 로그를 Supabase에 자동 저장.
- 마이페이지: 날짜별 세션 열람, 텍스트 복사, Markdown 다운로드(포트폴리오/노션에 바로 붙여넣을 수 있는 정제된 포맷).
- **레이더 차트 5축**(결론 선행도/필러 억제력/구체성/목표 시간 준수율/정중체 완성도)과 **주간·월간 연습 빈도 히트맵** — 순수 클라이언트 시각화로 구현, 서버 연산 없음.
- **오답 노트 플래시카드**: 사용자가 수정한 모범 문장(`corrected_answer_text`)을 모아 면접 직전 암기용으로 제공.

### 4-8. STT/TTS 미지원 환경 폴백 (신뢰성)

브라우저별 지원 차이를 서비스 중단이 아닌 "기능 일부 제한"으로 처리한다.

1. 진입 시 `SpeechRecognition`/`webkitSpeechRecognition` 지원 여부 확인
2. `ja-JP` 설정 가능 여부 확인
3. 미지원 시 "텍스트 면접 모드"로 자동 전환
4. 마이크 권한 거부 시 답변 직접 입력 제공
5. 일본어 음성이 없으면 질문 텍스트만 표시
6. 인식 오류 시 누적 답변을 로컬에 임시 보존
7. `MediaRecorder.isTypeSupported()`로 브라우저별 녹음 포맷 감지 (webm 고정 금지)

---

## 5. 개인정보 및 저장 정책

- 기본값: 음성 녹음 저장 안 함 (텍스트 로그만 저장).
- 사용자 선택: "이번 세션만 저장" / "항상 저장" (+ 보관 기한 선택, `audio_expires_at`).
- 세션별 삭제, 전체 삭제, 다운로드 지원.
- 만료 삭제는 §3에서 정리한 대로 **클라이언트 접속 시점 확인 방식**으로 구현 (pg_cron 미사용).
- 서비스 개인정보 고지 문구는 §1 정정 사항을 그대로 반영한다.

---

## 6. "0원"의 정확한 정의

| 항목 | 정확한 설명 |
|---|---|
| Web Speech API | 별도 API 키·토큰 비용 없음. 단 브라우저 정책·네트워크·지원 여부에 의존 (완전 오프라인 보장 아님) |
| Supabase | 무료 한도(DB 500MB, Storage 1GB, MAU 5만) 내에서만 0원 |
| Vercel Hobby | 개인·비상업 용도 기준 무료 |
| 음성 파일 저장 | 옵트인이며, 여러 저장 항목 중 무료 한도에 가장 먼저 도달할 수 있는 항목 |
| 상업화/대규모 트래픽 | 본 설계 범위 밖. 필요 시점에 별도 호스팅/DB 전략 재검토 |

---

## 7. 데이터 모델 (최종본)

```sql
-- 사용자: Supabase Auth 기본 제공 (auth.users)

questions
  id UUID PRIMARY KEY,
  category TEXT,                    -- personality | technical | culture_fit | reverse
  difficulty TEXT,
  text_ja TEXT,
  text_ko TEXT,
  company_stage TEXT,               -- HR | 1st_interview | technical | final
  job_family TEXT,                  -- frontend | backend | data | AI_ML | common
  expected_duration_sec INT,
  answer_framework TEXT,            -- PREP | STAR | project | motivation
  evaluation_points JSONB,
  tags TEXT[],
  core_keywords TEXT[],             -- 권장 필수 포함 키워드
  sample_answer_ja TEXT,
  sample_answer_ko TEXT,
  is_custom BOOLEAN DEFAULT false,
  owner_user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()

follow_up_rules
  id UUID PRIMARY KEY,
  parent_question_id UUID REFERENCES questions(id),
  trigger_type TEXT,                -- keyword | missing_keyword | answer_length | order | random
  trigger_value JSONB,              -- ["チーム","協力"] 또는 60 등
  priority INT,
  cooldown_count INT,
  follow_up_question_id UUID REFERENCES questions(id),
  feedback_hint_ja TEXT,
  feedback_hint_ko TEXT

sessions
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  mode TEXT,                        -- practice | real | weakness | first_interview | technical | pressure | reverse
  created_at TIMESTAMPTZ DEFAULT now()

session_answers
  id UUID PRIMARY KEY,
  session_id UUID REFERENCES sessions(id),
  question_id UUID REFERENCES questions(id),
  follow_up_question_id UUID REFERENCES questions(id),
  stt_raw_text TEXT,
  corrected_answer_text TEXT,
  duration_seconds NUMERIC,
  latency_to_first_speech_sec NUMERIC(4,2),
  politeness_score_ratio NUMERIC(3,2),   -- 추정치. UI에 "추정치" 명시 필수
  recognized_framework_stages TEXT[],
  filler_counts JSONB,
  repeated_terms TEXT[],
  feedback_result JSONB,
  improvement_goal TEXT,
  audio_url TEXT,
  audio_expires_at TIMESTAMPTZ,          -- 클라이언트 접속 시점에 만료 확인 후 삭제
  answered_at TIMESTAMPTZ DEFAULT now()

user_custom_terms
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  spoken_variation TEXT NOT NULL,   -- STT 오표기 (예: "コベルト")
  correct_term TEXT NOT NULL,       -- 실제 표기 (예: "KoBERT")
  category TEXT DEFAULT 'tech',
  created_at TIMESTAMPTZ DEFAULT now()

user_settings
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  preferred_language TEXT,
  default_interview_mode TEXT,
  default_duration_seconds INT,
  save_audio_default BOOLEAN DEFAULT false,
  audio_retention_days INT,
  target_job_family TEXT,
  target_company_names TEXT[],
  frequently_used_terms TEXT[]
```

- Row Level Security(RLS)로 사용자별 데이터 접근을 제한한다 (Supabase 무료 티어에서도 기본 제공).
- TTL 삭제 예시: `DELETE FROM session_answers WHERE audio_expires_at < now() AND user_id = auth.uid();` — 크론이 아니라 마이페이지 진입 시 클라이언트가 이 쿼리를 실행.

---

## 8. 사용자 흐름 (User Flow)

1. **모드 선택**: 연습/실전/약점보완/모의1차/기술/압박꼬리질문/역질문 중 선택.
2. **질문 제시**: 일본어 질문 표시 + TTS 낭독 (실전 모드는 1회만).
3. **음성 답변**: STT 실시간 타이핑, 응답 지연·파형 시각화 표시.
4. **꼬리 질문(조건부)**: 규칙 매칭된 꼬리질문이 있으면 이어서 제시 → 재답변 (§4-2).
5. **다음 질문**: 세션 진행(5~10문항, 꼬리질문 포함).
6. **결과 저장 & 피드백**: 로그 저장 + 규칙 기반 피드백(개선 우선순위/유지할 점/다음 목표) 표시.
7. **복습**: 마이페이지에서 레이더 차트, 히트맵, 오답 노트 플래시카드, Markdown 다운로드.

---

## 9. 화면 구성 개요

- **홈**: 서비스 가치 한 줄, 브라우저/마이크 지원 상태, 새 면접 시작, 최근 세션 이어하기, 오늘의 목표.
- **면접 진행**: 상단(진행률/남은 시간/모드), 중앙(질문/번역 토글/다시 듣기), 하단(마이크 제어/실시간 STT/수동 수정), 측면(답변 구조 힌트), 답변 완료 후 "확정 → 피드백 → 꼬리질문 계속".
- **결과 리포트**: 세션 요약, 질문별 답변·꼬리질문 흐름, 개선 우선순위 3개, 반복 필러, 부족한 구체성 요소, 다음 세션 추천 질문, Markdown/JSON/텍스트 내보내기, 음성 재생·삭제·다운로드.

---

## 10. 구현 우선순위

### Phase 1 — MVP
1. Chrome/Edge 중심 STT 호환성 검사 + 미지원 시 텍스트 모드 폴백
2. 마이크 거부/STT 실패 시 텍스트 입력 폴백
3. 일본어 질문 TTS, 번역 토글
4. 기본/기술/커스텀 질문 세트, `questions` 기본 스키마
5. 정적·키워드 기반 꼬리질문 (`follow_up_rules` 기본형)
6. 타이머, 답변 수동 편집
7. Supabase 세션 저장, RLS
8. Markdown 내보내기
9. 텍스트 로그 우선 저장, 음성 저장 옵트인
10. STT 기술 용어 보정 사전 기본 20~30개, 음성 파형 시각화

### Phase 2 — 차별화
1. 답변 시간·필러·반복어·구체성 분석 + STAR/PREP 구조 체크
2. 정중체/보통체 혼용 감지 (추정치 표기)
3. 응답 지연 측정
4. "다음 답변 목표" 자동 생성
5. missing_keyword/answer_length 기반 꼬리질문 규칙 확장
6. 약점 보완 모드, 클라이언트 기반 TTL 삭제
7. JD/직무 태그 기반 질문 필터

### Phase 3 — 포트폴리오 고도화
1. 질문 세트 가져오기/내보내기 JSON
2. 레이더 차트·히트맵, 오답 노트 플래시카드
3. 세션 변화 추적(평균 답변 시간, 필러 감소 추이)
4. 익명화된 로컬 샘플 데이터로 대시보드 시연
5. 다국어 UI, 접근성(키보드 조작, 색상 대비)
6. PWA/오프라인 텍스트 연습 모드
7. 아키텍처·RLS 정책·비용 설계 기술 문서화(ADR)

---

## 11. 최종 평가

| 평가 기준 | 판단 |
|---|---|
| 0원 원칙 | 전체 기능이 클라이언트 규칙 기반으로 완결되어 유지 가능 |
| 기술 실현성 | 브라우저 폴백 포함 시 안정적 |
| 일본 취업 실전성 | 시나리오형 세션·압박 꼬리질문·역질문 모드로 강화 |
| 반복 학습 가치 | 규칙 기반 피드백 + 약점 보완 모드가 핵심 차별화 |
| 개인정보 신뢰성 | STT 서버 처리 가능성 고지 + 저장 옵트인/TTL로 확보 |
| 포트폴리오 가치 | 비용·개인정보·브라우저 호환성 제약을 규칙 엔진·UX 폴백·RLS·데이터 모델로 해결한 사례로 서술 가능 |
| 운영 확장성 | 무료 한도 내 개인 포트폴리오/비상업 데모에 충분, 상업 서비스는 별도 검토 필요 |

**결론**: "LLM 기반 AI 면접관"으로 가지 않고, **규칙 기반의 정교한 면접 진행 + 측정 가능한 자가 피드백 + STT 오인식 개인 사전**에 집중하는 방향을 최종안으로 채택한다. 무료 원칙을 지키면서도 실전 취업 준비생에게 실질적으로 유용하고, 동시에 "비용 제약을 이해하고 엔지니어링으로 해결한 프로젝트"라는 포트폴리오 서사를 가진다.

---

## 12. 현재 범위 밖 (참고용, 채택하지 않음)

- LLM 기반 실시간 AI 첨삭/AI 생성 꼬리질문 — 유료 API 필요
- 클라우드 기반 고정밀 STT/TTS — 유료
- `pg_cron` 등 DB 크론 기반 자동 삭제 — 무료 티어 휴면 정책과 신뢰성 충돌 (§3, §5 참고)
- Supabase/Vercel 유료 플랜 승급이 필요한 대용량 저장/트래픽 대응
- 상업 서비스/대규모 공개 운영 — 필요 시점에 별도 의사결정
