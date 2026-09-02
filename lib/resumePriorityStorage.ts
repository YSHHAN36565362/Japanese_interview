// ResumeInputStep(app/interview/page.tsx)이 세션 생성 직전에 매칭된 질문 id 목록을 여기에
// 잠깐 저장해두면, useInterviewMachine.ts가 세션 시작 시 한 번 읽어서 소비하고 지운다.
// sessionId가 생기기 전 시점(트랙 선택 직후)에 저장해야 해서 세션별 키가 아니라 고정 키를
// 쓴다 — 탭 하나에서 세션은 한 번에 하나만 시작되므로 충돌 걱정은 없다.
export const RESUME_PRIORITY_STORAGE_KEY = 'mensetsu:pendingResumePriorityIds'
