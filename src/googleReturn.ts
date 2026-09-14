// Vuelta desde Google tras pulsar "Conectar Google Calendar".
//
// El agente devuelve a la clínica al dashboard con ?google=<resultado>&motivo=…&org=…
// (studio32-agent/src/api/googleCalendarRoutes.js). Aquí se traduce a un aviso que
// entienda quien lo lee, sin jerga de OAuth.

export interface GoogleReturn {
  tone: 'success' | 'warning'
  message: string
  organizationId: string | null
}

const MOTIVOS: Record<string, string> = {
  permisos: 'Faltó aceptar algún permiso. Vuelve a conectar y deja marcadas todas las casillas: sin ellas el asistente no puede ver ni apuntar citas en tu calendario.',
  caducado: 'La conexión tardó demasiado y caducó. Vuelve a pulsar «Conectar Google Calendar».',
  permiso: 'Solo el responsable del negocio puede conectar Google Calendar.',
  negocio: 'Este negocio no se puede conectar a Google Calendar.',
}

export function readGoogleReturn(search: string): GoogleReturn | null {
  const params = new URLSearchParams(search)
  const result = params.get('google')
  if (!result) return null
  const organizationId = params.get('org')
  if (result === 'conectado') return { tone: 'success', organizationId, message: 'Google Calendar conectado. Desde ahora esta agenda es la misma que tenéis en el móvil.' }
  if (result === 'cancelado') return { tone: 'warning', organizationId, message: 'No se ha conectado porque se canceló en Google. Puedes intentarlo cuando quieras.' }
  return { tone: 'warning', organizationId, message: MOTIVOS[params.get('motivo') || ''] || 'Google no ha completado la conexión. Inténtalo de nuevo en unos minutos.' }
}

// Quita los parámetros de la vuelta para que recargar la página no repita el aviso.
export function clearGoogleReturn() {
  const url = new URL(window.location.href)
  for (const key of ['google', 'motivo', 'org']) url.searchParams.delete(key)
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
}
