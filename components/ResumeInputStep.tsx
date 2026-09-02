'use client'

import { useState } from 'react'
import { matchResumeKeywords } from '@/lib/resumeKeywords'

// 실전 면접(소프트웨어/반도체 트랙) 시작 직전에 한 번 보여주는 선택 단계. 이력서/자기소개
// 텍스트를 붙여넣으면 그 안의 키워드(팀 프로젝트, 머신러닝, 반도체 등)를 보고 관련 있는
// 질문을 세션 풀에 우선 포함시킨다 — AI 호출 없이 단순 키워드 매칭만 쓴다(0원 운영 원칙).
// 원하지 않으면 "스킵하기"로 그냥 넘어갈 수 있다.
export default function ResumeInputStep({
  onContinue,
}: {
  onContinue: (matchedQuestionIds: string[]) => void
}) {
  const [text, setText] = useState('')

  function handleSubmit() {
    onContinue(matchResumeKeywords(text))
  }

  function handleSkip() {
    onContinue([])
  }

  return (
    <div className="preflight-overlay">
      <div className="preflight-card">
        <h2>이력서 / 자기소개 붙여넣기 (선택)</h2>
        <p className="muted small">
          장단점, 프로젝트 경험 등이 담긴 이력서나 자기소개 텍스트를 붙여넣으면, 그 안의
          키워드(예: 팀 프로젝트, 머신러닝, 반도체, 리더십 등)와 관련된 질문을 이번 세션에
          우선 포함시킵니다. AI가 내용을 읽는 것이 아니라 정해진 키워드 목록과 단순
          문자열 매칭만 합니다. 원하지 않으면 그냥 스킵해도 됩니다.
        </p>
        <textarea
          className="answer-box"
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="여기에 이력서나 자기소개 내용을 붙여넣어주세요 (선택 사항)"
        />
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={handleSkip}>
            스킵하기
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={!text.trim()}>
            반영하고 시작하기
          </button>
        </div>
      </div>
    </div>
  )
}
