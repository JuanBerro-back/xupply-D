# Experiencia por rol y recomendaciones para Xupply

Documento de trabajo del rediseño de UX transversal. Incluye lo corregido en
esta iteración y el backlog priorizado para cada tipo de usuario.

## 1. Correcciones aplicadas

### Feedback y errores (todos los roles)

- Se eliminaron **todos** los `alert()`, `window.confirm()` y `prompt()` del
  frontend (16 archivos).
- Nuevo sistema global de avisos (`lib/feedback.ts` + `FeedbackHost`):
  - Toasts no bloqueantes con tipos (éxito, error, aviso, info) y `aria-live`.
  - Diálogo de confirmación accesible con promesa (`await confirmAction(...)`).
- El aviso de “sesión revocada” sobrevive a la redirección a `/login`
  (`sessionStorage` + toast).
- Errores de renderizado muestran una pantalla accionable con recarga en lugar
  de dejar la app en blanco (`AppErrorBoundary`).
- Página **404 real** para rutas inexistentes (antes redirigía en silencio).
- Página **403 explicativa** con enlace al panel que corresponde al rol.

### Modales (todos los roles)

- `Escape` cierra solo el modal superior.
- Bloqueo de scroll del fondo con contador para modales anidados.
- `role="dialog"`, `aria-modal` y `aria-label`.

### Navegación por rol

- **Domiciliario**: al iniciar sesión entra directo a `/repartidor`; tiene “Mi
  ruta” en la barra inferior, en la barra superior y en el menú lateral.
- **Verificador**: navegación propia de back office en menú lateral y barra
  superior; no ve módulos que no puede usar.
- **Proveedor/restaurante**: se mantienen sus accesos, sin enlaces muertos.
- **Admin**: panel y verificación en el mismo lugar.

### Formularios y acciones

- Cambio de contraseña (equipo y admin) ya no usa `prompt`: modal con campo
  enmascarado, mínimo 8 caracteres y cierre de sesiones activas.
- Confirmaciones destructivas (activar/desactivar usuario) usan el diálogo del
  sistema, con texto específico y color de riesgo.
- Login enfoca el usuario automáticamente y ofrece enlace al seguimiento cuando
  la cuenta está en verificación.

## 2. Diagnóstico por rol

### Restaurante / gerente

Fortalezas: catálogo con recomendaciones, carrito, pedidos, inventario,
facturación, contabilidad, radar e IA.

Problemas detectados:

- El dashboard mezcla módulos de restaurante, proveedor y logística; el gerente
  ve tarjetas que no siempre aplican a su operación.
- No hay una vista clara de “mi pedido en camino” fuera de logística.
- Los estados de pedido no explican el siguiente paso esperado.
- Facturación y contabilidad piden muchos datos sin valores por defecto por
  restaurante.

Recomendaciones:

1. **Checklist de activación** (perfil completo, primer pedido, primer empleado)
   con progreso persistente.
2. **Tarjeta “pedido en camino”** en el dashboard con ETA, domiciliario y
   teléfono, reutilizando los datos de logística.
3. **Línea de tiempo del pedido** (creado → confirmado → preparando → en ruta →
   entregado) con responsable y hora.
4. **Plantillas de pedido recurrente** (“pedido semanal de carnes”).
5. Valores por defecto de facturación (cliente, dirección, IVA) y duplicar
   factura.

### Empleado

Fortalezas: acceso operativo a catálogo, pedidos e inventario.

Problemas:

- Ve el mismo menú que el gerente aunque no puede facturar, gestionar equipo o
  cambiar precios.
- No hay un modo “tarea del día” (comandas, stock crítico).

Recomendaciones:

1. Navegación filtrada por permisos reales (no solo por rol).
2. **Pantalla de turno**: comandas abiertas, stock crítico y tareas asignadas.
3. Confirmaciones más rápidas (un toque) para marcar listo/entregado.
4. Bloquear visualmente acciones sin permiso (con explicación), en vez de 403.

### Proveedor / `proveedor_admin`

Fortalezas: catálogo propio, pedidos, despachos, flota, GPS, radar y facturación.

Problemas:

- El dashboard y los textos siguen siendo muy de restaurante (lenguaje y
  tarjetas).
- No hay indicador de **SLA** (pedidos por confirmar, tiempo de respuesta).
- La gestión de flota y domiciliarios está separada de la operación diaria.

Recomendaciones:

1. **Dashboard de operación**: pedidos nuevos, por despachar, entregas activas,
   tiempo medio de confirmación.
2. **Bandeja de pedidos entrantes con aceptación/rechazo** y motivo.
3. **Scorecard de proveedor**: cumplimiento, tiempo de entrega, reseñas.
4. **Asignación masiva** de domiciliarios/vehículos y reasignación con un clic.
5. Alertas de stock propio y de catálogo vencido.

### Domiciliario

Fortalezas: mapa inmersivo a pantalla completa, ruta por calles, HUD con destino,
propietario y resumen del pedido.

Problemas:

- Depende de GPS y datos móviles; sin conexión pierde el mapa.
- No hay navegación por voz ni modo moto (pantalla encendida).
- La evidencia de entrega es solo el código; no hay foto/firma.
- Las notificaciones push no están integradas.

Recomendaciones:

1. **PWA offline-first**: últimas entregas y ruta en caché; cola de estados.
2. **Wake Lock** y modo alto contraste para uso en moto.
3. **Prueba de entrega**: foto, firma y geocerca opcional.
4. **Push real** (FCM) para nuevas asignaciones y cambios de estado.
5. Botón de emergencia/incidencia (dirección errada, cliente ausente).
6. Optimización de ruta con varias paradas (hoy es una por una).

### Admin

Fortalezas: usuarios, roles, permisos, auditoría, comercios, correo, verificación.

Problemas:

- Muchas tablas sin acciones masivas ni exportación.
- La auditoría es técnica; falta lectura de negocio.
- No hay panel de salud del sistema (correo, base, sockets, colas).

Recomendaciones:

1. **Exportar CSV** en usuarios, comercios, auditoría y verificaciones.
2. **Acciones masivas** (activar, asignar plan, reintentar correo).
3. **Panel de salud**: proveedor de correo activo, últimos envíos, estado de BD,
   versión desplegada.
4. Alertas cuando falla el correo o hay solicitudes de verificación antiguas.
5. Roles con permisos granulares visibles en la UI (ya existe la base).

### Verificador (nuevo)

Fortalezas: bandeja con contadores, búsqueda, expediente, documentos, historial y
decisiones con motivo.

Problemas:

- Sin asignación de casos ni control de SLA.
- Sin OCR: el verificador compara NIT a mano.
- Sin notificación en tiempo real al llegar una solicitud.

Recomendaciones:

1. **Asignación y prioridad** (antigüedad, riesgo, tamaño).
2. **OCR del RUT** para prellenar NIT/razón social y detectar discrepancias.
3. **RUES/Cámara de Comercio** automático (siguiente fase acordada).
4. Aviso en vivo al back office (Socket.IO) y correo con resumen.
5. Plantillas de motivo de rechazo/corrección.

## 3. Backlog priorizado (impacto / esfuerzo)

| Prioridad | Mejora | Rol | Impacto | Esfuerzo |
| --- | --- | --- | --- | --- |
| P0 | Toasts + confirmaciones + 403/404/error boundary | Todos | Alto | Hecho |
| P0 | Navegación y home por rol | Todos | Alto | Hecho |
| P1 | Checklist de activación | Restaurante | Alto | M |
| P1 | Tarjeta “pedido en camino” con ETA | Restaurante | Alto | S |
| P1 | Dashboard operativo + SLA | Proveedor | Alto | M |
| P1 | PWA offline + Wake Lock | Domiciliario | Alto | M |
| P1 | Push FCM | Domiciliario/Proveedor | Alto | M |
| P1 | Asignación de casos y SLA | Verificador | Medio | S |
| P2 | Evidencia fotográfica/firma | Domiciliario | Alto | M |
| P2 | OCR de RUT y RUES | Verificador | Alto | L |
| P2 | Exportaciones y acciones masivas | Admin | Medio | S |
| P2 | Panel de salud del sistema | Admin | Medio | S |
| P2 | Línea de tiempo del pedido | Restaurante/Proveedor | Medio | S |
| P3 | Navegación por voz / modo moto | Domiciliario | Medio | M |
| P3 | i18n completo ES/EN | Todos | Bajo | M |
| P3 | Atajos de teclado y command palette | Admin | Bajo | S |

## 4. Otras recomendaciones de producto

- **Pagos en línea y crédito**: PSE/Nequi/tarjeta y cupo para restaurantes;
  reduce la fricción del pedido B2B.
- **Pedidos recurrentes y plantillas**: principal palanca de retención en
  abastecimiento.
- **Integración DIAN** real para facturación electrónica (hoy es un módulo
  interno).
- **Trazabilidad y evidencia**: foto/firma y geocerca en la entrega.
- **Observabilidad**: Sentry/OpenTelemetry, alertas de errores y métricas de
  latencia por endpoint.
- **Seguridad**: 2FA para admin/verificador, rotación de secretos, backups
  verificados y pruebas de restauración.
- **Accesibilidad**: auditoría AA (contraste, foco, teclado, lectores).
- **Analítica de producto**: embudo de registro → verificación → primer pedido,
  tiempo de aprobación, adopción por rol.
- **Soporte**: centro de ayuda contextual y chat dentro de la app.

## 5. Métricas para saber si la UX mejora

- Tiempo de alta: registro → cuenta aprobada → primer pedido.
- % de registros rechazados por documentos ilegibles.
- Tiempo medio de verificación y de confirmación de pedido.
- Entregas completadas sin llamadas de soporte.
- Errores de frontend por sesión y abandonos en formularios.
- Uso del mapa a pantalla completa y de “Ir ahora”.
