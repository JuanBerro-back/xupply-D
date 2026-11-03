# Pasarela de pagos (Wompi)

Estado: **implementado y compilando**, en modo sandbox a la espera de las llaves
de Wompi. Cubre dos flujos:

1. **Suscripción del restaurante a Xupply** (Básico gratis, Medio y Premium).
2. **Venta proveedor → restaurante** con modelo *Xupply cobra y dispersa*:
   el restaurante paga a Xupply, se retiene la comisión y el neto queda como
   obligación con el proveedor hasta el payout.

---

## 1. Variables de entorno

En `app/server/.env` (local) y en **Vercel → Settings → Environment Variables**:

```env
WOMPI_ENV=sandbox
WOMPI_PUBLIC_KEY=pub_test_...
WOMPI_PRIVATE_KEY=prv_test_...
WOMPI_INTEGRITY_SECRET=test_integrity_...
WOMPI_EVENTS_SECRET=test_events_...
WOMPI_VERIFY_TRANSACTION=true
CRON_SECRET=<cadena larga y aleatoria>
APP_URL=https://xupply-d.vercel.app
```

Para producción: `WOMPI_ENV=production` y las llaves `prod_*`.
`WOMPI_VERIFY_TRANSACTION` **no debe desactivarse en producción**: obliga a
confirmar cada transacción contra la API de Wompi en vez de confiar en el
cuerpo del webhook.

---

## 2. Flujo

```
Restaurante                         Xupply                          Wompi
    │  POST /payments/checkout/...     │                               │
    ├────────────────────────────────► │ crea payment_intent           │
    │ ◄──── checkout_url ──────────────┤ (monto calculado en servidor) │
    │  paga en el Web Checkout ────────┼──────────────────────────────►│
    │                                  │ ◄── webhook transaction.updated│
    │                                  │ verifica firma + consulta API │
    │                                  │ aplica pago (idempotente)     │
    │ ◄── /pago/resultado?intent=... ──┤                               │
```

### Pedido

- El pedido nace `nuevo`.
- Si `suppliers.payment_policy = 'prepago'`, nace con `payment_status = 'pendiente'`.
- El proveedor **no puede confirmar** (`nuevo → confirmado`) mientras siga pendiente:
  `PATCH /api/orders/:id/status` responde `409 PAYMENT_REQUIRED`.
- Al aprobarse el pago: `payment_status = 'pagado'`, `paid_at` y se crea la
  liquidación del proveedor (`supplier_settlements`).

### Suscripción

- Básico: se activa sin pasarela (`POST /payments/checkout/subscription`).
- Medio/Premium: checkout de Wompi; el plan **solo** cambia cuando el webhook
  confirma el pago. Ya no se puede activar un plan de pago desde el frontend.
- Renovación: cron diario (`/api/internal/cron/subscriptions`) cobra contra la
  fuente de pago tokenizada. Sin tarjeta guardada, la suscripción pasa a `mora`.

---

## 3. Configurar el webhook en Wompi

En el panel de comercios → **Desarrolladores → Webhooks**:

- URL: `https://xupply-d.vercel.app/api/payments/webhooks/wompi`
- Evento: `transaction.updated`
- Copia el **secreto de eventos** en `WOMPI_EVENTS_SECRET`.

El endpoint:

1. Lee el **body crudo** (montado antes del `express.json()` global).
2. Verifica `signature.checksum` (SHA256 + `timingSafeEqual`).
3. Registra el evento en `payment_events` con huella SHA256 del cuerpo
   (idempotencia: los reintentos no duplican asientos).
4. Consulta la transacción real a Wompi y aplica el resultado con
   `SELECT ... FOR UPDATE`.

Si el procesamiento falla responde `500` para que Wompi reintente.
Si la firma es inválida responde `401` y deja evidencia en `payment_events`.

---

## 4. Activar prepago a un proveedor

Mientras no exista pantalla de configuración:

```sql
UPDATE suppliers
   SET payment_policy = 'prepago',
       commission_pct = 5.00
 WHERE id = <supplier_id>;
```

`payment_policy`: `prepago` | `contraentrega` | `credito`.
`commission_pct`: porcentaje que retiene Xupply (por defecto 5 %).

Los pedidos existentes conservan `payment_status = 'no_requerido'`, así que el
flujo anterior no se rompe.

---

## 5. Endpoints

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/api/payments/config` | autenticado | Si la pasarela está configurada |
| POST | `/api/payments/checkout/order/:id` | gerente/empleado/admin | Checkout del pedido |
| POST | `/api/payments/checkout/subscription` | gerente | Checkout del plan |
| GET | `/api/payments/intents/:id?sync=1` | dueño/admin | Estado del pago |
| GET | `/api/payments/subscriptions/me` | gerente | Suscripción y cobros |
| POST | `/api/payments/subscriptions/cancel` | gerente | Cancela renovación |
| POST | `/api/payments/methods` | gerente | Guarda tarjeta tokenizada |
| GET | `/api/payments/admin/settlements` | admin | Liquidaciones |
| POST | `/api/payments/admin/settlements/:id/pay` | admin | Registra payout |
| POST | `/api/payments/webhooks/wompi` | público (firma) | Webhook |
| GET/POST | `/api/internal/cron/subscriptions` | `CRON_SECRET` | Renovaciones |

---

## 6. Cron de renovación

El endpoint acepta GET y POST. En Vercel (`vercel.json`, nivel raíz):

```json
{
  "crons": [
    { "path": "/api/internal/cron/subscriptions", "schedule": "0 11 * * *" }
  ]
}
```

`11:00 UTC` = `06:00` en Bogotá. Vercel envía
`Authorization: Bearer <CRON_SECRET>` automáticamente si la variable existe.
Si tu plan no permite crons, llama el endpoint desde un scheduler externo.

---

## 7. Probar en sandbox

1. Crea el comercio en `https://comercios.wompi.co/` y copia las llaves `pub_test_` / `prv_test_`.
2. Configura el webhook con la URL de tu entorno (usa ngrok o el deploy de Vercel).
3. Con un usuario `gerente`, entra a **Planes** y elige Medio o Premium.
4. Paga con las tarjetas de prueba que publica Wompi en su documentación.
5. Verifica:
   - `payment_intents.status = 'aprobado'`
   - `restaurants.subscription_plan` actualizado
   - `subscriptions.status = 'activa'`
   - `subscription_charges.status = 'pagado'`
6. Para un pedido: marca el proveedor como `prepago`, crea un pedido y paga
   desde el detalle. Luego intenta confirmarlo antes y después del pago.

Consulta la tabla `payment_events` si algo no cuadra: guarda el payload
completo, la firma y el error.

---

## 8. Seguridad implementada

- Monto calculado siempre en el servidor (`orders.total`, precio del plan).
- Firma de integridad en el checkout y firma de eventos en el webhook.
- Verificación de la transacción contra la API de Wompi.
- Idempotencia por huella de evento y bloqueo `FOR UPDATE`.
- Comparación de monto recibido vs. esperado (si no coincide, `fallido`).
- Los roles sin permiso no ven el botón ni pueden llamar los endpoints.
- No se almacenan datos de tarjeta: solo `payment_source_id` tokenizado.

---

## 9. Pendiente (siguiente iteración)

- **UI de tokenización** con Wompi.js para guardar tarjeta y activar el cobro
  recurrente automático (hoy el primer pago funciona, pero sin tarjeta guardada
  la renovación pasa a `mora`).
- **Payouts automáticos** con la API de Wompi (hoy el admin ejecuta el payout y
  registra el `provider_payout_id`).
- **Conciliación diaria** contra el listado de transacciones de Wompi.
- **Reembolsos** desde la app (aprobados, anulados, disputas).
- **Facturación DIAN** de la comisión y de la suscripción.
- **Portal de proveedor** para registrar cuenta bancaria y ver liquidaciones.
