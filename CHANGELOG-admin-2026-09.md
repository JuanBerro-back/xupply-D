# Panel de administración Xupply — Reporte de cambios

**Rama:** `main`
**Commits:** `b649ae1` (funcionalidad), `05dae2c` (corrección de test)
**Alcance:** panel administrativo, autorización por permisos, integridad contable de facturas.

---

## 1. Resumen

Se completó el panel administrativo de Xupply y se corrigieron fugas de datos cruzadas entre
tenants,holes de autorización, errores de integridad contable y una regresión de despliegue
que se introdujo durante el propio trabajo.

Todo verificado por compilación (`tsc` en backend y frontend, `build` de Vite). La verificación
de comportamiento en runtime quedó pendiente por falta de una instancia de PostgreSQL en el
entorno de desarrollo, y se sustituyó por un smoke test ejecutable más una checklist manual.

---

## 2. Fugas de datos y autorización

### 2.1 El gate del panel se validaba por rol, no por permiso

`auth.ts` no devolvía los permisos del usuario en `/login`, `/register` ni `/auth/me`. Como el
frontend no tenía esa información, `hasAdminAccess` solo miraba `user.role === 'admin'`.

- **Impacto:** cualquier usuario con rol `admin` entraba al panel completo, y no había forma de
  ocultar los KPIs de toda la plataforma a un admin sin permiso de analítica.
- **Corrección:** los tres endpoints resuelven permisos con `JOIN role_permissions` y los incluyen
  en la respuesta. El gate del frontend exige el permiso `config`.

### 2.2 Autorización gruesa en ~14 endpoints de administración

Los endpoints admin usaban `roleRequired('admin')`, una sola palabra como control de acceso.

- **Corrección:** `requirePermission('config')` por recurso, y `requirePermission('analytics')`
  en `/admin/stats`.
- `clearPermissionCache()` se invoca tras cada cambio de roles o permisos, porque
  `requirePermission` cachea por `role_id` y sin invalidación **revocar un permiso no surtía
  efecto**.

### 2.3 IDOR en facturas: lectura y anulación entre tenants

`GET /invoices/:id` y `PATCH /invoices/:id/status` solo chequeaban el rol, sin validar que la
factura perteneciera al restaurante del solicitante.

- **Impacto:** un gerente del restaurante A podía **leer y anular** una factura del restaurante B
  indicando su id. Es la fuga cross-tenant más clara del conjunto.
- **Corrección:** ambos endpoints validan `restaurant_id === user.restaurant_id` y devuelven 403.

### 2.4 Lógica de scope de usuarios duplicada con IDs mágicos

`activateUser` / `deactivateUser` repetían el chequeo de scope con `role_id === 5` y
`role_id === 3`, y con una condición mezclada `user.role === 'gerente' || user.restaurant_id` que
se activaba para cualquier usuario con `restaurant_id` sin importar su rol.

- **Corrección:** un único helper `checkUserScope()` con `else if` excluyente y `role_name`
  obtido vía `JOIN roles`, compartido por `PUT /:id`, activate, deactivate y password.
  Incluye auto-desactivación y protección del último administrador activo.

### 2.5 Credenciales en la bitácora de auditoría

- **Corrección:** `lib/audit.ts` filtra `password_hash` y `password` antes de insertar en
  `audit_log`, y registra `old_values`, `new_values` e `ip_address`.

### 2.6 Validación de tenants en alta de usuarios

`POST /users` metía `restaurant_id` y `supplier_id` directo al `INSERT`.

- **Impacto:** un id inexistente reventaba con violación de FK → **500** en vez de 400. Y un
  `admin` podía colgar un empleado de una sucursal de otro restaurante, que ni la FK ni el
  código detectaban.
- **Corrección:** valida contra `restaurants`, `suppliers` y `branches` —este último con
  `AND restaurant_id = $2` para exigir pertenencia— y devuelve 400 con mensaje explícito.

---

## 3. Integridad contable

### 3.1 No había máquina de estados

Se aceptaba `borrador → pagada` (marcar pagada sin emitir) y `anulada → emitida` (revivir una
factura anulada).

- **Corrección:** matriz `INVOICE_TRANSITIONS` explícita, validada contra el estado leído de la
  base bajo `SELECT ... FOR UPDATE`, no contra el body.

### 3.2 Anulación de una factura pagada dejaba vivo el ingreso

- **Impacto:** anular una factura `pagada` no tocaba `accounting_transactions`, así que los KPIs
  contaban ingresos de facturas anuladas.
- **Corrección:** al anular una `pagada` se asienta un `egreso` por el mismo `total`. **Decisión de
  negocio:** se reversa con un egreso en lugar de borrar el ingreso, para conservar la
  trazabilidad. La elección de la matriz de permisos equivalente está documentada en el código.

### 3.3 Asientos duplicados

El dedupe filtraba solo `reference_type` + `reference_id`, sin `type`, y no existía índice único.

- **Impacto:** doble clic o doble POST generaba **dos ingresos por la misma factura**.
- **Corrección:** el dedupe incluye `type = 'ingreso'`, más el índice único parcial
  `uq_accounting_invoice_ingreso` sobre `(reference_type, reference_id, type)`. El índice va en su
  propio `try/catch`: si una base existente ya tiene duplicados, no tumba el arranque.

### 3.4 Estado inválido en el enum

`'cancelada'` estaba en la lista de estados válidos del endpoint pero no en el enum
`invoice_status` de Postgres.

- **Impacto:** `22P02 invalid input value for enum` → **500** dentro de la transacción.
- **Corrección:** eliminado. El enum es la fuente de verdad.

### 3.5 Auditoría incompleta de facturas

- **Corrección:** el `INSERT` manual a `audit_log` se reemplazó por `logAudit()`, que registra
  estado anterior, nuevo, motivo e IP.

### 3.6 Fuga de conexiones

`pool.connect()` estaba fuera del `try`. Si el pool se agotaba, la conexión nunca se liberaba y la
petición se colgaba.

- **Corrección:** `let client` declarado arriba, `connect()` dentro del `try`, `release()` en un
  `finally` condicionado.

### 3.7 Escrituras no atómicas

El alta de restaurante con sucursal inicial era en varios pasos sin `BEGIN`/`COMMIT`: si fallaba
la sucursal, quedaba el restaurante huérfano.

- **Corrección:** transaccional.

---

## 4. Migraciones y arranque

- **Columnas faltantes:** `restaurants.category` y `restaurants.subscription_plan` no existían, así
  que `POST /admin/restaurants` reventaba con `42703 column does not exist`. Agregadas al esquema
  y como `ALTER TABLE ... IF NOT EXISTS`.
- **`invoices.motivo`:** columna `TEXT` persistente. El motivo de anulación es propiedad del
  dominio transaccional de la factura, no del historial: si viviera solo en `audit_log`, la UI del
  comprobante quedaría acoplada a la bitácora y, si el log se purga por tamaño, se perdería la
  trazabilidad del egreso.
- **Permiso `analytics`:** existía solo en el seed del `.sql`, así que en la base ya desplegada no
  existía y era invisible e imposible de grantear. Agregado con `INSERT ... ON CONFLICT DO
  NOTHING` más su grant al rol admin. Se verificó que `role_permissions` tiene
  `PRIMARY KEY (role_id, permission_id)`, así que no se duplica en cada arranque.
- **`DROP VIEW ... CASCADE` en cada arranque:** `ensurePlatformViews()` ejecutaba cinco
  `DROP ... CASCADE` en cada boot. El `CASCADE` borraba en silencio cualquier vista, índice o
  función construida encima, en cada reinicio de producción. Reemplazado por
  `dropLegacyPlatformViews()`, sin `CASCADE` y con nombre honesto.

---

## 5. Correcciones funcionales

| Problema | Corrección |
|---|---|
| `TeamManagement` llamaba `DELETE /users/:id`, endpoint eliminado → 404 | `PATCH /users/:id/{activate,deactivate}` con etiqueta y `confirm` dinámicos |
| `ComercioProfile` pedía una ruta distinta a la registrada → 404 | Rutas consolidadas en `/admin/comercios/:type/:id` |
| Alta de sucursal mandaba `branchRestaurantId`, el backend leía `restaurantId` → sucursal sin restaurante | Campo unificado |
| Edición de sucursal no enviaba `editItem?.id` → editaba la equivocada | Id enviado |
| `DELETE /admin/users/:id` indistinguible de desactivar en la UI | Borrado duro etiquetado como definitivo, separado de desactivar |
| Barras del dashboard calculadas en píxeles en vez de porcentaje | Porcentaje real |
| Casts sin `::float8` → error de tipo en Postgres | Casts corregidos |
| Fechas mal parseadas desde `pg` (llegaban como string) | Parseo correcto |
| CSV de usuarios con cabeceras y valores desalineados | CSV regenerado |
| `activateUser` / `deactivateUser` con parámetros `any` implícitos | Tipos explícitos con `Request`, `Response`, `NextFunction` |
| Contraseña mínima de 6 caracteres | 8 caracteres |
| `/auth/me` sin manejo de errores | `try/catch` con `next(err)` |
| Import circular `App.tsx` ↔ `AdminLayout.tsx` por `hasAdminAccess` | Extraído a `app/web/src/lib/permissions.ts` |
| `tsconfig.tsbuildinfo` versionado en git | Desindexado y `*.tsbuildinfo` en `.gitignore` |

---

## 6. Estado de facturas en la UI

- Modal de anulación con `textarea`, contador "N / 5 caracteres", botón de confirmar deshabilitado
  bajo el mínimo y motivo obligatorio.
- El motivo se envía en el body solo cuando aplica, así que "Emitir" y "Pagar" no se ven afectados.
- El motivo se muestra en la fila de la factura anulada.
- Los botones se derivan de `INVOICE_TRANSITIONS` en `app/web/src/lib/constants.ts`, la misma
  tabla que usa el backend. No se ofrece "Pagar" sobre borrador ni "Emitir" sobre pagada.

---

## 7. Regresión de despliegue introducida y corregida

Durante el trabajo se movió el smoke test a `app/server/scripts/` y se añadió `scripts` al
`include` del `tsconfig.json` quitando `rootDir: "src"`. Eso cambió la estructura de salida de
`tsc` de `dist/server.js` a `dist/src/server.js`.

Se actualizaron `main` y `start` de `package.json`, pero **Render y Docker no ejecutan
`npm start`**: llaman al path directo.

- `render.yaml` → `startCommand: node server/dist/server.js`
- `Dockerfile` → `CMD ["node", "server/dist/server.js"]`

Ambos apuntaban a un archivo que ya no se generaba. El deploy habría fallado con
`Cannot find module '/app/server/dist/server.js'`. Además `dist/scripts/smoke.js` se compilaba
dentro de la imagen de producción.

**Corrección:** se revirtió el `tsconfig.json` a `rootDir: "src"` / `include: ["src"]`, sin tocar
`render.yaml` ni el `Dockerfile`. El smoke test se typechequea aparte con
`app/server/tsconfig.smoke.json` (`noEmit: true`), invocado desde el script `typecheck`.

El revert también reparó la resolución del schema: `config/db.ts:26` usa
`path.join(__dirname, '..', '..', 'DB', ...)`, calculado para el layout plano. Con `dist/src` ese
candidato apuntaba a `dist/DB` y el código dependía del fallback por `process.cwd()`.

**Layout verificado tras rebuild limpio:**

```
dist/  ->  config/  lib/  middleware/  routes/  app.js  server.js
dist/server.js      existe
dist/scripts/       NO se genera
```

---

## 8. Verificación

### 8.1 Compilación — todo en exit 0

| Comando | Resultado |
|---|---|
| `npx tsc --noEmit` (server) | exit 0 |
| `tsc -p tsconfig.smoke.json` (server) | exit 0 |
| `npx tsc -b --noEmit` (web) | exit 0 |
| `npm run build` (web) | exit 0 |
| `npm run build` (server) | exit 0 |

### 8.2 Smoke test — `app/server/scripts/smoke.ts`

Ejecutable con `npm run smoke`. Sin omisiones silenciosas: si un login falla o un rol no existe
en la base, el script aborta con código 1. Puerto efímero (`listen(0)`), `SMOKE_PASSWORD` por
variable de entorno, datos de prueba propios, cleanup en orden correcto (asientos → facturas →
restaurantes) y verificación final de que no quedó residuo.

**Guardas de seguridad:** aborta si no hay `DATABASE_URL`, y aborta si el nombre de la base
contiene `prod`. Imprime host y nombre de base, nunca la contraseña. El `README.md` de `scripts/`
prohíbe explícitamente correrlo contra producción.

**Matriz de permisos por rol** sobre `/api/admin/stats`, `/api/admin/restaurants`,
`/api/admin/audit-log` y `/api/users`:

| Rol | Los cuatro endpoints |
|---|---|
| `admin` | 200 |
| `gerente` | **403** |
| `empleado` | 403 |
| `proveedor_admin` | 403 |
| `domiciliario` | 403 |

**Matriz de transiciones de facturas** (bajo `SMOKE_ALLOW_INVOICES=1`), con aserciones de
`accounting_transactions` en cada paso:

| Transición | HTTP | Aserciones |
|---|---|---|
| Factura ajena (gerente B) | 403 | Perímetro de tenant |
| `borrador → pagada` | 400 | Sin asiento |
| `borrador → anulada` sin motivo | 400 | Sin asiento |
| `borrador → emitida` | 200 | Sin asiento: se asienta al pagar |
| `emitida → pagada` | 200 | 1 `ingreso` por el `total` exacto, `paid_at` no null |
| `pagada → emitida` | 400 | El `ingreso` sigue en 1 |
| `pagada → anulada` con motivo | 200 | 1 `egreso`, y el `ingreso` **no** se borró |
| `anulada → emitida` | 400 | Conteos intactos |

### 8.3 Corrección posterior al commit

La primera versión de la matriz afirmaba la existencia del `ingreso` después de `borrador →
emitida`. La implementación lo crea solo al pasar a `pagada`, así que la aserción habría dado
`count = 0` y `exit 1` en la primera corrida. Se movió la verificación al paso correcto y se
enriqueció con `sum(amount) === total`, conservando el `count === 1` que valida el dedupe.

Commit `05dae2c`.

### 8.4 Pendiente de verificación manual

Sin instancia de PostgreSQL en el entorno de desarrollo, las matrices anteriores son **la
especificación de lo que el smoke test exige, no una medición**. Queda por ejecutar contra una
base real de desarrollo.

En producción, pendiente de confirmación manual:

1. Build log de Render sin `error TS`, arranque por `node server/dist/server.js`.
2. `Advertencia creando índice uq_accounting_invoice_ingreso` — si aparece, la base tiene
   asientos duplicados previos a la mitigación.
3. En la DB: columnas `category`, `subscription_plan` y `motivo` presentes; permiso `analytics`
   existente; índice `uq_accounting_invoice_ingreso` creado; `audit_log` recibiendo filas.
4. Con un **gerente real**: `/admin/stats`, `/admin/restaurants` y `/admin/audit-log` deben dar
   403, no pantalla en blanco. Es la aserción que ningún build ni typecheck detecta.
5. Factura completa en la UI: emitir, pagar (1 `ingreso`), anular con motivo (1 `egreso`, el
   `ingreso` intacto).
6. `TeamManagement`: suspender y reactivar un empleado.

---

## 9. Archivos

### Modificados

```
.gitignore                                          |   1 +
app/server/DB/xupply_schema_postgresql.sql          |   4 +
app/server/package.json                             |   3 +-
app/server/src/lib/migrations.ts                    |  41 +-
app/server/src/routes/admin.ts                      | 458 +++++++++++---
app/server/src/routes/auth.ts                       |  46 +-
app/server/src/routes/invoices.ts                   |  92 ++-
app/server/src/routes/users.ts                      | 158 +++---
app/server/src/server.ts                            |   3 +-
app/web/src/App.tsx                                 |  25 +-
app/web/src/components/AdminLayout.tsx              |   4 +-
app/web/src/lib/constants.ts                        |   7 +
app/web/src/pages/Invoices.tsx                      |  78 ++-
app/web/src/pages/TeamManagement.tsx                |  11 +-
app/web/src/pages/admin/ComerciosAdmin.tsx          | 394 ++++++++---
app/web/src/pages/admin/DashboardAdmin.tsx          | 218 ++++++--
app/web/src/types.ts                                |   2 +
app/web/tsconfig.tsbuildinfo                        |   1 -   (desindexado)
```

### Nuevos

```
app/server/scripts/README.md
app/server/scripts/smoke.ts
app/server/src/lib/audit.ts
app/server/tsconfig.smoke.json
app/web/src/lib/permissions.ts
```

`render.yaml`, `Dockerfile` y `app/server/tsconfig.json` **no** fueron modificados. Verificado en
el commit.

---

## 10. Cómo verificar contra una base real

```bash
cd app/server
npm run typecheck
npm run smoke                                # solo matriz de permisos
SMOKE_ALLOW_INVOICES=1 npm run smoke        # agrega la matriz de facturas
SMOKE_PASSWORD='...' npm run smoke          # si no es la contraseña por defecto
```

Nunca contra la base de Render: la guarda por nombre `prod` lo aborta, y el test escribe en
`accounting_transactions`.
