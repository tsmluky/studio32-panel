import { Component, FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { agentApi, ApiError } from './api'
import { supabase } from './supabase'
import type { Conversation, CurrentUser, Message, Organization, Summary } from './types'
import { OverviewView } from './views/OverviewView'
import { AppointmentsView } from './views/AppointmentsView'
import { clearGoogleReturn, readGoogleReturn } from './googleReturn'
import { ServicesView } from './views/ServicesView'
import { AgentView } from './views/AgentView'
import { Icon } from './icons'

type Filter = 'active' | 'human' | 'resolved'
type Section = 'overview' | 'inbox' | 'appointments' | 'services' | 'agent'

function initials(value?: string | null) {
  return String(value || '?').split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()
}

function relativeTime(value?: string | null) {
  if (!value) return 'Sin actividad'
  const diff = Date.now() - new Date(value).getTime()
  if (diff < 60_000) return 'Ahora'
  if (diff < 3_600_000) return `Hace ${Math.floor(diff / 60_000)} min`
  if (diff < 86_400_000) return `Hace ${Math.floor(diff / 3_600_000)} h`
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short' }).format(new Date(value))
}

function loginErrorES(message: string) {
  const m = String(message || '').toLowerCase()
  if (m.includes('invalid login credentials')) return 'Email o contraseña incorrectos.'
  if (m.includes('email not confirmed')) return 'Tu email todavía no está confirmado.'
  if (m.includes('rate limit') || m.includes('too many')) return 'Demasiados intentos. Espera un momento e inténtalo de nuevo.'
  if (m.includes('failed to fetch') || m.includes('network')) return 'No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.'
  return 'No se pudo iniciar sesión. Inténtalo de nuevo.'
}

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const result = await supabase.auth.signInWithPassword({ email, password })
      if (result.error) setError(loginErrorES(result.error.message))
    } catch (cause) {
      setError(loginErrorES(cause instanceof Error ? cause.message : ''))
    } finally {
      setLoading(false)
    }
  }

  return <main className="login-shell">
    <section className="login-story">
      <div className="brand-lockup"><span className="brand-mark">32</span><span>Studio32</span></div>
      <div className="story-copy">
        <span className="eyebrow">Agent Platform</span>
        <h1>Recepción digital,<br />bajo control.</h1>
        <p>Conversaciones, citas y atención humana, todo en el mismo panel.</p>
      </div>
      <p className="story-foot">Digital Systems · Valencia</p>
    </section>
    <section className="login-panel">
      <form className="login-card" onSubmit={submit}>
        <span className="eyebrow">Acceso privado</span>
        <h2>Entrar al panel</h2>
        <p>Entra con el acceso que te hemos creado para tu negocio.</p>
        <label>Email<input type="email" required autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="tu@correo.es" /></label>
        <label>Contraseña<input type="password" required autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} placeholder="••••••••••••" /></label>
        {error && <div className="form-error" role="alert">{error}</div>}
        <button className="primary-button" disabled={loading}>{loading ? 'Comprobando…' : 'Acceder'}</button>
        <small>Solo tu equipo puede entrar aquí.</small>
      </form>
    </section>
  </main>
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="empty-state"><span className="empty-orbit">32</span><p>{children}</p></div>
}

function ConversationList({ conversations, selectedId, onSelect }: { conversations: Conversation[]; selectedId?: string; onSelect: (conversation: Conversation) => void }) {
  if (!conversations.length) return <EmptyState>No hay conversaciones en esta vista.</EmptyState>
  return <div className="conversation-list">
    {conversations.map(conversation => {
      const title = conversation.contact?.name || conversation.contact?.phone || 'Contacto sin identificar'
      return <button key={conversation.id} className={`conversation-card ${selectedId === conversation.id ? 'is-selected' : ''}`} onClick={() => onSelect(conversation)}>
        <span className="avatar">{initials(title)}</span>
        <span className="conversation-copy">
          <span className="conversation-line"><strong>{title}</strong><time>{relativeTime(conversation.last_message_at)}</time></span>
          <span className="conversation-preview">{conversation.subject || 'Abrir conversación'}</span>
          <span className="badges">
            <span className={`mode-badge ${conversation.control_mode}`}>{conversation.control_mode === 'agent' ? 'Asistente' : conversation.control_mode === 'human' ? 'Humano' : 'Pausado'}</span>
            {conversation.status === 'resolved' && <span className="status-badge">Resuelta</span>}
          </span>
        </span>
      </button>
    })}
  </div>
}

function MessageBubble({ message }: { message: Message }) {
  const inbound = message.direction === 'inbound'
  return <article className={`message ${inbound ? 'inbound' : 'outbound'} ${message.sender_type}`}>
    <p>{message.body}</p>
    <footer><span>{message.sender_type === 'agent' ? 'Asistente' : message.sender_type === 'human' ? 'Equipo' : inbound ? 'Cliente' : 'Sistema'}</span><time>{new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }).format(new Date(message.occurred_at))}</time></footer>
  </article>
}

function ConversationDetail({ session, organization, conversation, messages, busy, error, onRefresh, onChanged, onBack }: {
  session: Session; organization: Organization; conversation: Conversation | null; messages: Message[]; busy: boolean; error: string; onRefresh: () => void; onChanged: (conversation: Conversation) => void; onBack: () => void
}) {
  const [draft, setDraft] = useState('')
  const [action, setAction] = useState('')
  if (!conversation) return <section className="detail-panel no-selection"><EmptyState>Selecciona una conversación para consultar el historial y tomar el control.</EmptyState></section>
  const conversationId = conversation.id
  const controlMode = conversation.control_mode

  async function run(label: string, operation: () => Promise<{ conversation: Conversation }>) {
    setAction(label)
    try { onChanged((await operation()).conversation) } finally { setAction('') }
  }
  async function submitDraft() {
    const body = draft.trim()
    if (!body || action || controlMode !== 'human') return
    setAction('send')
    try { await agentApi.sendMessage(session, conversationId, body); setDraft(''); onRefresh() } finally { setAction('') }
  }
  function send(event: FormEvent) { event.preventDefault(); void submitDraft() }

  const canWrite = organization.role !== 'viewer'
  return <section className="detail-panel">
    <header className="detail-header">
      <button className="detail-back" onClick={onBack} aria-label="Volver a la lista"><Icon name="back" size={20} /></button>
      <div className="detail-identity"><span className="avatar large">{initials(conversation.contact?.name || conversation.contact?.phone)}</span><div><h2>{conversation.contact?.name || 'Contacto'}</h2><p>{conversation.contact?.phone || conversation.contact?.email || 'Sin contacto'}</p></div></div>
      <div className="detail-actions">
        {conversation.control_mode === 'agent'
          ? <button disabled={!canWrite || !!action} onClick={() => run('takeover', () => agentApi.takeover(session, conversation.id))}>Tomar control</button>
          : <button className="release" disabled={!canWrite || !!action} onClick={() => run('release', () => agentApi.release(session, conversation.id))}>Devolver al agente</button>}
        {conversation.status !== 'resolved' && <button className="resolve-btn" aria-label="Resolver conversación" disabled={!canWrite || !!action} onClick={() => run('resolve', () => agentApi.resolve(session, conversation.id))}><Icon name="check" size={14} />Resolver</button>}
      </div>
    </header>
    <div className="control-strip"><span className={`control-dot ${conversation.control_mode}`} />{conversation.control_mode === 'agent' ? 'El asistente responde automáticamente' : 'El asistente está pausado; responde el equipo'}<button onClick={onRefresh}>Actualizar</button></div>
    <div className="messages" aria-live="polite">
      {busy && !messages.length ? <div className="loading-line">Cargando historial…</div> : messages.map(message => <MessageBubble key={message.id} message={message} />)}
      {!busy && !messages.length && <EmptyState>Esta conversación todavía no contiene mensajes.</EmptyState>}
    </div>
    {error && <div className="inline-error" role="alert">{error}</div>}
    <form className="composer" onSubmit={send}>
      <textarea value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void submitDraft() } }} disabled={!canWrite || conversation.control_mode !== 'human'} placeholder={conversation.control_mode === 'human' ? 'Escribe como miembro del equipo… (Enter envía)' : 'Toma el control para responder manualmente'} rows={2} />
      <button className="send-button" disabled={!draft.trim() || !!action || conversation.control_mode !== 'human'} aria-label="Enviar mensaje"><Icon name="send" size={18} /></button>
    </form>
  </section>
}

function Dashboard({ session }: { session: Session }) {
  const [me, setMe] = useState<CurrentUser | null>(null)
  // Al volver de conectar Google Calendar: abrir Citas del negocio que se conectó.
  const [googleNotice] = useState(() => readGoogleReturn(window.location.search))
  const [organizationId, setOrganizationId] = useState(googleNotice?.organizationId || localStorage.getItem('studio32:organization') || '')
  const [filter, setFilter] = useState<Filter>('active')
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selected, setSelected] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [detailBusy, setDetailBusy] = useState(false)
  const [error, setError] = useState('')
  const [section, setSection] = useState<Section>(googleNotice ? 'appointments' : 'overview')
  useEffect(() => { if (googleNotice) clearGoogleReturn() }, [googleNotice])

  const [metrics, setMetrics] = useState<Summary['metrics'] | null>(null)
  const organization = me?.organizations.find(item => item.id === organizationId) || me?.organizations[0]
  const filterQuery = useMemo(() => filter === 'human' ? '&control_mode=human&status=open' : filter === 'resolved' ? '&status=resolved' : '&status=open', [filter])
  const lastActivity = conversations.reduce<string | null>((max, item) => (item.last_message_at && (!max || item.last_message_at > max)) ? item.last_message_at : max, null)

  const loadInbox = useCallback(async (quiet = false) => {
    if (!organization) return
    if (!quiet) setLoading(true)
    try {
      const data = await agentApi.inbox(session, organization.id, filterQuery)
      setConversations(data.conversations)
      setSelected(current => current ? data.conversations.find(item => item.id === current.id) || current : null)
      setError('')
      // Contadores de cabecera desde el estado global (no la lista filtrada).
      // open/human no dependen del rango; sirve una ventana cualquiera.
      const now = Date.now()
      agentApi.summary(session, organization.id, new Date(now - 86_400_000).toISOString(), new Date(now + 86_400_000).toISOString())
        .then(summary => setMetrics(summary.metrics)).catch(() => {})
    } catch (cause) { setError(cause instanceof ApiError ? cause.message : 'No se pudo cargar el inbox.') }
    if (!quiet) setLoading(false)
  }, [session, organization, filterQuery])

  const loadMessages = useCallback(async () => {
    if (!selected) return
    setDetailBusy(true)
    try { setMessages((await agentApi.messages(session, selected.id)).messages); setError('') }
    catch (cause) { setError(cause instanceof ApiError ? cause.message : 'No se pudo cargar la conversación.') }
    setDetailBusy(false)
  }, [session, selected])

  useEffect(() => { agentApi.me(session).then(data => { setMe(data); const first = data.organizations.find(item => item.id === organizationId) || data.organizations[0]; if (first) { setOrganizationId(first.id); localStorage.setItem('studio32:organization', first.id) } setLoading(false) }).catch(cause => { setError(cause.message); setLoading(false) }) }, [session])
  useEffect(() => { if (organization) loadInbox() }, [organization?.id, filter])
  useEffect(() => { if (selected) loadMessages() }, [selected?.id])
  useEffect(() => { if (!organization) return; const timer = window.setInterval(() => loadInbox(true), 12_000); return () => window.clearInterval(timer) }, [organization?.id, filter, loadInbox])

  function changeOrganization(id: string) { setOrganizationId(id); localStorage.setItem('studio32:organization', id); setSelected(null); setMessages([]) }
  function updateConversation(next: Conversation) {
    setSelected(current => current ? { ...current, ...next } : next)
    setConversations(items => items.map(item => item.id === next.id ? { ...item, ...next } : item))
    void loadInbox(true)
  }

  if (loading && !me) return <div className="app-loading"><span className="brand-mark">32</span><p>Preparando tu panel…</p></div>
  if (!me) return <div className="app-loading"><span className="brand-mark">32</span><h2>No se pudo abrir el panel</h2><p>{error || 'La sesión no se pudo validar.'}</p><button onClick={() => window.location.reload()}>Reintentar</button><button onClick={() => supabase.auth.signOut()}>Cerrar sesión</button></div>
  if (!me.organizations.length) return <div className="app-loading"><span className="brand-mark">32</span><h2>Sin negocio asignado</h2><p>Tu usuario existe, pero todavía no pertenece a ningún negocio. Escríbenos y lo enlazamos.</p><button onClick={() => supabase.auth.signOut()}>Cerrar sesión</button></div>

  return <main className={`app-shell section-${section}`}>
    <header className="mobile-topbar">
      <div className="brand-lockup compact"><span className="brand-mark">32</span><span>Studio32</span></div>
      <button className="topbar-signout" onClick={() => supabase.auth.signOut()} aria-label="Cerrar sesión"><Icon name="signout" size={18} /></button>
    </header>
    <aside className="sidebar">
      <div className="brand-lockup compact"><span className="brand-mark">32</span><span>Studio32</span></div>
      <nav>
        <button className={section === 'overview' ? 'active' : ''} aria-label="Resumen" onClick={() => setSection('overview')}><Icon name="overview" /><span>Resumen</span></button>
        <button className={section === 'inbox' ? 'active' : ''} aria-label="Conversaciones" onClick={() => setSection('inbox')}><Icon name="inbox" /><span>Chats</span></button>
        <button className={section === 'appointments' ? 'active' : ''} aria-label="Citas" onClick={() => setSection('appointments')}><Icon name="appointments" /><span>Citas</span></button>
        <button className={section === 'services' ? 'active' : ''} aria-label="Servicios" onClick={() => setSection('services')}><Icon name="services" /><span>Servicios</span></button>
        <button className={section === 'agent' ? 'active' : ''} aria-label="Asistente" onClick={() => setSection('agent')}><Icon name="agent" /><span>Asistente</span></button>
      </nav>
      <div className="sidebar-user"><span className="avatar small">{initials(me.user.email)}</span><span><strong>{me.user.email.split('@')[0]}</strong><small>{organization?.role}</small></span><button onClick={() => supabase.auth.signOut()} aria-label="Cerrar sesión"><Icon name="signout" size={18} /></button></div>
    </aside>
    {section === 'overview' && <OverviewView session={session} organization={organization!} />}
    {section === 'appointments' && <AppointmentsView session={session} organization={organization!} googleNotice={googleNotice} />}
    {section === 'services' && <ServicesView session={session} organization={organization!} />}
    {section === 'agent' && <AgentView session={session} organization={organization!} />}
    {section === 'inbox' && <><section className="inbox-panel">
      <header className="inbox-header">
        <div><span className="eyebrow">Recepción</span><h1>Conversaciones</h1></div>
        <select value={organization?.id} onChange={event => changeOrganization(event.target.value)} aria-label="Negocio">{me.organizations.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
      </header>
      <div className="summary-row"><article><span>Abiertas</span><strong>{metrics?.open_conversations ?? conversations.filter(item => item.status === 'open').length}</strong></article><article><span>En humano</span><strong>{metrics?.human_conversations ?? conversations.filter(item => item.control_mode === 'human' && item.status !== 'resolved').length}</strong></article><article><span>Última actividad</span><strong className="small-stat">{relativeTime(lastActivity)}</strong></article></div>
      <div className="filter-row"><button className={filter === 'active' ? 'active' : ''} onClick={() => setFilter('active')}>Activas</button><button className={filter === 'human' ? 'active' : ''} onClick={() => setFilter('human')}>En humano</button><button className={filter === 'resolved' ? 'active' : ''} onClick={() => setFilter('resolved')}>Resueltas</button><button className="refresh-button" onClick={() => loadInbox()} aria-label="Actualizar"><Icon name="refresh" size={16} /></button></div>
      {error && !selected && <div className="inline-error">{error}</div>}
      {loading ? <div className="loading-line">Actualizando conversaciones…</div> : <ConversationList conversations={conversations} selectedId={selected?.id} onSelect={setSelected} />}
    </section>
    <ConversationDetail session={session} organization={organization!} conversation={selected} messages={messages} busy={detailBusy} error={selected ? error : ''} onRefresh={loadMessages} onChanged={updateConversation} onBack={() => setSelected(null)} /></>}
  </main>
}

class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: unknown) { console.error('Panel error boundary:', error) }
  render() {
    if (!this.state.failed) return this.props.children
    return <div className="app-loading">
      <span className="brand-mark">32</span>
      <h2>Algo ha fallado</h2>
      <p>Se produjo un error inesperado en el panel. Recarga para volver a intentarlo.</p>
      <button onClick={() => window.location.reload()}>Recargar</button>
    </div>
  }
}

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true) })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => { setSession(next); setReady(true) })
    return () => data.subscription.unsubscribe()
  }, [])
  if (!ready) return <div className="app-loading"><span className="brand-mark">32</span></div>
  return session ? <Dashboard session={session} /> : <Login />
}

export default function AppRoot() {
  return <ErrorBoundary><App /></ErrorBoundary>
}
