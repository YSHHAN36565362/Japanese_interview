// 규칙 기반 문법 교정 엔진. 실제 계산은 lib/grammarCheck.ts에 있고, 여기서는
// features/interview 트리 안에서 evaluateAnswer.ts와 같은 방식으로 재노출한다.
export { checkGrammar, type GrammarCheckResult, type GrammarIssue, type GrammarIssueType, type GrammarIssueSeverity } from '@/lib/grammarCheck'
