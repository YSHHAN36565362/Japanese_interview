import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

// Server Component / Route Handler 에서 사용하는 Supabase 클라이언트.
// Next.js 15+ 부터 cookies()가 비동기 API이므로 이 함수도 async로 호출해야 한다.
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch {
            // Server Component에서 호출되면 무시 (미들웨어가 세션을 갱신함)
          }
        },
        remove(name: string, options: any) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch {
            // Server Component에서 호출되면 무시
          }
        },
      },
    }
  )
}
