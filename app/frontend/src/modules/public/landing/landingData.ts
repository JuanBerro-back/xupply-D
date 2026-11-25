export interface SimulatorProduct {
  id: number;
  name: string;
  unit: string;
  price: number;
  supplier: string;
  fefoDiscount: number;
  defaultQty?: number;
}

export const simulatorProductsByType: Record<string, SimulatorProduct[]> = {
  burger: [
    { id: 101, name: 'Carne de Res Angus (Corte Parrilla)', unit: 'Kg', price: 34000, supplier: 'Cárnicos del Oriente', fefoDiscount: 0.15, defaultQty: 0 },
    { id: 102, name: 'Queso Cheddar Americano Tajado', unit: 'Bloque 1Kg', price: 26000, supplier: 'Lácteos Santander', fefoDiscount: 0.10, defaultQty: 0 },
    { id: 103, name: 'Pan Brioche Artesanal', unit: 'Bolsa x30', price: 28000, supplier: 'Panadería La Gran Vía', fefoDiscount: 0.20, defaultQty: 0 },
    { id: 104, name: 'Aceite Vegetal de Cocina', unit: 'Bidón 20L', price: 92000, supplier: 'Distribuciones Bucaramanga', fefoDiscount: 0.05, defaultQty: 0 },
    { id: 105, name: 'Tocineta Ahumada Tajada', unit: 'Paquete 1Kg', price: 31000, supplier: 'Avícola & Porcinos del Oriente', fefoDiscount: 0.12, defaultQty: 0 },
  ],
  pizza: [
    { id: 201, name: 'Harina de Trigo Especial Pizza 00', unit: 'Bulto 25Kg', price: 78000, supplier: 'Molinos del Oriente', fefoDiscount: 0.15, defaultQty: 0 },
    { id: 202, name: 'Queso Mozzarella en Bloque', unit: 'Barra 2.5Kg', price: 46000, supplier: 'Lácteos Santander', fefoDiscount: 0.10, defaultQty: 0 },
    { id: 203, name: 'Pasta de Tomate / Salsa Pizzera', unit: 'Bidón 5Kg', price: 32000, supplier: 'Salsas & Conservas Andinas', fefoDiscount: 0.12, defaultQty: 0 },
    { id: 204, name: 'Orégano Entero Seco Aromático', unit: 'Bolsa 1Kg', price: 18000, supplier: 'Especias & Aromas BGA', fefoDiscount: 0.20, defaultQty: 0 },
    { id: 205, name: 'Pepperoni Madurado Tajado', unit: 'Paquete 1Kg', price: 38000, supplier: 'Embutidos del Oriente', fefoDiscount: 0.08, defaultQty: 0 },
  ],
  cafe: [
    { id: 301, name: 'Café Especial Grano Tostado', unit: 'Bolsa 2.5Kg', price: 65000, supplier: 'Café Mesa de los Santos', fefoDiscount: 0.15, defaultQty: 0 },
    { id: 302, name: 'Leche Entera Barista Especial', unit: 'Caja x12 Litros', price: 42000, supplier: 'Lácteos Santander', fefoDiscount: 0.10, defaultQty: 0 },
    { id: 303, name: 'Harina de Trigo Pastelera Fina', unit: 'Bulto 25Kg', price: 72000, supplier: 'Molinos del Oriente', fefoDiscount: 0.15, defaultQty: 0 },
    { id: 304, name: 'Mantequilla Sin Sal Pura', unit: 'Bloque 5Kg', price: 58000, supplier: 'Lácteos del Oriente', fefoDiscount: 0.10, defaultQty: 0 },
    { id: 305, name: 'Azúcar Refinada de Alta Pureza', unit: 'Bulto 25Kg', price: 62000, supplier: 'Distribuciones Bucaramanga', fefoDiscount: 0.05, defaultQty: 0 },
  ],
  grill: [
    { id: 401, name: 'Punta de Anca / Picanha Premium', unit: 'Kg', price: 42000, supplier: 'Cárnicos del Oriente', fefoDiscount: 0.15, defaultQty: 0 },
    { id: 402, name: 'Bife de Chorizo Angus', unit: 'Kg', price: 45000, supplier: 'Cárnicos del Oriente', fefoDiscount: 0.12, defaultQty: 0 },
    { id: 403, name: 'Costilla de Cerdo Especial BBQ', unit: 'Kg', price: 26000, supplier: 'Porcinos del Oriente', fefoDiscount: 0.18, defaultQty: 0 },
    { id: 404, name: 'Carbón Vegetal de Quebracho', unit: 'Bulto 15Kg', price: 28000, supplier: 'Distribuciones del Oriente', fefoDiscount: 0.05, defaultQty: 0 },
    { id: 405, name: 'Sal Marina Gruesa Parrillera', unit: 'Bolsa 5Kg', price: 14000, supplier: 'Especias & Sales BGA', fefoDiscount: 0.10, defaultQty: 0 },
  ],
};

export const statuses = [
  { id: 'recibido', label: 'Pedido recibido', time: '10:14 AM', desc: 'Restaurante confirma compra', speed: '0 km/h', eta: '28 min' },
  { id: 'confirmado', label: 'Proveedor confirma', time: '10:18 AM', desc: 'Stock FEFO validado', speed: '0 km/h (Bodega)', eta: '24 min' },
  { id: 'despacho', label: 'Despacho y lote', time: '10:25 AM', desc: 'Asignado a conductor', speed: '15 km/h', eta: '19 min' },
  { id: 'en_ruta', label: 'Conductor en ruta', time: '10:32 AM', desc: 'GPS satelital activo', speed: '44 km/h', eta: '8 min' },
  { id: 'entregado', label: 'Entregado y factura', time: '10:48 AM', desc: 'CUFE DIAN emitido', speed: '0 km/h (Destino)', eta: 'Entregado' },
];

export const chips = [
  'GPS satelital en tiempo real',
  'Inventario inteligente FEFO',
  'Facturación electrónica DIAN',
  'Validación CUFE y QR',
  'Bucaramanga y Santander',
  'Copiloto XupAI para compras',
  'Seguridad RBAC y auditoría',
  'Punto de venta POS integrado',
  'Conexión directa Restaurante - Proveedor',
];

export const rolesData = [
  {
    key: 'admin',
    name: 'Administrador',
    summary: 'Gobierna todo el ecosistema con telemetría de sistema, auditoría de eventos y supervisión financiera.',
    highlights: ['Auditoría completa de transacciones', 'Gestión de roles y permisos RBAC', 'Supervisión de comercios y usuarios'],
    mockupData: {
      title: 'Panel de Control Maestro',
      metrics: [
        { label: 'Volumen Facturado', val: '$54.820.000 COP' },
        { label: 'Comercios Activos', val: '48 Establecimientos' },
        { label: 'Tasa SLA Entregas', val: '99.4%' },
      ],
      actionText: 'Inspeccionar auditoría',
    },
  },
  {
    key: 'restaurante',
    name: 'Restaurante',
    summary: 'Abastece tu cocina en 3 clics con precios mayoristas directos, control de stock y seguimiento del camión en el mapa.',
    highlights: ['Catálogo multi-proveedor centralizado', 'Reordenamiento inteligente semanal', 'Alerta de bajo stock por porción'],
    mockupData: {
      title: 'Gestor de Abastecimiento',
      metrics: [
        { label: 'Última Orden', val: 'PO-742 (24 productos)' },
        { label: 'Ahorro Lote FEFO', val: '$148.000 COP' },
        { label: 'Tiempo de Entrega', val: '18 min restantes' },
      ],
      actionText: 'Generar pedido rápido',
    },
  },
  {
    key: 'proveedor',
    name: 'Proveedor',
    summary: 'Publica inventario, recibe pedidos confirmados, asigna conductores y despacha con trazabilidad de lotes.',
    highlights: ['Priorización FEFO en bodega', 'Asignación inmediata de rutas', 'Factura DIAN automática al despachar'],
    mockupData: {
      title: 'Centro de Despacho Mayorista',
      metrics: [
        { label: 'Pedidos por Despachar', val: '9 órdenes' },
        { label: 'Lotes FEFO en Rotación', val: '42 SKU activos' },
        { label: 'Flujo de Caja Hoy', val: '$18.450.000 COP' },
      ],
      actionText: 'Asignar flota de reparto',
    },
  },
  {
    key: 'conductor',
    name: 'Conductor',
    summary: 'Consola táctil con optimización de ruta GPS, tiempos estimados de llegada (ETA) y confirmación digital de entrega.',
    highlights: ['Navegación paso a paso en Bucaramanga', 'Prueba de entrega con firma o foto', 'Notificación inmediata al restaurante'],
    mockupData: {
      title: 'Consola Móvil de Ruta',
      metrics: [
        { label: 'Destino Actual', val: 'Cra 33 con Calle 48 - Cabecera' },
        { label: 'Velocidad Promedio', val: '42 km/h' },
        { label: 'Entrega Estimada', val: '10:48 AM' },
      ],
      actionText: 'Confirmar llegada a destino',
    },
  },
  {
    key: 'cajero',
    name: 'Cajero / POS',
    summary: 'Facturación rápida de mostrador con generación de CUFE, cálculo de propina voluntaria e impresión de tirilla fiscal.',
    highlights: ['Integración directa con caja', 'Dispersión de impuestos IVA e INC', 'Arqueo de turnos automático'],
    mockupData: {
      title: 'Terminal POS Electrónico',
      metrics: [
        { label: 'Ventas del Turno', val: '$3.890.000 COP' },
        { label: 'Facturas DIAN Emitidas', val: '64 tirillas' },
        { label: 'Tiempo por Transacción', val: '12 segundos' },
      ],
      actionText: 'Emitir factura con CUFE',
    },
  },
];

export const words = ['en tiempo real', 'sin mermas (FEFO)', 'con factura DIAN y CUFE', 'con GPS satelital', 'en Bucaramanga'];
