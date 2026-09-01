import type { BankQuestion } from '@/lib/questionBank'
import type { FeedbackResult } from '@/lib/feedback'

// zoom_style_frontend_implementation_guide.md §6 을 그대로 따르는 면접 진행 상태 머신.
export type InterviewPhase =
  | 'preflight' // 장치 확인, 개인정보 안내, 모드 선택
  | 'questionReady' // 질문 표시, 재생 전
  | 'interviewerSpeaking'
  | 'listening' // 사용자의 답변 수집 중
  | 'answerReview' // 전사 편집 및 다음 질문 확인
  | 'followUpReady'
  | 'saving'
  | 'completed'
  | 'fallbackText'

export type InterviewEvent =
  | { type: 'START_SESSION' }
  | { type: 'ENTER_FALLBACK_TEXT' }
  | { type: 'TTS_STARTED' }
  | { type: 'TTS_ENDED' }
  | { type: 'MIC_STARTED' }
  | { type: 'MIC_STOPPED' }
  | { type: 'SET_INTERIM'; text: string }
  | { type: 'SET_DRAFT'; text: string }
  | { type: 'ANSWER_CONFIRMED' }
  | { type: 'FOLLOW_UP_READY'; question: BankQuestion }
  | { type: 'FOLLOW_UP_STARTED' }
  | { type: 'SAVE_STARTED' }
  | { type: 'SAVE_FINISHED'; hasNext: boolean; nextQuestion?: BankQuestion }
  | { type: 'DEVICE_UNAVAILABLE' }
  | { type: 'END_SESSION' }

export interface QueueItem {
  question: BankQuestion
  isFollowUp: boolean
}

export interface LastFeedback {
  questionTextJa: string
  analysis: FeedbackResult
}
