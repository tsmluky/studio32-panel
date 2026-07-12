import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { agentApi } from '../api'
import { supabase } from '../supabase'
import type { Organization, Summary } from '../types'
import { formatDateTime, RealtimeStatus, ViewError, ViewHeader } from './shared'

function madridDay() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  return { from: new Date(`${parts}T00:00:00+02:00`).toISOString(), to: new Date(`${parts}T23:59:59+02:00`).toISOString() }
}

export function OverviewView({ session, organization }: { session: Session; organization: Organization }) {
  const [data, setData] = useState<Summary | null>(null)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    try { const range = madridDay(); setData(await agentApi.summary(session, organization.id, range.from, range.to)); setError('') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo cargar el resumen.') }
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
    <ViewHeader eyebrow={organization.name} title="Resumen operativo" description="Lo que requiere atención hoy, sin ruido." action={<RealtimeStatus />} />
    {error && <ViewError>{error}</ViewError>}
    <div className="metric-grid">
      <article><span>Conversaciones abiertas</span><strong>{metrics?.open_conversations ?? '—'}</strong><small>Atención en curso</small></article>
      <article><span>En control humano</span><strong>{metrics?.human_conversations ?? '—'}</strong><small>Responde el equipo</small></article>
      <article><span>Citas de hoy</span><strong>{metrics?.appointments_today ?? '—'}</strong><small>Sin canceladas</small></article>
      <article><span>Atención requerida</span><strong>{metrics?.pending_handoffs ?? '—'}</strong><small>Handoffs pendientes</small></article>
    </div>
    <div className="overview-grid">
      <article className="workspace-card"><div className="card-heading"><div><span className="eyebrow">Agenda</span><h2>Próximas citas</h2></div></div>
        <div className="compact-list">{data?.next_appointments.length ? data.next_appointments.map(item => <div key={item.id} className="compact-row"><time>{formatDateTime(item.starts_at, { hour: '2-digit', minute: '2-digit' })}</time><span><strong>{item.contact?.name || item.contact?.phone || 'Paciente'}</strong><small>{item.service?.name || 'Cita'}{item.resource_name ? ` · ${item.resource_name}` : ''}</small></span><b className={`status-pill ${item.status}`}>{item.status}</b></div>) : <p className="quiet-empty">No hay próximas citas registradas.</p>}</div>
      </article>
      <article className="workspace-card focus-card"><span className="eyebrow">Sistema</span><h2>Recepción bajo control</h2><p>Las conversaciones, citas y cambios de conocimiento quedan asociados a {organization.name} y aislados mediante RLS.</p><div className="system-line"><i />Agente y panel conectados</div></article>
    </div>
  </section>
}
