# Arquitectura del backend (`app/backend/src`)

Organización por **dominio**, no por tipo de archivo. Cada funcionalidad vive en
`modules/<modulo>/` y comparte únicamente lo que usan **dos o más módulos**, que
vive en `shared/`.

Regla de oro: **para encontrar un archivo, busca el dominio primero**.

## Si es X, va en Y

| Si es... | Va en... |
| --- | --- |
| La definición de rutas (método, path, middlewares, orden) | `modules/<mod>/<mod>.routes.ts` |
| Un handler de Express (`req`, `res`, `next`) | `modules/<mod>/<mod>.controller.ts` |
| Reglas de negocio, constantes y validaciones del dominio | `modules/<mod>/<mod>.service.ts` |
| SQL y helpers que solo hacen `query` / `pool.query` | `modules/<mod>/<mod>.repository.ts` |
| Interfaces y tipos del dominio | `modules/<mod>/<mod>.types.ts` (solo si hay tipos reales) |
| Listeners de Socket.IO del dominio | `modules/<mod>/<mod>.socket.ts` (solo si aplica) |
| Cliente/http de un proveedor externo del dominio | archivo de soporte en `modules/<mod>/` |
| Middleware usado por 2+ módulos (auth, errores) | `shared/middleware/` |
| Rate limit y utilidades KYC propios de `identity` | `modules/identity/utils/` |
| Configuración de BD y SQL de esquema | `shared/config/` |
| Utilidades usadas por 2+ módulos (auditoría, email, realtime, etc.) | `shared/lib/` |
| Registro global de salas y emisores de Socket.IO | `shared/lib/realtime.ts` |
| Ensamblado de routers y middleware global | `app.ts` (solamente) |
| Handshake/registro global de Socket.IO | `server.ts` |

## Capas de un módulo

```
routes  →  controller  →  service  →  repository
```

- `routes` declara la forma de la petición y delega en `controller`.
- `controller` traduce HTTP: valida, llama a `service`/`repository`, responde y
  propaga errores con `next(err)`. No contiene SQL.
- `service` contiene reglas de negocio puras.
- `repository` contiene SQL. Ninguna otra capa debería escribir consultas nuevas.
- Cuando una consulta está tan acoplada al flujo de un handler que extraerla
  cambiaría el comportamiento, se deja inline en el controller. Es una decisión
  consciente, no una omisión.

## Reglas de dependencia

- Hay **9 dominios**. Cada dominio puede contener varios submódulos, y los
  archivos conservan su nombre original (`auth.routes.ts`, `users.service.ts`,
  etc.): solo cambia la carpeta.
- Un módulo **nunca** importa archivos internos de otro módulo. Lo compartido
  sube a `shared/` o baja al dominio si ya solo lo usa ese dominio.
- `shared/` no importa desde `modules/`. Solo depende de paquetes y de otros
  archivos de `shared/`. Así no hay ciclos.
- `app.ts` solo monta los routers en `/api/*`, en el mismo orden de siempre.
- No hay aliases de TypeScript: **todas las importaciones son relativas**.
- Los barrels que se conservan son `src/index.ts` (exports CommonJS/Vercel) y
  `admin.controller.ts` / `deliveries.controller.ts`, que reexportan los handlers
  divididos sin cambiar los contratos de las rutas.

## Puntos sensibles que NO se tocan

- `/api/payments/webhooks` se monta **antes** del `express.json` global porque
  necesita el cuerpo crudo para validar la firma.
- El POST de documentos de verificación salta el parser JSON global mediante la
  regex `^\/api\/verification\/public\/[a-f0-9]{64}\/documents$`.
- `notFound` y `errorHandler` van al final; `/health` y `/api/health` responden
  antes de la inicialización de BD.
- La descarga del APK y el fallback a `frontend/dist/index.html` se mantienen.
- `defaultApp` se crea al importar `app.ts`.
- Los eventos de Socket.IO, salas y payloads conservan sus nombres y formas.

## Árbol final

```text
app/backend/src/
├── app.ts                        # middleware global + ensamblado de routers
├── server.ts                     # HTTP + Socket.IO + cron de radar
├── index.ts                      # exports CommonJS/Vercel
├── shared/
│   ├── config/
│   │   ├── db.ts
│   │   └── schemaSql.ts
│   ├── middleware/
│   │   ├── auth.ts
│   │   └── error.ts
│   └── lib/
│       ├── audit.ts
│       ├── bucaramangaGeo.ts
│       ├── codes.ts
│       ├── email.ts
│       ├── migrations.ts
│       ├── oc.ts
│       ├── realtime.ts
│       └── userTenant.ts
└── modules/
    ├── identity/
    │   ├── auth/         {routes,controller,service,repository}.ts
    │   ├── users/        {routes,controller,service,repository}.ts
    │   ├── verification/ {routes,controller,service,repository,types}.ts
    │   └── utils/        {verification,verificationEmails,rateLimit}.ts
    ├── catalog/
    │   ├── products/     {routes,controller,repository,service}.ts
    │   ├── categories/   {routes,controller,repository}.ts
    │   ├── restaurants/  {routes,controller,repository,service}.ts
    │   ├── suppliers/    {routes,controller,repository,service}.ts
    │   └── reviews/      {routes,controller,repository}.ts
    ├── orders/
    │   ├── orders/       {routes,controller,service,repository}.ts
    │   └── purchaseOrders/{routes,controller,repository}.ts
    ├── deliveries/       {routes,controller,service,repository,types,socket,geo}.ts + *.controller.ts
    ├── finance/
    │   ├── invoices/     {routes,controller,service,repository}.ts
    │   └── accounting/   {routes,controller,repository}.ts
    ├── payments/         {routes,controller,service,repository,payments,wompi}.ts
    ├── operations/
    │   ├── inventory/    {routes,controller,repository,inventory.radar}.ts
    │   ├── radar/        {routes,controller,repository}.ts
    │   └── dashboard/    {routes,controller,service,repository}.ts
    ├── ai/
    │   ├── ai/           {routes,controller,service,repository}.ts
    │   ├── agent/        {routes,controller,repository}.ts
    │   └── xupai/        {routes,controller,service,repository,types}.ts
    └── admin/            {routes,controller,service,repository}.ts + *.controller.ts
```

## Verificación

```bash
cd app/backend
npm run typecheck
npm run build
```
