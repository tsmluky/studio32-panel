export type Role = 'owner' | 'admin' | 'operator' | 'viewer'
export type ControlMode = 'agent' | 'human' | 'paused'
export type ConversationStatus = 'open' | 'waiting' | 'resolved' | 'archived'

export interface Organization {
  id: string
  slug: string
  name: string
  status: string
  timezone: string
  locale: string
  role: Role
}

export interface CurrentUser {
  user: { id: string; email: string }
  organizations: Organization[]
}

export interface Contact {
  id: string
  name: string | null
  phone: string | null
  email: string | null
  status: string
  last_seen_at: string
}

export interface Conversation {
  id: string
  contact_id: string
  contact: Contact | null
  status: ConversationStatus
  control_mode: ControlMode
  assigned_user_id: string | null
  subject: string | null
  last_message_at: string | null
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  direction: 'inbound' | 'outbound' | 'internal'
  sender_type: 'contact' | 'agent' | 'human' | 'system' | 'tool'
  sender_user_id: string | null
  content_type: string
  body: string | null
  status: string
  occurred_at: string
  payload: Record<string, unknown>
}

export interface Service {
  id: string
  organization_id: string
  external_key: string | null
  name: string
  description: string | null
  duration_minutes: number | null
  price_amount: number | null
  currency: string
  active: boolean
  settings: Record<string, unknown>
  updated_at: string
}

// De dónde sale una cita cuando el negocio tiene Google Calendar conectado:
// 'agent' la reservó el asistente, 'calendar' la apuntó la clínica en su calendario,
// 'panel_only' solo existe en la base de datos y no en la agenda real.
export type AppointmentSource = 'agent' | 'calendar' | 'panel_only'

export interface Appointment {
  // Las apuntadas en Google sin ficha llegan con id 'gcal:<evento>'.
  id: string
  contact_id: string | null
  conversation_id: string | null
  service_id: string | null
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'
  starts_at: string
  ends_at: string
  resource_name: string | null
  notes: string | null
  metadata: Record<string, unknown>
  external_calendar_event_id: string | null
  contact: Contact | null
  service: Pick<Service, 'id' | 'name' | 'duration_minutes' | 'price_amount' | 'currency'> | null
  source?: AppointmentSource
  title?: string | null
  all_day?: boolean
}

// Google Calendar conectado por la propia clínica (botón "Conectar Google Calendar").
export interface GoogleCalendarConnection {
  status: 'pending' | 'active' | 'error' | 'disabled'
  google_email: string | null
  calendar_id: string | null
  calendar_name: string | null
  timezone: string | null
  connected_at: string | null
  last_error: string | null
}

export interface GoogleCalendarStatus {
  // El servidor tiene la conexión con Google activada.
  available: boolean
  // Este negocio se puede conectar (no es de demostración y tiene asistente).
  supported: boolean
  // Quien mira puede conectar o desconectar (dueño o admin).
  can_manage: boolean
  connection: GoogleCalendarConnection | null
}

export interface GoogleCalendarOption {
  id: string
  summary: string
  timeZone: string | null
  primary: boolean
}

export interface Summary {
  metrics: {
    open_conversations: number
    human_conversations: number
    pending_handoffs: number
    appointments_today: number
  }
  next_appointments: Appointment[]
}

export interface AgentConfig {
  id: string
  organization_id: string
  version: number
  status: 'draft' | 'active' | 'retired'
  business: Record<string, unknown>
  faq: string | null
  policies: string | null
  tone: string | null
  handoff_config: Record<string, unknown>
  updated_at: string
}
