# Verificación de cuentas (back office KYC/KYB)

Módulo que valida que un restaurante o proveedor **exista legalmente** antes de
poder operar. El registro ya no activa la cuenta: crea un expediente, lo deja
`pendiente` y un verificador decide.

## Flujo

```
Registro (3 pasos)                  Back office                    Solicitante
──────────────────                  ───────────                    ───────────
Datos de la empresa
NIT + DV validado
Representante legal
RUT + Cámara de Comercio  ───────▶  Bandeja de pendientes
Cédula del representante            Revisa datos y documentos
                                    ├─ Aprobar ────────────────▶  Correo: cuenta aprobada
                                    ├─ Pedir corrección ───────▶  Correo con enlace para resubir
                                    └─ Rechazar ───────────────▶  Correo con motivo
                                          │
                                          └─ Todo queda en el historial y en audit_log
```

Enlace público de seguimiento: `/verificacion/<token>` (token de 64 hex enviado
por correo). Ahí el solicitante ve el estado, el motivo y puede reemplazar
documentos o reenviar el expediente tras una corrección.

## Estados

| Estado | Significado | Puede iniciar sesión |
| --- | --- | --- |
| `pendiente` | En cola de revisión | No |
| `subsanacion` | El verificador pidió corregir documentos | No |
| `verificado` | Empresa validada | Sí |
| `rechazado` | Solicitud rechazada (motivo obligatorio) | No |

La entidad (`restaurants`/`suppliers`) y el usuario nacen con `is_active = FALSE`
y solo se activan al aprobar. Además, `authRequired` bloquea cualquier petición
si la entidad no está `verificado` (defensa en profundidad).

## Roles y permisos

- Rol nuevo: **`verificador`** (back office).
- Permisos: `verificacion` (ver) y `verificacion:write` (decidir/notas).
- El rol `admin` recibe ambos permisos al aplicar la migración.
- La migración también marca como `verificado` a todas las cuentas existentes:
  **no se bloquea a nadie que ya operaba**.

Crear el primer verificador:

1. Entra como admin → **Usuarios** → nuevo usuario.
2. Rol **Verificador**, sin restaurante ni proveedor.
3. Contraseña de 12+ caracteres; entrega las credenciales por un canal seguro.

## API

### Público (token del expediente)

| Método | Ruta | Uso |
| --- | --- | --- |
| `GET` | `/api/verification/public/:token` | Estado, documentos y motivo |
| `POST` | `/api/verification/public/:token/documents` | Subir/reemplazar un documento |
| `POST` | `/api/verification/public/:token/submit` | Reenviar tras corrección |

Los documentos viajan en base64 (`{ doc_type, file_name, data }`), uno por
petición (máx. 3 MB). Se valida el tipo real por *magic bytes* (PDF/JPG/PNG) y se
rechazan HTML/SVG y archivos ejecutables.

### Back office (`authRequired` + `verificacion`)

| Método | Ruta | Uso |
| --- | --- | --- |
| `GET` | `/api/verification/summary` | Contadores por estado |
| `GET` | `/api/verification/requests?status=&q=` | Bandeja paginada |
| `GET` | `/api/verification/requests/:type/:id` | Expediente + checks + historial |
| `GET` | `/api/verification/requests/:type/:id/documents/:docType` | Documento (inline, `no-store`) |
| `POST` | `/api/verification/requests/:type/:id/decision` | `aprobar` / `rechazar` / `subsanar` |
| `POST` | `/api/verification/requests/:type/:id/notes` | Nota interna |

`:type` es `restaurante` o `proveedor`.

### Registro

`POST /api/auth/register` ahora exige `nit`, `address`, `city`,
`legal_rep_name` y `legal_rep_document`, además de los campos previos. Responde
`201 { pending: true, verification_token, ... }` **sin token de sesión**.
También rechaza NIT inválido, NIT duplicado y correo ya usado.

`POST /api/auth/login` responde `403` con `code: VERIFICATION_PENDING |
VERIFICATION_CORRECTION | VERIFICATION_REJECTED` (solo si la contraseña es
correcta), para no filtrar la existencia de cuentas.

## Validaciones automáticas de esta versión

- Dígito de verificación del NIT colombiano (algoritmo DIAN).
- NIT duplicado dentro del mismo tipo de cuenta.
- Correo duplicado entre usuarios, restaurantes y proveedores.
- Expediente completo (3 documentos) antes de poder aprobar.
- Aviso de NIT repetido en el otro tipo de cuenta y de correo compartido.
- Consulta a **RUES/Cámara de Comercio**: pendiente para la siguiente fase
  (requiere credenciales/API externa).

## Base de datos

Nuevas columnas en `restaurants` y `suppliers`:
`verification_status`, `verification_reason`, `verification_token`,
`verified_at`, `verified_by`, `submitted_at`, `legal_rep_name`,
`legal_rep_document`.

Tablas nuevas:
`verification_documents` (metadatos + `BYTEA`) y `verification_events`
(historial con actor y estados).

La migración `ensureVerificationSchema()` se ejecuta al arrancar el servidor,
junto con las demás (`lib/migrations.ts`).

## Almacenamiento de documentos

Los archivos se guardan en PostgreSQL (`BYTEA`) para que funcione igual en
Vercel, Render o VPS sin depender de disco efímero. Límites: 3 MB por documento,
3 documentos por cuenta. El límite de 3 MB deja margen para el ~33 % extra que
añade base64 y para el tope de 4,5 MB por petición de Vercel. El acceso solo es
posible con:

- token público del expediente (solicitante), o
- sesión de verificador/admin con permiso `verificacion`.

La descarga usa `Content-Disposition: inline`, `X-Content-Type-Options: nosniff`
y `Cache-Control: no-store`.

Para volúmenes mayores conviene moverlos a S3/R2 con URLs firmadas; la interfaz
no cambia (solo el almacenamiento en `verification.ts`).

## Variables de entorno

```env
APP_URL=https://tudominio.com            # ya existente; se usa en los enlaces
VERIFICATION_NOTIFY_EMAIL=verificacion@tudominio.com  # opcional
```

Si `VERIFICATION_NOTIFY_EMAIL` no se define, se avisa a los usuarios activos con
rol `verificador` o `admin` que tengan correo (máximo 5). Requiere el correo
enterprise configurado (`EMAIL-ENTERPRISE.md`).

## UX incluida

- **Registro** en 3 pasos con validación en cliente y servidor, barra de
  progreso y pantalla final “Registro en revisión” con enlace copiable.
- **Back office** `/admin/verificaciones`: contadores, pestañas por estado,
  búsqueda por nombre/NIT/correo, tabla con antigüedad de la solicitud y
  expediente en modal con vista previa de PDF/imágenes, checklist, usuarios,
  historial, decisión con confirmación y notas internas.
- **Página pública** `/verificacion/:token`: estado, motivo, expediente y carga
  o reemplazo de documentos.

## Verificación técnica

```bash
cd app/server && npm run typecheck
cd app/web && npm run build
```

Ambos pasan. Para probar el flujo completo hace falta una base PostgreSQL:

1. Registrar un restaurante con NIT válido (por ejemplo `900123456-8`).
2. Confirmar que el login responde 403 “cuenta en revisión”.
3. Subir los 3 documentos desde el enlace.
4. Aprobar desde `/admin/verificaciones` con un usuario verificador.
5. Iniciar sesión: debe entrar al dashboard.

## Pendientes recomendados

- Integración con RUES/Cámara de Comercio para validación automática.
- Firma de documentos y verificación de la cédula contra Registraduría.
- Re-verificación automática cuando cambie NIT o razón social.
- Notificación en tiempo real (Socket.IO) al back office cuando llegue una
  solicitud (hoy se refresca al abrir/actualizar la bandeja).
