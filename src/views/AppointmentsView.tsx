import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { agentApi } from '../api'
import { supabase } from '../supabase'
import type { Appointment, Organization } from '../types'
import { formatDateTime, RealtimeStatus, ViewError, ViewHeader } from './shared'

export function AppointmentsView({ session, organization }: { session: Session; organization: Organization }) {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState('')
  const [busy, setBusy] = useState('')
  const load = useCallback(async () => {
    const from = new Date(); from.setHours(0, 0, 0, 0)
    const to = new Date(from); to.setDate(to.getDate() + 31)
    try { setAppointments((await agentApi.appointments(session, organization.id, from.toISOString(), to.toISOString())).appointments); setError('') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo cargar la agenda.') }
  }, [session, organization.id])
  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const channel = supabase.channel(`appointments:${organization.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: `organization_id=eq.${organization.id}` }, load).subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [organization.id, load])

  async function cancel(appointment: Appointment) {
    if (confirming !== appointment.id) { setConfirming(appointment.id); return }
    setBusy(appointment.id)
    try { await agentApi.cancelAppointment(session, appointment.id); setConfirming(''); await load() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo cancelar la cita.') }
    finally { setBusy('') }
  }

  const canWrite = organization.role !== 'viewer'
  return <section className="workspace">
    <ViewHeader eyebrow={organization.name} title="Citas" description="Agenda operativa de los próximos 30 días." action={<RealtimeStatus />} />
    {error && <ViewError>{error}</ViewError>}
    <article className="workspace-card table-card">
      <div className="appointment-table"><div className="table-head"><span>Fecha y hora</span><span>Paciente</span><span>Servicio</span><span>Estado</span><span /></div>
        {appointments.map(item => <div className="appointment-row" key={item.id}>
          <time><strong>{formatDateTime(item.starts_at, { weekday: 'short', day: '2-digit', month: 'short' })}</strong><small>{formatDateTime(item.starts_at, { hour: '2-digit', minute: '2-digit' })}–{formatDateTime(item.ends_at, { hour: '2-digit', minute: '2-digit' })}</small></time>
          <span><strong>{item.contact?.name || 'Paciente'}</strong><small>{item.contact?.phone || item.contact?.email || 'Sin contacto'}</small></span>
          <span><strong>{item.service?.name || 'Cita'}</strong><small>{item.resource_name || 'Equipo de clínica'}</small></span>
          <span><b className={`status-pill ${item.status}`}>{item.status}</b><small>{item.external_calendar_event_id ? 'Calendar conectado' : 'Agenda interna'}</small></span>
          {canWrite && <button className={confirming === item.id ? 'danger-action confirm' : 'danger-action'} disabled={item.status === 'cancelled' || busy === item.id} onClick={() => cancel(item)}>{confirming === item.id ? 'Confirmar' : item.status === 'cancelled' ? 'Cancelada' : 'Cancelar'}</button>}
        </div>)}
        {!appointments.length && <p className="quiet-empty">No hay citas en este periodo.</p>}
      </div>
    </article>
  </section>
}
