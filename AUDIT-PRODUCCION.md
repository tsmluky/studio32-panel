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
| A2 | 🟠 | ⏳ | `.env.example` **también** apunta a Bonto; quien lo copie arranca contra el backend muerto | `.env.example:3` → Railway o placeholder |
| A3 | 🟡 | ⏳ | Verificar en Netlify que `VITE_AGENT_API_URL` = Railway antes del go-live (no fiarse de memoria) | Netlify env vars |
| A4 | ⚪ | ⏳ | Sin favicon: la pestaña muestra el icono por defecto del navegador | `index.html` + `public/favicon` |
| A5 | ⚪ | ⏳ | `.claude/launch.json` (helper dev) sin trackear; decidir si se ignora | `.gitignore` |

## B · Correctitud (código)

| # | Sev | Estado | Punto | Ubicación / acción |
|---|-----|--------|-------|--------------------|
| B1 | 🟠 | ✅ | "Próximas citas" mostraba solo la hora → contradecía "Citas de hoy" y parecía desordenada. Ahora `Hoy/Mañana/Mié 15 Jul` + hora | `views/OverviewView.tsx`, `styles.css` |
| B3 | 🟠 | ✅ | Contador "En humano" contaba conversaciones resueltas (mostraba 2 en filtro Resueltas). Ahora excluye resueltas | `App.tsx:215` |
| B4 | 🟡 | ⏳ | `useEffect` de `me` depende solo de `[session]` pero usa `organizationId` → closure obsoleta (funciona por lectura inicial de localStorage) | `App.tsx:178` |
| B5 | 🟡 | ⏳ | Los contadores de cabecera del inbox (Abiertas / En humano / Última actividad) se calculan sobre la lista **filtrada**, no sobre estado global. Deberían venir de `/summary` | `App.tsx:215` |
| B6 | 🟡 | ⏳ | Filtro "En humano" usa `&control_mode=human` sin `status` → trae también resueltas en humano (raíz de B3) | `App.tsx:156` (`filterQuery`) |
| B7 | 🟠 | ✅ | `madridDay()` usaba offset fijo `+02:00`. Ahora deriva el offset real de Madrid (`madridOffset`): `+02:00` verano / `+01:00` invierno. Verificado en Node | `views/OverviewView.tsx` |
| B8 | 🟡 | ⏳ | "Última actividad" usa `conversations[0]?.last_message_at` asumiendo orden desc del backend; debería tomar el máximo, no el `[0]` | `App.tsx:215` |

## C · Seguridad y roles

| # | Sev | Estado | Punto | Ubicación / acción |
|---|-----|--------|-------|--------------------|
| C1 | 🟡 | ✅ | `ServicesView`: inputs `disabled` y "Guardar" oculto para `viewer`; muestra "solo lectura" | `views/ServicesView.tsx` |
| C2 | 🟡 | ✅ | `AgentView`: textareas `disabled` y "Guardar" oculto para `viewer` | `views/AgentView.tsx` |
| C3 | 🟡 | ✅ | `AppointmentsView`: botón "Cancelar" oculto para `viewer` | `views/AppointmentsView.tsx` |
| — | — | — | Referencia correcta: el Inbox sí usa `canWrite = role !== 'viewer'` | `App.tsx:119` |

## D · UX, copy y estados

| # | Sev | Estado | Punto | Ubicación / acción |
|---|-----|--------|-------|--------------------|
| D1 | ⚪ | ⏳ | "Primera valoración (gratuita)" muestra "0 EUR" en vez de "Gratis" cuando `price_amount === 0` | `ServicesView` (lista) y donde se pinte precio |
| D3 | 🟠 | ✅ | Errores de login mapeados a español (`loginErrorES`: credenciales, no confirmado, rate limit, red) + try/catch | `App.tsx` `Login` |
| D4 | 🟠 | ⏳ | No hay recuperación de contraseña ("¿Olvidaste tu contraseña?"). El cliente lo necesitará en producción | `App.tsx` `Login` (feature) |
| D5 | 🟠 | ✅ | `ErrorBoundary` envolviendo la app con fallback "Algo ha fallado / Recargar" | `App.tsx` |
| D11 | ⚪ | ⏳ | Iconos del sidebar son glifos unicode (`◫ ⌁ □ ◇ ✦`); renderizan distinto según SO/fuente y se ven amateur. Cambiar a SVG | `App.tsx` sidebar |
| D12 | ⚪ | ⏳ | Composer sin enviar con Enter ni límite de caracteres | `App.tsx` `ConversationDetail` |
| D13 | ⚪ | ⏳ | El screenshot del navegador embebido se colgaba (render pesado); revisar rendimiento/CSS en Chrome real del cliente | — |

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
