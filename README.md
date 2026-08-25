# Studio32 Panel

> Panel de control del agente de Studio32. Es donde el equipo del negocio ve las
> conversaciones en vivo y puede tomar el control de una cuando hace falta.

Vive en **`dashboard.studio32.es`** y se despliega por separado de la web comercial y del
backend del agente.

## Qué hace

- Autenticación con Supabase por correo y contraseña.
- Descubre a qué organizaciones pertenece la persona, preguntándoselo a la API del agente.
- Bandeja de conversaciones con el historial de mensajes.
- **Intervención humana:** tomar el control de una conversación, devolvérsela al agente y
  darla por resuelta.
- Redacción y envío de mensajes manuales cuando el canal lo permite.
- Resumen operativo y próximas citas.
- Listado de citas con cancelación controlada.
- Servicios y base de conocimiento del agente, editables.
- Refresco en tiempo real de conversaciones, citas y servicios con Supabase Realtime.
- Diseño adaptado a escritorio y a móvil.

## Seguridad

El navegador solo recibe la clave *publishable* de Supabase. **La clave de servicio nunca
entra en este proyecto.** La autenticación, la pertenencia a la organización y toda escritura
se vuelven a validar en el backend: el frontend no es la frontera de seguridad.

## Puesta en marcha

```bash
npm install
npm run dev
```

Copia `.env.example` a `.env.local` y rellena la clave publishable de Supabase.

El backend tiene que permitir el origen del panel en su `CORS_ORIGINS` y exponer las rutas
autenticadas de `/api`.

## Comprobar

```bash
npm test
npm run build
```

## Despliegue

Aplicación Vite: `npm run build` y se publica `dist/`.

Hoy se sirve desde **Cloudflare Pages** (`studio32-panel.pages.dev`). El `netlify.toml` que
queda en el repositorio es del despliegue anterior y ya no es lo que manda; sigue siendo útil
como referencia de los valores de build y del *fallback* de SPA.

En el proveedor de hosting hay que configurar los tres valores `VITE_*` de `.env.example`, y
añadir el origen final a la lista `CORS_ORIGINS` del backend.
