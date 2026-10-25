# Migración del backend: `xupply-D` → `Hackathon-Xupply`

**Origen canónico:** `JuanBerro-back/xupply-D`
**Destino (producción):** `cheche2813/Hackathon-Xupply`
**Rol:** Backend owner.
**Fecha:** 2026-10-24

> La copia local `C:\Users\jdbpb\Desktop\xupply-D-main` está **desactualizada** (sin `.git`, 17 archivos por detrás). No la uses como fuente. Todo el trabajo de esta migración parte del HEAD de GitHub + los fixes de seguridad.

---

## 1. Estrategia

`Hackathon-Xupply` es la fase de producción. La forma más limpia y con menos conflictos es **migrar el árbol completo de `xupply-D` (con los fixes) como una rama**, revisar el diff contra `main` del repo hackathon y fusionar. No copies carpeta por carpeta a mano.

```
xupply-D (main + fixes de seguridad)
        │
        ├── rama: security/production-hardening
        │
        └──► Hackathon-Xupply (main)
                 ├── PR revisado
                 ├── CI verde
                 └── deploy producción
```

---

## 2. Contenido que se migra

| Ruta | Acción |
|---|---|
| `app/server/**` | Copiar (backend completo + fixes) |
| `app/web/**` | Copiar (SPA; coordinar con el owner de frontend) |
| `landing/**` | Copiar solo si el repo hackathon no tiene landing propia |
| `Dockerfile`, `docker-compose.yml`, `Caddyfile`, `render.yaml` | Copiar (hardening nuevo) |
| `vercel.json` | Copiar (CSP + cabeceras) |
| `.env.example`, `.env.production.example` | Copiar |
| `.github/workflows/ci.yml` | Copiar |
| `.gitignore`, `README.md`, `SECURITY-AUDIT.md` | Copiar/mergear |
| `app/web/android/**` | **No migrar** salvo que el equipo lo pida (build local) |
| `node_modules/`, `dist/`, `.env`, `.env.production` | **Nunca** |
| `app/server/DB/xupply_schema_postgresql.sql` | Copiar con el aviso; no usar completo en producción |

### Archivos que NO deben viajar

- `.env`, `.env.production`, `app/server/.env` (secretos reales).
- `package-lock.json` **sí** debe viajar (necesario para `npm ci` y Docker).
- `dist-apk/`, `*.jks`, `*.apk` (excepto el que ya esté publicado).
- `pgdata/`, `pg/`, `node/`, logs.

---

## 3. Procedimiento con Git (recomendado)

### 3.1 Preparar el repo destino

```powershell
git clone https://github.com/cheche2813/Hackathon-Xupply.git
cd Hackathon-Xupply
git checkout -b security/production-hardening
```

### 3.2 Traer el árbol de xupply-D

Opción A — con el parche entregado (más rápido y reproducible):

```powershell
# El parche está en el Escritorio: xupply-security-hardening.patch
git apply --stat ..\xupply-security-hardening.patch   # revisar
git apply ..\xupply-security-hardening.patch
```

Opción B — con un remote temporal:

```powershell
git remote add xupply https://github.com/JuanBerro-back/xupply-D.git
git fetch xupply
git checkout xupply/main -- app/server app/web vercel.json Dockerfile docker-compose.yml Caddyfile render.yaml
# Revisar y resolver diferencias del frontend con el owner
git remote remove xupply
```

### 3.3 Revisar antes de commitear

```powershell
git status
git diff --stat
git diff -- app/server/src/routes/deliveries.ts
```

Checklist:

- [ ] No hay `.env` ni secretos en el diff.
- [ ] `package-lock.json` actualizado (incluye `helmet`).
- [ ] `vercel.json` con CSP y cabeceras.
- [ ] `Dockerfile` usa usuario `node` y `npm ci`.
- [ ] `README.md` sin credenciales demo.
- [ ] `SECURITY-AUDIT.md` incluido.

### 3.4 Commit y PR

```powershell
git add -A
git commit -m "feat(backend): hardening de produccion y cierre de vulnerabilidades P0/P1"
git push -u origin security/production-hardening
```

Abre el PR en GitHub y exige:

- CI en verde (`typecheck`, build backend, build frontend, `npm audit`).
- Revisión del owner de frontend si se tocó `app/web`.
- Revisión de otro miembro antes de mergear a `main`.

---

## 4. Base de datos

### 4.1 Entorno nuevo (recomendado para la hackathon)

1. Crea una base PostgreSQL nueva (Neon, Supabase o Render Postgres).
2. Copia la cadena de conexión a `DATABASE_URL` en el proveedor.
3. **No apliques** `xupply_schema_postgresql.sql` completo: contiene el bloque demo.
4. Deja que la app cree el esquema:
   - `initDatabase()` ejecuta el esquema de referencia (roles, permisos, tablas, vistas).
   - Con `SEED_DEMO_DATA=false` no crea usuarios demo.
   - `ensureBootstrapAdmin()` crea el administrador desde `ADMIN_USERNAME` / `ADMIN_PASSWORD`.
5. Verifica en logs: `Esquema creado sin datos de demostración`.

### 4.2 Base existente (la del deploy actual)

Si reutilizas la base de producción actual:

1. Despliega primero el código nuevo con `SEED_DEMO_DATA=false`.
2. Al arrancar, `neutralizeDemoCredentials()` desactiva toda cuenta que siga usando el hash `demo1234`.
3. Confirma:
   ```sql
   SELECT id, username, is_active FROM users
   WHERE username IN ('admin','gerente','empleado','proveedor','domiciliario');
   ```
4. Crea/rota el administrador:
   - Define `ADMIN_USERNAME` + `ADMIN_PASSWORD` (12+ caracteres) y reinicia, **o**
   - Restablece la contraseña desde el panel con otro admin.
5. Elimina las variables `ADMIN_USERNAME`/`ADMIN_PASSWORD` después del bootstrap.
6. Rota `JWT_SECRET` para invalidar todas las sesiones emitidas antes del fix.

> Si la base es compartida con el deploy viejo, haz una copia de seguridad antes (`pg_dump`).

---

## 5. Variables de entorno en producción

Configúralas en Vercel (o Render/VPS). Referencia: `.env.production.example`.

| Variable | Obligatoria | Valor |
|---|---|---|
| `NODE_ENV` | Sí | `production` |
| `DATABASE_URL` | Sí | Cadena PostgreSQL con SSL |
| `JWT_SECRET` | Sí | 64+ caracteres aleatorios |
| `JWT_EXPIRES_IN` | No | `12h` |
| `CLIENT_ORIGIN` | Sí | `https://tu-dominio` (coma-separado si hay varios) |
| `SEED_DEMO_DATA` | Sí | `false` |
| `ADMIN_USERNAME` | Solo bootstrap | usuario del admin inicial |
| `ADMIN_PASSWORD` | Solo bootstrap | 12+ caracteres, luego eliminar |
| `DEEPSEEK_API_KEY` / `XUPAI_*` | Si se usa XupAI | claves del proveedor |
| `EMAILJS_*` | Si se usa correo | claves de EmailJS |

### Correo enterprise

Para que las notificaciones de pedidos y facturas lleguen a la bandeja de entrada
(y no a spam), configura SMTP corporativo o Resend:

```env
MAIL_PROVIDER=smtp
MAIL_FROM=notificaciones@tudominio.com
MAIL_REPLY_TO=soporte@tudominio.com
MAIL_BCC=auditoria@tudominio.com
SMTP_HOST=smtp.tudominio.com
SMTP_PORT=587
SMTP_USER=notificaciones@tudominio.com
SMTP_PASS=...
```

Pasos completos (SPF, DKIM, DMARC, Google Workspace/M365/SES/Resend y pruebas):
ver **`EMAIL-ENTERPRISE.md`**.

Generar secreto:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

## 6. Despliegue

### 6.1 Vercel (web + API serverless)

- Conecta el repo `Hackathon-Xupply`.
- `vercel.json` ya define los servicios `server` y `web`, las rutas y las cabeceras.
- Define las variables del punto 5 en **Settings → Environment Variables** (Production y Preview).
- Limitación: **Socket.IO no funciona en Vercel**. La app sigue operando con HTTP; el tiempo real requiere un host persistente.

### 6.2 Render / VPS / Docker (recomendado para producción real)

**Render:**

- Usa `render.yaml` (servicio `xupply` + base `xupply-db`).
- `JWT_SECRET` se genera automáticamente; define `CLIENT_ORIGIN`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`.
- `SEED_DEMO_DATA=false` ya está fijado.
- El backend sirve el SPA compilado (`app/web/dist`), así que frontend y API comparten origen.

**Docker Compose:**

```bash
cp .env.production.example .env.production
# editar .env.production con secretos reales
docker compose up -d --build
docker compose logs -f app
```

- Caddy obtiene HTTPS automático para `DOMAIN`.
- El contenedor de la app corre como usuario `node`, sin privilegios y con sistema de archivos de solo lectura.
- La base no publica puertos al exterior.

### 6.3 APK / Android

- `DEFAULT_RENDER_URL` apunta hoy a `https://xupply-d.onrender.com`, que está caído.
- Antes de compilar el APK, actualiza la URL base al dominio de producción real.
- El APK se genera con `build-apk.ps1` y se publica en `app/web/public/Xupply.apk`.

---

## 7. Verificación post-despliegue

1. `GET /health` → `200 {"status":"ok","db":"connected","tables_ready":true}`.
2. `curl -I https://tu-dominio/` → cabeceras CSP, HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`.
3. Login con el admin nuevo → 200.
4. Login con `admin`/`demo1234` → **401** (o cuenta inactiva).
5. `GET /api/products/1` sin token → 401.
6. Socket.IO sin token → rechazado (`connect_error: unauthorized`).
7. Flujo completo: catálogo → pedido → entrega → confirmación con código → factura.
8. Revisar logs: sin `[DB] datos de demostración`, sin errores 500 inesperados.
9. `npm audit --omit=dev` → 0 high/critical.

---

## 8. Rollback

- **Vercel:** redeploy del deployment anterior desde el panel (Instant Rollback).
- **Render:** "Rollback" al deploy anterior.
- **Docker:** `docker compose down` y volver a la imagen/tag anterior.
- **Base de datos:** restaurar el `pg_dump` previo. Los cambios de esquema son aditivos e idempotentes, pero la neutralización de cuentas demo no se revierte con el código.

---

## 9. Coordinación con el equipo

- **Frontend:** los cambios en `app/web/src/lib/socket.ts` y `Login.tsx` son obligatorios; sin ellos el realtime no autentica y se muestran credenciales demo.
- **Producto:** confirmar si se mantiene el precio manual en facturas (riesgo aceptado) o se calcula desde catálogo.
- **Infra:** decidir si producción real va en Render/VPS (realtime) o se queda en Vercel (sin realtime).
- **Seguridad:** rotar `JWT_SECRET` y contraseñas antes de la demo pública de la hackathon.

---

## 10. Checklist final

- [ ] Rama creada y PR abierto en `Hackathon-Xupply`.
- [ ] CI verde.
- [ ] Sin secretos en el repo.
- [ ] `SEED_DEMO_DATA=false` en producción.
- [ ] `ADMIN_USERNAME`/`ADMIN_PASSWORD` usados y luego eliminados.
- [ ] `JWT_SECRET` rotado.
- [ ] Cuentas demo bloqueadas/eliminadas.
- [ ] Cabeceras de seguridad verificadas.
- [ ] `/health` sin fuga de información.
- [ ] Proveedor de correo configurado (SMTP/Resend) y `npm run email:test` recibido en Recibidos.
- [ ] SPF, DKIM y DMARC verificados en el dominio corporativo.
- [ ] `MAIL_REPLY_TO` apunta al buzón enterprise (`soporte@...`).
- [ ] Flujo completo probado.
- [ ] Backup de la base de datos realizado.
- [ ] Plan de rollback acordado.
