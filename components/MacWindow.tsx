import type { ReactNode } from 'react'

export default function MacWindow({ children }: { title?: string; children: ReactNode }) {
  return (
    <div className="panel-card">
      <div className="panel-card-body">{children}</div>
    </div>
  )
}
