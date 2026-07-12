# Studio32 Panel

Independent operational surface for Studio32 Agent Platform. It is designed
for `panel.studio32.es` and remains deployable separately from the commercial
website and the agent backend.

## Current scope

- Supabase email/password authentication.
- Organization membership discovery through the authenticated Agent API.
- Conversation inbox and message history.
- Human takeover, release and resolution controls.
- Human message composer when a delivery channel exists.
- Operational summary and upcoming appointments.
- Appointment list with controlled cancellation.
- Editable services and active agent knowledge.
- Supabase Realtime refresh for conversations, appointments and services.
- Responsive desktop/mobile layout.

## Run

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and set the Supabase publishable key. Never
place the Supabase secret/service-role key in this project.

The backend must allow the panel origin through `CORS_ORIGINS` and expose the
authenticated `/api` routes.

## Validate

```bash
npm test
npm run build
```

The browser only receives the Supabase publishable key. Authentication,
organization membership and every write action are validated again by the
backend; the service-role key is never part of this application.

## Deploy

The project is a Vite application. Use `npm run build` and publish `dist/`.
Configure the three `VITE_*` values from `.env.example` in the hosting provider
and add the final origin to the backend `CORS_ORIGINS` list.
