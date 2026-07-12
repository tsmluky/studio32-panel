// Iconos SVG del panel (stroke, currentColor). Sustituyen a los glifos unicode
// que renderizaban distinto en cada sistema. 24x24, se escalan con `size`.

import type { ReactElement } from 'react'

export type IconName =
  | 'overview' | 'inbox' | 'appointments' | 'services' | 'agent'
  | 'refresh' | 'send' | 'check' | 'signout' | 'back'

const paths: Record<IconName, ReactElement> = {
  overview: <>
    <rect x="3" y="3" width="7" height="8.5" rx="1.6" />
    <rect x="14" y="3" width="7" height="5" rx="1.6" />
    <rect x="14" y="12.5" width="7" height="8.5" rx="1.6" />
    <rect x="3" y="16" width="7" height="5" rx="1.6" />
  </>,
  inbox: <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 1 1 21 11.5z" />,
  appointments: <>
    <rect x="3" y="4.5" width="18" height="16.5" rx="2.2" />
    <path d="M16 2.5v4M8 2.5v4M3 9.5h18" />
  </>,
  services: <>
    <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0l-7-7A2 2 0 0 1 3 12V5.2A2.2 2.2 0 0 1 5.2 3H12a2 2 0 0 1 1.4.6l7.2 7.2a2 2 0 0 1 0 2.6z" />
    <circle cx="7.7" cy="7.7" r="1.3" />
  </>,
  agent: <path d="M12 2.5l1.9 5.6a2 2 0 0 0 1.3 1.3L20.8 11l-5.6 1.9a2 2 0 0 0-1.3 1.3L12 19.8l-1.9-5.6a2 2 0 0 0-1.3-1.3L3.2 11l5.6-1.9a2 2 0 0 0 1.3-1.3L12 2.5z" />,
  refresh: <>
    <path d="M21 12a9 9 0 1 1-2.64-6.36" />
    <path d="M21 3.5V9h-5.5" />
  </>,
  send: <>
    <path d="M22 2 11 13" />
    <path d="M22 2 15 22l-4-9-9-4 20-7z" />
  </>,
  check: <path d="M20 6.5 9.5 17 4 11.5" />,
  signout: <>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="M16 17l5-5-5-5M21 12H9" />
  </>,
  back: <path d="M15 18.5 8.5 12 15 5.5" />,
}

export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true" focusable="false">{paths[name]}</svg>
}
