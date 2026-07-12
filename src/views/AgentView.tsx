import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { agentApi } from '../api'
import type { AgentConfig, Organization } from '../types'
import { ViewError, ViewHeader } from './shared'

// Canal de soporte para "Solicitar un cambio". La configuración del asistente la
// mantiene Studio32 (calidad), así que el cliente no edita: pide el cambio y lo
// aplicamos nosotros. Si hay WhatsApp, se usa; si no, email.
const SUPPORT_WHATSAPP = '34694293166' // sin +. Vacío => usa email.
const SUPPORT_EMAIL = 'info@studio32.es'

function changeRequestHref(orgName: string) {
  const message = `Hola, soy de ${orgName} y me gustaría cambiar algo de mi asistente:`
  if (SUPPORT_WHATSAPP) return `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(message)}`
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Cambio en mi asistente · ${orgName}`)}&body=${encodeURIComponent(message)}`
}

const CAPABILITIES = [
  'Atiende por WhatsApp con el tono de tu clínica.',
  'Resuelve las dudas frecuentes de tus pacientes al momento.',
  'Agenda, confirma y gestiona citas.',
  'Avisa a tu equipo y cede la conversación cuando hace falta atención humana.',
]

export function AgentView({ session, organization }: { session: Session; organization: Organization }) {
  const [config, setConfig] = useState<AgentConfig | null>(null)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    try { setConfig((await agentApi.agentConfig(session, organization.id)).config); setError('') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo cargar la configuración.') }
  }, [session, organization.id])
  useEffect(() => { void load() }, [load])

  return <section className="workspace">
    <ViewHeader eyebrow={organization.name} title="Tu asistente" description="Así atiende tu asistente. Studio32 mantiene la configuración para cuidar la calidad de cada respuesta." />
    {error && <ViewError>{error}</ViewError>}
    <div className="agent-readonly">
      <article className="workspace-card agent-block">
        <span className="eyebrow">Qué hace tu asistente</span>
        <ul className="agent-caps">{CAPABILITIES.map(item => <li key={item}>{item}</li>)}</ul>
      </article>
      <article className="workspace-card agent-block">
        <span className="eyebrow">Preguntas que sabe responder</span>
        {config?.faq ? <p>{config.faq}</p> : <p className="agent-empty">Aún no hay preguntas frecuentes cargadas. Las preparamos contigo en la puesta en marcha.</p>}
      </article>
      <div className="agent-help">
        <span>¿Quieres cambiar algo? Nos encargamos nosotros y lo actualizamos por ti.</span>
        <a className="request-change" href={changeRequestHref(organization.name)} target="_blank" rel="noreferrer">Solicitar un cambio</a>
      </div>
    </div>
  </section>
}
