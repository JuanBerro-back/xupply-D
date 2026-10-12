export const site = {
  name: 'Xupply',
  tagline: 'Logística B2B y Abastecimiento Gastronómico',
  appUrl: 'http://localhost:5173',
  loginUrl: 'http://localhost:5173/login',
  registerUrl: 'http://localhost:5173/register',
  cloudAppUrl: 'https://xupply-d-production.up.railway.app/',
  apkUrl: '/Xupply.apk',
  description: 'Xupply: La plataforma integral que conecta restaurantes y proveedores mayoristas en Bucaramanga y Colombia con pedidos B2B, inventario FEFO, facturación DIAN y seguimiento GPS en tiempo real.',
  hero: {
    title: 'Pide, rastrea y factura',
    highlight: 'en tiempo real',
    sub: 'La plataforma B2B que sincroniza restaurantes y proveedores de alimentos: pedidos en segundos, control de inventario FEFO sin mermas, facturación electrónica DIAN y rastreo satelital GPS.',
    cta: 'Abrir Aplicación',
    cta2: 'Probar Simulador',
  },
  statuses: [
    { id: 'recibido', label: 'Pedido recibido', time: '10:14 AM', desc: 'Restaurante confirma compra' },
    { id: 'confirmado', label: 'Proveedor confirma', time: '10:18 AM', desc: 'Stock FEFO validado' },
    { id: 'despacho', label: 'Despacho y lote', time: '10:25 AM', desc: 'Asignado a conductor' },
    { id: 'en_ruta', label: 'Conductor en ruta', time: '10:32 AM', desc: 'GPS satelital activo' },
    { id: 'entregado', label: 'Entregado y factura', time: '10:48 AM', desc: 'CUFE DIAN emitido' },
  ],
  stats: [
    { n: 5, prefix: '', suffix: '', label: 'Roles con permisos configurables' },
    { n: 99, prefix: '', suffix: '.8%', label: 'Entregas a tiempo con ruta optimizada' },
    { n: 100, prefix: '', suffix: '%', label: 'Cumplimiento normativo DIAN y CUFE' },
    { n: 0, prefix: '', suffix: '%', label: 'Mermas por vencimiento con FEFO' },
  ],
  features: [
    {
      id: 'gps',
      icon: 'radar',
      title: 'Seguimiento GPS satelital',
      text: 'Rastreo en vivo sobre el área metropolitana de Bucaramanga con consola móvil para repartidores y telemetría de ruta.',
    },
    {
      id: 'dian',
      icon: 'invoice',
      title: 'Facturación electrónica DIAN',
      text: 'Emisión automática de factura electrónica con CUFE, código QR, IVA y cálculo de Impoconsumo según normativa colombiana.',
    },
    {
      id: 'fefo',
      icon: 'box',
      title: 'Control de inventario FEFO',
      text: 'First Expire, First Out: prioriza automáticamente los lotes de alimentos próximos a vencer, minimizando pérdidas y mermas a cero.',
    },
    {
      id: 'xupai',
      icon: 'ai',
      title: 'Copiloto XupAI',
      text: 'Asistente inteligente para análisis de food cost, pronóstico de demanda, sugerencia de compras por histórico y optimización de menú.',
    },
    {
      id: 'roles',
      icon: 'shield',
      title: 'Control de acceso por roles',
      text: 'Permisos granulares para Administradores, Gerentes de restaurante, Proveedores mayoristas, Repartidores y Cajeros.',
    },
    {
      id: 'colombia',
      icon: 'location',
      title: 'Pensado para Colombia',
      text: 'Soporte nativo para NIT, RUT, municipios de Santander, catálogos en pesos colombianos (COP) y despacho puerta a puerta.',
    },
  ],
  roles: [
    {
      key: 'admin',
      name: 'Administrador',
      icon: 'shield',
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
      icon: 'store',
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
      icon: 'warehouse',
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
      icon: 'truck',
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
      icon: 'credit-card',
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
  ],
  steps: [
    {
      step: '01',
      title: 'El restaurante arma su pedido',
      desc: 'Selecciona insumos frescos con precios de distribuidor y aplica descuentos por lotes FEFO disponibles.',
    },
    {
      step: '02',
      title: 'El proveedor confirma y prepara',
      desc: 'Bodega valida stock, descuenta inventario por lote de vencimiento y emite la orden de despacho.',
    },
    {
      step: '03',
      title: 'El repartidor viaja con GPS en vivo',
      desc: 'Ruta satelital transmitida segundo a segundo. Ambos lados ven el recorrido exacto por la ciudad.',
    },
    {
      step: '04',
      title: 'Recepción y factura electrónica',
      desc: 'El restaurante inspecciona la mercancía, valida con firma digital y recibe la factura DIAN con CUFE.',
    },
  ],
  simulatorProducts: [
    { id: 1, name: 'Carne de Res Angus (Corte Parrilla)', unit: 'Kg', price: 34000, supplier: 'Cárnicos del Oriente', fefoDiscount: 0.15 },
    { id: 2, name: 'Queso Mozzarella Bloque', unit: 'Barra 2.5Kg', price: 46000, supplier: 'Lácteos Santander', fefoDiscount: 0.10 },
    { id: 3, name: 'Pan Brioche Artesanal', unit: 'Bolsa x30', price: 28000, supplier: 'Panadería La Gran Vía', fefoDiscount: 0.20 },
    { id: 4, name: 'Aceite Vegetal de Cocina', unit: 'Bidón 20L', price: 92000, supplier: 'Distribuciones Bucaramanga', fefoDiscount: 0.05 },
    { id: 5, name: 'Pechuga de Pollo Desmechada', unit: 'Kg', price: 21000, supplier: 'Avícola Metropolitana', fefoDiscount: 0.12 },
  ],
  testimonials: [
    {
      name: 'Chef Andrés Montoya',
      role: 'Fundador, Hamburguesería Angus & Co (Cabecera)',
      quote: 'Antes perdíamos hasta un 12% en mermas por vencimiento. Con el inventario FEFO de Xupply y el seguimiento GPS, las compras llegan justo a tiempo y las mermas bajaron a cero.',
    },
    {
      name: 'Claudia Valenzuela',
      role: 'Gerente Comercial, Distribuidora Avícola Santander',
      quote: 'La facturación DIAN integrada nos ahorró 3 horas diarias de papeleo. Ahora los pedidos de 40 restaurantes se despachan con un solo clic.',
    },
  ],
  footer: {
    copy: 'Xupply © 2026 • Plataforma B2B para Restaurantes y Proveedores',
    location: 'Bucaramanga, Santander, Colombia',
    sub: 'Proyecto de Innovación Tecnológica • ADSO SENA',
  },
};

export const extra = {
  words: ['en tiempo real', 'sin mermas (FEFO)', 'con factura DIAN y CUFE', 'con GPS satelital', 'en Bucaramanga'],
  chips: [
    'GPS satelital en tiempo real',
    'Inventario inteligente FEFO',
    'Facturación electrónica DIAN',
    'Validación CUFE y QR',
    'Bucaramanga y Santander',
    'Copiloto XupAI para compras',
    'Seguridad RBAC y auditoría',
    'Punto de venta POS integrado',
    'Conexión directa Restaurante - Proveedor',
  ],
};
