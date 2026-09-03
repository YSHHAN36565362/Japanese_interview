import type { BankFollowUp, BankQuestion, QuestionCategory } from '@/lib/questionBank'
import type { ParsedResume } from './types'
import { RESUME_ESSAY_QUESTIONS, careerQuestionId } from './resumeQuestions'

// public/data/follow_ups.txt에 이미 나오는 기술 키워드를 base로 삼고, 본인 기술표에서 뽑힌
// 스택까지 합쳐서 자소서/경력 본문에서 매칭한다(대소문자 무시).
const BASE_TECH_KEYWORDS = [
  'Python', 'SQL', 'Java', 'JavaScript', 'TypeScript', 'React', 'Node.js',
  'C++', 'C#', 'HTML', 'CSS', 'Django', 'FastAPI', 'Spring', 'MySQL',
  'PostgreSQL', 'MongoDB', 'AWS', 'Docker', 'Kubernetes', 'Git', 'GitHub',
  '機械学習', 'データ', 'データベース',
]

// 꼬리질문이 한 번 더 깊이 들어갈 때 공통으로 쓰는 트리거 — 기존 public/data/follow_ups.txt의
// tier1→tier2 체인(예: tp_conflict_tier1 → tier2)과 같은 패턴을 이력서 유래 질문에도 적용한다.
const DEPTH_KEYWORDS = ['苦労', '大変', '難し', '失敗', '工夫', '対応', '解決', '改善', '結果', '成果']

function extractQuotedPhrases(text: string): string[] {
  const matches = text.match(/[「『"'](.+?)[」』"']/g) ?? []
  const seen = new Set<string>()
  const out: string[] = []
  for (const m of matches) {
    const phrase = m.slice(1, -1).trim()
    // 문장 전체가 인용부호에 잘못 걸리는 경우(너무 긴 구간)는 프로젝트명 후보에서 제외한다.
    if (!phrase || phrase.length > 24) continue
    const key = phrase.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(phrase)
  }
  return out
}

function extractTechMentions(text: string, techStack: string[]): string[] {
  const dict = Array.from(new Set([...BASE_TECH_KEYWORDS, ...techStack]))
  const lowerText = text.toLowerCase()
  const rawMatches = dict.filter((kw) => lowerText.includes(kw.toLowerCase()))
  // "PostgreSQL"이 매칭되면 그 안에 포함된 "SQL"처럼, 더 긴 매칭 키워드에 완전히 포함되는
  // 짧은 키워드는 중복으로 보지 않는다(그대로 두면 같은 문장에서 SQL/PostgreSQL이 각각 별도
  // 꼬리질문으로 뽑히는 오탐이 생긴다).
  return rawMatches.filter(
    (kw) => !rawMatches.some((other) => other !== kw && other.length > kw.length && other.toLowerCase().includes(kw.toLowerCase()))
  )
}

interface TokenSource {
  questionId: string
  category: QuestionCategory
  text: string
}

// 꼬리질문 재료를 자소서 5문항뿐 아니라 경력 항목(직무/부서/업무 내용)에서도 뽑는다 —
// 경력 답변에 나온 회사·기술 키워드도 실제 면접에서 파고들 만한 재료이기 때문이다.
function collectSources(parsed: ParsedResume): TokenSource[] {
  const sources: TokenSource[] = []

  for (const key of Object.keys(RESUME_ESSAY_QUESTIONS) as (keyof ParsedResume['essays'])[]) {
    const text = parsed.essays[key]
    if (!text) continue
    sources.push({ questionId: RESUME_ESSAY_QUESTIONS[key].id, category: RESUME_ESSAY_QUESTIONS[key].category, text })
  }

  parsed.careers.slice(0, 3).forEach((career, i) => {
    const text = [career.role, career.department, career.duties].filter(Boolean).join(' ')
    if (!text) return
    // buildCareerQuestions()와 같은 category('technical')를 써야 한다 — 다르면 이 꼬리질문의
    // category가 부모 질문과 어긋나서, 기술 면접 모드에서 카테고리 필터링 근거가 흔들린다.
    sources.push({ questionId: careerQuestionId(i), category: 'technical', text })
  })

  return sources
}

function buildTier2(tier1Id: string, isProject: boolean, category: QuestionCategory): { rule: BankFollowUp; question: BankQuestion } {
  const targetId = `${tier1Id}_deep`
  return {
    rule: { parentId: tier1Id, triggerType: 'keyword', keywords: DEPTH_KEYWORDS, targetId, priority: 1 },
    question: {
      id: targetId,
      category,
      expectedDurationSec: 60,
      textJa: isProject
        ? 'その経験を通じて、具体的にどのような成果や学びがありましたか。可能であれば数字や結果も教えてください。'
        : 'その過程で最も難しかった点と、それをどう乗り越えたかを具体的に教えてください。',
      tags: ['resume_derived', 'follow_up', 'tier2'],
    },
  }
}

// 자소서·경력 고유명사(프로젝트명)·기술 키워드 → 2단(tier1→tier2) 꼬리질문 규칙+질문 합성.
// id는 전부 resume_followup_ 접두사라 data/questions.json과 절대 충돌하지 않는다.
export function buildResumeFollowUps(parsed: ParsedResume): { rules: BankFollowUp[]; questions: BankQuestion[] } {
  const rules: BankFollowUp[] = []
  const questions: BankQuestion[] = []
  const usedTokens = new Set<string>() // 같은 프로젝트/기술명이 자소서·경력에 중복 언급돼도 질문은 한 번만
  let seq = 0

  for (const source of collectSources(parsed)) {
    const quoted = extractQuotedPhrases(source.text)
    const tech = extractTechMentions(source.text, parsed.techStack).filter(
      (t) => !quoted.some((q) => q.toLowerCase() === t.toLowerCase())
    )

    // usedTokens 반영은 slice로 최종 채택된 토큰에 대해서만 해야 한다 — filter 콜백 안에서
    // 바로 add하면 슬라이스로 버려질 3번째 이후 후보까지 "이미 썼다"고 잘못 표시되어,
    // 다른 소스(경력 등)에서 같은 토큰이 다시 나와도 정당하게 못 뽑는 문제가 생긴다.
    const candidates = [
      ...quoted.map((token) => ({ token, isProject: true })),
      ...tech.map((token) => ({ token, isProject: false })),
    ].filter(({ token }) => !usedTokens.has(token.toLowerCase()))
    const tokens = candidates.slice(0, 2)
    for (const { token } of tokens) usedTokens.add(token.toLowerCase())

    for (const { token, isProject } of tokens) {
      const tier1Id = `resume_followup_${seq++}`
      questions.push({
        id: tier1Id,
        category: source.category,
        expectedDurationSec: 60,
        textJa: isProject
          ? `「${token}」について、具体的にどのように取り組みましたか。`
          : `${token}について、実務や学習の中でどのように活用しましたか。`,
        tags: ['resume_derived', 'follow_up'],
      })
      rules.push({
        parentId: source.questionId,
        triggerType: 'keyword',
        keywords: [token],
        targetId: tier1Id,
        priority: isProject ? 5 : 2,
      })

      const tier2 = buildTier2(tier1Id, isProject, source.category)
      rules.push(tier2.rule)
      questions.push(tier2.question)
    }
  }

  return { rules, questions }
}
