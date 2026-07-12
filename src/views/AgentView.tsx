import { FormEvent, useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { agentApi } from '../api'
import type { AgentConfig, Organization } from '../types'
import { ViewError, ViewHeader } from './shared'

export function AgentView({ session, organization }: { session: Session; organization: Organization }) {
  const [config, setConfig] = useState<AgentConfig | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const load = useCallback(async () => { try { setConfig((await agentApi.agentConfig(session, organization.id)).config); setError('') } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo cargar la configuración.') } }, [session, organization.id])
  useEffect(() => { void load() }, [load])
  function field(key: 'tone' | 'faq' | 'policies', value: string) { if (config) { setConfig({ ...config, [key]: value }); setSaved(false) } }
  async function save(event: FormEvent) { event.preventDefault(); if (!config) return; setBusy(true); try { setConfig((await agentApi.updateAgentConfig(session, config.id, { tone: config.tone, faq: config.faq, policies: config.policies })).config); setSaved(true); setError('') } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar la configuración.') } finally { setBusy(false) } }
  const canWrite = organization.role !== 'viewer'
  return <section className="workspace"><ViewHeader eyebrow={organization.name} title="Agente" description="Tono, preguntas frecuentes y políticas operativas." />{error && <ViewError>{error}</ViewError>}
    <form className="workspace-card agent-editor" onSubmit={save}>{config ? <><label>Tono de atención<textarea rows={5} value={config.tone || ''} disabled={!canWrite} onChange={event => field('tone', event.target.value)} /></label><label>Preguntas frecuentes<textarea rows={10} value={config.faq || ''} disabled={!canWrite} onChange={event => field('faq', event.target.value)} /></label><label>Políticas<textarea rows={8} value={config.policies || ''} disabled={!canWrite} onChange={event => field('policies', event.target.value)} /></label>{canWrite ? <div className="save-row"><span>{saved ? 'La nueva información ya está disponible para el agente.' : `Configuración activa · versión ${config.version}`}</span><button disabled={busy}>{busy ? 'Guardando…' : 'Guardar configuración'}</button></div> : <div className="save-row"><span>Tu rol es de solo lectura · versión {config.version}</span></div>}</> : <p className="quiet-empty">No existe una configuración activa para esta organización.</p>}</form>
  </section>
}
