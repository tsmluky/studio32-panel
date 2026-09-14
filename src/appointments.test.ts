import { describe, expect, it } from 'vitest'
import { appointmentDetail, appointmentOrigin, appointmentStatusLabel, appointmentTime, appointmentTitle, canCancelFromPanel } from './appointments'
import type { Appointment } from './types'

const base: Appointment = {
  id: 'row-1',
  contact_id: 'c1',
  conversation_id: null,
  service_id: 's1',
  status: 'confirmed',
  starts_at: '2026-09-17T09:30:00.000Z',
  ends_at: '2026-09-17T10:00:00.000Z',
  resource_name: null,
  notes: null,
  metadata: {},
  external_calendar_event_id: 'ev-1',
  contact: { id: 'c1', name: 'Marta', phone: '+34600111111', email: null, status: 'customer', last_seen_at: '' },
  service: { id: 's1', name: 'Revisión', duration_minutes: 30, price_amount: null, currency: 'EUR' },
  source: 'agent',
  title: null,
  all_day: false,
}

const fromPhone: Appointment = { ...base, id: 'gcal:ev-2', contact: null, service: null, contact_id: null, source: 'calendar', title: 'Paciente llamó por teléfono' }
const hour = (value: string) => value.slice(11, 16)

describe('cómo se enseña una cita', () => {
  it('la del asistente lleva el paciente y el servicio', () => {
    expect(appointmentTitle(base)).toBe('Marta')
    expect(appointmentDetail(base)).toBe('Revisión · +34600111111')
    expect(appointmentOrigin(base)?.label).toBe('Reservada por el asistente')
  })

  it('la apuntada en el móvil lleva el título de Google y no se cancela desde el panel', () => {
    expect(appointmentTitle(fromPhone)).toBe('Paciente llamó por teléfono')
    expect(appointmentDetail(fromPhone)).toBe('Apuntada en Google Calendar')
    expect(canCancelFromPanel(fromPhone)).toBe(false)
    expect(canCancelFromPanel(base)).toBe(true)
  })

  it('lo que no está en Google se avisa', () => {
    expect(appointmentOrigin({ ...base, source: 'panel_only' })).toEqual({ label: 'No está en Google Calendar', tone: 'warning' })
  })

  it('el estado sale en español y los días completos no enseñan hora', () => {
    expect(appointmentStatusLabel({ status: 'no_show' })).toBe('No acudió')
    expect(appointmentTime({ ...base, all_day: true }, hour)).toBe('Todo el día')
    expect(appointmentTime(base, hour)).toBe('09:30–10:00')
  })
})
