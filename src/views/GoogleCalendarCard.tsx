import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { agentApi } from '../api'
import type { GoogleReturn } from '../googleReturn'
import type { GoogleCalendarOption, GoogleCalendarStatus, Organization } from '../types'

// Conexión con Google Calendar, dentro de Citas.
//
// La clínica conecta su propia cuenta con un botón; a partir de ahí la agenda del
// dashboard y la del asistente son su Google Calendar. Solo el dueño o un admin
// conecta, cambia de calendario o desconecta; el resto del equipo ve el estado.

export function GoogleCalendarCard({ session, organization, notice, onChange }: {
  session: Session
  organization: Organization
  notice: GoogleReturn | null
  onChange: () => void
}) {
  const [status, setStatus] = useState<GoogleCalendarStatus | null>(null)
  const [calendars, setCalendars] = useState<GoogleCalendarOption[] | null>(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)

  const load = useCallback(async () => {
    try { setStatus(await agentApi.googleCalendar(session, organization.id)); setError('') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo consultar la conexión con Google Calendar.') }
  }, [session, organization.id])
  useEffect(() => { void load() }, [load])

  async function connect() {
    setBusy('connect')
    try { window.location.assign((await agentApi.connectGoogleCalendar(session, organization.id)).url) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo iniciar la conexión.'); setBusy('') }
  }

  async function showCalendars() {
    setBusy('calendars')
    try { setCalendars((await agentApi.googleCalendars(session, organization.id)).calendars); setError('') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudieron cargar tus calendarios.') }
    finally { setBusy('') }
  }

  async function selectCalendar(calendarId: string) {
    setBusy('select')
    try {
      const { connection } = await agentApi.selectGoogleCalendar(session, organization.id, calendarId)
      setStatus(current => current ? { ...current, connection } : current)
      setCalendars(null)
      onChange()
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo cambiar el calendario.') }
    finally { setBusy('') }
  }

  async function disconnect() {
    if (!confirmDisconnect) { setConfirmDisconnect(true); return }
    setBusy('disconnect')
    try {
      await agentApi.disconnectGoogleCalendar(session, organization.id)
      setStatus(current => current ? { ...current, connection: null } : current)
      setConfirmDisconnect(false)
      onChange()
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo desconectar.') }
    finally { setBusy('') }
  }

  if (!status) return error ? <div className="gcal-card"><p className="gcal-error">{error}</p></div> : null
  // Demostraciones y negocios sin asistente: no hay nada que conectar.
  if (!status.supported && !status.connection) return null

  const connection = status.connection
  const needsReconnect = connection?.status === 'error'
  const connected = connection && !needsReconnect && connection.calendar_id

  return <section className={`gcal-card${connected ? ' is-connected' : ''}${needsReconnect ? ' needs-attention' : ''}`} aria-label="Google Calendar">
    {notice && <p className={`gcal-notice ${notice.tone}`} role="status">{notice.message}</p>}

    <div className="gcal-main">
      <span className="gcal-mark" aria-hidden="true">G</span>
      <div className="gcal-text">
        {connected ? <>
          <strong>Conectado con Google Calendar</strong>
          <small>{connection.google_email} · calendario «{connection.calendar_name || connection.calendar_id}»</small>
        </> : needsReconnect ? <>
          <strong>Google Calendar necesita reconectarse</strong>
          <small>Google ya no acepta el acceso, así que el asistente no puede ver ni apuntar citas. Vuelve a conectar para seguir.</small>
        </> : <>
          <strong>Conecta tu Google Calendar</strong>
          <small>Las citas del asistente entrarán en tu calendario, y lo que apuntes en el móvil aparecerá aquí. Una sola agenda.</small>
        </>}
      </div>

      {status.can_manage && <div className="gcal-actions">
        {!connected && <button type="button" className="gcal-primary" disabled={!status.available || busy === 'connect'} onClick={connect}>
          {busy === 'connect' ? 'Abriendo Google…' : needsReconnect ? 'Reconectar' : 'Conectar Google Calendar'}
        </button>}
        {connected && <>
          <button type="button" className="gcal-secondary" disabled={busy === 'calendars'} onClick={showCalendars}>{busy === 'calendars' ? 'Cargando…' : 'Cambiar calendario'}</button>
          <button type="button" className={confirmDisconnect ? 'danger-action confirm' : 'danger-action'} disabled={busy === 'disconnect'} onClick={disconnect}>{confirmDisconnect ? 'Confirmar desconexión' : 'Desconectar'}</button>
        </>}
      </div>}
    </div>

    {!status.available && status.can_manage && !connected && <p className="gcal-hint">La conexión con Google todavía no está activada para tu negocio. Escríbenos y la dejamos lista.</p>}
    {!status.can_manage && !connected && <p className="gcal-hint">Pide al responsable del negocio que conecte Google Calendar desde su cuenta.</p>}
    {confirmDisconnect && <p className="gcal-hint">Al desconectar, el asistente deja de ver y apuntar citas en tu calendario. Las citas que ya están en Google no se borran.</p>}

    {calendars && <div className="gcal-picker">
      <span className="eyebrow">Tus calendarios</span>
      {calendars.map(item => <button type="button" key={item.id} className={item.id === connection?.calendar_id ? 'is-current' : ''} disabled={busy === 'select'} onClick={() => selectCalendar(item.id)}>
        <strong>{item.summary}</strong><small>{item.primary ? 'Principal' : item.id === connection?.calendar_id ? 'En uso' : ''}</small>
      </button>)}
      {!calendars.length && <p className="gcal-hint">Esta cuenta no tiene calendarios propios.</p>}
    </div>}

    {error && <p className="gcal-error" role="alert">{error}</p>}
  </section>
}
