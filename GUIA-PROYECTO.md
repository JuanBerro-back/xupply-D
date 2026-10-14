# Xupply — Guía del Proyecto (dónde está cada cosa)

> Documento para orientarse rápido en el repo: backend, frontend, base de datos, landing, despliegues, dependencias y **dónde buscar/hacer cada cambio**.

---

## 1. Visión general (30 segundos)

**Xupply** es una plataforma B2B (restaurantes ↔ proveedores) de Bucaramanga:

- **Backend:** `app/server/` — Express + TypeScript + PostgreSQL (`pg`) + Socket.IO + JWT.
- **Frontend PWA:** `app/web/` — React 19 + Vite + Tailwind + React Router + Leaflet + Socket.IO-client. Instalable (PWA), con salida a **Android (Capacitor)** y **Escritorio (Electron)**.
- **Landing pública:** `landing/` — Astro (separada de la app).
- **Base de datos:** PostgreSQL 16. Esquema en `app/server/DB/xupply_schema_postgresql.sql` + migraciones en caliente en `app/server/src/lib/migrations.ts`.
- **Tiempo real:** Socket.IO (pedidos, entregas GPS, notificaciones).
- **IA:** Asistente general (`/api/ai`) + Agente de compra inteligente XupAI (`/api/xupai`, DeepSeek/OpenAI).

```
xupply-D/
├── app/server/      → BACKEND (API Express)
├── app/web/         → FRONTEND (React PWA)
├── app/main.js      → Electron (app escritorio)
├── app/scripts/     → Instalación local Windows
├── landing/         → Landing Astro (marketing)
├── Dockerfile, docker-compose.yml, Caddyfile
├── render.yaml, vercel.json   → despliegues
├── n8n.yml          → automatización opcional (n8n)
├── po.sql           → script SQL suelto (revisar antes de usar)
└── *.md             → documentación (ver §10)
```

---

## 2. Arranque rápido (desarrollo)

| Qué | Comando | Puerto / URL |
|---|---|---|
| Backend | `cd app/server` → `npm install` → `cp .env.example .env` → `npm run dev` | `http://localhost:4000` |
| Frontend | `cd app/web` → `npm install` → `npm run dev` | `http://localhost:5173` |
| Landing | `npm run landing` (desde raíz) | `http://localhost:4321` (Astro default) |
| Todo (portátil Windows) | doble clic `Iniciar-Xupply.cmd` / `Iniciar-Xupply.ps1` | abre Electron + Postgres portable |

Scripts del workspace raíz (`package.json`):
- `npm run web` → `npm run dev --prefix app/web`
- `npm run server` → `npm run dev --prefix app/server`
- `npm run landing` / `landing:build` / `landing:preview`

Usuarios demo (pass `demo1234`): `admin`, `gerente`, `empleado`, `proveedor`, `domiciliario`.

---

## 3. BACKEND — `app/server/`

### 3.1 Entrada y estructura

```
app/server/
├── .env.example        → plantilla de env (PORT, DATABASE_URL, JWT_SECRET, CLIENT_ORIGIN, EmailJS, DeepSeek/XupAI)
├── package.json        → deps backend + scripts dev/build/start/typecheck/smoke
├── tsconfig.json / tsconfig.smoke.json
├── index.js / index.ts → entrypoints legacy / compat Vercel
├── insert_vehicles.ts  → seed de vehículos
├── DB/
│   └── xupply_schema_postgresql.sql  → ESQUEMA CANÓNICO (675 líneas, 24 tablas)
├── dist/               → salida compilada (tsc). Lo sirve Docker/Render.
├── scripts/
│   ├── smoke.ts        → `npm run smoke` (prueba rápida API)
│   ├── populate_mock_data.js
│   └── README.md
└── src/
    ├── server.ts       → crea HTTP + Socket.IO, listen :4000, init DB, limpieza radar cada hora
    ├── app.ts          → define TODAS las rutas /api/*, /health, /download/apk, sirve web/dist en prod
    ├── config/
    │   ├── db.ts       → Pool pg, resolveDatabaseUrl() (DATABASE_URL → POSTGRES_URL* → POSTGRES_HOST* → localhost), SSL auto, initDatabase()
    │   └── schemaSql.ts→ esquema embebido para auto-init
    ├── middleware/
    │   ├── auth.ts     → JWT + roleRequired(...)
    │   └── error.ts    → notFound + errorHandler
    ├── lib/
    │   ├── migrations.ts      → ensureServerInitialized() + expireRadarItems() (migraciones runtime: purchase_orders, permisos, etc.)
    │   ├── realtime.ts        → setIo / registerSocket / emitToUser
    │   ├── audit.ts           → logAudit()
    │   ├── geo.ts / bucaramangaGeo.ts → utilidades GPS
    │   ├── radar.ts           → lógica Radar ofertas/alertas
    │   ├── oc.ts              → createPurchaseOrderDraft() (usado por purchaseOrders + xupai)
    │   └── email.ts           → EmailJS
    └── routes/  (19 archivos → prefijo en app.ts)
```

### 3.2 Mapa de rutas API (archivo → endpoint)

| Archivo `src/routes/` | Montaje en `app.ts` | Qué maneja |
|---|---|---|
| `auth.ts` | `/api/auth` | login, register, perfil, JWT |
| `users.ts` | `/api/users` | CRUD usuarios / equipo |
| `admin.ts` | `/api/admin` | super-admin: usuarios, roles, permisos, comercios, auditoría |
| `restaurants.ts` | `/api/restaurants` | restaurantes + sucursales (`branches`) |
| `suppliers.ts` | `/api/suppliers` | proveedores |
| `categories.ts` | `/api/categories` | `product_categories` |
| `products.ts` | `/api/products` | catálogo mayorista |
| `orders.ts` | `/api/orders` | pedidos B2B + `order_items` |
| `purchaseOrders.ts` | `/api/purchase-orders` | borradores OC (`POST /drafts`, `GET /`, `GET /:id`) |
| `inventory.ts` | `/api/inventory` | stock + `inventory_movements` |
| `invoices.ts` | `/api/invoices` | facturación + `invoice_items` |
| `accounting.ts` | `/api/accounting` | contabilidad / flujo caja (`accounting_transactions`) |
| `deliveries.ts` | `/api/deliveries` | logística, vehículos, GPS (`deliveries`, `vehicles`, `route_history`) |
| `dashboard.ts` | `/api/dashboard` | KPIs / resúmenes |
| `reviews.ts` | `/api/reviews` | reseñas (`Reseña`) |
| `radar.ts` | `/api/radar` | ofertas/alertas geolocalizadas |
| `ai.ts` | `/api/ai` | asistente general |
| `xupai.ts` | `/api/xupai` | **agente Compra Inteligente** (`GET /status`, `POST /agent`, 5 tools + gate de confirmación) |
| `agent.ts` | `/api/agent` | endpoints SOLO-LECTURA para el agente (consumo-histórico, último-pedido, catálogo-precios, proveedores-vigentes) |

Especiales en `app.ts`:
- `GET /health` y `/api/health` → `{status:"ok", service:"xupply-api", db:...}`.
- `GET /download/apk`, `/api/download/apk`, `/Xupply.apk` → sirve `Xupply.apk` (busca en `dist-apk/`, `web/dist/`, `web/public/`).
- Si existe `web/dist/index.html` → sirve el frontend estático + fallback SPA `*`.

### 3.3 Dependencias backend

Prod (`app/server/package.json`): `express ^4`, `pg ^8`, `socket.io ^4`, `jsonwebtoken ^9`, `bcryptjs ^2`, `cors ^2`, `dotenv ^16`.
Dev: `typescript ^5`, `tsx ^4` (para `npm run dev` = `tsx watch src/server.ts`), `@types/*`.

### 3.4 Dónde tocar en backend

- Nueva tabla/columna → 1) `DB/xupply_schema_postgresql.sql`, 2) `src/config/schemaSql.ts` (si aplica), 3) `src/lib/migrations.ts` (ALTER/CREATE IF NOT EXISTS runtime).
- Nuevo endpoint → crear en `src/routes/<modulo>.ts` + montar en `src/app.ts`.
- Permisos/roles → `src/middleware/auth.ts` + tabla `permissions`/`role_permissions` + `src/routes/admin.ts`.
- Tiempo real → `src/lib/realtime.ts` + `src/server.ts` (join `user:{id}`, `admins`).
- IA XupAI → `src/routes/xupai.ts` (prompt + loop + tools), lógica OC en `src/lib/oc.ts`.

---

## 4. FRONTEND — `app/web/`

### 4.1 Entrada y config

```
app/web/
├── index.html, vite.config.ts (proxy /api, /download, /socket.io → VITE_BACKEND_TARGET o 127.0.0.1:4000), tailwind.config.js, postcss.config.js
├── capacitor.config.ts + android/ (com.xupply.app) → APK
├── public/ (favicon, manifest.webmanifest, sw.js, Xupply.apk, logo.svg, login-bg.mp4, logistica.png)
└── src/
    ├── main.tsx        → bootstrap React + providers
    ├── App.tsx         → TODAS las rutas (ver tabla)
    ├── types.ts, index.css, vite-env.d.ts
    ├── lib/
    │   ├── api.ts     → getApiOrigin(), api<T>() (fetch a /api), token localStorage, DEFAULT_RENDER_URL, getApkDownloadUrl()
    │   ├── socket.ts  → connectSocket({userId, role, restaurantId, supplierId})
    │   ├── permissions.ts / planAccess.ts → hasAdminAccess(), gating por plan
    │   ├── constants.ts, location.ts, bucaramangaGeo.ts
    ├── context/ (5)
    │   ├── AuthContext.tsx, CartContext.tsx, NotificationContext.tsx, ThemeContext.tsx, LanguageContext.tsx
    ├── components/ (17)
    │   └── Navbar, BottomNav, SideCart, AdminLayout, AiFloatingWidget, Toasts, NotificationBell, HamburgerDrawer, OrderCard, Modal, ConfirmDialog, Logo, Icons, CookieConsent, TermsModal, AppDownloadNotice, RecommendedSuppliersGallery
    └── pages/ + pages/admin/
```

### 4.2 Mapa de rutas frontend (`src/App.tsx`)

| Ruta | Página | Roles (`RolesAllowed` / `RequireAuth`) |
|---|---|---|
| `/` | `Landing.tsx` o `Dashboard.tsx` (según sesión; admin → `/admin`) | pública / auto |
| `/login`, `/register` | `Login.tsx`, `Register.tsx` | pública (si hay sesión → `/`) |
| `/catalogo` | `Catalog.tsx` | admin, gerente, empleado, proveedor_admin |
| `/carrito` | `CartPage.tsx` | gerente, empleado |
| `/pedidos`, `/pedidos/:id` | `Orders.tsx`, `OrderDetail.tsx` | cualquier logueado |
| `/inventario` | `Inventory.tsx` | gerente, empleado |
| `/radar` | `Radar.tsx` | admin, gerente, empleado, proveedor_admin |
| `/facturacion` | `Invoices.tsx` | admin, gerente, proveedor_admin |
| `/contabilidad` | `Accounting.tsx` | admin, gerente, proveedor_admin |
| `/proveedores` | `Suppliers.tsx` | logueado |
| `/clientes` | `PosiblesClientes.tsx` | proveedor_admin, admin |
| `/logistica` | `Deliveries.tsx` | admin, gerente, proveedor_admin, domiciliario |
| `/repartidor` | `DriverDashboard.tsx` | domiciliario, admin |
| `/planes` | `Plans.tsx` | logueado |
| `/xupply-ia` | `AiAssistant.tsx` | logueado |
| `/equipo` | `TeamManagement.tsx` | admin, gerente, proveedor_admin |
| `/descargar` | `DownloadApp.tsx` | pública |
| `/admin` + `usuarios/roles/permisos/comercios` | `AdminLayout.tsx` + `pages/admin/*.tsx` | `hasAdminAccess()` |
| `/comercio/:type/:id`, `/mi-perfil` | `ComercioProfile.tsx`, `MyProfile.tsx` | logueado |

Layout global en `App.tsx`: `Navbar` + `BottomNav` + `SideCart` + `Toasts` + `AiFloatingWidget` + `CookieConsent`.

### 4.3 Dependencias frontend

Prod (`app/web/package.json`): `react ^19`, `react-dom`, `react-router-dom ^6`, `socket.io-client ^4`, `leaflet ^1` + `react-leaflet ^5` (mapas), `lucide-react` (iconos), `@capacitor/{core,android,geolocation}`, `@capgo/capacitor-updater`.
Dev: `vite ^5`, `@vitejs/plugin-react`, `tailwindcss ^3`, `postcss`, `autoprefixer`, `typescript ^5`.

### 4.4 Dónde tocar en frontend

- Nueva pantalla → `src/pages/<Nombre>.tsx` + ruta en `src/App.tsx` + link en `Navbar.tsx` / `BottomNav.tsx` / `HamburgerDrawer.tsx`.
- Llamar a la API → `src/lib/api.ts` → `api<T>('/ruta', {method, body})`.
- Estado global → `src/context/*` (auth, carrito, notificaciones, tema, idioma).
- Permisos UI → `src/lib/permissions.ts`, `src/lib/planAccess.ts`.
- Mapas/GPS → `Radar.tsx`, `Deliveries.tsx`, `DriverDashboard.tsx` + `src/lib/location.ts` + `bucaramangaGeo.ts`.
- PWA → `public/manifest.webmanifest`, `public/sw.js`. APK → `capacitor.config.ts`, `android/`, `build-apk.ps1`.

---

## 5. BASE DE DATOS — PostgreSQL

- **Motor:** PostgreSQL 16 (Docker `postgres:16-alpine`; local se pide 16 o 18).
- **Esquema canónico:** `app/server/DB/xupply_schema_postgresql.sql` (~675 líneas). Se monta en Docker como `/docker-entrypoint-initdb.d/01-schema.sql` y se auto-aplica al arrancar vía `initDatabase()` + `ensureServerInitialized()`.
- **Conexión:** `app/server/src/config/db.ts` → orden: `DATABASE_URL` → `POSTGRES_URL*` → `POSTGRES_HOST/USER/DATABASE` → fallback `postgres://postgres:postgres@127.0.0.1:5432/xupply`. SSL auto para Neon/Render/Supabase/Vercel.
- **Tablas (24):** `roles`, `permissions`, `role_permissions`, `restaurants`, `branches`, `users`, `suppliers`, `product_categories`, `products`, `inventory`, `menu_products`, `recipes`, `orders`, `order_items`, `invoices`, `invoice_items`, `Reseña`, `accounting_transactions`, `vehicles`, `deliveries`, `delivery_items`, `route_history`, `inventory_movements`, `audit_log` (+ runtime: `purchase_orders`, `purchase_order_items` + enum `purchase_order_status` vía `migrations.ts`).
- **Archivo suelto:** `po.sql` en raíz (script auxiliar; revisar antes de ejecutar, no es el esquema oficial).
- **Dónde tocar:** cambios de modelo → esquema SQL + `migrations.ts` + tipos en `app/web/src/types.ts` si el front los consume.

---

## 6. LANDING — `landing/` (Astro)

```
landing/
├── astro.config.mjs, package.json (solo `astro ^5`)
├── public/  → estáticos landing
└── src/
    ├── config.ts, styles/
    └── pages/index.astro  → página única
```

Scripts: `npm run landing` (dev), `landing:build`, `landing:preview`. Es independiente de `app/web` (que tiene su propio `Landing.tsx` interno).

---

## 7. ESCRITORIO / MÓVIL / PWA

| Target | Dónde | Cómo se genera |
|---|---|---|
| PWA | `app/web/public/manifest.webmanifest` + `sw.js` | automático con `vite build` |
| Android APK | `app/web/android/` (`com.xupply.app`) + `capacitor.config.ts` | `build-apk.ps1` o `npm run build:apk --prefix app/web` → deja `Xupply.apk` en `app/web/public/` |
| Escritorio Electron | `app/main.js` + `app/package.json` (`electron ^31`) | `npm run setup` (`scripts/setup.ps1`) luego `npm start` en `app/` |
| Portable Windows | `Iniciar-Xupply.cmd` / `.ps1`, `LEER-YA.txt` | levanta Postgres portable + esquema + Electron |

---

## 8. VARIABLES DE ENTORNO

Plantillas: `.env.production.example` (raíz) y `app/server/.env.example` (son espejo).

| Variable | Dónde se usa | Descripción |
|---|---|---|
| `PORT` | server, Docker (4420), Caddy | puerto API (dev 4000) |
| `DATABASE_URL` | `src/config/db.ts`, `render.yaml`, compose | conexión Postgres |
| `POSTGRES_DB/USER/PASSWORD` | `docker-compose.yml`, `.env.production` | credenciales DB Docker |
| `JWT_SECRET` | auth middleware | firma de tokens |
| `CLIENT_ORIGIN` | CORS + Socket.IO | origen permitido PWA |
| `DOMAIN` | `Caddyfile`, compose | dominio prod (HTTPS auto) |
| `VITE_API_URL` / `VITE_BACKEND_TARGET` | `web/src/lib/api.ts`, `vite.config.ts` | override URL API en build/dev |
| `DEEPSEEK_API_KEY` / `XUPAI_API_KEY`, `XUPAI_MODEL`, `XUPAI_BASE_URL` | `routes/xupai.ts` | agente compra inteligente |
| `EMAILJS_*` | `lib/email.ts` | envío correos |
| `VERCEL=1`, `POSTGRES_URL*` | `db.ts`, `app.ts` | modo Vercel/Neon |

---

## 9. DESPLIEGUE (dónde está cada config)

| Destino | Archivos | Notas |
|---|---|---|
| Docker Compose (DigitalOcean) | `docker-compose.yml` (app+db+caddy), `Dockerfile` (build web+server, sirve en 4420), `Caddyfile` (`{$DOMAIN}` → `app:4420`), `DIGITALOCEAN.md` | `.env.production` requerido |
| Render | `render.yaml` (web `xupply` + db `xupply-db` free), `RENDER.md` | `DEFAULT_RENDER_URL=https://xupply-d.onrender.com` en front |
| Vercel | `vercel.json` (services server/web, rewrites `/api/*`, `/health`, `/socket.io/*`, `/download/*` → server; resto → web) | requiere `DATABASE_URL` en Settings |
| n8n opcional | `n8n.yml` (servicio `n8nio/n8n`, puerto 5678) | ver `AGENTE_CAMBIOS.md` (decisión: XupAI vive en backend, n8n opcional) |

---

## 10. DOCUMENTACIÓN EXISTENTE (qué leer según qué)

| Archivo | Contenido |
|---|---|
| `README.md` | overview, módulos, requisitos, puesta en marcha |
| `LEER-YA.txt` | modo portátil Windows |
| `AGENTE_CAMBIOS.md` | **bitácora del agente XupAI** (tablas, endpoints, widget, env) — leer antes de tocar IA/OC |
| `CHANGELOG-admin-2026-09.md` | cambios panel admin |
| `RENDER.md` / `DIGITALOCEAN.md` | guías deploy |
| `app/LEER-ESCRITORIO.md` (citado en README) | Electron escritorio |
| `app/server/scripts/README.md` | scripts backend |
| `app/scripts/*.ps1` | `setup.ps1`, `provision.ps1`, `instalar-postgres.ps1` |

---

## 11. RECETA: "quiero cambiar X → voy a Y"

- **Agregar columna a productos** → `DB/xupply_schema_postgresql.sql` + `lib/migrations.ts` (ALTER) + `routes/products.ts` + `pages/Catalog.tsx` / `Inventory.tsx` + `types.ts`.
- **Nuevo rol** → tabla `roles`/`permissions` + `middleware/auth.ts` (`roleRequired`) + `lib/permissions.ts` (front) + `App.tsx` (`RolesAllowed`) + `pages/admin/RolesAdmin.tsx`.
- **Nuevo endpoint** → `server/src/routes/*.ts` + montar en `server/src/app.ts` + consumir con `api()` en `web/src/lib/api.ts`.
- **Notificación tiempo real** → emitir en backend con `emitToUser()` (`lib/realtime.ts`) + escuchar en front con `connectSocket()` (`lib/socket.ts`) + `NotificationContext.tsx` / `Toasts.tsx`.
- **Mapa/GPS** → backend `routes/deliveries.ts` + `lib/geo.ts`; front `Deliveries.tsx` / `DriverDashboard.tsx` / `Radar.tsx` (Leaflet).
- **IA** → general: `routes/ai.ts` + `pages/AiAssistant.tsx` + `AiFloatingWidget.tsx`; compras: `routes/xupai.ts` + `lib/oc.ts` + `routes/agent.ts` + `routes/purchaseOrders.ts`.
- **Estilos/tema** → `tailwind.config.js`, `src/index.css`, `context/ThemeContext.tsx`.
- **Error de CORS/API URL** → revisar `CLIENT_ORIGIN`, `VITE_API_URL`, `getApiOrigin()` en `lib/api.ts`, proxy en `vite.config.ts`.

---

## 12. Chequeos antes de commitear

```bash
# Backend
cd app/server && npm run typecheck   # tsc --noEmit + smoke
# Frontend
cd app/web && npm run typecheck      # tsc -b --noEmit
```

Salud: `GET /health` → `{"status":"ok","service":"xupply-api"}` (+ `db`, `users_count`).

---

## 13. BITÁCORA DE CAMBIOS (sesión actual)

### 13.1 Fondo del Login — quitar video .mp4, poner cielo estrellado brand (2026-10-14)

**Motivo:** el `login-bg.mp4` se veía mal; se quería un fondo llamativo, seguro y acorde a los azules de la página. Base tomada de `prueba.txt` (raíz).

**Archivos tocados (solo login, nada más):**
- **NUEVO:** `app/web/src/pages/Login.css` — estilos exclusivos del login (prefijo `login-` para no afectar al resto):
  - `.login-bg` → degradado brand `radial sky-400/20 + radial brand/30 + linear #082f49 → #0c4a6e → #020617`.
  - `.login-stars` + `.login-stars::after` → estrellas de `prueba.txt` con `box-shadow`, algunas tintadas `#bae6fd / #7dd3fc`, animación `login-twinkle` (8s + 6s reverse).
  - `.login-shooting-star` (x3) → fugaces celestes `linear #e0f2fe → transparent`, animación `login-shoot` 7s con delays 0s / 2.2s / 4.4s.
  - `prefers-reduced-motion` → desactiva animaciones.
- **EDITADO:** `app/web/src/pages/Login.tsx`
  - `import './Login.css'`.
  - Quitado: `<video src="/login-bg.mp4">` + overlay `bg-black/40`.
  - Puesto: `div.login-stars` + 3x `div.login-shooting-star` + 2 orbes blur (`bg-sky-400/20`, `bg-brand/30`) + viñeta `gradient-to-t from-[#020617]/60`.
  - Tarjeta blanca del formulario intacta. `public/login-bg.mp4` se deja en disco (borrable).
- **Colores brand ref:** `app/web/tailwind.config.js` → `brand #0284c7 / dark #0369a1 / light #38bdf8`.

### 13.2 Simulador de pedidos arranca en 0 (2026-10-14)

**Motivo:** el simulador de `Landing.tsx` arrancaba con cantidades precargadas.

**Archivo tocado:** `app/web/src/pages/Landing.tsx` (sección simulador `id="simulador"`, líneas ~16-45 y ~301-314):
- Estado inicial (l.305): `{101:3, 102:2, 103:4, 104:1, 105:2}` → `{}`.
- Los 20 `defaultQty` de `simulatorProductsByType` (burger 101-105, pizza 201-205, café 301-305, parrilla 401-405) → `defaultQty: 0`.
- `handleTypeChange` (l.314): `initialQty[p.id] = p.defaultQty ?? 1` → `initialQty[p.id] = 0` (si no, al cambiar de tipo se volvía a llenar).
- Resultado: cantidades, subtotal, ahorro FEFO, impuesto 8% y total arrancan en `$0 COP`. Lógica de cálculo (`rawSubtotal`, `fefoSavings`, `tax`, `totalPayable`, `handleQuantity`, `handleEmitOrder`/CUFE) sin cambios.
