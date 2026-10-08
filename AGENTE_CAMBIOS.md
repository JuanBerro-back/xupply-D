# Cambios realizados para implementar Agente "Compra Inteligente" (XupAI)

## 1. Migraciones / Base de datos (runtime)
Archivo: app/server/src/lib/migrations.ts
- Añadido tipo ENUM `purchase_order_status` con valores ('borrador','enviada','confirmada','cancelada')
- Creada tabla `purchase_orders` (id, order_code, restaurant_id FK, supplier_id FK, status, subtotal, total, notes, created_by FK, timestamps)
- Creada tabla `purchase_order_items` (id, purchase_order_id FK CASCADE, product_id FK NULL, name, quantity, unit, unit_price, subtotal, created_at)
- Índices: idx_po_restaurant, idx_po_supplier, idx_po_status, idx_po_created, idx_po_item_po, idx_po_item_product, idx_order_items_order, idx_order_items_product, idx_products_supplier
- Añadido permiso `compras:write` en `permissions` (ON CONFLICT DO NOTHING)

## 2. Rutas backend
### app/server/src/routes/purchaseOrders.ts (nuevo)
- POST /drafts: crea borrador de OC con transacción (BEGIN/COMMIT/ROLLBACK). Calcula precios desde `products.price_per_unit`, genera `order_code` PO-<base36>, inserta ítems, audita via logAudit. Requiere JWT + roleRequired('gerente','admin')
- GET /: lista borradores del restaurante (opcional supplier_id), JOIN suppliers, LIMIT 50
- GET /:id: retorna borrador + items
Montado en app.ts bajo `/api/purchase-orders`

### app/server/src/routes/agent.ts (nuevo)
Endpoints de SOLO LECTURA para las tools del agente (JWT + gerente/admin):
- GET /consumo-historico?dias=30&limite_skus=40: agrupa `order_items`+`orders` (status<>'cancelado', últimos N días) por product_id: total_qty, num_pedidos, last_order_date, avg_qty_30d, days_since_last. Ordenado por total_qty DESC, LIMIT
- GET /ultimo-pedido: último pedido no cancelado + sus items
- GET /catalogo-precios?supplier_id=&search=: productos activos con supplier_name, precio, min_order_qty, stock
- GET /proveedores-vigentes: proveedores activos con sku_count
Montado en app.ts bajo `/api/agent`

### app/server/src/app.ts
- Imports: purchaseOrdersRouter, agentRouter
- Montaje: app.use('/api/purchase-orders', ...), app.use('/api/agent', ...)

## 3. Infraestructura
### n8n.yml (nuevo, raíz del proyecto)
- Servicio n8n (n8nio/n8n:latest) en red externa `xupply-d-main_default`, puerto 5678, volumen n8n_data
- Variables: N8N_ENCRYPTION_KEY, N8N_HOST, N8N_PORT, N8N_PROTOCOL, GENERIC_TIMEZONE, TZ, WEBHOOK_URL

### docker-compose (contexto)
Xupply ya levantado (app, db, caddy). n8n añadido con `-f docker-compose.yml -f n8n.yml up -d n8n`.

## 4. Notas
- Migraciones también aplicadas manualmente a la BD Docker (`purchase_orders`, `purchase_order_items`, índices, permiso `compras:write`) para asegurar disponibilidad inmediata.
- Endpoints con filtro estricto por `restaurant_id` del token (aislamiento tenant). 
- No se tocaron rutas existentes. Solo lectura + creación de borrador (una única escritura controlada).
- Código compilado sin errores TypeScript.

## 5. Próximos pasos sugeridos
- Crear workflow `XupAI - Compra Inteligente` en n8n (localhost:5678) con AI Agent + 5 HTTP Tools apuntando a `http://app:4420/api/agent/...` y `http://app:4420/api/purchase-orders/drafts`
- Widget embebido en PWA para invocar el webhook
- QA con datos reales (ahora orders vacío, se pueden generar pedidos de prueba)

## 6. Agente XupAI (Compra Inteligente) — implementado en backend

> Decisión de arquitectura: en lugar de depender de n8n (que requería credenciales LLM, red Docker y gestión de webhook), el agente se implementó dentro del backend Express, reutilizando el JWT de sesión. Esto da aislamiento por tenant automático, roles ya validados y un único punto de escritura auditado (crear_borrador_oc).

### app/server/src/routes/xupai.ts (nuevo)
- GET /api/xupai/status: devuelve { enabled, model } (habilitado si hay XUPAI_API_KEY).
- POST /api/xupai/agent: agente conversacional con function-calling hacia el LLM.
  - Prompt maestro XupAI (de la especificación): vertical puro, acción con CTA "¿Quieres que genere la orden de compra con esto?", cifras concretas y tono coloquial.
  - 5 herramientas acotadas (schema OpenAI): get_consumo_historico, get_ultimo_pedido, get_catalogo_precios, get_proveedores_vigentes, crear_borrador_oc.
  - Loop de agente (máx. 8 pasos) con temperature=0.2 y timeout de 60 s (AbortSignal.timeout), usando fetch global (Node 20).
  - GATE de confirmación en servidor (defensa en profundidad): crear_borrador_oc se bloquea salvo que el último turno del usuario sea una confirmación explícita (sí/ok/dale/confirmo...) y exista una propuesta de OC previa del asistente.
  - Aislamiento total por req.user.restaurant_id (nunca cross-tenant). Roles gerente/admin.

### app/server/src/lib/oc.ts (nuevo)
- createPurchaseOrderDraft(): lógica de creación de borrador de OC extraída de routes/purchaseOrders.ts (transacción + precios desde products.price_per_unit + items). Reutilizada por POST /api/purchase-orders/drafts y por la tool crear_borrador_oc.

### app/server/src/app.ts
- Montaje: app.use('/api/xupai', xupaiRouter).

### app/web/src/components/AiFloatingWidget.tsx
- Nuevo modo "Compra Inteligente (XupAI)": toggle General <> Compra Inteligente en el header del widget.
- Detección automática de intención de compra ("¿qué debo pedir?", "orden de compra", "proveedor", "precio"...) que enruta al agente XupAI desde el modo General.
- Si el agente no está configurado (enabled:false), avisa al usuario y cae al asistente general clásico.
- Chip "Borrador de OC generado [OK]" cuando crear_borrador_oc tiene éxito.

### Configuración (env)
- XUPAI_API_KEY (obligatorio para habilitar el agente; compatible OpenAI o sustitutos OpenRouter/Groq/LiteLLM vía XUPAI_BASE_URL).
- XUPAI_MODEL (default gpt-4o-mini) y XUPAI_BASE_URL (default https://api.openai.com/v1).
- Añadidas a .env, .env.production y .env.production.example.

### Notas
- Compilado sin errores: npm run typecheck (server) y tsc --noEmit + vite build (web).
- Sin dependencias nuevas: usa fetch global y los paquetes existentes del proyecto.