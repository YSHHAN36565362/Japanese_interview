'use client'

import { useEffect, useState } from 'react'

const THEME_STORAGE_KEY = 'theme'

// layout.tsx의 인라인 스크립트가 페인트 전에 <html data-theme>를 이미 정해두므로, 마운트
// 시점에 그 값을 그대로 읽어와 스위치 위치만 맞춘다(서버 렌더링 결과와 다를 수 있어 useEffect에서 동기화).
export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    setIsDark(document.documentElement.getAttribute('data-theme') === 'dark')
  }, [])

  function toggle() {
    const next = isDark ? 'light' : 'dark'
    setIsDark(!isDark)
    document.documentElement.setAttribute('data-theme', next)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // localStorage를 못 쓰는 환경이면 조용히 무시 — 이번 방문에서만 토글이 안 남을 뿐
    }
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      className={`theme-toggle-switch${isDark ? ' is-on' : ''}`}
      onClick={toggle}
      aria-label={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
      title={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
    >
      <span className="theme-toggle-track">
        <span className="theme-toggle-thumb" aria-hidden="true" />
      </span>
    </button>
  )
}
