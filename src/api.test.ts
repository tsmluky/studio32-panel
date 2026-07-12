import type { Session } from '@supabase/supabase-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { agentApi, ApiError } from './api'

const session = { access_token: 'panel-test-token' } as Session

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('agentApi', () => {
  it('sends the Supabase access token and encodes the organization id', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ conversations: [] }))
    vi.stubGlobal('fetch', fetchMock)

    await agentApi.inbox(session, 'org/with spaces', '&status=open')

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/api/inbox?organization_id=org%2Fwith%20spaces&status=open')
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer panel-test-token',
      'Content-Type': 'application/json',
    })
  })

  it('serializes a human message as JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ message: { id: 'message-1' } }))
    vi.stubGlobal('fetch', fetchMock)

    await agentApi.sendMessage(session, 'conversation-1', 'Te atiende el equipo de clínica.')

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/api/conversations/conversation-1/messages')
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({ body: 'Te atiende el equipo de clínica.' })
  })

  it('turns API failures into typed errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'Forbidden' }, 403)))

    await expect(agentApi.me(session)).rejects.toEqual(new ApiError('Forbidden', 403))
  })
})
