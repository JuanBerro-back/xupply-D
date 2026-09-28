import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { Order, Product } from '../types';
import { ORDER_STATUS, formatMoney, formatDate } from '../lib/constants';
import RecommendedSuppliersGallery from '../components/RecommendedSuppliersGallery';
import AppDownloadNotice from '../components/AppDownloadNotice';
import {
  IconMotorcycle,
  IconChart,
  IconGps,
  IconOrders,
  IconAi,
  IconKey,
  IconBox,
  IconInventory,
  IconTeam,
  IconSuppliers,
  IconPlans,
  IconMessage,
} from '../components/Icons';

interface MonthlyItem {
  month_key: string;
  month_name: string;
  orders_count: number;
  total_amount: number;
}

interface StockAlert {
  id: number;
  name: string;
  category: string;
  unit: string;
  current_stock: number;
  min_stock: number;
  stock_status: string;
  supplier_name: string;
  supplier_id?: number;
}

interface SuggestionItem {
  id: number;
  name: string;
  unit: string;
  price_per_unit: number;
  supplier_id: number;
  supplier_name: string;
  image_url?: string;
  reason: string;
}

interface DiscountItem {
  id: number;
  name: string;
  unit: string;
  price_per_unit: number;
  original_price: number;
  discount_pct: number;
  supplier_id: number;
  supplier_name: string;
  image_url?: string;
  promo_tag: string;
}

interface EmergingRestaurant {
  id: number;
  name: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  created_at: string;
}

export interface ProspectiveRestaurant {
  id: number;
  name: string;
  category: string;
  city: string;
  address: string;
  phone: string;
  potential_needs: string[];
  compatibility_score: number;
}

export interface DriverDeliveryItem {
  id: number;
  order_id: number;
  order_code: string;
  restaurant_name: string;
  delivery_address: string;
  status: string;
  confirmation_code?: string;
  scheduled_time?: string;
}

interface SupplierProductsInfo {
  total_skus: number;
  low_stock_count: number;
  items: {
    id: number;
    name: string;
    unit: string;
    price_per_unit: number;
    stock_available: number;
    sku: string;
    is_active: boolean;
  }[];
}

interface Announcement {
  id: number;
  title: string;
  tag: string;
  tag_color: string;
  date: string;
  summary: string;
  image_url: string;
  action_label: string;
  action_url: string;
}

interface DashboardData {
  orders: { total: number; nuevos: number; activos: number; monto_total: number };
  products: number;
  recent: Order[];
  monthly_history: MonthlyItem[];
  stock_alerts: StockAlert[];
  daily_suggestions: SuggestionItem[];
  daily_discounts: DiscountItem[];
  my_products: SupplierProductsInfo | null;
  emerging_restaurants: EmergingRestaurant[];
  prospective_restaurants?: ProspectiveRestaurant[];
  driver_deliveries?: DriverDeliveryItem[];
  today_deliveries: any[];
  announcements: Announcement[];
}

const DEFAULT_ANNOUNCEMENTS: Announcement[] = [
  {
    id: 1,
    title: 'Nueva versión de Xupply con GPS satelital y asignación vehicular',
    tag: 'Novedades de la App',
    tag_color: 'bg-emerald-600',
    date: 'Actualización reciente',
    summary: 'Asignación inmediata de camión o moto a tu equipo de despacho, rutas dinámicas con línea de proximidad estilo DiDi y cálculo de tiempo estimado.',
    image_url: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800&auto=format&fit=crop&q=80',
    action_label: 'Ver Mapa GPS',
    action_url: '/logistica',
  },
  {
    id: 2,
    title: 'Comunidad B2B: Alianza de precios con distribuidores mayoristas',
    tag: 'Comunidad Gastronómica',
    tag_color: 'bg-blue-600',
    date: 'Comunidad',
    summary: 'Más de 40 restaurantes en Bucaramanga y Santander redujeron costos hasta un 18% centralizando compras en Xupply.',
    image_url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop&q=80',
    action_label: 'Explorar Catálogo',
    action_url: '/catalogo',
  },
  {
    id: 3,
    title: 'Control de inventario automatizado y alertas de stock bajo',
    tag: 'Tips de Gestión',
    tag_color: 'bg-purple-600',
    date: 'Gestión',
    summary: 'Configura stock mínimo en tus insumos prioritarios para recibir alertas tempranas antes de que se agoten en horarios punta.',
    image_url: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&auto=format&fit=crop&q=80',
    action_label: 'Revisar Inventario',
    action_url: '/inventario',
  },
];

const DEFAULT_DASHBOARD_DATA: DashboardData = {
  orders: { total: 0, nuevos: 0, activos: 0, monto_total: 0 },
  products: 0,
  recent: [],
  monthly_history: [
    { month_key: '2026-04', month_name: 'Abril', orders_count: 14, total_amount: 3200000 },
    { month_key: '2026-05', month_name: 'Mayo', orders_count: 19, total_amount: 4850000 },
    { month_key: '2026-06', month_name: 'Junio', orders_count: 23, total_amount: 6100000 },
    { month_key: '2026-07', month_name: 'Julio', orders_count: 28, total_amount: 7420000 },
    { month_key: '2026-08', month_name: 'Agosto', orders_count: 31, total_amount: 8900000 },
    { month_key: '2026-09', month_name: 'Septiembre', orders_count: 12, total_amount: 3450000 },
  ],
  stock_alerts: [],
  daily_suggestions: [
    {
      id: 101,
      name: 'Aceite Vegetal Palma Real 20L',
      unit: 'bidón',
      price_per_unit: 115000,
      supplier_id: 1,
      supplier_name: 'Distribuidora Santander S.A.S.',
      image_url: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=500&auto=format&fit=crop&q=60',
      reason: 'Precio especial por volumen para restaurantes afiliados',
    },
    {
      id: 102,
      name: 'Pechuga de Pollo Fresca Especial x 1Kg',
      unit: 'kg',
      price_per_unit: 14800,
      supplier_id: 1,
      supplier_name: 'Carnes & Aves del Oriente',
      image_url: 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=500&auto=format&fit=crop&q=60',
      reason: 'Insumo de alta rotación con entrega matutina garantizada',
    },
  ],
  daily_discounts: [
    {
      id: 201,
      name: 'Arroz Diana Extra Blanco Bulto 50Kg',
      unit: 'bulto',
      price_per_unit: 195000,
      original_price: 228000,
      discount_pct: 15,
      supplier_id: 1,
      supplier_name: 'Abastos Centrales',
      image_url: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=500&auto=format&fit=crop&q=60',
      promo_tag: '15% OFF HOY',
    },
    {
      id: 202,
      name: 'Queso Mozzarella Bloque 2.5Kg',
      unit: 'bloque',
      price_per_unit: 54000,
      original_price: 64000,
      discount_pct: 16,
      supplier_id: 1,
      supplier_name: 'Lácteos del Valle',
      image_url: 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=500&auto=format&fit=crop&q=60',
      promo_tag: 'OFERTA EXPRESS',
    },
  ],
  my_products: null,
  emerging_restaurants: [
    {
      id: 501,
      name: 'Trattoria Bella Napoli',
      city: 'Bucaramanga',
      address: 'Cra 35 #48-22, Cabecera',
      phone: '3187654321',
      email: 'contacto@bellanapoli.com',
      created_at: new Date().toISOString(),
    },
    {
      id: 502,
      name: 'Burgers & Grill Central',
      city: 'Floridablanca',
      address: 'Calle 30 #26-10, Cañaveral',
      phone: '3159876543',
      email: 'compras@burgersgrill.co',
      created_at: new Date().toISOString(),
    },
  ],
  today_deliveries: [],
  announcements: DEFAULT_ANNOUNCEMENTS,
};

export default function Dashboard() {
  const { user } = useAuth();
  const { add } = useCart();
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData>(DEFAULT_DASHBOARD_DATA);
  const [fetchNotice, setFetchNotice] = useState(false);

  // Estado del Carrusel de Novedades y Foro
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Menú Desplegable tipo Dashboard interactivo
  const [dashboardMenuExpanded, setDashboardMenuExpanded] = useState(false);

  useEffect(() => {
    api<DashboardData>('/dashboard/summary')
      .then((res) => {
        if (res && typeof res === 'object') {
          setData((prev) => ({
            ...prev,
            ...res,
            orders: { ...prev.orders, ...(res.orders || {}) },
            monthly_history: res.monthly_history && res.monthly_history.length > 0 ? res.monthly_history : prev.monthly_history,
            daily_suggestions: res.daily_suggestions && res.daily_suggestions.length > 0 ? res.daily_suggestions : prev.daily_suggestions,
            daily_discounts: res.daily_discounts && res.daily_discounts.length > 0 ? res.daily_discounts : prev.daily_discounts,
            announcements: res.announcements && res.announcements.length > 0 ? res.announcements : prev.announcements,
            stock_alerts: res.stock_alerts || [],
            emerging_restaurants: res.emerging_restaurants && res.emerging_restaurants.length > 0 ? res.emerging_restaurants : prev.emerging_restaurants,
          }));
          setFetchNotice(false);
        }
      })
      .catch((err) => {
        console.warn('Dashboard fetch notice (using cache):', err);
        setFetchNotice(true);
      });
  }, []);

  useEffect(() => {
    if (user) {
      api('/auth/notify-me').catch(() => undefined);
    }
  }, [user]);

  // Rotación automática del Banner Carrusel
  useEffect(() => {
    if (!data.announcements || data.announcements.length === 0 || isPaused) return;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % data.announcements.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [data.announcements, isPaused]);

  const isSupplier = user?.role === 'proveedor_admin';
  const isRestaurant = !isSupplier && (!!user?.restaurant_id || user?.role === 'gerente' || user?.role === 'admin');
  const isDomiciliario = user?.role === 'domiciliario';

  const handleAddSuggestedProduct = (s: SuggestionItem) => {
    const prod: Product = {
      id: s.id,
      name: s.name,
      description: '',
      sku: `SUG-${s.id}`,
      unit: s.unit,
      price_per_unit: s.price_per_unit,
      min_order_qty: 1,
      stock_available: 50,
      image_url: s.image_url || '',
      category: 'Insumos',
      category_id: 1,
      supplier_id: s.supplier_id,
      supplier_name: s.supplier_name,
      is_active: true,
    };
    add(prod, 1);
  };

  const handleAddDiscountedProduct = (d: DiscountItem) => {
    const prod: Product = {
      id: d.id,
      name: d.name,
      description: d.promo_tag,
      sku: `PROMO-${d.id}`,
      unit: d.unit,
      price_per_unit: d.price_per_unit,
      min_order_qty: 1,
      stock_available: 50,
      image_url: d.image_url || '',
      category: 'Ofertas Flash',
      category_id: 1,
      supplier_id: d.supplier_id,
      supplier_name: d.supplier_name,
      is_active: true,
    };
    add(prod, 1);
  };

  const maxMonthAmount = useMemo(() => {
    if (!data.monthly_history || data.monthly_history.length === 0) return 1;
    return Math.max(...data.monthly_history.map((m) => m.total_amount), 1);
  }, [data.monthly_history]);

  const activeAnnouncement = data.announcements && data.announcements[currentSlide];

return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-12 font-sans animate-in fade-in duration-300">
      
      {/* 1. HEADER & GREETING */}
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 border-b border-slate-200">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
            Bienvenido, {user?.name || user?.username || 'Usuario'}
          </h1>
          <p className="text-sm text-slate-500 mt-1 capitalize">
            Panel Principal • {user?.role?.replace('_', ' ')}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => window.dispatchEvent(new Event('xupply_open_drawer'))}
            className="flex items-center gap-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 px-4 py-2.5 text-sm font-semibold transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            Menú de Módulos
          </button>
          
          {!isDomiciliario && !isSupplier && (
            <Link to="/catalogo" className="bg-sky-500 hover:bg-sky-600 text-white font-medium py-2.5 px-5 rounded-xl shadow-sm transition-colors flex items-center gap-2 text-sm">
              <IconBox className="w-4 h-4" />
              Nueva Orden B2B
            </Link>
          )}
        </div>
      </header>

      <div className="px-6 md:px-8 max-w-[1800px] mx-auto space-y-6">
        
        {fetchNotice && (
          <div className="flex items-center justify-between rounded-xl bg-sky-50 border border-sky-200 p-4 text-sm text-sky-800 shadow-sm">
            <span className="flex items-center gap-2 font-medium">
              <svg className="w-5 h-5 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Conexión optimizada en segundo plano. Los datos podrían tardar en actualizarse.
            </span>
            <button onClick={() => window.location.reload()} className="rounded-lg bg-sky-200/80 px-3 py-1 font-bold text-sky-900 hover:bg-sky-300 transition">
              Actualizar
            </button>
          </div>
        )}

        {/* PROGRESSIVE DISCLOSURE: TABS */}
        <nav className="flex space-x-2 border-b border-slate-200 mb-6">
          <button className="px-4 py-2.5 text-sm font-bold capitalize border-b-2 border-sky-500 text-sky-600">
            Resumen Operativo
          </button>
          {isRestaurant && (
            <Link to="/inventario" className="px-4 py-2.5 text-sm font-medium capitalize border-b-2 border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300">
              Alertas de Stock ({data.stock_alerts.length})
            </Link>
          )}
          {isDomiciliario && (
            <Link to="/logistica" className="px-4 py-2.5 text-sm font-medium capitalize border-b-2 border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300">
              Mapa GPS
            </Link>
          )}
        </nav>

        {/* DOMICILIARIOS VIEW */}
        {isDomiciliario ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-sm font-bold text-slate-700">Entregas Asignadas</h2>
                <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                  <IconMotorcycle className="w-5 h-5" />
                </div>
              </div>
              <div className="mb-2">
                <span className="text-4xl font-bold text-slate-900 tracking-tight">{(data.driver_deliveries || []).length}</span>
              </div>
              <Link to="/pedidos" className="text-xs font-bold text-sky-600 hover:underline">Ver detalles de entrega →</Link>
            </section>
            
            <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-sm font-bold text-slate-700">Telemetría GPS</h2>
                <div className="p-2 bg-sky-50 rounded-lg text-sky-600">
                  <IconGps className="w-5 h-5" />
                </div>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <span className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-sm font-bold text-emerald-700">Conectado y Transmitiendo</span>
              </div>
              <Link to="/logistica" className="text-xs font-bold text-sky-600 hover:underline">Abrir Mapa Satelital →</Link>
            </section>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Card 1: Pedidos Activos */}
            <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-sm font-bold text-slate-700">Pedidos {isSupplier ? 'Entrantes' : 'Activos'}</h2>
                <div className="p-2 bg-sky-50 rounded-lg text-sky-500">
                  <IconOrders className="w-5 h-5" />
                </div>
              </div>
              <div className="mb-2">
                <span className="text-4xl font-bold text-slate-900 tracking-tight">{data.orders?.activos || 0}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                <span className="text-emerald-600">{data.orders?.nuevos || 0} Nuevos</span>
                <span>• {data.orders?.total || 0} Históricos</span>
              </div>
            </section>

            {/* Card 2: Estado del Inventario */}
            {isRestaurant ? (
              <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-sm font-bold text-slate-700">Stock Crítico (ROP)</h2>
                  <div className="p-2 bg-amber-50 rounded-lg text-amber-500">
                    <IconInventory className="w-5 h-5" />
                  </div>
                </div>
                <div className="mb-2">
                  <span className="text-4xl font-bold text-slate-900 tracking-tight">{data.stock_alerts?.length || 0}</span>
                  <span className="text-sm text-slate-500 ml-2 font-medium">insumos</span>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-2">Requieren orden de compra pronto.</p>
              </section>
            ) : (
              <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-sm font-bold text-slate-700">Mi Catálogo</h2>
                  <div className="p-2 bg-sky-50 rounded-lg text-sky-500">
                    <IconBox className="w-5 h-5" />
                  </div>
                </div>
                <div className="mb-2">
                  <span className="text-4xl font-bold text-slate-900 tracking-tight">{data.products || 0}</span>
                  <span className="text-sm text-slate-500 ml-2 font-medium">SKUs</span>
                </div>
                <Link to="/inventario" className="text-xs font-bold text-sky-600 hover:underline">Gestionar productos →</Link>
              </section>
            )}

            {/* Card 3: Gasto / Ingreso del Mes */}
            <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-sm font-bold text-slate-700">{isSupplier ? 'Ventas' : 'Inversión'} del Mes</h2>
                <div className="p-2 bg-slate-50 rounded-lg text-slate-500">
                  <IconChart className="w-5 h-5" />
                </div>
              </div>
              <div className="mb-2">
                <span className="text-4xl font-bold text-slate-900 tracking-tight text-ellipsis overflow-hidden block whitespace-nowrap">
                  {formatMoney(data.orders?.monto_total || 0)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                <span className="text-emerald-600">En curso</span>
                <span>• Datos de {new Date().toLocaleDateString('es-ES', { month: 'long' })}</span>
              </div>
            </section>
          </div>
        )}

        {/* MODULAR SECTIONS BELOW THE FOLD */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          {/* Quick Actions / Shortcuts (Replaces the massive module grid) */}
          <div className="lg:col-span-1 space-y-4">
            <h3 className="text-xs font-black tracking-wider uppercase text-slate-400">Accesos Rápidos</h3>
            
            {(isSupplier || isDomiciliario || user?.role === 'admin') && (
              <Link to="/logistica" className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl hover:border-sky-300 hover:shadow-sm transition-all group">
                <div className="flex items-center gap-3">
                  <div className="text-slate-400 group-hover:text-sky-500 transition-colors"><IconGps className="w-5 h-5" /></div>
                  <span className="text-sm font-bold text-slate-700 group-hover:text-slate-900">Rastreo GPS en Vivo</span>
                </div>
                <svg className="w-4 h-4 text-slate-300 group-hover:text-sky-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </Link>
            )}

            {!isDomiciliario && (
              <Link to="/proveedores" className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl hover:border-sky-300 hover:shadow-sm transition-all group">
                <div className="flex items-center gap-3">
                  <div className="text-slate-400 group-hover:text-sky-500 transition-colors"><IconSuppliers className="w-5 h-5" /></div>
                  <span className="text-sm font-bold text-slate-700 group-hover:text-slate-900">Directorio de Proveedores</span>
                </div>
                <svg className="w-4 h-4 text-slate-300 group-hover:text-sky-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </Link>
            )}

            <Link to="/xupply-ia" className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl hover:border-indigo-300 hover:shadow-sm transition-all group">
              <div className="flex items-center gap-3">
                <div className="text-slate-400 group-hover:text-indigo-500 transition-colors"><IconAi className="w-5 h-5" /></div>
                <span className="text-sm font-bold text-slate-700 group-hover:text-slate-900">Asistente Xupply IA</span>
              </div>
              <svg className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </Link>
          </div>

          {/* Activity Feed */}
          <div className="lg:col-span-2">
            <h3 className="text-xs font-black tracking-wider uppercase text-slate-400 mb-4">Órdenes Recientes</h3>
            <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 shadow-sm overflow-hidden">
               {data.recent && data.recent.length > 0 ? data.recent.slice(0, 4).map(order => (
                 <div key={order.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-slate-50 transition-colors gap-4">
                   <div className="flex items-center gap-4">
                     <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-xs border border-slate-200">
                       <IconOrders className="w-4 h-4" />
                     </div>
                     <div>
                       <p className="text-sm font-bold text-slate-900">{order.restaurant_name || order.supplier_name}</p>
                       <p className="text-xs text-slate-500 font-medium">#{order.order_code} • {formatDate(order.created_at)}</p>
                     </div>
                   </div>
                   <div className="flex items-center gap-3 justify-between sm:justify-end w-full sm:w-auto">
                     <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700">
                       {ORDER_STATUS[order.status as keyof typeof ORDER_STATUS]?.label || order.status}
                     </span>
                     <Link to={`/pedidos/${order.id}`} className="text-xs font-bold text-sky-600 hover:text-sky-700">Ver</Link>
                   </div>
                 </div>
               )) : (
                 <div className="p-8 text-center text-slate-500">
                   <p className="text-sm font-medium">No hay actividad reciente.</p>
                 </div>
               )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
