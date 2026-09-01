'use client'

import { usePathname } from 'next/navigation'

const COLUMN_COUNT = 26

export default function MatrixBackground() {
  const pathname = usePathname()

  // 면접 연습이 진행되는 화면에서는 시선을 분산시키지 않도록 배경을 숨긴다.
  if (pathname?.startsWith('/interview/run')) return null

  return (
    <div className="matrix-bg" aria-hidden="true">
      {Array.from({ length: COLUMN_COUNT }).map((_, i) => (
        <div
          key={i}
          className="matrix-column"
          style={{
            left: `${(i / COLUMN_COUNT) * 100}%`,
            animationDelay: `${-((i % 7) * 0.6 + 0.3)}s`,
            animationDuration: `${3 + (i % 5) * 0.5}s`,
          }}
        />
      ))}
    </div>
  )
}
