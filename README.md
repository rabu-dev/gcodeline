# GCodeLine

Plataforma SaaS colaborativa para equipos de desarrollo de juegos y simulacion que conecta gestion de proyecto, GitHub y metadata de Unreal Engine.

## Estructura

- `packages/backend`: backend TypeScript para auth, proyectos, tareas, assets, webhooks y builds.
- `packages/web`: SPA React + TypeScript para login, dashboard y trazabilidad.
- `packages/unreal-plugin`: esqueleto del plugin de Unreal Engine 5.
- `docs`: arquitectura y decisiones iniciales.
- `tests`: pruebas de integracion del MVP.

## Sprint 1

Este scaffold cubre los entregables base del primer sprint:

- arquitectura de alto nivel
- backend con endpoints del MVP
- frontend con flujo base de login y vistas
- esqueleto del plugin de Unreal
- prueba de integracion para task + asset + commit

## Monorepo

```bash
npm install
copy packages\\backend\\.env.example packages\\backend\\.env
npm run dev
```

## Scripts utiles

```bash
npm run dev
npm run build
npm run test --workspace @gcodeline/backend
```

## Variables necesarias

Configura [packages/backend/.env.example](/C:/Users/rabudev/Documents/Prochectos/GCodeLine/packages/backend/.env.example) como `.env`.

- `GITHUB_CLIENT_ID` y `GITHUB_CLIENT_SECRET`: activan OAuth real.
- `GITHUB_WEBHOOK_SECRET`: se usa para validar HMAC de webhooks.
- `DATABASE_PATH`: ruta del SQLite local para timeline, notificaciones, builds y cola de eventos.

## OAuth y webhooks

- `GET /api/auth/github/connect`: genera la URL real de autorizacion con `state`.
- `GET /api/auth/github/callback`: intercambia `code` por token con GitHub y persiste la integracion.
- `POST /api/integrations/github/webhook`: valida firma `x-hub-signature-256` y dispara trazabilidad y builds asincronos.

## Unreal plugin

El plugin ahora soporta:

- autenticacion real contra `POST /api/integrations/unreal/auth`
- envio autenticado de metadata de assets
- subida de snapshots base64 a `POST /api/integrations/unreal/assets/:id/snapshot`

## Tests

## Siguientes pasos recomendados

1. Sustituir el storage en memoria por Postgres + S3/MinIO.
2. Completar OAuth real de GitHub y firma HMAC de webhooks con secretos gestionados.
3. Persistir timeline, notificaciones y builds asincronos mediante colas/event bus.
4. Conectar el plugin de Unreal con autenticacion real y captura de thumbnails.
