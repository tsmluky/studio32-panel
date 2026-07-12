import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { agentApi, ApiError } from './api'
import { supabase } from './supabase'
import type { Conversation, CurrentUser, Message, Organization } from './types'
import { OverviewView } from './views/OverviewView'
import { AppointmentsView } from './views/AppointmentsView'
import { ServicesView } from './views/ServicesView'
import { AgentView } from './views/AgentView'

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

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')
    const result = await supabase.auth.signInWithPassword({ email, password })
    if (result.error) setError(result.error.message)
    setLoading(false)
  }

  return <main className="login-shell">
    <section className="login-story">
      <div className="brand-lockup"><span className="brand-mark">32</span><span>Studio32</span></div>
      <div className="story-copy">
        <span className="eyebrow">Agent Platform</span>
        <h1>Recepción digital,<br />bajo control.</h1>
        <p>Conversaciones, citas y atención humana en un solo espacio operativo.</p>
      </div>
      <p className="story-foot">Digital Systems · Valencia</p>
    </section>
    <section className="login-panel">
      <form className="login-card" onSubmit={submit}>
        <span className="eyebrow">Acceso privado</span>
        <h2>Entrar al panel</h2>
        <p>Utiliza las credenciales asignadas a tu organización.</p>
        <label>Email<input type="email" required autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="equipo@clinica.es" /></label>
        <label>Contraseña<input type="password" required autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} placeholder="••••••••••••" /></label>
        {error && <div className="form-error" role="alert">{error}</div>}
        <button className="primary-button" disabled={loading}>{loading ? 'Comprobando…' : 'Acceder'}</button>
        <small>Acceso protegido mediante Supabase Auth.</small>
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
            <span className={`mode-badge ${conversation.control_mode}`}>{conversation.control_mode === 'agent' ? 'Agente' : conversation.control_mode === 'human' ? 'Humano' : 'Pausado'}</span>
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
    <footer><span>{message.sender_type === 'agent' ? 'Agente' : message.sender_type === 'human' ? 'Equipo' : inbound ? 'Cliente' : 'Sistema'}</span><time>{new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }).format(new Date(message.occurred_at))}</time></footer>
  </article>
}

function ConversationDetail({ session, organization, conversation, messages, busy, error, onRefresh, onChanged }: {
  session: Session; organization: Organization; conversation: Conversation | null; messages: Message[]; busy: boolean; error: string; onRefresh: () => void; onChanged: (conversation: Conversation) => void
}) {
  const [draft, setDraft] = useState('')
  const [action, setAction] = useState('')
  if (!conversation) return <section className="detail-panel no-selection"><EmptyState>Selecciona una conversación para consultar el historial y tomar el control.</EmptyState></section>
  const conversationId = conversation.id

  async function run(label: string, operation: () => Promise<{ conversation: Conversation }>) {
    setAction(label)
    try { onChanged((await operation()).conversation) } finally { setAction('') }
  }
  async function send(event: FormEvent) {
    event.preventDefault()
    const body = draft.trim()
    if (!body) return
    setAction('send')
    try { await agentApi.sendMessage(session, conversationId, body); setDraft(''); onRefresh() } finally { setAction('') }
  }

  const canWrite = organization.role !== 'viewer'
  return <section className="detail-panel">
    <header className="detail-header">
      <div className="detail-identity"><span className="avatar large">{initials(conversation.contact?.name || conversation.contact?.phone)}</span><div><h2>{conversation.contact?.name || 'Contacto'}</h2><p>{conversation.contact?.phone || conversation.contact?.email || 'Sin contacto'}</p></div></div>
      <div className="detail-actions">
        {conversation.control_mode === 'agent'
          ? <button disabled={!canWrite || !!action} onClick={() => run('takeover', () => agentApi.takeover(session, conversation.id))}>Tomar control</button>
          : <button className="release" disabled={!canWrite || !!action} onClick={() => run('release', () => agentApi.release(session, conversation.id))}>Devolver al agente</button>}
        {conversation.status !== 'resolved' && <button className="icon-button" aria-label="Resolver conversación" disabled={!canWrite || !!action} onClick={() => run('resolve', () => agentApi.resolve(session, conversation.id))}>✓</button>}
      </div>
    </header>
    <div className="control-strip"><span className={`control-dot ${conversation.control_mode}`} />{conversation.control_mode === 'agent' ? 'El agente responde automáticamente' : 'El agente está pausado; responde el equipo'}<button onClick={onRefresh}>Actualizar</button></div>
    <div className="messages" aria-live="polite">
      {busy && !messages.length ? <div className="loading-line">Cargando historial…</div> : messages.map(message => <MessageBubble key={message.id} message={message} />)}
      {!busy && !messages.length && <EmptyState>Esta conversación todavía no contiene mensajes.</EmptyState>}
    </div>
    {error && <div className="inline-error" role="alert">{error}</div>}
    <form className="composer" onSubmit={send}>
      <textarea value={draft} onChange={event => setDraft(event.target.value)} disabled={!canWrite || conversation.control_mode !== 'human'} placeholder={conversation.control_mode === 'human' ? 'Escribe como miembro del equipo…' : 'Toma el control para responder manualmente'} rows={2} />
      <button className="send-button" disabled={!draft.trim() || !!action || conversation.control_mode !== 'human'} aria-label="Enviar mensaje">↑</button>
    </form>
  </section>
}

function Dashboard({ session }: { session: Session }) {
  const [me, setMe] = useState<CurrentUser | null>(null)
  const [organizationId, setOrganizationId] = useState(localStorage.getItem('studio32:organization') || '')
  const [filter, setFilter] = useState<Filter>('active')
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selected, setSelected] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [detailBusy, setDetailBusy] = useState(false)
  const [error, setError] = useState('')
  const [section, setSection] = useState<Section>('overview')

  const organization = me?.organizations.find(item => item.id === organizationId) || me?.organizations[0]
  const filterQuery = useMemo(() => filter === 'human' ? '&control_mode=human' : filter === 'resolved' ? '&status=resolved' : '&status=open', [filter])

  const loadInbox = useCallback(async (quiet = false) => {
    if (!organization) return
    if (!quiet) setLoading(true)
    try {
      const data = await agentApi.inbox(session, organization.id, filterQuery)
      setConversations(data.conversations)
      setSelected(current => current ? data.conversations.find(item => item.id === current.id) || current : null)
      setError('')
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

  if (loading && !me) return <div className="app-loading"><span className="brand-mark">32</span><p>Preparando el espacio operativo…</p></div>
  if (!me?.organizations.length) return <div className="app-loading"><span className="brand-mark">32</span><h2>Sin organización asignada</h2><p>Tu usuario existe, pero todavía no pertenece a ningún negocio.</p><button onClick={() => supabase.auth.signOut()}>Cerrar sesión</button></div>

  return <main className={`app-shell section-${section}`}>
    <aside className="sidebar">
      <div className="brand-lockup compact"><span className="brand-mark">32</span><span>Studio32</span></div>
      <nav>
        <button className={section === 'overview' ? 'active' : ''} aria-label="Resumen" onClick={() => setSection('overview')}>◫<span>Resumen</span></button>
        <button className={section === 'inbox' ? 'active' : ''} aria-label="Conversaciones" onClick={() => setSection('inbox')}>⌁<span>Inbox</span></button>
        <button className={section === 'appointments' ? 'active' : ''} aria-label="Citas" onClick={() => setSection('appointments')}>□<span>Citas</span></button>
        <button className={section === 'services' ? 'active' : ''} aria-label="Servicios" onClick={() => setSection('services')}>◇<span>Servicios</span></button>
        <button className={section === 'agent' ? 'active' : ''} aria-label="Agente" onClick={() => setSection('agent')}>✦<span>Agente</span></button>
      </nav>
      <div className="sidebar-user"><span className="avatar small">{initials(me.user.email)}</span><span><strong>{me.user.email.split('@')[0]}</strong><small>{organization?.role}</small></span><button onClick={() => supabase.auth.signOut()} aria-label="Cerrar sesión">↗</button></div>
    </aside>
    {section === 'overview' && <OverviewView session={session} organization={organization!} />}
    {section === 'appointments' && <AppointmentsView session={session} organization={organization!} />}
    {section === 'services' && <ServicesView session={session} organization={organization!} />}
    {section === 'agent' && <AgentView session={session} organization={organization!} />}
    {section === 'inbox' && <><section className="inbox-panel">
      <header className="inbox-header">
        <div><span className="eyebrow">Recepción</span><h1>Conversaciones</h1></div>
        <select value={organization?.id} onChange={event => changeOrganization(event.target.value)} aria-label="Organización">{me.organizations.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
      </header>
      <div className="summary-row"><article><span>Abiertas</span><strong>{conversations.filter(item => item.status === 'open').length}</strong></article><article><span>En humano</span><strong>{conversations.filter(item => item.control_mode === 'human').length}</strong></article><article><span>Última actividad</span><strong className="small-stat">{relativeTime(conversations[0]?.last_message_at)}</strong></article></div>
      <div className="filter-row"><button className={filter === 'active' ? 'active' : ''} onClick={() => setFilter('active')}>Activas</button><button className={filter === 'human' ? 'active' : ''} onClick={() => setFilter('human')}>En humano</button><button className={filter === 'resolved' ? 'active' : ''} onClick={() => setFilter('resolved')}>Resueltas</button><button className="refresh-button" onClick={() => loadInbox()} aria-label="Actualizar">↻</button></div>
      {error && !selected && <div className="inline-error">{error}</div>}
      {loading ? <div className="loading-line">Actualizando conversaciones…</div> : <ConversationList conversations={conversations} selectedId={selected?.id} onSelect={setSelected} />}
    </section>
    <ConversationDetail session={session} organization={organization!} conversation={selected} messages={messages} busy={detailBusy} error={selected ? error : ''} onRefresh={loadMessages} onChanged={updateConversation} /></>}
  </main>
}

export default function App() {
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
