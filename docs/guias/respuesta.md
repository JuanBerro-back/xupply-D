# Diagnóstico del proyecto `xupply-D`

## 1. Lenguaje y framework

| Capa | Stack |
|---|---|
| Backend | **TypeScript + Express 4 + PostgreSQL** (`pg`, SQL crudo, **sin ORM**) + **Socket.IO**. JWT, bcryptjs, Helmet, Nodemailer, integración Wompi. |
| Frontend principal | **React 19 + Vite 7 + TypeScript + Tailwind CSS** (`app/frontend`), React Router 7, Leaflet, PWA. |
| Desktop / móvil | **Electron 31** (`app/main.js`) y **Capacitor 8** (`app/frontend/android`, paquete `com.xupply.app`). |

No hay Python ni `requirements.txt`/`pyproject.toml`: todo es ecosistema Node/TypeScript (`tsconfig` con `strict: true`, target ES2022).

## 2. Estado del proyecto

**Código existente y maduro, no es greenfield.** Evidencia:

- 64 commits, del 2026-09-28 al 2026-11-03; rama `main`, remote `github.com/JuanBerro-back/xupply-D.git`, working tree limpio.
- ~284 archivos versionados (60 `.ts`, 59 `.tsx`, 43 `.js`, SQL, Docker, docs).
- Documentación operativa extensa: `README.md`, `SECURITY-AUDIT.md`, `MIGRACION-BACKEND.md`, `PAGOS-WOMPI.md`, `REVISION-2026-10-27.md`, además de configuraciones de Render, DigitalOcean, Vercel y Caddy.

Cualquier trabajo sería **mantenimiento / refactor / extensión** sobre una arquitectura ya definida.

## 3. Capas y pruebas

**Sí, es monorepo con ambas capas** (npm workspaces: `app/backend`, `app/frontend`):

- **Backend/DB:** `app/backend/src/app.ts` monta 22 routers API (`/api/auth`, `/api/orders`, `/api/deliveries`, `/api/admin`, `/api/xupai`, `/api/payments`...); `src/shared/config/db.ts` usa `pg.Pool` con SQL directo y migraciones en `src/shared/lib/migrations.ts`; esquema en `app/backend/DB/xupply_schema_postgresql.sql`. Docker Compose usa `postgres:16-alpine`.
- **Frontend:** SPA React en `app/frontend/src` (incluye la landing pública en `modules/public/landing`), Electron y APK Capacitor.
- **Infra:** deploy/Dockerfile multi-stage, `deploy/docker-compose.yml` (app + DB + Caddy), `render.yaml`, `vercel.json`.

**Tests: no hay suite automatizada.** Concretamente:

- No existen `*.test.*`, `*.spec.*`, `__tests__/`, ni configuraciones de Jest/Vitest/Playwright/Cypress; ningún `package.json` tiene script `test`.
- `.github/workflows/ci.yml` solo hace `npm ci`, `typecheck` y `build` (además de `npm audit`).
- `app/backend/scripts/smoke.ts` es una prueba de integración **manual** (RBAC/facturación, crea y borra datos; no se ejecuta en CI).
- El único archivo `*Test.java` es el stub autogenerado de Capacitor.
- `REVISION-2026-10-27.md` lo confirma literalmente: *"Pruebas automatizadas: no existe ninguna suite."*

## Resumen

> **Express + PostgreSQL (sin ORM) + React/Vite**, proyecto consolidado, monorepo full-stack, sin framework de tests todavía.
