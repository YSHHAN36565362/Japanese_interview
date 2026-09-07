'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MODE_LABEL } from '../constants'

const MIC_BAR_WEIGHTS = [0.4, 0.75, 0.55, 0.9, 0.62, 0.35, 0.5]

export default function PreflightDialog({
  mode,
  micLevel,
  isGuest,
  onRequestMic,
  onComplete,
}: {
  mode: string
  micLevel: number
  isGuest: boolean
  onRequestMic: () => Promise<boolean>
  onComplete: (micAvailable: boolean) => void
}) {
  const [testing, setTesting] = useState(false)
  const [tested, setTested] = useState(false)
  const [micOk, setMicOk] = useState(false)

  async function handleTestMic() {
    setTesting(true)
    const ok = await onRequestMic()
    setTesting(false)
    setTested(true)
    setMicOk(ok)
  }

  return (
    <div className="preflight-overlay" role="dialog" aria-modal="true" aria-labelledby="preflight-title">
      <div className="preflight-card">
        <div className="step-indicator">
          <span>01 MODE</span>
          <span className="step-indicator-line step-indicator-line-short" />
          <span className="step-indicator-current">02 CHECK</span>
          <span className="step-indicator-line" />
          <span>03 INTERVIEW</span>
        </div>

        <h2 id="preflight-title" className="preflight-title">
          입장 전 확인
        </h2>
        <p className="preflight-subtitle">
          入場前の確認 · {MODE_LABEL[mode] ?? '면접'} · 마이크가 없어도 텍스트 모드로 전체 연습을 진행할 수 있습니다.
        </p>

        <div className="preflight-section preflight-mic-section">
          <div className="preflight-mic-head">
            <span className="preflight-mic-label">마이크 테스트 · マイクテスト</span>
            {micOk && <span className="preflight-mic-status-ok">입력 감지됨</span>}
          </div>

          {tested && micOk ? (
            <>
              <div className="preflight-mic-bars">
                {MIC_BAR_WEIGHTS.map((w, i) => {
                  const height = Math.min(100, Math.round((0.15 + w * Math.min(1, micLevel * 1.8)) * 100))
                  return (
                    <div
                      key={i}
                      className="preflight-mic-bar"
                      style={{ height: `${height}%`, opacity: height > 30 ? 1 : 0.4 }}
                    />
                  )
                })}
              </div>
              <p className="preflight-mic-hint">「よろしくお願いします」라고 한 번 말해보세요.</p>
            </>
          ) : (
            <div className="preflight-mic-test-row">
              <button className="mic-test-btn" onClick={handleTestMic} disabled={testing}>
                {testing ? '마이크 확인 중...' : '마이크 테스트 시작'}
              </button>
              {tested && !micOk && (
                <span className="badge badge-warn">마이크를 사용할 수 없습니다. 텍스트로 답변할 수 있습니다.</span>
              )}
            </div>
          )}
        </div>

        <ul className="preflight-notice-list">
          <li>카메라 미리보기는 켜더라도 기본적으로 저장·업로드되지 않습니다.</li>
          <li>
            브라우저 음성 인식 엔진은 브라우저·OS에 따라 외부 서버에서 처리될 수 있습니다. 별도의 유료
            API 비용은 발생하지 않습니다.
          </li>
          <li>마이크 권한이 없어도 텍스트 모드로 전체 연습을 진행할 수 있습니다.</li>
        </ul>

        {isGuest && (
          <div className="preflight-guest-notice">
            <span className="home-guest-dot" aria-hidden="true" />
            <div>
              <strong>번호 없이 게스트로 입장합니다.</strong> 이 세션은 저장되지 않으며 종료 후 다시 볼 수 없습니다.
            </div>
          </div>
        )}

        <div className="preflight-actions">
          <Link href="/interview" className="btn">
            ← 모드 다시 선택
          </Link>
          <div className="preflight-actions-right">
            <button className="btn" onClick={() => onComplete(false)}>
              텍스트 모드로 계속하기
            </button>
            <button className="btn btn-primary" onClick={() => onComplete(true)} disabled={!tested || !micOk}>
              입장하기
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
