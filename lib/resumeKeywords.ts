// 실전 면접 시작 전, 사용자가 자기소개/이력서 텍스트를 붙여넣으면(선택, 스킵 가능) 그 안의
// 키워드를 보고 관련 있는 대분류 질문을 세션 풀에 우선 포함시킨다. AI 호출 없이 순수
// 문자열 포함 검사만 사용한다(0원 운영 원칙) — follow_ups.txt의 키워드 매칭과 같은 방식이다.
import { getQuestionById, type BankQuestion } from './questionBank'

export interface ResumeKeywordEntry {
  questionId: string
  keywords: string[]
}

export const RESUME_KEYWORD_MAP: ResumeKeywordEntry[] = [
  { questionId: 'team_project', keywords: ['팀 프로젝트', '팀플', '협업', 'チーム'] },
  { questionId: 'leadership_experience', keywords: ['리더십', '팀장', '동아리 회장', '리더'] },
  { questionId: 'oss_contribution', keywords: ['오픈소스', 'OSS', '깃허브 기여', 'github contribution'] },
  { questionId: 'ml_project_experience', keywords: ['머신러닝', '딥러닝', '기계학습', '데이터 분석', '데이터사이언스'] },
  { questionId: 'nlp_llm_experience', keywords: ['자연어처리', 'NLP', 'LLM', '챗봇', 'GPT'] },
  { questionId: 'semiconductor_process_understanding', keywords: ['반도체', '웨이퍼', '팹', '공정'] },
  { questionId: 'cleanroom_attitude', keywords: ['클린룸', '방진복'] },
  { questionId: 'internship_experience', keywords: ['인턴십', '인턴'] },
  { questionId: 'part_time_job', keywords: ['아르바이트'] },
  { questionId: 'graduation_research_topic', keywords: ['졸업논문', '졸업연구', '졸업작품'] },
  { questionId: 'side_project_experience', keywords: ['사이드 프로젝트', '개인 프로젝트', '토이 프로젝트'] },
  { questionId: 'database_experience', keywords: ['데이터베이스', 'SQL', 'DB 설계'] },
  { questionId: 'cloud_experience', keywords: ['클라우드', 'AWS', 'GCP', 'Azure'] },
  { questionId: 'docker_experience', keywords: ['도커', 'Docker', '컨테이너'] },
  { questionId: 'ci_cd_experience', keywords: ['CI/CD', '지속적 통합', '배포 자동화'] },
  { questionId: 'git_conflict_resolution', keywords: ['Git', '깃', '형상관리'] },
  { questionId: 'api_design_experience', keywords: ['API', 'REST', 'RESTful'] },
  { questionId: 'test_automation_experience', keywords: ['테스트 자동화', 'QA', '단위 테스트'] },
  { questionId: 'failure_in_development', keywords: ['실패', '버그', '장애'] },
  { questionId: 'mentoring_experience', keywords: ['멘토링', '과외', '튜터링'] },
  { questionId: 'certification_motivation', keywords: ['자격증', '정보처리기사', '인증시험'] },
  { questionId: 'japanese_learning_method', keywords: ['JLPT', '일본어 공부', '일본어 학습'] },
  {
    questionId: 'preferred_language_reason',
    keywords: ['Python', '파이썬', 'Java', '자바', 'JavaScript', '자바스크립트', 'TypeScript', 'C++', 'Go언어'],
  },
]

// 대소문자 구분 없이 부분 문자열 포함 여부만 검사한다(AI 없이, follow_ups.txt와 같은 방식).
// 매칭된 question id를 사전에 나열한 순서 그대로, 중복 없이 반환한다.
export function matchResumeKeywords(resumeText: string): string[] {
  const normalized = resumeText.toLowerCase()
  const matched: string[] = []
  for (const entry of RESUME_KEYWORD_MAP) {
    if (entry.keywords.some((k) => normalized.includes(k.toLowerCase()))) {
      matched.push(entry.questionId)
    }
  }
  return matched
}

// 세션 시작 시 이미 무작위로 뽑아둔 pool에, 이력서 키워드로 매칭된 질문을 끼워 넣는다.
// poolSize(개수)는 그대로 유지해야 하므로, 매칭된 질문 수만큼 pool 뒤쪽에서 밀어내고
// 앞쪽(자기소개 바로 다음)에 매칭된 질문을 넣는다. 이미 pool에 있거나, group이 같은
// 질문이 이미 pool에 있으면(예: 스트레스 해소법 두 버전 중 하나가 이미 뽑혀 있음) 건너뛴다.
export function applyResumePriority(pool: BankQuestion[], priorityIds: string[]): BankQuestion[] {
  if (priorityIds.length === 0) return pool
  const existingIds = new Set(pool.map((q) => q.id))
  const existingGroups = new Set(pool.map((q) => q.group ?? q.id))
  const toInsert: BankQuestion[] = []
  for (const id of priorityIds) {
    if (existingIds.has(id)) continue
    const q = getQuestionById(id)
    if (!q) continue
    const groupKey = q.group ?? q.id
    if (existingGroups.has(groupKey)) continue
    toInsert.push(q)
    existingGroups.add(groupKey)
  }
  if (toInsert.length === 0) return pool
  const kept = pool.slice(0, Math.max(0, pool.length - toInsert.length))
  return [...toInsert, ...kept]
}
