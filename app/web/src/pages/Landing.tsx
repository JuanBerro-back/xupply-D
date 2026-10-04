import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Shield, TrendingUp, Truck, PackageSearch, FileText, Zap, Cpu, Users } from 'lucide-react';
import { MapContainer, TileLayer, CircleMarker, Polyline } from 'react-leaflet';
import AppDownloadNotice from '../components/AppDownloadNotice';

export default function Landing() {
  const [showMapModal, setShowMapModal] = useState(false);
  const [routePositions, setRoutePositions] = useState<[number, number][]>([]);
  const [etaMinutes, setEtaMinutes] = useState<number | null>(null);

  useEffect(() => {
    if (showMapModal) {
      const fetchRoute = async () => {
        try {
          // OSRM coordinates are in [lng, lat]
          // Origin: 7.1250, -73.1200 => -73.1200,7.1250
          // Destination: 7.1000, -73.1150 => -73.1150,7.1000
          const res = await fetch('https://router.project-osrm.org/route/v1/driving/-73.1200,7.1250;-73.1150,7.1000?overview=full&geometries=geojson');
          const data = await res.json();
          if (data.routes && data.routes.length > 0) {
            const route = data.routes[0];
            // OSRM returns coordinates as [[lng, lat], ...]
            // Leaflet Polyline expects [[lat, lng], ...]
            const coords = route.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]);
            setRoutePositions(coords);
            setEtaMinutes(Math.ceil(route.duration / 60)); // Convert seconds to minutes
          }
        } catch (error) {
          console.error("Error fetching OSRM route:", error);
        }
      };
      fetchRoute();
    }
  }, [showMapModal]);
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b1120] text-slate-900 dark:text-slate-100 font-sans selection:bg-sky-500/30">
      <header className="sticky top-0 z-50 w-full backdrop-blur-md bg-white/70 dark:bg-[#0b1120]/70 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-sky-500/20">X</div>
            <span className="font-bold text-xl tracking-tight">Xupply</span>
          </div>
          <nav className="hidden md:flex gap-8 text-sm font-medium text-slate-600 dark:text-slate-300">
            <a href="#features" className="hover:text-sky-500 transition-colors">Características</a>
            <a href="#planes" className="hover:text-sky-500 transition-colors">Planes</a>
            <a href="#xupply-ia" className="hover:text-sky-500 transition-colors">Xupply IA</a>
          </nav>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm font-medium hover:text-sky-500 transition-colors">Iniciar sesión</Link>
            <Link to="/register" className="text-sm font-medium bg-slate-900 dark:bg-sky-500 text-white dark:text-slate-950 px-4 py-2 rounded-full hover:bg-slate-800 dark:hover:bg-sky-400 transition-all shadow-md">Crear cuenta</Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative pt-24 pb-20 lg:pt-32 lg:pb-24 overflow-hidden">
          <div className="absolute top-1/2 left-0 -translate-y-1/2 w-[600px] h-[600px] bg-sky-500/20 dark:bg-sky-500/10 blur-[120px] rounded-full pointer-events-none" />
          <div className="absolute top-1/2 right-0 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/20 dark:bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none" />
          
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
              {/* Text Content */}
              <div className="text-center lg:text-left pt-10 lg:pt-0">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand/10 text-brand text-sm font-bold mb-6">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-brand"></span>
                  </span>
                  Lanzamiento Oficial
                </div>
                <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-r from-slate-900 via-slate-700 to-slate-900 dark:from-white dark:via-slate-200 dark:to-slate-400">
                  El motor operativo de tu restaurante en Bucaramanga
                </h1>
                <p className="mt-4 text-xl md:text-2xl text-slate-600 dark:text-slate-400 mb-10 leading-relaxed max-w-2xl mx-auto lg:mx-0">
                  Catálogo B2B, pedidos con GPS en vivo, inventario inteligente, facturación electrónica y nuestro asistente <span className="text-sky-500 font-semibold">Xupply IA</span>.
                </p>
                <div className="flex flex-col sm:flex-row justify-center lg:justify-start gap-4">
                  <Link to="/register" className="text-lg font-medium bg-sky-500 text-white px-8 py-4 rounded-full hover:bg-sky-400 transition-all shadow-[0_0_40px_-10px_rgba(2,132,199,0.5)] hover:scale-105 active:scale-95 flex items-center justify-center gap-2">
                    Comenzar gratis
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                  </Link>
                  <a href="#features" className="text-lg font-medium bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-8 py-4 rounded-full border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all text-center">
                    Explorar plataforma
                  </a>
                </div>

                <div className="mt-8 max-w-sm mx-auto lg:mx-0">
                  <AppDownloadNotice compact={false} dismissible={false} />
                </div>
                
                <div className="mt-8 flex items-center justify-center lg:justify-start gap-4 text-sm text-slate-500 dark:text-slate-400 font-medium">
                  <div className="flex -space-x-3">
                    <img className="w-10 h-10 rounded-full border-2 border-white dark:border-slate-900 object-cover" src="https://images.unsplash.com/photo-1583394838336-acd977736f90?auto=format&fit=crop&w=100&q=80" alt="Usuario 1" />
                    <img className="w-10 h-10 rounded-full border-2 border-white dark:border-slate-900 object-cover" src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80" alt="Usuario 2" />
                    <img className="w-10 h-10 rounded-full border-2 border-white dark:border-slate-900 object-cover" src="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=100&q=80" alt="Usuario 3" />
                  </div>
                  <p>Únete a más de <strong className="text-slate-900 dark:text-white">50+</strong> restaurantes y proveedores</p>
                </div>
              </div>

              {/* Image Composition */}
              <div className="relative hidden lg:block h-[600px] w-full perspective-1000">
                {/* Main Restaurant Image */}
                <div className="absolute top-10 right-10 w-[380px] h-[480px] rounded-3xl overflow-hidden shadow-2xl border-4 border-white dark:border-slate-800 z-10 transform rotate-2 hover:rotate-0 transition-transform duration-500">
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent z-10" />
                  <img src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80" alt="Restaurante" className="w-full h-full object-cover" />
                  <div className="absolute bottom-6 left-6 z-20 text-white">
                    <div className="text-sm font-bold bg-brand px-2 py-1 rounded-md inline-block mb-1 shadow-lg">Restaurantes</div>
                    <p className="font-medium text-white/90">Optimiza tu operación diaria</p>
                  </div>
                </div>

                {/* Supplier / Ingredients Image */}
                <div className="absolute bottom-10 left-0 w-[300px] h-[340px] rounded-3xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.3)] border-4 border-white dark:border-slate-800 z-20 transform -rotate-3 hover:rotate-0 transition-transform duration-500">
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent z-10" />
                  <img src="https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=500&q=80" alt="Proveedores" className="w-full h-full object-cover" />
                  <div className="absolute bottom-5 left-5 z-20 text-white">
                    <div className="text-sm font-bold bg-emerald-500 px-2 py-1 rounded-md inline-block mb-1 shadow-lg">Proveedores</div>
                    <p className="font-medium text-white/90 text-sm">Conecta con cientos de clientes</p>
                  </div>
                </div>
                
                {/* Floating UI Element (App widget mockup) */}
                <div className="absolute top-24 -left-12 bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-xl border border-slate-200 dark:border-slate-700 z-30 flex items-center gap-4 transform -rotate-2 animate-bounce" style={{ animationDuration: '3s' }}>
                  <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Pedido #1042</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">¡Entregado con éxito!</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Módulos de Identificación por Tipo de Negocio */}
        <section id="soluciones" className="py-24 bg-white dark:bg-slate-950 relative border-t border-slate-100 dark:border-slate-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Hecho a la medida de tu operación</h2>
              <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto text-lg">
                Xupply no es un software genérico. Es un ecosistema gastronómico que conecta cada eslabón de la cadena de suministro.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {/* Card Restaurantes */}
              <div className="group rounded-3xl overflow-hidden bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 hover:border-brand/50 transition-colors shadow-lg">
                <div className="h-48 overflow-hidden relative">
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent z-10" />
                  <img src="https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80" alt="Para Restaurantes" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                  <h3 className="absolute bottom-4 left-6 z-20 text-2xl font-bold text-white">Restaurantes y Cafés</h3>
                </div>
                <div className="p-8">
                  <p className="text-slate-600 dark:text-slate-400 mb-6 h-20">
                    Olvídate de pedir insumos por WhatsApp. Centraliza tus compras mayoristas, controla tu inventario y analiza tu Food Cost en un solo lugar.
                  </p>
                  <ul className="space-y-3 mb-8 h-24">
                    {['Pedidos centralizados 24/7', 'Alertas de stock y mermas', 'Facturación electrónica automática'].map((item, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                        <div className="mt-0.5 text-brand"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg></div>
                        {item}
                      </li>
                    ))}
                  </ul>
                  <Link to="/register" className="inline-flex items-center gap-2 text-brand font-bold hover:gap-3 transition-all">
                    Registrar mi restaurante <span>&rarr;</span>
                  </Link>
                </div>
              </div>

              {/* Card Proveedores */}
              <div className="group rounded-3xl overflow-hidden bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 transition-colors shadow-lg">
                <div className="h-48 overflow-hidden relative">
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent z-10" />
                  <img src="https://images.unsplash.com/photo-1587293852726-70cdb56c2866?auto=format&fit=crop&w=600&q=80" alt="Para Proveedores" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                  <h3 className="absolute bottom-4 left-6 z-20 text-2xl font-bold text-white">Proveedores Mayoristas</h3>
                </div>
                <div className="p-8">
                  <p className="text-slate-600 dark:text-slate-400 mb-6 h-20">
                    Digitaliza tu catálogo, recibe órdenes estructuradas y llega a nuevos clientes gastronómicos. Tu canal B2B sin fricciones.
                  </p>
                  <ul className="space-y-3 mb-8 h-24">
                    {['Catálogo B2B digital', 'Recepción de pagos y facturas', 'Directorio de nuevos restaurantes'].map((item, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                        <div className="mt-0.5 text-emerald-500"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg></div>
                        {item}
                      </li>
                    ))}
                  </ul>
                  <Link to="/register" className="inline-flex items-center gap-2 text-emerald-600 font-bold hover:gap-3 transition-all">
                    Registrarme como proveedor <span>&rarr;</span>
                  </Link>
                </div>
              </div>

              {/* Card Logística */}
              <div className="group rounded-3xl overflow-hidden bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 hover:border-amber-500/50 transition-colors shadow-lg">
                <div className="h-48 overflow-hidden relative">
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent z-10" />
                  <img src="https://images.unsplash.com/photo-1621252178280-9afeb4407b8b?auto=format&fit=crop&w=600&q=80" alt="Para Operadores Logísticos" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                  <h3 className="absolute bottom-4 left-6 z-20 text-2xl font-bold text-white">Equipos Logísticos</h3>
                </div>
                <div className="p-8">
                  <p className="text-slate-600 dark:text-slate-400 mb-6 h-20">
                    Rutas eficientes, seguimiento en vivo y comprobantes de entrega digital. La tranquilidad de que el pedido llegará a tiempo.
                  </p>
                  <ul className="space-y-3 mb-8 h-24">
                    {['Rastreo satelital GPS en vivo', 'Asignación de flotas', 'Pruebas de entrega (Fotografía)'].map((item, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                        <div className="mt-0.5 text-amber-500"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg></div>
                        {item}
                      </li>
                    ))}
                  </ul>
                  <button onClick={() => setShowMapModal(true)} className="inline-flex items-center gap-2 text-amber-600 font-bold hover:gap-3 transition-all">
                    Demostración GPS en Vivo <span>&rarr;</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="py-24 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold mb-4">Todo lo que necesitas, en un solo lugar</h2>
              <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
                Diseñado específicamente para el ecosistema gastronómico, conectando restaurantes con proveedores mayoristas.
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { icon: PackageSearch, title: 'Catálogo Mayorista', desc: 'Explora categorías y proveedores verificados con precios exclusivos B2B.' },
                { icon: Truck, title: 'Logística GPS', desc: 'Sigue tus despachos en tiempo real en el área metropolitana.' },
                { icon: TrendingUp, title: 'Control de Inventario', desc: 'Alertas de stock crítico, mínimos, máximos y vencimientos.' },
                { icon: FileText, title: 'Facturación Electrónica', desc: 'Emisión DIAN automática con IVA e impoconsumo por cada orden.' },
                { icon: Zap, title: 'Contabilidad', desc: 'Reportes de flujo de caja, ingresos y egresos al instante.' },
                { icon: Shield, title: 'Proveedores Verificados', desc: 'Directorio con calificaciones reales de otros restaurantes.' },
                { icon: Users, title: 'Roles y Equipo', desc: 'Gestión granular para administradores, gerentes y empleados.' },
                { icon: Cpu, title: 'Xupply IA', desc: 'Tu copiloto inteligente para optimizar el food cost y compras.' },
              ].map((feature, i) => (
                <div key={i} className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-700/50 hover:border-sky-500/30 dark:hover:border-sky-500/30 transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-sky-500/5 group">
                  <div className="w-12 h-12 bg-sky-50 dark:bg-sky-500/10 rounded-2xl flex items-center justify-center text-sky-500 mb-6 group-hover:scale-110 transition-transform">
                    <feature.icon className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-lg mb-2">{feature.title}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="xupply-ia" className="py-24 relative overflow-hidden">
          <div className="absolute right-0 top-0 w-[500px] h-[500px] bg-purple-500/10 blur-[100px] rounded-full pointer-events-none" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-slate-900 rounded-[3rem] p-8 md:p-16 relative overflow-hidden border border-slate-800">
              <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-900/50 z-0" />
              <div className="relative z-10 grid lg:grid-cols-2 gap-12 items-center">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-sm font-medium mb-6">
                    <Cpu className="w-4 h-4" /> Nuevo
                  </div>
                  <h2 className="text-4xl font-bold text-white mb-6">Conoce a Xupply IA</h2>
                  <p className="text-lg text-slate-400 mb-8 leading-relaxed">
                    Tu copiloto gastronómico. Pregúntale sobre tu food cost ideal, predicciones de compra, o tendencias de precios mayoristas. Toma decisiones basadas en datos en segundos.
                  </p>
                  <ul className="space-y-4 mb-8">
                    {['Análisis predictivo de inventario', 'Optimización de compras y mermas', 'Chat interactivo contextual'].map((item, i) => (
                      <li key={i} className="flex items-center gap-3 text-slate-300">
                        <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400">✓</div>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-[#0b1120] rounded-2xl p-6 border border-slate-700/50 shadow-2xl">
                  <div className="flex gap-4 mb-6">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center text-white text-xs">X</div>
                    <div className="bg-slate-800 rounded-2xl rounded-tl-none p-4 text-sm text-slate-300 flex-1">
                      Hola, he analizado tus ventas de la última semana. Te sugiero aumentar el pedido de Tomate Chonto en un 15% para evitar quiebres de stock este fin de semana.
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-1 bg-sky-600 rounded-2xl rounded-tr-none p-4 text-sm text-white text-right">
                      ¿Cómo afecta esto mi food cost de la semana?
                    </div>
                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-400 text-xs">Tú</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="planes" className="py-24 bg-slate-50 dark:bg-[#0b1120]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold mb-4">Planes diseñados para tu crecimiento</h2>
              <p className="text-slate-600 dark:text-slate-400">Empieza con lo básico o escala con herramientas avanzadas.</p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {[
                { name: 'Xupply Lite', target: 'Básico', price: 'Gratis', desc: 'Catálogo y pedidos esenciales.', features: ['Catálogo mayorista', 'Pedidos B2B', 'Facturas base', 'Soporte estándar'] },
                { name: 'Xupply Pro', target: 'Medio', price: '$89.000', period: '/mes', popular: true, desc: 'Inventario, contabilidad y logística GPS.', features: ['Todo lo de Lite', 'Control de Inventario', 'Módulo de Contabilidad', 'Seguimiento GPS en vivo'] },
                { name: 'Xupply Max', target: 'Premium', price: '$199.000', period: '/mes', desc: 'IA avanzada y soporte prioritario.', features: ['Todo lo de Pro', 'Xupply IA ilimitada', 'Reportes inteligentes', 'Soporte 24/7'] },
              ].map((plan, i) => (
                <div key={i} className={`relative bg-white dark:bg-slate-900 rounded-3xl p-8 border ${plan.popular ? 'border-sky-500 shadow-2xl shadow-sky-500/10 scale-105 z-10' : 'border-slate-200 dark:border-slate-800'}`}>
                  {plan.popular && <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-sky-500 text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">Más popular</div>}
                  <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                  <div className="text-sm text-sky-500 font-medium mb-4">{plan.target}</div>
                  <div className="flex items-baseline gap-1 mb-4">
                    <span className="text-4xl font-extrabold">{plan.price}</span>
                    {plan.period && <span className="text-slate-500">{plan.period}</span>}
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 text-sm mb-8 h-10">{plan.desc}</p>
                  <ul className="space-y-4 mb-8">
                    {plan.features.map((feat, j) => (
                      <li key={j} className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300">
                        <div className="text-sky-500">✓</div>
                        {feat}
                      </li>
                    ))}
                  </ul>
                  <Link to="/register" className={`block text-center w-full py-3 rounded-full font-medium transition-colors ${plan.popular ? 'bg-sky-500 text-white hover:bg-sky-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-700'}`}>
                    Elegir {plan.name.split(' ')[1]}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-900 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-sky-500 flex items-center justify-center text-white font-bold text-xs">X</div>
            <span className="font-bold text-lg">Xupply</span>
          </div>
          <nav className="flex gap-6 text-sm text-slate-500">
            <a href="#catalogo" className="hover:text-slate-900 dark:hover:text-white">Catálogo</a>
            <a href="#planes" className="hover:text-slate-900 dark:hover:text-white">Planes</a>
            <a href="#proveedores" className="hover:text-slate-900 dark:hover:text-white">Proveedores</a>
          </nav>
          <div className="text-sm text-slate-500 text-center md:text-right">
            Bucaramanga, Santander<br />
            <a href="mailto:contacto@xupply.co" className="hover:text-sky-500">contacto@xupply.co</a>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 text-center text-xs text-slate-500">
          © 2026 Xupply. Plataforma B2B para restaurantes y distribuidores.
        </div>
      </footer>

      {/* Modal Didi-style GPS Demo */}
      {showMapModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 animate-fadeIn">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setShowMapModal(false)} />
          <div className="relative w-full max-w-5xl bg-slate-900 rounded-[2rem] overflow-hidden shadow-2xl border border-slate-800 flex flex-col h-[85vh]">
            {/* Modal Header */}
            <div className="p-5 bg-slate-900 flex items-center justify-between border-b border-slate-800 z-10 shadow-sm relative">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </span>
                  Rastreo Satelital Activo
                </h3>
                <p className="text-xs text-slate-400 mt-1">Conectando con satélites locales... (Simulación)</p>
              </div>
              <button onClick={() => setShowMapModal(false)} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors shadow-inner">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            {/* Map Area */}
            <div className="flex-1 relative bg-[#0b0f19]">
              <style>{`.dark-map-tiles { filter: invert(100%) hue-rotate(180deg) brightness(85%) contrast(110%); }`}</style>
              <MapContainer center={[7.11392, -73.1198]} zoom={15} zoomControl={false} className="w-full h-full">
                {/* Usamos OpenStreetMap con un filtro CSS para hacerlo oscuro (sin necesidad de API KEY) */}
                <TileLayer 
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" 
                  className="dark-map-tiles"
                />
                
                {/* Ruta simulada / real obtenida de OSRM */}
                <Polyline 
                  positions={routePositions.length > 0 ? routePositions : [[7.1250, -73.1200], [7.11392, -73.1198], [7.1000, -73.1150]]} 
                  pathOptions={{ color: '#10b981', weight: 4, opacity: 0.8 }} 
                />

                {/* Marcadores de demostración */}
                {/* Domiciliario (moto) */}
                <CircleMarker center={[7.11392, -73.1198]} radius={8} pathOptions={{ color: 'white', weight: 2, fillColor: '#3b82f6', fillOpacity: 1 }} />
                <CircleMarker center={[7.11392, -73.1198]} radius={24} pathOptions={{ color: '#3b82f6', weight: 0, fillColor: '#3b82f6', fillOpacity: 0.2 }} className="animate-ping" />
                
                {/* Origen */}
                <CircleMarker center={[7.1250, -73.1200]} radius={6} pathOptions={{ color: '#10b981', weight: 2, fillColor: '#10b981', fillOpacity: 1 }} />
                {/* Destino */}
                <CircleMarker center={[7.1000, -73.1150]} radius={6} pathOptions={{ color: '#f59e0b', weight: 2, fillColor: '#f59e0b', fillOpacity: 1 }} />
              </MapContainer>

              {/* Didi-Style Overlay Card */}
              <div className="absolute bottom-6 left-6 right-6 md:left-6 md:right-auto md:w-80 bg-slate-900/95 backdrop-blur-xl rounded-3xl p-6 border border-slate-700 shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[1000]">
                <div className="flex items-center gap-4 mb-5 pb-5 border-b border-slate-800">
                  <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center text-2xl shadow-inner border border-slate-700">
                    🛵
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-lg">Carlos M.</h4>
                    <p className="text-slate-400 text-sm flex items-center gap-1">
                      <span>Placa: XUP-123</span>
                      <span className="w-1 h-1 rounded-full bg-slate-600 inline-block" />
                      <span className="text-amber-400">★ 4.9</span>
                    </p>
                  </div>
                </div>
                
                <div className="space-y-4 relative before:absolute before:inset-y-0 before:left-[11px] before:w-[2px] before:bg-slate-800">
                  <div className="flex gap-4 relative z-10">
                    <div className="w-6 h-6 rounded-full bg-slate-900 border-[3px] border-emerald-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Origen (Recolectado)</p>
                      <p className="text-white text-sm font-medium">Distribuidora Oriente</p>
                    </div>
                  </div>
                  <div className="flex gap-4 relative z-10">
                    <div className="w-6 h-6 rounded-full bg-amber-500 flex-shrink-0 border-[3px] border-slate-900 shadow-[0_0_0_2px_rgba(245,158,11,0.3)] mt-0.5" />
                    <div>
                      <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Destino (En camino)</p>
                      <p className="text-white text-sm font-medium">Burger & Co. (Cabecera)</p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-5 border-t border-slate-800 flex justify-between items-center">
                  <div>
                    <p className="text-slate-400 text-xs font-medium">Llegada estimada</p>
                    <p className="text-emerald-400 font-bold text-lg">
                      {etaMinutes !== null ? `${etaMinutes} MIN` : 'Calculando...'}
                    </p>
                  </div>
                  <button className="bg-brand text-white font-bold py-2 px-5 rounded-full text-sm shadow-lg shadow-brand/20 hover:scale-105 transition-transform">
                    Contactar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
