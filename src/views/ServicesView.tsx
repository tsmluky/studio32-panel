import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { agentApi } from '../api'
import { supabase } from '../supabase'
import type { Organization, Service } from '../types'
import { LoadingLine, RealtimeStatus, ViewError, ViewHeader } from './shared'

export function ServicesView({ session, organization }: { session: Session; organization: Organization }) {
  const [services, setServices] = useState<Service[]>([])
  const [selected, setSelected] = useState<Service | null>(null)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const editorRef = useRef<HTMLFormElement>(null)
  function selectService(item: Service) {
    setSelected(item); setSaved(false)
    if (window.matchMedia('(max-width:720px)').matches) {
      requestAnimationFrame(() => editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    }
  }
  const load = useCallback(async () => {
    try { const data = (await agentApi.services(session, organization.id)).services; setServices(data); setSelected(current => data.find(item => item.id === current?.id) || data[0] || null); setError('') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudieron cargar los servicios.') }
    finally { setLoaded(true) }
  }, [session, organization.id])
  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const channel = supabase.channel(`services:${organization.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'services', filter: `organization_id=eq.${organization.id}` }, load).subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [organization.id, load])

  function field<K extends keyof Service>(key: K, value: Service[K]) { if (selected) { setSelected({ ...selected, [key]: value }); setSaved(false) } }
  async function save(event: FormEvent) {
    event.preventDefault(); if (!selected) return; setBusy(true)
    try { const result = await agentApi.updateService(session, selected.id, { name: selected.name, description: selected.description, duration_minutes: selected.duration_minutes, price_amount: selected.price_amount, active: selected.active }); setSelected(result.service); setServices(items => items.map(item => item.id === result.service.id ? result.service : item)); setSaved(true); setError('') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar el servicio.') }
    finally { setBusy(false) }
  }

  const canWrite = organization.role !== 'viewer'
  return <section className="workspace">
    <ViewHeader eyebrow={organization.name} title="Servicios" description="La información guardada aquí alimenta la siguiente conversación del agente." action={<RealtimeStatus />} />
    {error && <ViewError>{error}</ViewError>}
    <div className="settings-grid"><article className="workspace-card service-list"><div className="card-heading"><span className="eyebrow">Catálogo</span><strong>{loaded ? `${services.length} servicios` : ''}</strong></div>{!loaded && !services.length && <LoadingLine />}{services.map(item => <button key={item.id} className={selected?.id === item.id ? 'active' : ''} onClick={() => selectService(item)}><span><strong>{item.name}</strong><small>{item.duration_minutes || '—'} min · {item.price_amount === null ? 'Consultar' : item.price_amount === 0 ? 'Gratis' : `${item.price_amount} ${item.currency}`}</small></span><i className={item.active ? 'on' : ''} /></button>)}</article>
      <form ref={editorRef} className="workspace-card editor-card" onSubmit={save}>{selected ? <><div className="card-heading"><div><span className="eyebrow">Edición</span><h2>{selected.name}</h2></div><label className="toggle-field"><input type="checkbox" checked={selected.active} disabled={!canWrite} onChange={event => field('active', event.target.checked)} />Activo</label></div>
        <label>Nombre<input value={selected.name} disabled={!canWrite} onChange={event => field('name', event.target.value)} required /></label>
        <label>Descripción para pacientes<textarea rows={4} value={selected.description || ''} disabled={!canWrite} onChange={event => field('description', event.target.value)} /></label>
        <div className="form-columns"><label>Duración (min)<input type="number" min="5" value={selected.duration_minutes || ''} disabled={!canWrite} onChange={event => field('duration_minutes', Number(event.target.value) || null)} /></label><label>Precio orientativo<input type="number" min="0" step="0.01" value={selected.price_amount ?? ''} disabled={!canWrite} onChange={event => field('price_amount', event.target.value === '' ? null : Number(event.target.value))} /></label></div>
        {canWrite && <div className="save-row"><span>{saved ? 'Cambio disponible para la próxima conversación.' : 'Los cambios quedan auditados.'}</span><button disabled={busy}>{busy ? 'Guardando…' : 'Guardar servicio'}</button></div>}
        {!canWrite && <div className="save-row"><span>Tu rol es de solo lectura.</span></div>}</> : <p className="quiet-empty">Selecciona un servicio.</p>}</form>
    </div>
  </section>
}
