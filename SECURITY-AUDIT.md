# Auditoría de Seguridad — Xupply Backend

**Repositorio auditado:** `JuanBerro-back/xupply-D` (HEAD)
**Despliegue en vivo analizado:** `https://xupply-d.vercel.app`
**Fecha:** 2026-10-24
**Alcance:** API Express + Socket.IO (`app/server`), SPA (`app/web`), configuración de despliegue (Vercel, Render, Docker, Caddy) y base de datos PostgreSQL.
**Objetivo:** dejar el backend listo para la fase de producción y para la migración a `cheche2813/Hackathon-Xupply`.

---

## 1. Resumen ejecutivo

Se identificaron **3 vulnerabilidades críticas (P0)** y **12 de severidad alta/media (P1)**. Todas las de código están corregidas en esta rama. Quedan **3 riesgos aceptados/documentados** que requieren una decisión de producto o infraestructura.

| # | Hallazgo | Severidad | Estado |
|---|---|---|---|
| 1 | Credenciales de administrador por defecto (`admin` / `demo1234`) | **P0 — Crítica** | Corregido |
| 2 | IDOR / escritura cruzada en productos de proveedor | **P0 — Crítica** | Corregido |
| 3 | Socket.IO sin autenticación (suplantación de rol y salas) | **P0 — Crítica** | Corregido |
| 4 | Cambio de plan de suscripción por cualquier usuario | P1 — Alta | Corregido |
| 5 | Fuga y bypass del código de confirmación de entrega | P1 — Alta | Corregido |
| 6 | Abuso de XupAI (coste/DoS) y propuestas manipulables | P1 — Alta | Corregido |
| 7 | CORS abierto y `trust proxy` mal configurado | P1 — Alta | Corregido |
| 8 | Fuga de detalles internos en errores 500 | P1 — Alta | Corregido |
| 9 | Ausencia de cabeceras de seguridad | P1 — Alta | Corregido |
| 10 | Fuga entre inquilinos y datos falsos en dashboard | P1 — Alta | Corregido |
| 11 | Bypass de estado `entregado` y usuarios sin inquilino | P1 — Alta | Corregido |
| 12 | Spam de reseñas y asignación arbitraria de columnas | P1 — Alta | Corregido |
| 13 | CRUD de vehículos y sucursales sin aislamiento | P1 — Media/Alta | Corregido |
| 14 | Paginación sin límite en panel admin | P1 — Media | Corregido |
| 15 | Siembra de datos demo y `UPDATE` peligrosos al arrancar | P1 — Media | Corregido |
| 16 | JWT en `localStorage` (robo vía XSS) | P2 — Media | Mitigado / aceptado |
| 17 | Precios de factura controlados por el cliente | P2 — Media | Aceptado (documentado) |
| 18 | Rate limiting en memoria (no distribuido) | P3 — Baja | Documentado |
| 19 | Socket.IO no funciona en Vercel (serverless) | P2 — Operativo | Documentado |

---

## 2. Hallazgos críticos (P0)

### 2.1 Credenciales de administrador por defecto — CRÍTICO

**Evidencia (despliegue en vivo, antes del fix):**

```
POST https://xupply-d.vercel.app/api/auth/login
{"username":"admin","password":"demo1234"}
→ 200 OK + token con role=admin
```

Las credenciales también estaban visibles en `app/web/src/pages/Login.tsx`, en `README.md` y en `LEER-YA.txt`. Cualquier persona con acceso a la URL podía tomar el control total de la plataforma (usuarios, pedidos, facturación, auditoría).

**Causa raíz:** el esquema semilla creaba cinco usuarios (`admin`, `gerente`, `empleado`, `proveedor`, `domiciliario`) con el mismo hash bcrypt de `demo1234`, y ese esquema se aplicaba en todos los entornos.

**Corrección aplicada:**

- `app/server/src/config/db.ts`: `shouldSeedDemoData()` — los datos demo solo se siembran con `SEED_DEMO_DATA=true` (por defecto `false` en producción/Vercel).
- `ensureBootstrapAdmin()`: crea un único administrador a partir de `ADMIN_USERNAME` / `ADMIN_PASSWORD` (mínimo 12 caracteres), nunca credenciales por defecto.
- `neutralizeDemoCredentials()`: en producción, cualquier cuenta heredada que todavía use el hash demo es **desactivada**, se le asigna un hash aleatorio y se invalidan sus tokens. Si coincide con `ADMIN_USERNAME` y hay `ADMIN_PASSWORD`, se rota a la contraseña nueva.
- Se eliminaron las credenciales de demostración de la UI (`Login.tsx`), del `README.md` y de `LEER-YA.txt`.
- `app/server/DB/xupply_schema_postgresql.sql`: aviso de seguridad y bloque demo delimitado; `docker-compose.yml` ya no monta ese SQL como init (evita recrear usuarios demo).

> ⚠️ **Acción obligatoria al desplegar:** el fix de código no borra las cuentas ya existentes en la base de datos de producción. Al arrancar la nueva versión con `SEED_DEMO_DATA=false`, `neutralizeDemoCredentials()` las bloquea automáticamente. Verifica los logs `[SECURITY]`.

### 2.2 IDOR en productos de proveedor — CRÍTICO

**Evidencia:** `GET/PUT/DELETE /api/products/:id` no comprobaba que el producto perteneciera al proveedor del usuario. Un proveedor podía leer, editar y borrar el catálogo de otro cambiando el `id`.

**Corrección:** `app/server/src/routes/products.ts`

- Lectura/edición/borrado exigen `product.supplier_id === req.user.supplier_id` (o `admin`).
- `POST` fuerza el `supplier_id` del token, ignorando el del body.
- `roleRequired('proveedor_admin', 'admin')` en escritura.
- Validación de precios, stock y campos permitidos (whitelist).

### 2.3 Socket.IO sin autenticación — CRÍTICO

**Evidencia:** cualquier cliente podía conectarse sin token y ejecutar `client:identify` con `role=admin`, uniéndose a salas como `admins` y recibiendo pedidos, GPS y auditoría de toda la plataforma.

**Corrección:**

- `app/server/src/server.ts`: middleware de handshake que exige JWT (`auth.token` o `?token=`), valida `HS256`, consulta la BD y verifica `is_active` + `token_version`. Una sesión revocada ya no puede reconectarse.
- `app/server/src/lib/realtime.ts`: las salas se derivan **solo** de la identidad del token (`user:<id>`, `restaurant:<id>`, `supplier:<id>`, `admins`). Se eliminó `client:identify` y los parámetros de identidad por query.
- `join:delivery` y `delivery:position` validan que el usuario sea el conductor asignado, el proveedor dueño o un administrador.
- CORS de Socket.IO fail-closed en producción.
- `app/web/src/lib/socket.ts`: el cliente envía únicamente el JWT.

---

## 3. Hallazgos altos (P1)

### 3.1 Plan de suscripción gratuito
`POST /api/auth/subscription-plan` permitía a cualquier usuario con restaurante cambiarse a un plan premium. Ahora exige `roleRequired('admin')` y valida el plan contra una lista permitida.

### 3.2 Código de confirmación de entrega
El código se devolvía en las respuestas de pedidos/entregas y `POST /api/deliveries/:id/confirm` no limitaba intentos ni roles.

- `redactDelivery()` + `canSeeConfirmationCode()`: el código solo lo ven `admin`, el proveedor dueño y el domiciliario asignado.
- `POST /:id/confirm`: solo `gerente`, `empleado` y `admin`; rate limit de 5 intentos / 10 minutos; comparación en tiempo constante.
- `PATCH /:id/status` y `PATCH /api/orders/:id/status` bloquean el paso a `entregado` para roles no autorizados (evita cerrar entregas sin el código).

### 3.3 Abuso de XupAI
`POST /api/xupai/chat` no tenía límite y aceptaba propuestas/estado enviados por el cliente, lo que permitía quemar créditos del proveedor de IA y confirmar acciones sin pasar por el flujo real.

- Rate limit por usuario: 30 peticiones / 10 minutos.
- Estado de propuestas en servidor (`pendingProposals`, TTL 10 minutos).
- Topes de longitud de mensaje e historial.
- Los errores del proveedor ya no se reenvían al cliente.

### 3.4 CORS y proxy
- `CLIENT_ORIGIN` ahora es una lista blanca real. En producción, sin lista, **no se permite ningún origen cruzado** (antes `*`).
- Se eliminó el `*` de `render.yaml`.
- `app.set('trust proxy', 1)` para que `req.ip` (rate limit y auditoría) use la IP real detrás de Vercel/Caddy.

### 3.5 Fuga de información en errores
`errorHandler` devolvía `err.message` y stack traces. Ahora:

- Responde `{ error, requestId }` genérico en 500.
- Solo expone mensajes marcados con `expose`/`status < 500`.
- Registra el detalle completo en logs del servidor.

### 3.6 Cabeceras de seguridad
No había CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` ni HSTS.

- `helmet` en `app.ts` con CSP completa (scripts propios, estilos inline, fuentes de Google, imágenes https), HSTS, `X-Frame-Options: DENY`, `nosniff` y `Referrer-Policy`.
- CSP y cabeceras equivalentes en `vercel.json` y `Caddyfile` (defensa en profundidad).
- `x-powered-by` deshabilitado.
- Límite de body JSON a `1mb`.

### 3.7 Dashboard: fuga entre inquilinos y datos falsos
`/api/dashboard/*` mezclaba datos de otros restaurantes y usaba `.catch()` que devolvía cifras inventadas. Ahora:

- Cada consulta filtra por el `restaurant_id` real del usuario.
- Se eliminaron todos los fallbacks fabricados.
- Las alertas de stock y el directorio de prospectos respetan el inquilino y solo exponen campos públicos.

### 3.8 Bypass de estados y usuarios sin inquilino
- `entregado` solo lo puede fijar `admin` en los endpoints de pedidos.
- Los cambios de estado están acotados por rol.
- Los usuarios sin restaurante/proveedor se rechazan por defecto (default-deny) en lugar de permitir acceso global.

### 3.9 Reseñas
- Whitelist de columnas (evita inyección de campos).
- `rating` entero entre 1 y 5.
- Verificación de que el proveedor exista.
- Una reseña por usuario y proveedor (índice único).

### 3.10 Vehículos y sucursales
- El CRUD de vehículos valida el `supplier_id` del token.
- Asignación de conductor/vehículo valida que pertenezcan al mismo proveedor.
- Las sucursales se validan contra el restaurante del usuario antes de usarlas en pedidos.

### 3.11 Paginación del panel admin
`/api/admin/users` y `/api/admin/audit` aceptaban `limit` arbitrario (hasta agotar memoria). Ahora `pagination()` limita a 100 usuarios y 200 filas de auditoría.

### 3.12 Arranque peligroso
- Se eliminaron `UPDATE users SET supplier_id = 1` y el reseteo de inquilinos al arrancar.
- Se eliminó `repairLegacySeedPasswords()`.
- Migraciones idempotentes: columnas e índices con `IF NOT EXISTS`, índice único de reseñas, `driver_id` en vehículos.

---

## 4. Riesgos aceptados / pendientes

| Riesgo | Motivo | Mitigación actual | Recomendación |
|---|---|---|---|
| **JWT en `localStorage`** | Cambiar a cookies `httpOnly` implica rehacer el flujo de auth en web + Android. | CSP estricta, tokens de 12 h, `token_version` y validación en BD en cada petición y handshake. | Migrar a cookies `httpOnly` + `SameSite=Strict` y CSRF token en la fase 2. |
| **Precios de factura** (`unit_price` del cliente) | La UI permite precios libres (facturación POS). Solo afecta la contabilidad del propio restaurante; no hay cruce de inquilinos. | Totales recalculados en servidor; validación de cantidades. | Si se requiere integridad fiscal, calcular desde el catálogo y bloquear precios manuales. |
| **Rate limit en memoria** | Sin Redis en la arquitectura actual. | Límites por proceso y por usuario/IP. | Usar Upstash Redis / rate-limit distribuido si se escala a varias instancias. |
| **Socket.IO en Vercel** | Vercel es serverless; no mantiene conexiones persistentes. | La app funciona con polling HTTP; `server.ts` no intenta escuchar en Vercel. | Desplegar el backend en Render/VPS/Docker para tiempo real. |
| **Sin MFA** | Fuera del alcance de la hackathon. | Contraseñas bcrypt (12 rounds), sesiones cortas. | Añadir TOTP para roles `admin`/`gerente`. |

---

## 5. Verificación realizada

- `npm run typecheck` en `app/server` → sin errores (`tsc --noEmit` + `tsconfig.smoke.json`).
- `npx tsc -b --noEmit` y `npm run build` en `app/web` → sin errores.
- `npm audit` en backend → 0 vulnerabilidades.
- Pruebas manuales contra el despliegue en vivo (antes del fix): login demo, `/health`, cabeceras, `/socket.io`.
- Revisión estática de todos los routers, middleware, migraciones y configuración de despliegue.

---

## 6. Checklist de despliegue seguro

1. **Rotar secretos inmediatamente**
   - `JWT_SECRET` nuevo (64+ caracteres aleatorios): invalida todas las sesiones.
   - Contraseña de la base de datos.
   - Claves de XupAI / EmailJS si estuvieron expuestas.
2. **Configurar variables** (ver `.env.production.example`):
   - `NODE_ENV=production`
   - `JWT_SECRET`, `JWT_EXPIRES_IN=12h`
   - `CLIENT_ORIGIN=https://tu-dominio`
   - `SEED_DEMO_DATA=false`
   - `ADMIN_USERNAME` / `ADMIN_PASSWORD` (solo el primer arranque)
3. **Verificar que las cuentas demo quedaron bloqueadas**
   - Revisar logs `[SECURITY] ... bloqueadas`.
   - Consulta de control:
     ```sql
     SELECT id, username, is_active FROM users
     WHERE username IN ('admin','gerente','empleado','proveedor','domiciliario');
     ```
4. **Confirmar cabeceras** con `curl -I https://tu-dominio/`:
   - `content-security-policy`, `x-content-type-options`, `x-frame-options`, `referrer-policy`, `strict-transport-security`.
5. **Confirmar que `/health` no filtra información** y que responde 503 si la BD falla.
6. **Probar el flujo completo** con una cuenta real: login, catálogo, pedido, entrega, confirmación con código, facturación.
7. **Realtime:** verificar Socket.IO solo en el host persistente (no Vercel).

---

## 7. Archivos modificados

```
app/server/src/app.ts                     cabeceras, CORS, límites, health
app/server/src/server.ts                  auth Socket.IO + CORS fail-closed
app/server/src/config/db.ts               seed gate, bootstrap admin, neutralización demo
app/server/src/config/schemaSql.ts        (sin cambios; el split se hace en db.ts)
app/server/src/lib/migrations.ts          migraciones idempotentes + neutralización
app/server/src/lib/realtime.ts            salas derivadas del JWT
app/server/src/lib/email.ts               SMTP/Resend/EmailJS, reintentos, plantilla corporativa
app/server/src/lib/oc.ts                  validación de proveedor en productos OC
app/server/src/middleware/auth.ts         identidad fresca desde BD, HS256, 12 h
app/server/src/middleware/error.ts        errores genéricos + requestId
app/server/src/routes/auth.ts             planes admin-only, logout, change-password
app/server/src/routes/products.ts         ownership + whitelist + roles
app/server/src/routes/orders.ts           sucursales, estados, códigos
app/server/src/routes/deliveries.ts       redacción de códigos, rate limit, vehículos
app/server/src/routes/dashboard.ts        aislamiento por inquilino, sin datos falsos
app/server/src/routes/reviews.ts          validación + anti-spam
app/server/src/routes/restaurants.ts      whitelist + ownership
app/server/src/routes/suppliers.ts        whitelist + roles
app/server/src/routes/admin.ts            paginación acotada
app/server/scripts/email-test.ts          prueba de correo enterprise
EMAIL-ENTERPRISE.md                       SPF/DKIM/DMARC y entregabilidad
app/server/src/routes/xupai.ts            rate limit + estado en servidor
app/web/src/lib/socket.ts                 handshake solo JWT
app/web/src/pages/Login.tsx               credenciales demo eliminadas
vercel.json                               CSP + cabeceras + cache
Caddyfile                                 CSP + cabeceras + health check
Dockerfile                                non-root, prod-deps, healthcheck
docker-compose.yml                        hardening, sin SQL demo, SEED_DEMO_DATA=false
render.yaml                               sin CORS *, bootstrap admin, 12 h
.env.example / .env.production.example    plantillas sin secretos
.github/workflows/ci.yml                  typecheck + build + npm audit
.gitignore                                locks versionados, dist ignorado
README.md / LEER-YA.txt                   credenciales demo eliminadas
app/server/DB/*.sql                       aviso + bloque demo delimitado
app/server/scripts/smoke.ts               exige SMOKE_PASSWORD
```
