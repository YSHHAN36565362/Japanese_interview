// 공유 비밀번호 대신 "고유 번호" 하나로 어느 기기에서든 같은 계정(=같은 저장 기록)에
// 접근하게 한다. Supabase 이메일/비밀번호 인증을 그대로 쓰되, 사용자에게는 이메일이나
// 비밀번호 입력을 요구하지 않고 번호 하나만 받아서 이 파일에서 결정적으로 이메일/비밀번호를
// 만들어낸다. 진짜 이메일이 아니므로 발송되는 메일은 없다(Supabase 프로젝트의 이메일 인증
// 확인(Confirm email)이 꺼져 있어야 한다 — SETUP.md 참고).
//
// 주의: 번호 자체가 사실상의 비밀번호 역할을 한다. 번호를 알거나 추측하는 사람은 그 번호의
// 저장 기록을 보고 지울 수 있다(복구 수단 없음) — 소규모(약 20명) 개인 연습용 데모라는
// 전제하에 사용자가 이 트레이드오프를 감수하기로 한 설계다.

// 주의: .local/.test/.invalid/.example 같은 예약된(reserved) TLD는 Supabase(GoTrue)의
// 이메일 형식 검증에서 "Email address ... is invalid"로 거부될 수 있다(실제로 확인된 문제).
// 실제 메일이 오가지 않는 가짜 주소이기만 하면 되므로, 예약되지 않은 평범한 형식의 도메인을 쓴다.
const EMAIL_DOMAIN = 'voiceinterviewjp-users.com'

export function sanitizeIdNumber(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '')
}

export function idNumberToEmail(id: string): string {
  return `id-${id}@${EMAIL_DOMAIN}`
}

export function idNumberToPassword(id: string): string {
  return `vij-${id}-pw-2026`
}
