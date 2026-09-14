import type { Appointment } from './types'

// Cómo se enseña una cita a la clínica. La agenda viene de Google Calendar a través
// del agente (ver studio32-agent/src/agenda.js), y cada cita puede tener tres
// orígenes; aquí se decide qué texto ve la clínica en cada caso, en un solo sitio
// para que el calendario, la lista y el resumen digan lo mismo.

const STATUS_LABELS: Record<Appointment['status'], string> = {
  confirmed: 'Confirmada',
  pending: 'Pendiente',
  cancelled: 'Cancelada',
  completed: 'Realizada',
  no_show: 'No acudió',
}

export function appointmentStatusLabel(item: Pick<Appointment, 'status'>) {
  return STATUS_LABELS[item.status] ?? item.status
}

// Nombre principal: el paciente si la reservó el agente; el título del evento si la
// apuntó la clínica en su calendario.
export function appointmentTitle(item: Appointment) {
  if (item.source === 'calendar') return item.title || 'Sin título'
  return item.contact?.name || item.contact?.phone || 'Paciente'
}

// Línea secundaria: servicio y contacto, o de dónde sale.
export function appointmentDetail(item: Appointment) {
  if (item.source === 'calendar') return 'Apuntada en Google Calendar'
  const contact = item.contact?.phone || item.contact?.email
  return [item.service?.name || 'Cita', contact].filter(Boolean).join(' · ')
}

// Aviso de origen, solo cuando aporta algo. "Solo en el panel" significa que esa cita
// no está en la agenda real de la clínica: se enseña para que el desajuste se vea.
export function appointmentOrigin(item: Appointment): { label: string; tone: 'quiet' | 'warning' } | null {
  if (item.source === 'panel_only') return { label: 'No está en Google Calendar', tone: 'warning' }
  if (item.source === 'agent') return { label: 'Reservada por el asistente', tone: 'quiet' }
  return null
}

export function appointmentTime(item: Appointment, format: (value: string, options: Intl.DateTimeFormatOptions) => string) {
  if (item.all_day) return 'Todo el día'
  const hour: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' }
  return `${format(item.starts_at, hour)}–${format(item.ends_at, hour)}`
}

// Las que la clínica apuntó en su calendario se cambian allí: el panel no borra
// eventos propios del dueño.
export function canCancelFromPanel(item: Appointment) {
  return item.source !== 'calendar' && item.status !== 'cancelled'
}
