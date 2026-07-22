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

// Hasta que resuelve la primera carga no sabemos si algo está vacío. Sin esto,
// las vistas afirman "no hay citas" mientras aún están pidiendo los datos, que
// con red lenta se ve como si el panel estuviera vacío.
export function LoadingLine({ children = 'Cargando…' }: { children?: ReactNode }) {
  return <p className="quiet-empty" aria-live="polite">{children}</p>
}

export function formatDateTime(value: string, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('es-ES', options || { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}
