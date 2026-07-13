# Auditoría de producción — Studio32 Panel

Registro vivo de todo lo que hay que revisar/arreglar antes del go-live del panel
para el cliente (GH Dent · Clínica Dental). Se actualiza en cada pasada.

- **Fecha inicio:** 2026-07-12
- **Tenant objetivo:** `gh-dent`
- **Deploy:** Netlify (`glistening-begonia-3f3358`) desde `tsmluky/studio32-panel` `main`
- **Backend:** Railway `https://web-production-d722c.up.railway.app`

Severidad: 🔴 Bloqueante · 🟠 Alta · 🟡 Media · ⚪ Baja/pulido
Estado: ✅ hecho · ⏳ pendiente · 🔵 pendiente de datos (scripts Supabase, los ejecuta el usuario)

---

## A · Configuración y despliegue

| # | Sev | Estado | Punto | Ubicación / acción |
|---|-----|--------|-------|--------------------|
| A1 | 🔴 | ✅ | `.env.local` apuntaba a Bonto (backend dormido) → cambiado a Railway | `.env.local` (local, gitignored) |
| A2 | 🟠 | ✅ | `.env.example` apunta a Railway | `.env.example:3` |
| A3 | 🟡 | ⏳ | Verificar en Netlify que `VITE_AGENT_API_URL` = Railway antes del go-live (no fiarse de memoria) | Netlify env vars |
| A4 | ⚪ | ⏳ | Sin favicon: la pestaña muestra el icono por defecto del navegador | `index.html` + `public/favicon` |
| A5 | ⚪ | ⏳ | `.claude/launch.json` (helper dev) sin trackear; decidir si se ignora | `.gitignore` |

## B · Correctitud (código)

| # | Sev | Estado | Punto | Ubicación / acción |
|---|-----|--------|-------|--------------------|
| B1 | 🟠 | ✅ | "Próximas citas" mostraba solo la hora → contradecía "Citas de hoy" y parecía desordenada. Ahora `Hoy/Mañana/Mié 15 Jul` + hora | `views/OverviewView.tsx`, `styles.css` |
| B3 | 🟠 | ✅ | Contador "En humano" contaba conversaciones resueltas (mostraba 2 en filtro Resueltas). Ahora excluye resueltas | `App.tsx:215` |
| B4 | 🟡 | ⏳ | `useEffect` de `me` depende solo de `[session]` pero usa `organizationId` → closure obsoleta (funciona por lectura inicial de localStorage) | `App.tsx:178` |
| B5 | 🟡 | ✅ | Contadores "Abiertas"/"En humano" ahora vienen de `/summary` (estado global), estables entre filtros. Verificado: en "Resueltas" muestran 0/0 aunque la lista tenga resueltas-en-humano | `App.tsx` |
| B6 | 🟡 | ✅ | Filtro "En humano" ahora `&control_mode=human&status=open` (solo activas) | `App.tsx` (`filterQuery`) |
| B7 | 🟠 | ✅ | `madridDay()` usaba offset fijo `+02:00`. Ahora deriva el offset real de Madrid (`madridOffset`): `+02:00` verano / `+01:00` invierno. Verificado en Node | `views/OverviewView.tsx` |
| B8 | 🟡 | ✅ | "Última actividad" toma el máximo real de `last_message_at`, no `[0]` | `App.tsx` (`lastActivity`) |

## C · Seguridad y roles

| # | Sev | Estado | Punto | Ubicación / acción |
|---|-----|--------|-------|--------------------|
| C1 | 🟡 | ✅ | `ServicesView`: inputs `disabled` y "Guardar" oculto para `viewer`; muestra "solo lectura" | `views/ServicesView.tsx` |
| C2 | 🟡 | ✅(superado) | `AgentView` ya no edita: es solo-lectura (ver K1), guard de rol innecesario | `views/AgentView.tsx` |
| C3 | 🟡 | ✅ | `AppointmentsView`: botón "Cancelar" oculto para `viewer` | `views/AppointmentsView.tsx` |
| — | — | — | Referencia correcta: el Inbox sí usa `canWrite = role !== 'viewer'` | `App.tsx:119` |

## D · UX, copy y estados

| # | Sev | Estado | Punto | Ubicación / acción |
|---|-----|--------|-------|--------------------|
| D1 | ⚪ | ✅ | "Gratis" cuando `price_amount === 0` (antes "0 EUR") | `ServicesView` (lista) |
| D3 | 🟠 | ✅ | Errores de login mapeados a español (`loginErrorES`: credenciales, no confirmado, rate limit, red) + try/catch | `App.tsx` `Login` |
| D4 | 🟠 | ⏳ | No hay recuperación de contraseña ("¿Olvidaste tu contraseña?"). El cliente lo necesitará en producción | `App.tsx` `Login` (feature) |
| D5 | 🟠 | ✅ | `ErrorBoundary` envolviendo la app con fallback "Algo ha fallado / Recargar" | `App.tsx` |
| D11 | ⚪ | ✅ | Iconos del sidebar y acciones (↻ ↑ ✓ ↗) migrados a sistema SVG (`icons.tsx`); consistentes en todo SO | `icons.tsx`, `App.tsx` |
| D12 | ⚪ | ✅ | Composer envía con Enter (Shift+Enter = salto); placeholder lo indica | `App.tsx` `ConversationDetail` |
| D13 | ⚪ | ✅(ok) | El screenshot del pane embebido ya no se cuelga; render correcto verificado en móvil y desktop | — |

## E · Accesibilidad

| # | Sev | Estado | Punto | Ubicación / acción |
|---|-----|--------|-------|--------------------|
| E1 | ⚪ | ✅(ok) | Botones solo-icono con `aria-label` (sidebar, ↻, ↑, ✓, ↗). Correcto | — |
| E2 | 🟡 | ⏳ | Texto pequeño `#838b84` a 10px sobre blanco: contraste dudoso (WCAG AA). Revisar | `styles.css` |

## F · i18n / multi-tenant

| # | Sev | Estado | Punto | Ubicación / acción |
|---|-----|--------|-------|--------------------|
| F2 | 🟡 | ⏳ | Se hardcodea `es-ES` y `Europe/Madrid` en todo; `Organization` ya trae `timezone` y `locale` sin usar. OK para un cliente, latente para multi-tenant | `OverviewView`, `AppointmentsView`, `shared.tsx` |

## G · Testing

| # | Sev | Estado | Punto | Ubicación / acción |
|---|-----|--------|-------|--------------------|
| G1 | 🟡 | ⏳ | Solo `api.test.ts` (3 tests). Sin cobertura de vistas ni de los contadores/fechas arreglados. Añadir tests de regresión para B1/B3 | `src/*.test.ts` |

## H · Datos (tenant gh-dent) — scripts, los ejecuta el usuario

| # | Sev | Estado | Punto | Acción |
|---|-----|--------|-------|--------|
| H1 | 🟠 | ✅ | Handoff huérfano resuelto (`--apply`). Verificado en vivo: "Atención requerida" → **0** | `resolve-orphan-handoffs.js gh-dent --apply` |
| H2 | ⚪ | ✅(N/A) | Las conversaciones E2E ya están `resolved`; el inbox por defecto (Activas) está limpio. `cleanup-test-conversations.js` no encuentra nada (solo mira open/waiting). Los nombres E2E solo quedan en el histórico "Resueltas", baja visibilidad | — (dejar histórico o purgar aparte) |
| H4 | 🟠 | ✅ | 3 citas de prueba borradas (`--apply`). Verificado en vivo: agenda solo con las 2 de Pancho | `agent/scripts/cleanup-test-appointments.js gh-dent --apply` |
| H3 | 🟡 | 🔵 | Cita de Pancho 10:00 sin `service_id` → cae al fallback "Cita" (parte de los datos de prueba) | Vincular servicio o borrar cita |

## J · UI mobile-first (2026-07-13)

El panel se usa mayoritariamente desde el móvil → rediseño mobile-first del layout.

| # | Sev | Estado | Punto | Ubicación |
|---|-----|--------|-------|-----------|
| J1 | 🟠 | ✅ | Sistema de iconos SVG (`icons.tsx`) sustituye todos los glifos unicode (nav + acciones) | `icons.tsx` |
| J2 | 🟠 | ✅ | Navegación móvil: barra lateral → **tab bar inferior** (icono + etiqueta) + barra superior (marca + salir) | `App.tsx`, `styles.css` |
| J3 | 🟠 | ✅ | Vista Citas en móvil: tabla ancha con scroll → **tarjetas apiladas** | `styles.css` |
| J4 | 🟡 | ✅ | Chat en móvil: pantalla completa inmersiva + botón "Volver" (antes te quedabas atrapado; composer tapado por la nav) | `App.tsx`, `styles.css` |
| J5 | 🟡 | ✅ | Tamaños táctiles y legibilidad ajustados en móvil (nav, métricas, filtros) | `styles.css` |
| J6 | ⚪ | ✅ | En móvil, seleccionar un servicio hace scroll suave al editor (`scrollIntoView`, solo ≤720px) | `ServicesView` |

| J7 | 🟡 | ✅ | Iconos SVG descentrados en botones (secuela de migrar glifos→SVG): se centran send, resolver, refresh, salir (`place-items:center`). Botón enviar 44x44 con avión compensado | `styles.css` |
| J8 | 🟡 | ✅ | Header de conversación en móvil descongestionado: avatar oculto, "Tomar control" y ✓ a la misma altura, espaciado apretado | `styles.css` |

Verificado en vivo (viewport 375px) las 5 vistas + desktop intacto. `tsc`/`build`/tests OK.

## K · Producto: pestaña Agente (2026-07-13)

Problema: el editor de Tono/FAQ/Políticas en crudo exige oficio de redacción, intimida
(página en blanco) y arriesga la calidad hacia los pacientes; además el cliente podía
sobrescribir una config buena. Principio adoptado: **el cliente contesta datos, la
agencia redacta el prompt**.

| # | Sev | Estado | Punto | Ubicación |
|---|-----|--------|-------|-----------|
| K1 | 🟠 | ✅ | Agente pasa a **solo-lectura** (Solución A): "Qué hace tu asistente" (bullets) + "Preguntas que sabe responder" (FAQ) + "Solicitar un cambio". Sin editor en crudo; no se exponen tripas (`createBooking`/`registerLead`). Verificado desktop + móvil | `views/AgentView.tsx`, `styles.css` |
| K2 | 🟠 | ✅ | "Solicitar un cambio" → WhatsApp real `34694293166` (fallback email `info@studio32.es`), con mensaje prellenado. Verificado el href | `views/AgentView.tsx` |
| K4 | 🟡 | ✅ | Pestaña renombrada de "Agente" (jerga) a **"Asistente"** (casa con el título "Tu asistente"; "Configuración" se descartó por engañoso en una vista de solo-lectura) | `App.tsx` |
| K3 | 🟡 | ✅ | Cuestionario de puesta en marcha dental redactado (mapea a `business/services/faq/handoff`) | `30-recursos/CUESTIONARIO-PUESTA-EN-MARCHA-DENTAL.md` |

Seguridad: la config real se autora en `studio32-agent/tenants/<id>/*.md|json` e importa a
Supabase; el panel era superficie secundaria → solo-lectura no rompe autoría. Onboarding
por plantilla de vertical ya existe (`src/onboarding.js`), falta crear `templates/dental/`.

## Decisiones de diseño (evaluadas y cerradas)

- **Identidad de cliente / agrupación de conversaciones (2026-07-12):** se evaluó pasar a "hilo eterno por cliente" o "vista CRM por contacto". **Decisión: mantener el modelo actual de episodios.** Motivo: la identidad ya está unificada por teléfono (`contactForPhone` deduplica por número; el nombre se guarda al reservar), y `conversationForPhone` mantiene solo UNA conversación abierta por contacto → en "Activas" un cliente nunca se repite; solo se repiten episodios en "Resueltas", lo cual es correcto. No requiere cambios.

## I · Cross-cutting (fuera del panel, en radar para go-live)

| # | Sev | Estado | Punto | Ubicación / acción |
|---|-----|--------|-------|--------------------|
| I1 | 🟡 | ⏳ | `studio32-agent` (backend): `npm install` reporta **5 vulnerabilidades (4 moderate, 1 high)**. Revisar `npm audit` antes de go-live; evaluar `npm audit fix` (no `--force` a ciegas) | repo `10-producto/studio32-agent` |
| I2 | ⚪ | ⏳ | Los scripts de mantenimiento tienen mojibake en comentarios/salida (`Â·`, `organizaciÃ³n`) — cosmético, herramientas internas | `studio32-agent/scripts/*.js` |

---

## Verificado y sano (no requiere acción)
- 5 vistas recorridas logueado: **cero errores de consola/red**.
- Backend Railway responde; realtime conectado.
- `tsc -b` limpio; `npm test` 3/3; `dist/` no trackeado; `.gitignore` correcto.
- Responsive con breakpoints a 900px y 720px + `prefers-reduced-motion`.
- Vista Servicios (catálogo real de 11), Agente (config completa) y Citas (orden correcto) sin bugs de código.
