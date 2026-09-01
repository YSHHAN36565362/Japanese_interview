'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { speakJapanese } from '@/lib/webSpeech'
import { useSpeechRecognition } from '@/lib/useSpeechRecognition'
import { CHOON_PRACTICE_WORDS } from '@/lib/choon'
import { analyzeAnswer, charOverlapSimilarity } from '@/lib/feedback'

const KEIGO_SENTENCE = '本日はお時間をいただき、誠にありがとうございます。'
const CHOON_WORD = CHOON_PRACTICE_WORDS[0]

type Step = 'self-report' | 'choon-check' | 'keigo-check' | 'result'

export default function LevelCheckPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [step, setStep] = useState<Step>('self-report')

  const [jlpt, setJlpt] = useState('unknown')
  const [keigoConfidence, setKeigoConfidence] = useState('unsure')
  const [choonConfidence, setChoonConfidence] = useState('unsure')

  const choonRec = useSpeechRecognition()
  const keigoRec = useSpeechRecognition()

  const [choonMismatch, setChoonMismatch] = useState<number | null>(null)
  const [keigoSimilarity, setKeigoSimilarity] = useState<number | null>(null)
  const [politenessRatio, setPolitenessRatio] = useState<number | null>(null)
  const [recommendation, setRecommendation] = useState<{ level: string; keigoMode: string } | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace('/login')
      } else {
        setUserId(data.user.id)
      }
    })
  }, [router])

  function evaluateChoon() {
    const recognized = choonRec.transcript.trim()
    const mismatch = recognized === CHOON_WORD.mistakenAs ? 1 : 0
    setChoonMismatch(mismatch)
    setStep('keigo-check')
  }

  function evaluateKeigo() {
    const recognized = keigoRec.transcript.trim()
    const sim = charOverlapSimilarity(KEIGO_SENTENCE, recognized)
    const analysis = analyzeAnswer(recognized)
    setKeigoSimilarity(sim)
    setPolitenessRatio(analysis.politenessRatio)
    computeRecommendation(sim)
    setStep('result')
  }

  function computeRecommendation(sim: number) {
    let level = jlpt !== 'unknown' ? jlpt : 'N3'
    if (jlpt === 'unknown') {
      if (sim > 0.7) level = 'N2'
      else if (sim > 0.4) level = 'N3'
      else level = 'N4'
    }

    let keigoMode: 'forced' | 'flexible' | 'casual_allowed' = 'flexible'
    if (keigoConfidence === 'confident' && sim > 0.6) keigoMode = 'forced'
    else if (keigoConfidence === 'difficult' || sim < 0.3) keigoMode = 'casual_allowed'

    setRecommendation({ level, keigoMode })
  }

  async function saveAndContinue() {
    if (!userId || !recommendation) return
    setSaving(true)
    const supabase = createClient()

    await supabase.from('diagnostic_results').insert({
      user_id: userId,
      self_reported_jlpt: jlpt,
      self_reported_keigo: keigoConfidence,
      self_reported_choon: choonConfidence,
      measured_politeness_ratio: politenessRatio,
      measured_choon_mismatch_count: choonMismatch,
      measured_keigo_similarity: keigoSimilarity,
      recommended_level: recommendation.level,
      recommended_keigo_mode: recommendation.keigoMode,
    })

    await supabase.from('user_settings').upsert({
      user_id: userId,
      jlpt_self_report: jlpt,
      jlpt_level_estimate: recommendation.level,
      keigo_mode: recommendation.keigoMode,
      choon_risk_flag: (choonMismatch ?? 0) > 0,
      diagnostic_completed_at: new Date().toISOString(),
    })

    setSaving(false)
    router.push('/interview')
  }

  if (!userId) return <p>확인 중입니다...</p>

  return (
    <div className="card">
      <h1>레벨 체크</h1>
      <p className="muted small">
        자가 신고 + 짧은 진단으로 초기 난이도와 경어 모드를 추천합니다. 결과는 자동 확정이 아니라
        제안이며, 면접 모드 선택 화면에서 언제든 바꿀 수 있습니다.
      </p>

      {step === 'self-report' && (
        <div className="form">
          <div>
            <p>JLPT 수준</p>
            <div className="radio-group">
              {['N1', 'N2', 'N3', 'N4', 'N5', 'unknown'].map((lvl) => (
                <label key={lvl}>
                  <input type="radio" name="jlpt" value={lvl} checked={jlpt === lvl} onChange={() => setJlpt(lvl)} />
                  {lvl === 'unknown' ? '모름' : lvl}
                </label>
              ))}
            </div>
          </div>

          <div>
            <p>경어(敬語) 사용</p>
            <div className="radio-group">
              {[
                { v: 'confident', label: '자신 있음' },
                { v: 'unsure', label: '애매함' },
                { v: 'difficult', label: '어려움' },
              ].map((opt) => (
                <label key={opt.v}>
                  <input
                    type="radio"
                    name="keigo"
                    value={opt.v}
                    checked={keigoConfidence === opt.v}
                    onChange={() => setKeigoConfidence(opt.v)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <p>장음(長音) 발음</p>
            <div className="radio-group">
              {[
                { v: 'confident', label: '자신 있음' },
                { v: 'unsure', label: '잘 모르겠음' },
                { v: 'difficult', label: '어려움을 느낀 적 있음' },
              ].map((opt) => (
                <label key={opt.v}>
                  <input
                    type="radio"
                    name="choon"
                    value={opt.v}
                    checked={choonConfidence === opt.v}
                    onChange={() => setChoonConfidence(opt.v)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          <div className="step-nav">
            <button className="btn btn-primary" onClick={() => setStep('choon-check')}>
              다음: 장음 발음 체크
            </button>
          </div>
        </div>
      )}

      {step === 'choon-check' && (
        <div>
          <h2>장음 발음 체크</h2>
          <p>
            아래 단어를 소리 내어 읽어보세요: <strong>{CHOON_WORD.word}</strong> ({CHOON_WORD.meaning})
          </p>
          <button className="btn" onClick={() => speakJapanese(CHOON_WORD.word)}>
            발음 듣기
          </button>
          <div className="mic-row" style={{ marginTop: 12 }}>
            <button className="btn btn-primary" onClick={() => choonRec.start()} disabled={choonRec.listening}>
              🎤 따라 말하기
            </button>
            <button className="btn" onClick={() => choonRec.stop()} disabled={!choonRec.listening}>
              ⏹ 중지
            </button>
          </div>
          <p className="muted small">인식된 텍스트: {choonRec.transcript || '—'}</p>
          <div className="step-nav">
            <button className="btn btn-primary" onClick={evaluateChoon}>
              다음: 경어 문장 체크
            </button>
          </div>
        </div>
      )}

      {step === 'keigo-check' && (
        <div>
          <h2>경어 문장 체크</h2>
          <p>아래 문장을 소리 내어 읽어보세요.</p>
          <p className="question-ja">{KEIGO_SENTENCE}</p>
          <button className="btn" onClick={() => speakJapanese(KEIGO_SENTENCE)}>
            발음 듣기
          </button>
          <div className="mic-row" style={{ marginTop: 12 }}>
            <button className="btn btn-primary" onClick={() => keigoRec.start()} disabled={keigoRec.listening}>
              🎤 따라 말하기
            </button>
            <button className="btn" onClick={() => keigoRec.stop()} disabled={!keigoRec.listening}>
              ⏹ 중지
            </button>
          </div>
          <p className="muted small">인식된 텍스트: {keigoRec.transcript || '—'}</p>
          <div className="step-nav">
            <button className="btn btn-primary" onClick={evaluateKeigo}>
              결과 보기
            </button>
          </div>
        </div>
      )}

      {step === 'result' && recommendation && (
        <div>
          <h2>진단 결과 (추정치)</h2>
          <ul>
            <li>추천 난이도: {recommendation.level}</li>
            <li>
              추천 경어 모드:{' '}
              {recommendation.keigoMode === 'forced'
                ? '경어 강제 모드'
                : recommendation.keigoMode === 'casual_allowed'
                ? '보통체 허용 연습 모드'
                : '경어 자율 모드'}
            </li>
            <li>장음 오인식 감지: {choonMismatch ? '있음 (장음 연습 모드를 권장합니다)' : '없음'}</li>
            <li>경어 문장 재현 유사도(추정치): {keigoSimilarity ?? '—'}</li>
            <li>정중체 사용 비율(추정치): {politenessRatio ?? '—'}</li>
          </ul>
          <p className="muted small">
            이 결과는 정밀한 언어 능력 평가가 아니라, 문자열 비교 기반의 근사치입니다. 면접 모드
            선택 화면에서 난이도를 직접 바꿀 수 있습니다.
          </p>
          <div className="step-nav">
            <button className="btn btn-primary" onClick={saveAndContinue} disabled={saving}>
              {saving ? '저장 중...' : '이 설정으로 면접 시작하기'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
