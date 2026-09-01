// 역질문 모드는 별도 모드로 두지 않는다 — 실전 모드 마지막에 항상 역질문이 자동으로 붙는다
// (useInterviewMachine.ts 참고).
export const MODE_TO_CATEGORY: Record<string, string[]> = {
  practice: ['personality', 'technical', 'culture_fit'],
  real: ['personality', 'technical', 'culture_fit'],
  technical: ['technical'],
}

export const MODE_LABEL: Record<string, string> = {
  practice: '연습 모드',
  real: '실전 모드',
  technical: '기술 면접',
}

// 상태별로 화면에 보여줄 문구. 색상만으로 상태를 전달하지 않기 위해 항상 텍스트를 함께 노출한다.
export const PHASE_STATUS_TEXT: Record<string, string> = {
  preflight: '입장 준비 중입니다.',
  questionReady: '질문을 확인하고 마이크를 눌러 답변을 시작하세요.',
  interviewerSpeaking: '면접관이 질문을 읽고 있습니다.',
  listening: '답변을 듣고 있습니다. 말한 내용은 화면에 표시됩니다.',
  answerReview: '전사 내용을 확인하고 필요하면 고친 뒤 확정하세요.',
  followUpReady: '꼬리 질문이 이어집니다.',
  saving: '답변을 저장하고 있습니다...',
  completed: '면접이 종료되었습니다.',
  fallbackText: '텍스트 모드로 답변을 입력해주세요.',
}

export const AUX_TABS = ['transcript', 'star', 'notes'] as const
export type AuxTab = (typeof AUX_TABS)[number]

export const AUX_TAB_LABEL: Record<AuxTab, string> = {
  transcript: '대화',
  star: 'STAR',
  notes: '메모',
}
