'use client'

import { useState, type ChangeEvent } from 'react'
import type { ParsedResume } from '@/lib/resume/types'

// 이력서는 텍스트 붙여넣기가 아니라 K-Move 이력서·자기소개서 워드(.docx) 양식을 파일로
// 업로드받는다. 서버(/api/resume/parse)가 그 파일을 파싱해서 경력·기술스택·자기소개서를
// 뽑아내고, 로그인 사용자는 Supabase(user_resumes)에 저장하며(게스트는 sessionStorage에만),
// useInterviewMachine이 세션 시작 시 그 결과를 읽어 맞춤 질문을 섞어 낸다. 여기서는
// 업로드/파싱까지만 하고 "스킵하기"나 "이 이력서로 시작하기"를 누르면 실제로 세션이 시작된다.
const RESUME_STORAGE_KEY = 'kmove_resume'

export default function ResumeInputStep({
  onContinue,
  isGuest,
}: {
  onContinue: () => void
  isGuest: boolean
}) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [parsed, setParsed] = useState<ParsedResume | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setError(null)
    setParsed(null)
    setFileName(file.name)
    setUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/resume/parse', { method: 'POST', body: formData })
      const body = await res.json()

      if (!res.ok) {
        setError(body.message ?? '이력서를 처리하는 중 오류가 발생했습니다.')
        return
      }

      setParsed(body.parsed as ParsedResume)
      if (isGuest) {
        try {
          sessionStorage.setItem(RESUME_STORAGE_KEY, JSON.stringify(body.parsed))
        } catch {
          // sessionStorage를 못 쓰는 환경이면 조용히 무시 — 이 세션에서만 이력서 질문이 안 나올 뿐
          // 나머지 기능에는 영향 없다.
        }
      }
    } catch {
      setError('이력서를 업로드하는 중 오류가 발생했습니다. 다시 시도해주세요.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="preflight-overlay">
      <div className="preflight-card">
        <h2 className="preflight-title">이력서 파일 업로드 (선택)</h2>
        <p className="preflight-subtitle">
          K-Move 이력서·자기소개서 워드(.docx) 양식을 업로드하면, 그 안의 경력·기술스택·자기소개서
          내용에서 맞춤 질문이 자동으로 만들어져 이번 세션에 함께 출제됩니다. 업로드하지
          않아도 스킵하고 그대로 진행할 수 있습니다.
        </p>

        <label className="resume-upload-dropzone">
          <span className="resume-upload-dropzone-icon" aria-hidden="true">
            📄
          </span>
          <span className="resume-upload-dropzone-text">
            {uploading ? '처리 중...' : fileName ? '다른 파일로 다시 선택' : 'K-Move 이력서(.docx) 파일 선택'}
          </span>
          <input
            type="file"
            accept=".docx"
            onChange={handleFileChange}
            disabled={uploading}
            style={{ display: 'none' }}
          />
        </label>

        {fileName && !error && !uploading && (
          <p className="muted small">선택한 파일: {fileName}</p>
        )}

        {error && (
          <p className="badge badge-error" style={{ display: 'block', whiteSpace: 'pre-wrap' }}>
            {error}
          </p>
        )}

        {parsed && (
          <div className="resume-upload-summary">
            <span className="badge badge-ok" style={{ width: 'fit-content' }}>
              분석 완료
            </span>
            <p>
              <strong>{parsed.personal.nameKanji ?? parsed.personal.nameRomaji ?? '이름 미인식'}</strong>
            </p>
            {parsed.careers.length > 0 && (
              <p className="muted small">
                경력 {parsed.careers.length}건: {parsed.careers.map((c) => c.company).join(', ')}
              </p>
            )}
            {parsed.techStack.length > 0 && <p className="muted small">기술스택: {parsed.techStack.join(', ')}</p>}
            <p className="muted small">
              자기소개서 항목 {Object.values(parsed.essays).filter(Boolean).length}/5개 인식됨
            </p>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onContinue} disabled={uploading}>
            스킵하기
          </button>
          <button type="button" className="btn btn-primary" onClick={onContinue} disabled={uploading || !parsed}>
            이 이력서로 시작하기
          </button>
        </div>
      </div>
    </div>
  )
}
