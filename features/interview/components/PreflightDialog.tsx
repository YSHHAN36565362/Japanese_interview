'use client'

import { useState } from 'react'
import { MODE_LABEL } from '../constants'

export default function PreflightDialog({
  mode,
  micLevel,
  onRequestMic,
  onComplete,
}: {
  mode: string
  micLevel: number
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
        <h2 id="preflight-title">{MODE_LABEL[mode] ?? '면접'} 입장 전 확인</h2>
        <ul className="preflight-notice-list">
          <li>카메라 미리보기는 켜더라도 기본적으로 저장·업로드되지 않습니다.</li>
          <li>
            브라우저 음성 인식 엔진은 브라우저·OS에 따라 외부 서버에서 처리될 수 있습니다. 별도의 유료
            API 비용은 발생하지 않습니다.
          </li>
          <li>마이크 권한이 없어도 텍스트 모드로 전체 연습을 진행할 수 있습니다.</li>
        </ul>

        <div className="preflight-mic-test">
          <button className="btn btn-primary" onClick={handleTestMic} disabled={testing}>
            {testing ? '마이크 확인 중...' : '마이크 테스트 시작'}
          </button>
          {tested && (
            <div className="preflight-mic-level" aria-live="polite">
              {micOk ? (
                <>
                  <div className="preflight-level-bar">
                    <div className="preflight-level-fill" style={{ width: `${Math.round(micLevel * 100)}%` }} />
                  </div>
                  <span className="badge badge-ok">마이크가 정상적으로 감지되었습니다.</span>
                </>
              ) : (
                <span className="badge badge-warn">마이크를 사용할 수 없습니다. 텍스트로 답변할 수 있습니다.</span>
              )}
            </div>
          )}
        </div>

        <div className="preflight-actions">
          <button className="btn" onClick={() => onComplete(false)}>
            텍스트 모드로 계속하기
          </button>
          <button className="btn btn-primary" onClick={() => onComplete(true)} disabled={!tested || !micOk}>
            입장하기
          </button>
        </div>
      </div>
    </div>
  )
}
