import type { Session } from '@supabase/supabase-js'
import type { AgentConfig, Appointment, Conversation, CurrentUser, Message, Service, Summary } from './types'

const API_URL = String(import.meta.env.VITE_AGENT_API_URL || '').replace(/\/$/, '')

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function request<T>(session: Session, path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController()
  const timeout = globalThis.setTimeout(() => controller.abort(), 20_000)
  try {
    const response = await fetch(`${API_URL}/api${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new ApiError(payload.error || `Request failed (${response.status})`, response.status)
    return payload as T
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw new ApiError('El agente está tardando más de lo esperado. Inténtalo de nuevo.', 408)
    throw cause
  } finally {
    globalThis.clearTimeout(timeout)
  }
}

export const agentApi = {
  me: (session: Session) => request<CurrentUser>(session, '/me'),
  inbox: (session: Session, organizationId: string, filters = '') =>
    request<{ conversations: Conversation[] }>(session, `/inbox?organization_id=${encodeURIComponent(organizationId)}${filters}`),
  summary: (session: Session, organizationId: string, from: string, to: string) =>
    request<Summary>(session, `/summary?organization_id=${encodeURIComponent(organizationId)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  appointments: (session: Session, organizationId: string, from: string, to: string) =>
    request<{ appointments: Appointment[] }>(session, `/appointments?organization_id=${encodeURIComponent(organizationId)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  cancelAppointment: (session: Session, appointmentId: string) =>
    request<{ appointment: Appointment }>(session, `/appointments/${appointmentId}/cancel`, { method: 'POST', body: '{}' }),
  services: (session: Session, organizationId: string) =>
    request<{ services: Service[] }>(session, `/services?organization_id=${encodeURIComponent(organizationId)}`),
  updateService: (session: Session, serviceId: string, changes: Partial<Service>) =>
    request<{ service: Service }>(session, `/services/${serviceId}`, { method: 'PATCH', body: JSON.stringify(changes) }),
  agentConfig: (session: Session, organizationId: string) =>
    request<{ config: AgentConfig | null }>(session, `/agent-config?organization_id=${encodeURIComponent(organizationId)}`),
  updateAgentConfig: (session: Session, configId: string, changes: Partial<AgentConfig>) =>
    request<{ config: AgentConfig }>(session, `/agent-config/${configId}`, { method: 'PATCH', body: JSON.stringify(changes) }),
  messages: (session: Session, conversationId: string) =>
    request<{ conversation: Conversation; messages: Message[] }>(session, `/conversations/${conversationId}/messages`),
  takeover: (session: Session, conversationId: string) =>
    request<{ conversation: Conversation }>(session, `/conversations/${conversationId}/takeover`, { method: 'POST', body: '{}' }),
  release: (session: Session, conversationId: string) =>
    request<{ conversation: Conversation }>(session, `/conversations/${conversationId}/release`, { method: 'POST', body: '{}' }),
  resolve: (session: Session, conversationId: string) =>
    request<{ conversation: Conversation }>(session, `/conversations/${conversationId}/resolve`, { method: 'POST', body: '{}' }),
  sendMessage: (session: Session, conversationId: string, body: string) =>
    request<{ message: Message }>(session, `/conversations/${conversationId}/messages`, {
      method: 'POST', body: JSON.stringify({ body }),
    }),
}
