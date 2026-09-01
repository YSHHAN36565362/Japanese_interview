// 서버(Vercel)가 UTC로 동작해도 항상 한국(서울) 시간 기준으로 표시한다.
export function formatKST(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
}
