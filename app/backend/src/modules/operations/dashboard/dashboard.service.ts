// Static dashboard content (category photos and announcements).
export const categoryPhotos: Record<string, { img: string; tag: string }> = {
      'Carnes': {
        img: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&auto=format&fit=crop&q=80',
        tag: 'Cortes Madurados & Parrilla',
      },
      'Lacteos': {
        img: 'https://images.unsplash.com/photo-1628088062854-d1870b4553da?w=800&auto=format&fit=crop&q=80',
        tag: 'Quesos Artesanales & Repostería',
      },
      'Mariscos': {
        img: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=800&auto=format&fit=crop&q=80',
        tag: 'Pesca Fresca del Pacífico y Caribe',
      },
      'Verduras': {
        img: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&auto=format&fit=crop&q=80',
        tag: 'Cosecha Fresca de Santander',
      },
      'Bebidas': {
        img: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=800&auto=format&fit=crop&q=80',
        tag: 'Licores, Cafés y Gaseosas',
      },
    };

export const announcements = [
      {
        id: 1,
        title: 'Nueva Actualización v2.5: Monitoreo GPS en Tiempo Real',
        tag: 'ACTUALIZACIÓN',
        tag_color: 'bg-sky-500',
        date: 'Septiembre 2026',
        summary: 'Rutas dinámicas con línea de proximidad estilo DiDi para tus domiciliarios. Asignación inmediata y telemetría de despacho.',
        image_url: 'https://images.unsplash.com/photo-1526367790999-0150786686a2?auto=format&fit=crop&w=900&q=80',
        action_label: 'Ver Mapa GPS',
        action_url: '/logistica',
      },
      {
        id: 2,
        title: 'Side Dashboard de Carrito Desplegable',
        tag: 'EXPERIENCIA',
        tag_color: 'bg-indigo-500',
        date: 'Septiembre 2026',
        summary: 'Ahora puedes gestionar tu orden lateralmente desde cualquier pantalla sin perder la vista del catálogo ni interrumpir tus pedidos.',
        image_url: 'https://images.unsplash.com/photo-1556742049-0a67e55722c3?auto=format&fit=crop&w=900&q=80',
        action_label: 'Abrir Catálogo',
        action_url: '/catalogo',
      },
      {
        id: 3,
        title: 'Foro de Actualizaciones: Red de Proveedores Mayoristas 2026',
        tag: 'COMUNIDAD',
        tag_color: 'bg-emerald-500',
        date: 'Septiembre 2026',
        summary: 'Conectamos a más de 120 restaurantes y distribuidores en Santander y el país. Consulta nuevas listas de precios directos de fábrica.',
        image_url: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=80',
        action_label: 'Ver Proveedores',
        action_url: '/proveedores',
      },
      {
        id: 4,
        title: 'Xupply IA: Asistente Inteligente para Cocina y Bodega',
        tag: 'INTELIGENCIA',
        tag_color: 'bg-purple-500',
        date: 'Septiembre 2026',
        summary: 'Predice automáticamente tus compras semanales, detecta riesgos de rotura de stock y minimiza mermas con machine learning.',
        image_url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=900&q=80',
        action_label: 'Consultar IA',
        action_url: '/xupply-ia',
      },
    ];
