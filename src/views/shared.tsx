import type { ReactNode } from 'react'

export function ViewHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <header className="workspace-header">
    <div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>
    {action}
  </header>
}

export function ViewError({ children }: { children: ReactNode }) {
  return <div className="workspace-error" role="alert">{children}</div>
}

export function RealtimeStatus() {
  return <span className="live-status"><i />En directo</span>
}

export function formatDateTime(value: string, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('es-ES', options || { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}
