import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseResumeDocx, ResumeTemplateError } from '@/lib/resume/docxParser'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) {
    return NextResponse.json({ error: 'unauthorized', message: '로그인이 필요합니다.' }, { status: 401 })
  }

  const formData = await req.formData()
  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'invalid_template', message: '파일을 찾을 수 없습니다.' }, { status: 422 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  let parsed
  try {
    parsed = await parseResumeDocx(buffer)
  } catch (e) {
    if (e instanceof ResumeTemplateError) {
      return NextResponse.json(
        { error: 'invalid_template', message: e.message, missingSections: e.missingSections },
        { status: 422 }
      )
    }
    return NextResponse.json(
      { error: 'invalid_template', message: '이력서 파일을 처리하는 중 오류가 발생했습니다.' },
      { status: 422 }
    )
  }

  // 게스트(익명 로그인)는 Supabase에 아무것도 쓰지 않는다 — 클라이언트가 sessionStorage에만 보관한다.
  if (userData.user.is_anonymous !== true) {
    const { error: upsertError } = await supabase.from('user_resumes').upsert(
      {
        user_id: userData.user.id,
        parsed_data: parsed,
        source_filename: file.name,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
    if (upsertError) {
      return NextResponse.json({ error: 'save_failed', message: upsertError.message }, { status: 500 })
    }
  }

  return NextResponse.json({ parsed })
}
