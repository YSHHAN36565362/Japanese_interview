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
    textKo: '성장 과정에 대해 알려주세요.',
    tags: ['resume_derived'],
  },
  personality: {
    id: 'resume_essay_personality',
    category: 'personality',
    expectedDurationSec: 90,
    textJa: 'ご自身の性格の長所と短所について教えてください。',
    textKo: '본인 성격의 장점과 단점에 대해 알려주세요.',
    tags: ['resume_derived'],
  },
  whyJapan: {
    id: 'resume_essay_why_japan',
    category: 'culture_fit',
    expectedDurationSec: 90,
    textJa: '日本で就職したい理由を教えてください。',
    textKo: '일본에서 취업하고 싶은 이유를 알려주세요.',
    tags: ['resume_derived'],
  },
  whyProgram: {
    id: 'resume_essay_why_program',
    category: 'culture_fit',
    expectedDurationSec: 90,
    textJa: 'このK-MOVE日本IT研修に参加された理由を教えてください。',
    textKo: '이번 K-MOVE 일본 IT 연수에 참가하신 이유를 알려주세요.',
    tags: ['resume_derived'],
  },
  aspiration: {
    id: 'resume_essay_aspiration',
    category: 'personality',
    expectedDurationSec: 90,
    textJa: '入社後の抱負や今後の計画について教えてください。',
    textKo: '입사 후 포부와 앞으로의 계획에 대해 알려주세요.',
    tags: ['resume_derived'],
  },
}

// 답변에 실제로 내용이 있는 자소서 항목만 질문으로 낸다(빈 항목은 제외).
export function buildEssayQuestions(essays: ParsedResume['essays']): BankQuestion[] {
  return (Object.keys(RESUME_ESSAY_QUESTIONS) as (keyof ParsedResume['essays'])[])
    .filter((key) => essays[key])
    .map((key) => RESUME_ESSAY_QUESTIONS[key])
}

// id 생성 규칙을 한 곳에 모아둔다(buildCareerQuestions가 사용).
export function careerQuestionId(index: number): string {
  return `resume_career_${index}`
}

// 경력 항목당 템플릿 질문 1개(최대 3개). category는 data/questions.json의 team_project와 같은
// 관례를 따라 'technical'로 둔다 — 실제 업무 경험을 묻는 질문이라, 이렇게 해야 "기술 면접"
// (MODE_TO_CATEGORY.technical = ['technical']) 모드에서도 이력서 경력 질문이 제외되지 않는다.
// docxParser.ts가 실제로 채우는 필드는 department(부서/직위가 한 칸에 같이 들어오는 경우가
// 많음)뿐이라 department를 쓴다 — 이전엔 한 번도 채워지지 않는 career.role을 참조하고 있어서
// "〜として勤務" 버전 문구가 항상 죽은 코드였다.
export function buildCareerQuestions(careers: ParsedResume['careers']): BankQuestion[] {
  return careers.slice(0, 3).map((career, i) => {
    const textJa = career.department
      ? `履歴書によると、${career.company}で${career.department}として勤務されていたとのことですが、そこでの業務について具体的に教えてください。`
      : `履歴書によると、${career.company}での勤務経験があるとのことですが、そこでの業務について具体的に教えてください。`
    const textKo = career.department
      ? `이력서에 따르면 ${career.company}에서 ${career.department}로 근무하셨다고 되어 있는데, 그곳에서의 업무에 대해 구체적으로 알려주세요.`
      : `이력서에 따르면 ${career.company}에서 근무하신 경험이 있다고 되어 있는데, 그곳에서의 업무에 대해 구체적으로 알려주세요.`
    return {
      id: careerQuestionId(i),
      category: 'technical' as const,
      expectedDurationSec: 90,
      textJa,
      textKo,
      tags: ['resume_derived'],
    }
  })
}

// 기술표(区分/製品/機種/活用) — 예전엔 파싱만 하고 질문으로 전혀 안 쓰였다. 특정 기술 하나를
// 콕 집어 묻는 대신, 전체 목록을 보여주고 "그중 가장 자신 있는 것"을 스스로 고르게 한다 —
// 이력서에 없는 기술을 잘못 짚어 묻는 사고를 원천적으로 막을 수 있다.
export function buildTechStackQuestion(techStack: ParsedResume['techStack']): BankQuestion | null {
  if (techStack.length === 0) return null
  const list = techStack.slice(0, 8).join('、')
  return {
    id: 'resume_tech_stack',
    category: 'technical',
    expectedDurationSec: 90,
    textJa: `履歴書の技術表に${list}などが挙げられていますが、その中で最も自信のある技術を一つ選んで、実務やプロジェクトでどのように活用したか教えてください。`,
    textKo: `이력서 기술표에 ${techStack.slice(0, 8).join(', ')} 등이 적혀 있는데, 그중 가장 자신 있는 기술 하나를 골라 실무나 프로젝트에서 어떻게 활용했는지 알려주세요.`,
    tags: ['resume_derived'],
  }
}

// 학력 — 첫 번째 항목(보통 최종 학력)만 쓴다. 전공이 있으면 전공 위주 문구, 없으면 학교만
// 언급하는 문구로 자연스럽게 폴백한다.
export function buildEducationQuestion(education: ParsedResume['education']): BankQuestion | null {
  const first = education[0]
  if (!first) return null
  const textJa = first.major
    ? `履歴書によると、${first.school}で${first.major}を専攻されたとのことですが、その学びが今回応募される職務とどのように繋がると思いますか。`
    : `履歴書によると、${first.school}のご出身とのことですが、そこで学んだことは今回応募される職務にどのように活かせると思いますか。`
  const textKo = first.major
    ? `이력서에 따르면 ${first.school}에서 ${first.major}을(를) 전공하셨는데, 그 배움이 이번에 지원하시는 직무와 어떻게 연결된다고 생각하시나요?`
    : `이력서에 따르면 ${first.school} 출신이신데, 거기서 배운 것을 이번에 지원하시는 직무에 어떻게 활용할 수 있다고 생각하시나요?`
  return {
    id: 'resume_education',
    category: 'technical',
    expectedDurationSec: 90,
    textJa,
    textKo,
    tags: ['resume_derived'],
  }
}

// 자격증 — 첫 번째 항목만 쓴다(여러 개면 가장 위에 적은 것을 대표로 취급).
export function buildCertificationQuestion(certifications: ParsedResume['certifications']): BankQuestion | null {
  const first = certifications[0]
  if (!first) return null
  return {
    id: 'resume_certification',
    category: 'technical',
    expectedDurationSec: 60,
    textJa: `履歴書に「${first.name}」の資格をお持ちだとありますが、この資格が実務にどのように役立つと思いますか。`,
    textKo: `이력서에 "${first.name}" 자격을 갖고 계신다고 되어 있는데, 이 자격이 실무에 어떻게 도움이 될 거라고 생각하시나요?`,
    tags: ['resume_derived'],
  }
}

// 희망 직종이 파싱됐다면, 그 직종과 실제 경험을 연결짓는 질문을 하나 더 추가한다.
export function buildDesiredJobQuestion(personal: ParsedResume['personal']): BankQuestion | null {
  if (!personal.desiredJob) return null
  return {
    id: 'resume_desired_job',
    category: 'culture_fit',
    expectedDurationSec: 90,
    textJa: `履歴書で希望職種として「${personal.desiredJob}」を挙げていらっしゃいますが、これまでの経験の中でその職種に関連する具体的な経験を教えてください。`,
    textKo: `이력서에 희망 직종으로 "${personal.desiredJob}"을(를) 적어주셨는데, 지금까지의 경험 중 그 직종과 관련된 구체적인 경험을 알려주세요.`,
    tags: ['resume_derived'],
  }
}

// 이력서에서 뽑는 "대분류" 질문 전부를 한 곳에서 조립한다
// (자소서 + 경력 + 희망직종 + 기술표 + 학력 + 자격증).
export function buildResumeMainQuestions(parsed: ParsedResume): BankQuestion[] {
  const desiredJobQuestion = buildDesiredJobQuestion(parsed.personal)
  const techStackQuestion = buildTechStackQuestion(parsed.techStack)
  const educationQuestion = buildEducationQuestion(parsed.education)
  const certificationQuestion = buildCertificationQuestion(parsed.certifications)
  return [
    ...buildEssayQuestions(parsed.essays),
    ...buildCareerQuestions(parsed.careers),
    ...(desiredJobQuestion ? [desiredJobQuestion] : []),
    ...(techStackQuestion ? [techStackQuestion] : []),
    ...(educationQuestion ? [educationQuestion] : []),
    ...(certificationQuestion ? [certificationQuestion] : []),
  ]
}
