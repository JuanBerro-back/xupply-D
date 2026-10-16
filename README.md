# Xupply

Plataforma B2B para la digitalizacion de restaurantes y empresas distribuidoras de la region metropolitana de Bucaramanga: catalogo mayorista, pedidos con seguimiento GPS en tiempo real, facturacion electronica, inventario, contabilidad e inteligencia artificial.

## Modulos

- **Catálogo mayorista**: categorias, productos y proveedores recomendados segun tu cocina.
- **Pedidos B2B**: carrito, ordenes, facturas y seguimiento en vivo de entregas (GPS satelital y asignacion vehicular).
- **Inventario y contabilidad**: control de stock, reportes de flujo de caja y facturacion electronica.
- **Asistente Xupply IA**: copiloto sobre food cost, compras mayoristas y logistica de entrega (disponible segun el plan).
- **Planes de suscripción**: basico, medio y premium (Xupply Lite, Pro y Max).
- **Roles**: admin, gerente, empleado, proveedor (`proveedor_admin`) y domiciliario.
- **Multiplataforma**: PWA instalable, app Android (Capacitor) y aplicacion de escritorio (Electron).

## Estructura

```
app/
  server/   Backend Express + PostgreSQL + Socket.IO (TypeScript)
  web/      Frontend React + Vite + Tailwind (TypeScript, PWA)
  web/android/  Proyecto Android Capacitor (com.xupply.app)
  main.js   Proceso principal Electron (app de escritorio)
  scripts/  Instalacion y provision local (PostgreSQL)
xupply_schema_postgresql.sql  Esquema de base de datos
```

## Requisitos

- Node.js 20+ (desarrollo)
- PostgreSQL 16 o 18 (desarrollo)
- Docker + Docker Compose (produccion opcional)

## Puesta en marcha (desarrollo)

```bash
# Backend
cd app/server
npm install
cp .env.example .env
npm run dev          # http://localhost:4000

# Frontend
cd app/web
npm install
npm run dev          # http://localhost:5173
```

Crea la base `xupply` y aplica el esquema `app/server/DB/xupply_schema_postgresql.sql`.

### Usuarios de prueba

Usuarios demo (contrasena: `demo1234`): `admin`, `gerente`, `empleado`, `proveedor`, `domiciliario`.

## Modo portatil (Windows, sin instalar nada)

Copia la carpeta `XupplyPortable` a una unidad local y ejecuta `Iniciar-Xupply.cmd`. Levanta PostgreSQL, carga el esquema y abre la ventana de Electron. Ve `LEER-YA.txt` para detalles.

## Despliegue

- **Render**: sigue `RENDER.md` (`render.yaml` crea el servicio web `xupply` y la base `xupply-db`).
- **DigitalOcean**: sigue `DIGITALOCEAN.md` (Docker Compose + Caddy con HTTPS automatico).
- **APK**: usa `build-apk.ps1` (compila con Capacitor y deja `Xupply.apk` en `app/web/public`).

## Variables de entorno

Espejo en `.env.production.example` y `app/server/.env.example`:

| Variable        | Descripcion                                   |
| --------------- | --------------------------------------------- |
| `DOMAIN`        | Dominio de produccion (Caddy).                |
| `POSTGRES_DB`   | Nombre de la base de datos (`xupply`).        |
| `POSTGRES_USER` | Usuario de base de datos.                     |
| `POSTGRES_PASSWORD` | Contrasena de base de datos.              |
| `DATABASE_URL`  | Cadena de conexion PostgreSQL.                |
| `JWT_SECRET`    | **Obligatorio.** Secreto para firmar tokens. En produccion el servidor no arranca si falta. Genera uno aleatorio largo. |
| `CLIENT_ORIGIN` | Lista blanca de origenes permitidos (CORS para HTTP y Socket.IO), separados por coma. Recomendado/obligatorio en produccion. |

## Verificacion de salud

El endpoint `/health` responde `{"status":"ok","service":"xupply-api","db":"connected"}`. Ya no expone conteos de usuarios ni mensajes de error de la base de datos.

## Seguridad

> Ultima revision: **2026-10-16**. Se corrigieron vulnerabilidades en los modulos de **pedidos**, **entregas** y **usuarios**. Detalle y estado por hallazgo:

### Criticas

- **Backdoor de autenticacion (`demo1234`)**: eliminada la validacion por prefijo de hash en `POST /api/auth/login`. El login ahora solo acepta contrasenas que superen `bcrypt.compare`. Los hashes semilla se reemplazaron por un hash bcrypt real y una migracion repara bases de datos antiguas.
- **Escalada de privilegios en el registro**: `POST /api/auth/register` ya no crea una cuenta oculta `<usuario>_admin` con `role_id = 1`. El propietario de un comercio queda con rol `gerente` (rol 2), nunca como administrador global.
- **Secreto JWT por defecto**: eliminado el fallback `xupply-secret-change-me`. Si `JWT_SECRET` no esta definido en produccion, el servidor **no arranca** (falla cerrado).
- **IDOR de pedidos**: `GET /api/orders/:id` ahora valida que el pedido pertenezca al restaurante o proveedor del usuario.

### Altas

- **Cancelacion cruzada de pedidos**: `PATCH /api/orders/:id/status` ya no permite cancelar pedidos de otro inquilino y exige un rol autorizado.
- **Escritura/lectura cruzada de entregas**: `GET /api/deliveries/:id`, `PATCH /:id/status`, `PATCH /:id/position`, `POST /:id/confirm`, `POST /api/deliveries` y `GET /:id/track` validan el alcance (proveedor, restaurante o domiciliario asignado).
- **Historial de pedidos sin control**: `GET /api/orders/:id/history` verifica el acceso al pedido antes de devolver la auditoria.
- **Sesiones no invalidadas**: los cambios de rol, inquilino o contrasena incrementan `token_version`; `authRequired` compara siempre la version. Un token antiguo o de una sesion revocada se rechaza.

### Medias y bajas

- **Fuga de usuarios**: el listado de usuarios ya no expone domiciliarios sin proveedor (`OR supplier_id IS NULL`) y deniega acceso sin inquilino.
- **Asignacion de conductores**: `PATCH /api/deliveries/:id/assign` valida la pertenencia de la entrega y que el conductor sea `domiciliario` del mismo proveedor.
- **Integridad de pedidos**: se validan cantidades (finitas y `> 0`), la existencia del proveedor y que los productos pertenezcan al proveedor declarado. El total se calcula en el servidor.
- **CORS**: `CLIENT_ORIGIN` se aplica como lista blanca tanto en HTTP como en Socket.IO.
- **Higiene**: politica minima de contrasena (8 caracteres) en todos los altas, rate limiting en `login`/`register`, y `/health` sin fuga de informacion.
- **Concurrencia**: el cambio de estado del pedido es atomico (evita dobles transiciones y descuentos de stock duplicados).

### Autorizacion y roles (correccion posterior)

- **`requirePermission` sin bypass**: se elimino el atajo que dejaba pasar siempre al rol `admin`. Ahora todo permiso se valida contra `role_permissions`, y una migracion garantiza que el rol `admin` conserve todos los permisos.
- **Cambio de plan de suscripcion**: `POST /api/auth/subscription-plan` exige rol `gerente` o `admin` (antes cualquier usuario autenticado con restaurante podia cambiar el plan del negocio).
- **Invariantes rol/inquilino**: al crear o cambiar el rol de un usuario se exige coherencia (`gerente`/`empleado` -> restaurante; `proveedor_admin`/`domiciliario` -> proveedor; `admin` -> plataforma). Evita usuarios sin inquilino que rompian el aislamiento multi-tenant.
- **Alta/edicion de usuarios del panel**: `POST/PUT /api/admin/users` ahora valida la existencia de restaurante, sucursal y proveedor (responde 400 en vez de 500) y aplica las mismas invariantes de rol/inquilino.
- **Migracion reparada**: un `INSERT INTO role_permissions` sin terminador en `migrations.ts` se fusionaba con el `UPDATE` siguiente y rompia la inicializacion al arrancar; se agrego `ON CONFLICT DO NOTHING;`.
- **Rol inexistente en el frontend**: se elimino la referencia a `restaurante_admin` (rol que no existe) en el catalogo.

### Notas de despliegue

1. **Define `JWT_SECRET`** en todos los entornos (Render, DigitalOcean, Vercel, Docker). Genera uno con:
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```
2. **Define `CLIENT_ORIGIN`** con el dominio real del frontend (varios separados por coma).
3. **Las sesiones activas se invalidaran una vez** (los tokens antiguos no llevan `token_version`); los usuarios deberan iniciar sesion de nuevo.
4. Las cuentas demo (`admin`, `gerente`, `empleado`, `proveedor`, `domiciliario` / `demo1234`) siguen funcionando con hash real, pero **cambia sus contrasenas en produccion**.
5. Los despliegues que compilan desde `src/` (Vercel, Render, Docker) toman los cambios automaticamente.

## Creadores y Contacto

- **Creadores:** Juan Berroteran y Fabio Chamorro
- **Correo de contacto:** [jdbpberroteran@gmail.com](mailto:jdbpberroteran@gmail.com)
- **Ubicación:** Bucaramanga, Santander, Colombia • ADSO SENA

---

Documentacion adicional: `RENDER.md`, `DIGITALOCEAN.md`, `app/LEER-ESCRITORIO.md` y `LEER-YA.txt`.