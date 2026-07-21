import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { agentApi } from '../api'
import { supabase } from '../supabase'
import type { Appointment, Organization } from '../types'
import { formatDateTime, RealtimeStatus, ViewError, ViewHeader } from './shared'

const MADRID_TZ = 'Europe/Madrid'

// Clave de día (YYYY-MM-DD) en la zona del negocio, para agrupar citas por día
// sin que el desfase UTC/Madrid las mueva de casilla.
function madridDateKey(value: string | number | Date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: MADRID_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value))
}

function shiftMonth(monthKey: string, amount: number) {
  const [year, month] = monthKey.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1 + amount, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function monthLabel(monthKey: string) {
  const formatted = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric', timeZone: MADRID_TZ }).format(new Date(`${monthKey}-15T12:00:00`))
  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

// Rejilla de 42 días (6 semanas) empezando en lunes, como en el Hub.
function calendarMonthDays(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number)
  const first = new Date(Date.UTC(year, month - 1, 1))
  const mondayOffset = (first.getUTCDay() + 6) % 7
  const start = new Date(first)
  start.setUTCDate(start.getUTCDate() - mondayOffset)
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start)
    date.setUTCDate(start.getUTCDate() + index)
    return date.toISOString().slice(0, 10)
  })
}

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

// "martes, 21 de julio" -> "Martes, 21 de julio" (solo la inicial: capitalize de CSS
// pondría también "De" y "Julio", que en español es incorrecto).
function capitalizeFirst(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function appointmentLabel(item: Appointment) {
  const parts = [item.service?.name || 'Cita']
  if (item.contact?.name) parts.push(item.contact.name)
  return parts.join(' · ')
}

export function AppointmentsView({ session, organization }: { session: Session; organization: Organization }) {
  const [mode, setMode] = useState<'calendar' | 'list'>('calendar')
  const [month, setMonth] = useState(madridDateKey().slice(0, 7))
  const [selectedDate, setSelectedDate] = useState(madridDateKey())
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState('')
  const [busy, setBusy] = useState('')

  const days = useMemo(() => calendarMonthDays(month), [month])

  // Rango de carga: cubre la rejilla visible del mes Y los próximos ~31 días
  // (para que la Lista siga mostrando lo de hoy en adelante navegues el mes que navegues).
  const range = useMemo(() => {
    const now = Date.now()
    const gridStart = Date.parse(`${days[0]}T00:00:00.000Z`)
    const gridEnd = Date.parse(`${days[41]}T00:00:00.000Z`) + 2 * 86_400_000
    const from = new Date(Math.min(gridStart, now - 86_400_000)).toISOString()
    const to = new Date(Math.max(gridEnd, now + 32 * 86_400_000)).toISOString()
    return { from, to }
  }, [days])

  const load = useCallback(async () => {
    try { setAppointments((await agentApi.appointments(session, organization.id, range.from, range.to)).appointments); setError('') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo cargar la agenda.') }
  }, [session, organization.id, range.from, range.to])
  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const channel = supabase.channel(`appointments:${organization.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: `organization_id=eq.${organization.id}` }, load).subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [organization.id, load])

  const byDay = useMemo(() => {
    const map = new Map<string, Appointment[]>()
    for (const appointment of appointments) {
      const key = madridDateKey(appointment.starts_at)
      const list = map.get(key)
      if (list) list.push(appointment); else map.set(key, [appointment])
    }
    for (const list of map.values()) list.sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    return map
  }, [appointments])

  const upcoming = useMemo(() => {
    const from = new Date(); from.setHours(0, 0, 0, 0)
    const to = new Date(from); to.setDate(to.getDate() + 31)
    return appointments
      .filter(item => { const t = Date.parse(item.starts_at); return t >= from.getTime() && t <= to.getTime() })
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  }, [appointments])

  const today = madridDateKey()
  const selectedList = byDay.get(selectedDate) || []
  const canWrite = organization.role !== 'viewer'

  function changeMonth(amount: number) {
    const next = shiftMonth(month, amount)
    setMonth(next)
    setSelectedDate(`${next}-01`)
  }
  function goToday() {
    setMonth(today.slice(0, 7))
    setSelectedDate(today)
  }

  async function cancel(appointment: Appointment) {
    if (confirming !== appointment.id) { setConfirming(appointment.id); return }
    setBusy(appointment.id)
    try { await agentApi.cancelAppointment(session, appointment.id); setConfirming(''); await load() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo cancelar la cita.') }
    finally { setBusy('') }
  }

  return <section className="workspace">
    <ViewHeader eyebrow={organization.name} title="Citas" description="Agenda operativa de la clínica: calendario y próximas citas." action={<RealtimeStatus />} />
    {error && <ViewError>{error}</ViewError>}

    <div className="cal-modebar">
      <div className="cal-toggle" role="tablist" aria-label="Vista de la agenda">
        <button role="tab" aria-selected={mode === 'calendar'} className={mode === 'calendar' ? 'active' : ''} onClick={() => setMode('calendar')}>Calendario</button>
        <button role="tab" aria-selected={mode === 'list'} className={mode === 'list' ? 'active' : ''} onClick={() => setMode('list')}>Lista</button>
      </div>
    </div>

    {mode === 'calendar' ? <>
      <div className="cal-toolbar">
        <div className="cal-nav">
          <button type="button" className="cal-nav-btn" onClick={() => changeMonth(-1)} aria-label="Mes anterior">‹</button>
          <button type="button" className="cal-nav-btn" onClick={() => changeMonth(1)} aria-label="Mes siguiente">›</button>
          <button type="button" className="cal-today" onClick={goToday}>Hoy</button>
        </div>
        <h2 className="cal-month-label">{monthLabel(month)}</h2>
      </div>
      <div className="cal-layout">
        <section className="workspace-card cal-month" aria-label={monthLabel(month)}>
          <div className="cal-weekdays">{WEEKDAYS.map(day => <span key={day}>{day}</span>)}</div>
          <div className="cal-grid">
            {days.map(day => {
              const items = byDay.get(day) || []
              const classes = ['cal-cell']
              if (day.slice(0, 7) !== month) classes.push('is-outside')
              if (day === today) classes.push('is-today')
              if (day === selectedDate) classes.push('is-selected')
              const dayName = capitalizeFirst(new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: MADRID_TZ }).format(new Date(`${day}T12:00:00`)))
              const dayCount = items.length ? `, ${items.length} ${items.length === 1 ? 'cita' : 'citas'}` : ', sin citas'
              return <button key={day} type="button" className={classes.join(' ')} onClick={() => setSelectedDate(day)} aria-label={`${dayName}${dayCount}`} aria-pressed={day === selectedDate}>
                <strong>{Number(day.slice(-2))}</strong>
                <span className="cal-cell-items">
                  {items.slice(0, 3).map(item => <small key={item.id} className={`cal-chip ${item.status}`} title={`${formatDateTime(item.starts_at, { hour: '2-digit', minute: '2-digit' })} · ${appointmentLabel(item)}`}>{formatDateTime(item.starts_at, { hour: '2-digit', minute: '2-digit' })}</small>)}
                  {items.length > 3 && <small className="cal-more">+{items.length - 3}</small>}
                </span>
              </button>
            })}
          </div>
        </section>
        <aside className="workspace-card cal-day">
          <header className="cal-day-head">
            <span className="eyebrow">Día seleccionado</span>
            <strong>{capitalizeFirst(new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: MADRID_TZ }).format(new Date(`${selectedDate}T12:00:00`)))}</strong>
            <small>{selectedList.length ? `${selectedList.length} ${selectedList.length === 1 ? 'cita' : 'citas'}` : 'Sin citas'}</small>
          </header>
          <div className="cal-day-list">
            {selectedList.map(item => <article className="cal-day-item" key={item.id}>
              <time>{formatDateTime(item.starts_at, { hour: '2-digit', minute: '2-digit' })}–{formatDateTime(item.ends_at, { hour: '2-digit', minute: '2-digit' })}</time>
              <div className="cal-day-item-body">
                <strong>{item.contact?.name || 'Paciente'}</strong>
                <small>{item.service?.name || 'Cita'} · {item.contact?.phone || item.contact?.email || 'Sin contacto'}</small>
                <span className="cal-day-item-foot"><b className={`status-pill ${item.status}`}>{item.status}</b><small>{item.external_calendar_event_id ? 'Calendar conectado' : 'Agenda interna'}</small></span>
              </div>
              {canWrite && <button className={confirming === item.id ? 'danger-action confirm' : 'danger-action'} disabled={item.status === 'cancelled' || busy === item.id} onClick={() => cancel(item)}>{confirming === item.id ? 'Confirmar' : item.status === 'cancelled' ? 'Cancelada' : 'Cancelar'}</button>}
            </article>)}
            {!selectedList.length && <p className="quiet-empty">No hay citas este día.</p>}
          </div>
        </aside>
      </div>
    </> : <article className="workspace-card table-card">
      <div className="appointment-table"><div className="table-head"><span>Fecha y hora</span><span>Paciente</span><span>Servicio</span><span>Estado</span><span /></div>
        {upcoming.map(item => <div className="appointment-row" key={item.id}>
          <time><strong>{formatDateTime(item.starts_at, { weekday: 'short', day: '2-digit', month: 'short' })}</strong><small>{formatDateTime(item.starts_at, { hour: '2-digit', minute: '2-digit' })}–{formatDateTime(item.ends_at, { hour: '2-digit', minute: '2-digit' })}</small></time>
          <span><strong>{item.contact?.name || 'Paciente'}</strong><small>{item.contact?.phone || item.contact?.email || 'Sin contacto'}</small></span>
          <span><strong>{item.service?.name || 'Cita'}</strong><small>{item.resource_name || 'Equipo de clínica'}</small></span>
          <span><b className={`status-pill ${item.status}`}>{item.status}</b><small>{item.external_calendar_event_id ? 'Calendar conectado' : 'Agenda interna'}</small></span>
          {canWrite && <button className={confirming === item.id ? 'danger-action confirm' : 'danger-action'} disabled={item.status === 'cancelled' || busy === item.id} onClick={() => cancel(item)}>{confirming === item.id ? 'Confirmar' : item.status === 'cancelled' ? 'Cancelada' : 'Cancelar'}</button>}
        </div>)}
        {!upcoming.length && <p className="quiet-empty">No hay citas en los próximos 30 días.</p>}
      </div>
    </article>}
  </section>
}
