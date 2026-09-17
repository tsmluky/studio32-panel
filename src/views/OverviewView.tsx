import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { agentApi } from '../api'
import { appointmentStatusLabel, appointmentTitle } from '../appointments'
import { supabase } from '../supabase'
import type { Organization, Summary } from '../types'
import { formatDateTime, LoadingLine, RealtimeStatus, ViewError, ViewHeader } from './shared'

// Offset real de Europe/Madrid para una fecha dada (+02:00 en verano CEST,
// +01:00 en invierno CET). Evita hardcodear el offset, que descuadraría la
// ventana "hoy" medio año y contaría mal las citas cerca de medianoche.
function madridOffset(date: Date) {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Madrid', timeZoneName: 'longOffset' })
    .formatToParts(date).find(part => part.type === 'timeZoneName')?.value || 'GMT+00:00'
  const match = name.match(/GMT([+-]\d{2}):?(\d{2})?/)
  return match ? `${match[1]}:${match[2] || '00'}` : '+00:00'
}

function madridDay() {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
  const offset = madridOffset(now)
  return { from: new Date(`${parts}T00:00:00${offset}`).toISOString(), to: new Date(`${parts}T23:59:59${offset}`).toISOString() }
}

function madridDateKey(value: string | number | Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value))
}

function dayLabel(value: string) {
  const target = madridDateKey(value)
  const today = madridDateKey(Date.now())
  const tomorrow = madridDateKey(Date.now() + 86_400_000)
  if (target === today) return 'Hoy'
  if (target === tomorrow) return 'Mañana'
  return new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', weekday: 'short', day: '2-digit', month: 'short' }).format(new Date(value))
}

export function OverviewView({ session, organization }: { session: Session; organization: Organization }) {
  const [data, setData] = useState<Summary | null>(null)
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)
  const load = useCallback(async () => {
    try { const range = madridDay(); setData(await agentApi.summary(session, organization.id, range.from, range.to)); setError('') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo cargar el resumen.') }
    finally { setLoaded(true) }
  }, [session, organization.id])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const channel = supabase.channel(`summary:${organization.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations', filter: `organization_id=eq.${organization.id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: `organization_id=eq.${organization.id}` }, load)
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [organization.id, load])

  const metrics = data?.metrics
  return <section className="workspace">
    <ViewHeader eyebrow={organization.name} title="Resumen" description="Lo que requiere atención hoy, sin ruido." action={<RealtimeStatus />} />
    {error && <ViewError>{error}</ViewError>}
    <div className="metric-grid">
      <article><span>Conversaciones abiertas</span><strong>{metrics?.open_conversations ?? '—'}</strong><small>Atención en curso</small></article>
      <article className={metrics?.human_conversations ? 'tone-amber' : 'tone-quiet'}><span>En control humano</span><strong>{metrics?.human_conversations ?? '—'}</strong><small>Responde el equipo</small></article>
      <article className="tone-blue"><span>Citas de hoy</span><strong>{metrics?.appointments_today ?? '—'}</strong><small>Sin canceladas</small></article>
      <article className={metrics?.pending_handoffs ? 'tone-rose' : 'tone-quiet'}><span>Atención requerida</span><strong>{metrics?.pending_handoffs ?? '—'}</strong><small>{metrics?.pending_handoffs ? 'A la espera de una persona' : 'Nada pendiente'}</small></article>
    </div>
    <div className="overview-grid">
      <article className="workspace-card"><div className="card-heading"><div><span className="eyebrow">Agenda</span><h2>Próximas citas</h2></div></div>
        <div className="compact-list">{data?.next_appointments.length ? data.next_appointments.map(item => <div key={item.id} className="compact-row"><time className="compact-when"><small>{dayLabel(item.starts_at)}</small><strong>{formatDateTime(item.starts_at, { hour: '2-digit', minute: '2-digit' })}</strong></time><span><strong>{appointmentTitle(item)}</strong><small>{item.source === 'calendar' ? 'Apuntada en Google Calendar' : `${item.service?.name || 'Cita'}${item.resource_name ? ` · ${item.resource_name}` : ''}`}</small></span><b className={`status-pill ${item.status}`}>{appointmentStatusLabel(item)}</b></div>) : loaded ? <p className="quiet-empty">No hay próximas citas registradas.</p> : <LoadingLine />}</div>
      </article>
      <article className="workspace-card focus-card"><span className="eyebrow">Sistema</span><h2>Recepción bajo control</h2><p>Todo lo de {organization.name} —conversaciones, citas y lo que sabe tu asistente— está aislado: nadie fuera de tu equipo puede verlo.</p><div className="system-line"><i />Asistente y panel conectados</div></article>
    </div>
  </section>
}
