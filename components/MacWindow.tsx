import type { ReactNode } from 'react'

export default function MacWindow({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="mac-window">
      <div className="mac-window-titlebar">
        <span className="mac-dot red" />
        <span className="mac-dot yellow" />
        <span className="mac-dot green" />
        {title && <span className="mac-window-tabtitle">{title}</span>}
      </div>
      <div className="mac-window-toolbar">
        <span className="mac-nav-arrow">‹</span>
        <span className="mac-nav-arrow">›</span>
        <span className="mac-urlbar">{title ?? 'voice-interview-jp.app'}</span>
      </div>
      <div className="mac-window-body">{children}</div>
    </div>
  )
}
