# UI/UX de logística — mapa inmersivo tipo DiDi

Rediseño de la experiencia de seguimiento y entrega para los roles **domiciliario**,
**proveedor_admin** y **admin/gerente**. Antes la vista era un mapa fijo de 440 px
con datos de demostración sembrados en producción; ahora es un mapa a pantalla
completa con el destino, el propietario y el resumen del pedido siempre a la vista.

## Qué se corrigió

| Antes | Ahora |
| --- | --- |
| Mapa de `h-[440px]` encajonado en una tarjeta, sin opción de ampliar | Mapa `h-[clamp(380px,62vh,560px)]` con botón de **pantalla completa** (y `Escape` para salir) |
| `/repartidor` duplicaba el mapa con `MOCK-801`/`MOCK-802` hardcodeados | `DriverDashboard` reutiliza `Deliveries focusMode`: una sola fuente de datos reales |
| `DEMO_BUCARAMANGA_DELIVERIES` y `localStorage` inyectaban entregas falsas si la API fallaba | Sin mocks ni persistencia local: estados de carga, error y vacío explícitos |
| Posiciones "inventadas" con `resolveDispatchHub` cuando faltaba GPS | Solo se dibuja lo que existe en el backend; si falta coordenada se avisa "Sin coordenadas" |
| `alert()` para errores | Notificaciones del contexto (`push`) y mensajes dentro de la vista |
| Leaflet quedaba con zonas grises al cambiar de tamaño | `ResizeObserver` + `invalidateSize()` al abrir/cerrar pantalla completa y la hoja |
| Sin línea de ruta real, solo recta entre puntos | Ruta por calles con OSRM y *fallback* a línea punteada si el servicio no responde |
| Datos del pedido solo en otra pantalla | Hoja inferior con ítems, cantidades, total, notas y acciones del pedido |
| Botones de navegación dispersos | "Ir ahora" (Google Maps) y "Waze" en la tarjeta de destino |

## Avisos que pide el flujo (HUD)

1. **Para dónde es** — dirección completa, distancia, ETA, copiar dirección y
   navegación externa (Google Maps / Waze). Si el pedido no tiene coordenadas se
   indica con un aviso ámbar en lugar de inventar un punto.
2. **Quién es el propietario** — restaurante que originó el pedido, proveedor y
   teléfono con acción directa de llamada.
3. **Resumen del pedido** — productos (`order_items`), unidades, total y notas;
   incluye las acciones de estado y la confirmación con código de seguridad.

## Pantalla completa

- Se activa con el botón de la barra superior (`Expand` / `Minimize2`) o al entrar
  a `/repartidor`, donde arranca abierta.
- Bloquea el scroll del documento y respeta `env(safe-area-inset-*)` (notch).
- El mapa se reajusta para que la ruta no quede tapada por el HUD superior ni por
  la hoja inferior (`paddingTopLeft` / `paddingBottomRight` en `fitBounds`).
- `Escape` cierra el modo inmersivo en escritorio.

## Archivos

- `app/web/src/components/DeliveryMap.tsx` — mapa, HUD, hoja de resumen y acciones.
- `app/web/src/lib/geo.ts` — Haversine, formato de distancia/ETA, OSRM con *timeout*
  y enlaces a Google Maps/Waze.
- `app/web/src/pages/Deliveries.tsx` — integración, búsqueda, filtro Activas/Todas,
  orden por cercanía, carga de detalle y `focusMode`.
- `app/web/src/pages/DriverDashboard.tsx` — wrapper de `Deliveries focusMode`.
- `app/web/src/index.css` — marcadores SVG, animaciones, tiles oscuros y atribución.
- `app/server/src/routes/deliveries.ts` — `created_by_name`/`created_by_phone` en
  `deliverySelect()` para identificar al solicitante.

## Verificación

```bash
cd app/server && npm run typecheck
cd app/web && npm run build
```

Ambos comandos terminan sin errores. El backend expone el detalle que consume el
HUD en `GET /api/deliveries/:id` (`items`, `order_items`, `order_total`, `notes`).
