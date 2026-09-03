'use client'

import { useEffect, useState, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import MacWindow from '@/components/MacWindow'
import LoadingDots from '@/components/LoadingDots'
import type { ParsedResume } from '@/lib/resume/types'

const RESUME_STORAGE_KEY = 'kmove_resume'

export default function ResumeUploadPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [isGuest, setIsGuest] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [parsed, setParsed] = useState<ParsedResume | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace('/login')
        return
      }
      setIsGuest(data.user.is_anonymous ?? false)
      setChecking(false)
    })
  }, [router])

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

  if (checking) return <LoadingDots label="확인 중입니다..." />

  return (
    <MacWindow title="mensetsu-dojo — resume">
      <h1 style={{ marginTop: 0 }}>이력서 업로드 (선택)</h1>
      <p className="muted small">
        K-Move 프로그램 이력서·자기소개서 워드(.docx) 양식을 업로드하면, 그 안의 경력·기술스택·자기소개서
        내용에서 맞춤 질문과 꼬리질문이 자동으로 만들어져 기존 질문들과 함께 출제됩니다. 업로드하지 않아도
        기존 방식 그대로 진행할 수 있습니다.
        {isGuest && ' 번호 없이 시작한 게스트는 이 브라우저 세션에서만 이력서 내용이 쓰이고, 서버에는 저장되지 않습니다.'}
      </p>

      <div className="card narrow" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label className="btn" style={{ display: 'inline-block', width: 'fit-content', cursor: 'pointer' }}>
          {uploading ? '처리 중...' : 'K-Move 이력서(.docx) 선택'}
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

        {uploading && <LoadingDots label="이력서를 분석하고 있습니다..." />}

        {error && (
          <p className="badge badge-error" style={{ display: 'block', whiteSpace: 'pre-wrap' }}>
            {error}
          </p>
        )}

        {parsed && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
            {parsed.techStack.length > 0 && (
              <p className="muted small">기술스택: {parsed.techStack.join(', ')}</p>
            )}
            <p className="muted small">
              자기소개서 항목 {Object.values(parsed.essays).filter(Boolean).length}/5개 인식됨
            </p>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button className="btn btn-primary" onClick={() => router.push('/interview')} disabled={uploading}>
          {parsed ? '이 이력서로 계속하기' : '건너뛰고 계속하기'}
        </button>
      </div>
    </MacWindow>
  )
}
