import type { BankQuestion } from '@/lib/questionBank'
import type { ParsedResume } from './types'

// 이력서 자기소개서 5문항 → 고정 질문. REAL_MODE_INTRO_QUESTION과 동일한 패턴으로
// data/questions.json 밖에 코드로 고정해 둔다. id는 전부 resume_ 접두사라 기존 은행과 충돌하지 않는다.
export const RESUME_ESSAY_QUESTIONS: Record<keyof ParsedResume['essays'], BankQuestion> = {
  growth: {
    id: 'resume_essay_growth',
    category: 'personality',
    expectedDurationSec: 90,
    textJa: '成長過程について教えてください。',
    tags: ['resume_derived'],
  },
  personality: {
    id: 'resume_essay_personality',
    category: 'personality',
    expectedDurationSec: 90,
    textJa: 'ご自身の性格の長所と短所について教えてください。',
    tags: ['resume_derived'],
  },
  whyJapan: {
    id: 'resume_essay_why_japan',
    category: 'culture_fit',
    expectedDurationSec: 90,
    textJa: '日本で就職したい理由を教えてください。',
    tags: ['resume_derived'],
  },
  whyProgram: {
    id: 'resume_essay_why_program',
    category: 'culture_fit',
    expectedDurationSec: 90,
    textJa: 'このK-MOVE日本IT研修に参加された理由を教えてください。',
    tags: ['resume_derived'],
  },
  aspiration: {
    id: 'resume_essay_aspiration',
    category: 'personality',
    expectedDurationSec: 90,
    textJa: '入社後の抱負や今後の計画について教えてください。',
    tags: ['resume_derived'],
  },
}

// 답변에 실제로 내용이 있는 자소서 항목만 질문으로 낸다(빈 항목은 제외).
export function buildEssayQuestions(essays: ParsedResume['essays']): BankQuestion[] {
  return (Object.keys(RESUME_ESSAY_QUESTIONS) as (keyof ParsedResume['essays'])[])
    .filter((key) => essays[key])
    .map((key) => RESUME_ESSAY_QUESTIONS[key])
}

// followUpSynth.ts가 경력 질문의 부모 id를 그대로 참조하므로, id 생성 규칙을 한 곳에 모아
// 두 파일이 서로 다른 id를 만들어내는 사고를 막는다.
export function careerQuestionId(index: number): string {
  return `resume_career_${index}`
}

// 경력 항목당 템플릿 질문 1개(최대 3개). category는 data/questions.json의 team_project와 같은
// 관례를 따라 'technical'로 둔다 — 실제 업무 경험을 묻는 질문이라, 이렇게 해야 "기술 면접"
// (MODE_TO_CATEGORY.technical = ['technical']) 모드에서도 이력서 경력 질문이 제외되지 않는다.
export function buildCareerQuestions(careers: ParsedResume['careers']): BankQuestion[] {
  return careers.slice(0, 3).map((career, i) => {
    const textJa = career.role
      ? `履歴書によると、${career.company}で${career.role}として勤務されていたとのことですが、そこでの業務について具体的に教えてください。`
      : `履歴書によると、${career.company}での勤務経験があるとのことですが、そこでの業務について具体的に教えてください。`
    return {
      id: careerQuestionId(i),
      category: 'technical' as const,
      expectedDurationSec: 90,
      textJa,
      tags: ['resume_derived'],
    }
  })
}

// 희망 직종이 파싱됐다면, 그 직종과 실제 경험을 연결짓는 질문을 하나 더 추가한다.
export function buildDesiredJobQuestion(personal: ParsedResume['personal']): BankQuestion | null {
  if (!personal.desiredJob) return null
  return {
    id: 'resume_desired_job',
    category: 'culture_fit',
    expectedDurationSec: 90,
    textJa: `履歴書で希望職種として「${personal.desiredJob}」を挙げていらっしゃいますが、これまでの経験の中でその職種に関連する具体的な経験を教えてください。`,
    tags: ['resume_derived'],
  }
}

// 이력서에서 뽑는 "대분류" 질문 전부를 한 곳에서 조립한다(자소서 + 경력 + 희망직종).
export function buildResumeMainQuestions(parsed: ParsedResume): BankQuestion[] {
  const desiredJobQuestion = buildDesiredJobQuestion(parsed.personal)
  return [
    ...buildEssayQuestions(parsed.essays),
    ...buildCareerQuestions(parsed.careers),
    ...(desiredJobQuestion ? [desiredJobQuestion] : []),
  ]
}
