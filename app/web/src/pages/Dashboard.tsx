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
    <div className="space-y-6 pb-12">
      {fetchNotice && (
        <div className="flex items-center justify-between rounded-xl bg-sky-50 border border-sky-200 px-3.5 py-2 text-xs text-sky-800 shadow-xs">
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4 text-sky-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Visualizando panel optimizado. Conexión en segundo plano activa.</span>
          </span>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg bg-sky-200/80 px-2 py-0.5 font-bold text-sky-900 hover:bg-sky-300 transition"
          >
            Actualizar
          </button>
        </div>
      )}

      {/* Aviso Prominente de Descarga de Xupply App */}
      <AppDownloadNotice />

      {/* Vista Exclusiva y Dedicada para Domiciliarios */}
      {isDomiciliario && (
        <div className="space-y-6 pb-12">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center font-black">
                <IconMotorcycle className="w-7 h-7 text-sky-700" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-800 tracking-tight">Panel de Reparto y Rutas GPS</h1>
                <p className="text-xs text-slate-500">
                  Conductor: <span className="font-bold text-slate-700">{user?.name || user?.username}</span> · Telemetría activa en Bucaramanga
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setDashboardMenuExpanded(!dashboardMenuExpanded)}
                className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 px-3.5 py-3 text-xs font-bold shadow-xs hover:bg-emerald-600/30 active:scale-95 transition cursor-pointer"
                title="Desplegar Módulos Dashboard"
              >
                <IconChart className="w-4 h-4 text-emerald-700 dark:text-emerald-300" />
                <span>Módulos</span>
                <span>{dashboardMenuExpanded ? '▲' : '▼'}</span>
              </button>

              <button
                type="button"
                onClick={() => window.dispatchEvent(new Event('xupply_open_drawer'))}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-xs font-bold text-white shadow-md hover:bg-slate-800 active:scale-95 transition cursor-pointer"
                title="Abrir menú tipo hamburguesa"
              >
                <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                <span>Menú</span>
              </button>

              <Link
                to="/logistica"
                className="inline-flex items-center gap-2 rounded-2xl bg-sky-600 px-5 py-3 text-xs font-bold text-white shadow-md hover:bg-sky-700 active:scale-95 transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                <span>Abrir Mapa GPS en Vivo</span>
              </Link>
            </div>
          </div>

          {/* Menú Desplegable tipo Dashboard para Domiciliarios */}
          {dashboardMenuExpanded && (
            <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between">
                <p className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Módulos de Conductor & Reparto
                </p>
                <button
                  type="button"
                  onClick={() => setDashboardMenuExpanded(false)}
                  className="text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  ▲ Contraer
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Link
                  to="/logistica"
                  className="flex items-center gap-3 p-3 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/60 hover:bg-sky-100 transition"
                >
                  <IconGps className="w-6 h-6 text-sky-600" />
                  <div>
                    <p className="text-xs font-black text-sky-900 dark:text-sky-200">Rutas & Mapa Satelital</p>
                    <p className="text-[10px] text-sky-600 dark:text-sky-400">Telemetría de reparto activa</p>
                  </div>
                </Link>

                <Link
                  to="/pedidos"
                  className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 transition"
                >
                  <IconOrders className="w-6 h-6 text-slate-600" />
                  <div>
                    <p className="text-xs font-black text-slate-900 dark:text-slate-100">Historial de Envíos</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">Entregas con llave de seguridad</p>
                  </div>
                </Link>

                <Link
                  to="/xupply-ia"
                  className="flex items-center gap-3 p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 hover:bg-indigo-100 transition"
                >
                  <IconAi className="w-6 h-6 text-indigo-600" />
                  <div>
                    <p className="text-xs font-black text-indigo-900 dark:text-indigo-200">Asistente Xupply IA</p>
                    <p className="text-[10px] text-indigo-600 dark:text-indigo-400">Preguntas sobre rutas y entregas</p>
                  </div>
                </Link>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl bg-white p-4 border border-slate-200 shadow-sm">
              <span className="text-xs font-semibold text-slate-400 block uppercase">Estado Telemetría</span>
              <div className="flex items-center gap-2 mt-1">
                <span className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-sm font-bold text-emerald-700">GPS Activo y Transmitiendo</span>
              </div>
            </div>
            <div className="rounded-2xl bg-white p-4 border border-slate-200 shadow-sm">
              <span className="text-xs font-semibold text-slate-400 block uppercase">Pedidos Asignados</span>
              <p className="text-2xl font-black text-slate-900 mt-0.5">
                {(data.driver_deliveries || data.today_deliveries || []).length}
              </p>
            </div>
            <div className="rounded-2xl bg-white p-4 border border-slate-200 shadow-sm">
              <span className="text-xs font-semibold text-slate-400 block uppercase">Navegación Rápida</span>
              <Link to="/logistica" className="text-xs font-bold text-sky-600 hover:underline mt-1.5 inline-block">
                Ver recorrido en mapa satelital →
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-black text-slate-900">Entregas Asignadas (Con Llave de Seguridad)</h2>
                <p className="text-xs text-slate-500">
                  Lleva este código al restaurante. El gerente lo necesita para validar la entrega.
                </p>
              </div>
              <Link to="/logistica" className="text-xs font-bold text-sky-600 hover:underline">
                Ver mapa completo →
              </Link>
            </div>

            {(!data.driver_deliveries || data.driver_deliveries.length === 0) ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <IconMotorcycle className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
                <p className="font-bold text-slate-700 text-sm">No tienes entregas pendientes en este momento</p>
                <p className="text-xs">Tu proveedor te notificará cuando te asigne una nueva ruta de despacho.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.driver_deliveries.map((del) => (
                  <div
                    key={del.id}
                    className="rounded-2xl border-2 border-slate-200 bg-slate-50/70 p-4 space-y-3 hover:border-sky-300 transition"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black font-mono text-slate-900">{del.order_code}</span>
                      <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-[10px] font-extrabold text-sky-800">
                        {del.status.toUpperCase()}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{del.restaurant_name}</h3>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="truncate">{del.delivery_address}</span>
                      </p>
                    </div>

                    {del.confirmation_code && (
                      <div className="rounded-xl bg-amber-50 border-2 border-amber-300 p-3 text-center space-y-1">
                        <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block inline-flex items-center justify-center gap-1">
                          <IconKey className="w-3.5 h-3.5 text-amber-700 inline" />
                          Llave de Seguridad para el Gerente:
                        </span>
                        <div className="text-2xl font-black font-mono text-amber-950 tracking-widest bg-white py-1 px-4 rounded-xl border border-amber-200 inline-block shadow-xs">
                          {del.confirmation_code}
                        </div>
                        <p className="text-[10px] text-amber-700">
                          Entrégale este código al gerente cuando te reciba los insumos
                        </p>
                      </div>
                    )}

                    <div className="pt-2 flex items-center justify-between border-t border-slate-200">
                      <Link
                        to="/logistica"
                        className="text-xs font-bold text-sky-600 hover:underline inline-flex items-center gap-1"
                      >
                        <span>Abrir en mapa GPS</span>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </Link>

                      <Link
                        to={`/pedidos/${del.order_id}`}
                        className="rounded-xl bg-slate-200 px-3 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-300 transition"
                      >
                        Detalle del Pedido
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 1. Cabecera y Bienvenida Personalizada (No Domiciliarios) */}
      {!isDomiciliario && (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">
            Panel Principal {isSupplier ? 'del Proveedor' : isDomiciliario ? 'de Entregas' : 'Gastronómico'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Bienvenido, <span className="font-bold text-slate-700">{user?.name || user?.username}</span> ·{' '}
            <span className="capitalize">{user?.role?.replace('_', ' ')}</span>
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Botón Destacado Menú Tipo Hamburguesa */}
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event('xupply_open_drawer'))}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 active:scale-95 px-3.5 py-2 text-xs font-black shadow-sm transition cursor-pointer border border-slate-700"
            title="Abrir menú tipo hamburguesa con todos los módulos"
          >
            <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span>Menú Completo</span>
          </button>

          {!isSupplier && !isDomiciliario && (
            <Link
              to="/catalogo"
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-brand-dark active:scale-95 transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span>Nueva Orden</span>
            </Link>
          )}

          <Link
            to="/pedidos"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span>Ver Pedidos</span>
          </Link>
        </div>
      </div>

      {/* Centro de Control Desplegable tipo Dashboard (Web & Móvil) */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-all duration-300">
        {/* Barra superior interactiva del desplegable */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setDashboardMenuExpanded(!dashboardMenuExpanded)}
              className="flex items-center gap-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 active:scale-95 px-3 py-1.5 text-xs font-bold transition cursor-pointer"
              aria-expanded={dashboardMenuExpanded}
            >
              <IconChart className="w-4 h-4 text-emerald-300" />
              <span>Menú Desplegable Dashboard</span>
              <svg
                className={`w-3.5 h-3.5 transition-transform duration-200 ${dashboardMenuExpanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <span className="text-xs text-slate-300 hidden md:inline font-medium">
              Panel interactivo con todos los módulos y accesos de tu rol.
            </span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
            <button
              type="button"
              onClick={() => setDashboardMenuExpanded(!dashboardMenuExpanded)}
              className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 transition text-[11px] font-semibold whitespace-nowrap cursor-pointer"
            >
              {dashboardMenuExpanded ? '▲ Ocultar Módulos' : '▼ Ver Todos los Módulos'}
            </button>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event('xupply_open_drawer'))}
              className="px-2.5 py-1 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/30 transition text-[11px] font-semibold whitespace-nowrap cursor-pointer"
            >
              Menú Lateral
            </button>
          </div>
        </div>

        {/* Panel Desplegable Expandible tipo Dashboard con Cards Interactivas */}
        {dashboardMenuExpanded && (
          <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Módulos del Sistema ({user?.role?.replace('_', ' ')})
              </p>
              <button
                type="button"
                onClick={() => setDashboardMenuExpanded(false)}
                className="text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                ▲ Contraer Panel
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Catálogo */}
              {!isDomiciliario && (
                <Link
                  to="/catalogo"
                  className="flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-xs hover:border-brand hover:shadow-sm transition group"
                >
                  <div className="h-10 w-10 rounded-xl bg-sky-50 dark:bg-sky-950/50 text-brand flex items-center justify-center group-hover:scale-105 transition">
                    <IconBox className="w-5 h-5 text-brand" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-800 dark:text-white">Catálogo B2B</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Insumos mayoristas</p>
                  </div>
                </Link>
              )}

              {/* Pedidos */}
              <Link
                to="/pedidos"
                className="flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-xs hover:border-brand hover:shadow-sm transition group"
              >
                <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition">
                  <IconOrders className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs font-black text-slate-800 dark:text-white">Gestión de Pedidos</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Despachos & entregas</p>
                </div>
              </Link>

              {/* Inventario ROP (Restaurantes) */}
              {isRestaurant && (
                <Link
                  to="/inventario"
                  className="flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-xs hover:border-brand hover:shadow-sm transition group"
                >
                  <div className="h-10 w-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center group-hover:scale-105 transition">
                    <IconInventory className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-800 dark:text-white">Inventario (ROP)</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Puntos de reorden</p>
                  </div>
                </Link>
              )}

              {/* Mapa GPS (Proveedores / Domiciliarios / Admin) */}
              {(isSupplier || isDomiciliario || user?.role === 'admin') && (
                <Link
                  to="/logistica"
                  className="flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-slate-800 border border-sky-200/80 dark:border-sky-800/80 shadow-xs hover:border-sky-500 hover:shadow-sm transition group"
                >
                  <div className="h-10 w-10 rounded-xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 flex items-center justify-center group-hover:scale-105 transition">
                    <IconGps className="w-5 h-5 text-sky-600" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-sky-900 dark:text-sky-200">Mapa GPS en Vivo</p>
                    <p className="text-[11px] text-sky-600 dark:text-sky-400">Telemetría de reparto</p>
                  </div>
                </Link>
              )}

              {/* Equipo / Flota */}
              {(isRestaurant || isSupplier || user?.role === 'admin') && (
                <Link
                  to="/equipo"
                  className="flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-slate-800 border border-purple-200/80 dark:border-purple-800/80 shadow-xs hover:border-purple-500 hover:shadow-sm transition group"
                >
                  <div className="h-10 w-10 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 flex items-center justify-center group-hover:scale-105 transition">
                    <IconTeam className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-purple-900 dark:text-purple-200">
                      {isSupplier ? 'Flota de Domiciliarios' : 'Equipo de Empleados'}
                    </p>
                    <p className="text-[11px] text-purple-600 dark:text-purple-400">
                      {isSupplier ? 'Vehículos & conductores' : 'Personal operativo'}
                    </p>
                  </div>
                </Link>
              )}

              {/* Directorio de Proveedores */}
              <Link
                to="/proveedores"
                className="flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-xs hover:border-brand hover:shadow-sm transition group"
              >
                <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center group-hover:scale-105 transition">
                  <IconSuppliers className="w-5 h-5 text-slate-700 dark:text-slate-200" />
                </div>
                <div>
                  <p className="text-xs font-black text-slate-800 dark:text-white">Proveedores</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Directorio B2B</p>
                </div>
              </Link>

              {/* Planes Xupply */}
              <Link
                to="/planes"
                className="flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-slate-800 border border-amber-200/80 dark:border-amber-800/80 shadow-xs hover:border-amber-500 hover:shadow-sm transition group"
              >
                <div className="h-10 w-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center group-hover:scale-105 transition">
                  <IconPlans className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs font-black text-amber-900 dark:text-amber-200">Planes Xupply</p>
                  <p className="text-[11px] text-amber-600 dark:text-amber-400">Suscripción & funciones</p>
                </div>
              </Link>

              {/* Xupply IA */}
              <Link
                to="/xupply-ia"
                className="flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-slate-800 border border-indigo-200/80 dark:border-indigo-800/80 shadow-xs hover:border-indigo-500 hover:shadow-sm transition group"
              >
                <div className="h-10 w-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 flex items-center justify-center group-hover:scale-105 transition">
                  <IconAi className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-xs font-black text-indigo-900 dark:text-indigo-200">Xupply Asistente IA</p>
                  <p className="text-[11px] text-indigo-600 dark:text-indigo-400">Copiloto 24/7</p>
                </div>
              </Link>
            </div>
          </div>
        )}
      </div>
        </>
      )}

      {/* Galería de Proveedores Recomendados (Solo para Restaurantes) */}
      {!isDomiciliario && isRestaurant && (
        <RecommendedSuppliersGallery />
      )}

      {/* 2. Banner Tipo Galería de Fotos: Novedades de la App y Foro de Actualizaciones */}
      {data.announcements && data.announcements.length > 0 && activeAnnouncement && (
        <div
          className="relative overflow-hidden rounded-3xl shadow-md border border-slate-200 bg-slate-900 group"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {/* Fondo Fotográfico / Ilustración */}
          <div
            className="absolute inset-0 bg-cover bg-center transition-all duration-700 group-hover:scale-105 opacity-40"
            style={{ backgroundImage: `url(${activeAnnouncement.image_url})` }}
          />

          {/* Gradiente de Legibilidad */}
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900/80 to-slate-900/40" />

          {/* Contenido del Banner */}
          <div className="relative z-10 p-6 sm:p-8 flex flex-col justify-between min-h-[220px] max-w-2xl text-white">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black tracking-wider uppercase text-white ${activeAnnouncement.tag_color}`}>
                  {activeAnnouncement.tag}
                </span>
                <span className="text-xs text-slate-300 font-medium">{activeAnnouncement.date}</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black leading-tight text-white drop-shadow-sm">
                {activeAnnouncement.title}
              </h2>
              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed max-w-xl">
                {activeAnnouncement.summary}
              </p>
            </div>

            <div className="mt-5 flex items-center gap-3">
              <Link
                to={activeAnnouncement.action_url}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-bold text-slate-900 shadow-sm hover:bg-slate-100 transition active:scale-95"
              >
                <span>{activeAnnouncement.action_label}</span>
                <svg className="w-3.5 h-3.5 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>

              {/* Controles del Carrusel */}
              <div className="flex items-center gap-1.5 ml-auto">
                <button
                  type="button"
                  onClick={() =>
                    setCurrentSlide((prev) => (prev === 0 ? data.announcements.length - 1 : prev - 1))
                  }
                  className="h-7 w-7 rounded-lg bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition"
                  aria-label="Slide anterior"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                {data.announcements.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setCurrentSlide(idx)}
                    className={`h-2 rounded-full transition-all ${
                      currentSlide === idx ? 'w-6 bg-brand' : 'w-2 bg-white/40'
                    }`}
                    aria-label={`Ir al slide ${idx + 1}`}
                  />
                ))}

                <button
                  type="button"
                  onClick={() =>
                    setCurrentSlide((prev) => (prev + 1) % data.announcements.length)
                  }
                  className="h-7 w-7 rounded-lg bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition"
                  aria-label="Siguiente slide"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Tarjetas Resumen Principales (Métricas Rápidas) */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Pedidos Totales</span>
            <div className="h-7 w-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900">{data.orders.total}</p>
          <span className="text-[11px] text-slate-400 font-medium">Registrados en la plataforma</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Nuevos</span>
            <div className="h-7 w-7 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-black text-sky-600">{data.orders.nuevos}</p>
          <span className="text-[11px] text-sky-600 font-medium">Por confirmar o despachar</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">En Ruta / Activos</span>
            <div className="h-7 w-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-black text-amber-600">{data.orders.activos}</p>
          <span className="text-[11px] text-amber-700 font-medium">Seguimiento en curso</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">
              {isSupplier ? 'Facturación' : 'Total Invertido'}
            </span>
            <div className="h-7 w-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-brand truncate">{formatMoney(data.orders.monto_total)}</p>
          <span className="text-[11px] text-emerald-600 font-medium">Histórico acumulado</span>
        </div>
      </div>

      {/* ============================================================ */}
      {/* SECCIÓN ESPECÍFICA PARA GERENTE / RESTAURANTE */}
      {/* ============================================================ */}
      {isRestaurant && (
        <div className="space-y-6">
          
          {/* Fila: Histórico del Mes + Alertas de Stock Crítico */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Histórico del Mes */}
            <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-brand/10 text-brand flex items-center justify-center">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-800">Histórico del Mes</h2>
                    <p className="text-xs text-slate-400">Evolución de compras y suministros</p>
                  </div>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-600">
                  Últimos meses
                </span>
              </div>

              <div className="space-y-3">
                {data.monthly_history.map((m) => {
                  const pct = Math.round((m.total_amount / maxMonthAmount) * 100);
                  return (
                    <div key={m.month_key} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-700 capitalize">{m.month_name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 font-mono text-[11px]">{m.orders_count} pedidos</span>
                          <span className="font-extrabold text-slate-900">{formatMoney(m.total_amount)}</span>
                        </div>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-sky-500 to-sky-700 rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(pct, 12)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 text-right">
                <Link to="/contabilidad" className="text-xs font-bold text-brand hover:underline inline-flex items-center gap-1">
                  <span>Ver balance contable completo</span>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </div>

            {/* Alertas de Stock Crítico */}
            <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-800">Alertas de Stock Crítico</h2>
                    <p className="text-xs text-slate-400">Insumos por debajo del mínimo de seguridad</p>
                  </div>
                </div>
                <Link
                  to="/inventario"
                  className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-200 transition"
                >
                  Ver Inventario
                </Link>
              </div>

              {data.stock_alerts.length === 0 ? (
                <div className="py-8 text-center text-slate-400">
                  <p className="text-xs">Todo tu inventario está en niveles óptimos.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {data.stock_alerts.map((a) => {
                    const isCritical = a.stock_status === 'critical' || a.current_stock <= a.min_stock * 0.5;
                    return (
                      <div key={a.id} className="py-2.5 flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`h-2 w-2 rounded-full ${
                                isCritical ? 'bg-rose-500 animate-ping' : 'bg-amber-500'
                              }`}
                            />
                            <p className="text-xs font-bold text-slate-900 truncate">{a.name}</p>
                            <span
                              className={`rounded-full px-2 py-0.2 text-[10px] font-bold ${
                                isCritical
                                  ? 'bg-rose-100 text-rose-700'
                                  : 'bg-amber-100 text-amber-700'
                              }`}
                            >
                              {isCritical ? 'Crítico' : 'Bajo'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Stock: <b className="text-slate-700">{a.current_stock} {a.unit}</b> · Mínimo: {a.min_stock} {a.unit} · {a.supplier_name}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            const prod: Product = {
                              id: a.id + 500,
                              name: a.name,
                              description: `Reabastecimiento urgente de ${a.name}`,
                              sku: `RESTOCK-${a.id}`,
                              unit: a.unit,
                              price_per_unit: 18500,
                              min_order_qty: 1,
                              stock_available: 50,
                              image_url: '',
                              category: a.category || 'Insumos',
                              category_id: 1,
                              supplier_id: a.supplier_id || 1,
                              supplier_name: a.supplier_name,
                              is_active: true,
                            };
                            add(prod, Math.max(Math.ceil(a.min_stock - a.current_stock), 1));
                          }}
                          className="shrink-0 rounded-xl bg-rose-500 text-white font-bold text-xs px-3 py-1.5 hover:bg-rose-600 active:scale-95 transition shadow-xs flex items-center gap-1"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          <span>Reabastecer</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Sugerencias del Día (Insumos Inteligentes de Cocina) */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-800">Sugerencias del Día</h2>
                  <p className="text-xs text-slate-400">Insumos de alta rotación recomendados para tu turno</p>
                </div>
              </div>
              <Link to="/catalogo" className="text-xs font-bold text-brand hover:underline">
                Explorar catálogo completo →
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {data.daily_suggestions.map((s) => (
                <div key={s.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 flex flex-col justify-between hover:border-brand/40 transition">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-xs font-bold text-slate-900 leading-snug">{s.name}</h3>
                      <span className="shrink-0 text-[10px] font-bold text-sky-700 bg-sky-100 px-2 py-0.5 rounded-md">
                        Sugerido
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">{s.supplier_name}</p>
                    <p className="text-xs font-extrabold text-brand mt-1.5">
                      {formatMoney(s.price_per_unit)} <span className="text-[10px] font-normal text-slate-500">/ {s.unit}</span>
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAddSuggestedProduct(s)}
                    className="mt-3 w-full rounded-xl bg-white border border-slate-300 py-1.5 text-xs font-bold text-slate-700 hover:bg-brand hover:text-white hover:border-brand transition flex items-center justify-center gap-1.5 shadow-2xs"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                    <span>Añadir al Carrito</span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Descuentos del Día (Ofertas Flash) */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-800">Descuentos del Día</h2>
                  <p className="text-xs text-slate-400">Precios especiales negociados directamente con proveedores</p>
                </div>
              </div>
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-800">
                Ahorro exclusivo
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {data.daily_discounts.map((d) => (
                <div key={d.id} className="rounded-xl border border-emerald-200/80 bg-emerald-50/30 p-3.5 flex flex-col justify-between hover:shadow-sm transition">
                  <div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="rounded-md bg-emerald-600 px-1.5 py-0.5 text-[10px] font-black text-white">
                        -{d.discount_pct}%
                      </span>
                      <span className="text-[10px] text-slate-400 truncate">{d.supplier_name}</span>
                    </div>
                    <h3 className="text-xs font-bold text-slate-900 mt-2 line-clamp-2">{d.name}</h3>
                    
                    <div className="mt-2 flex items-baseline gap-1.5">
                      <span className="text-sm font-black text-emerald-700">{formatMoney(d.price_per_unit)}</span>
                      <span className="text-[11px] text-slate-400 line-through">{formatMoney(d.original_price)}</span>
                      <span className="text-[10px] text-slate-500 font-mono">/ {d.unit}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAddDiscountedProduct(d)}
                    className="mt-3 w-full rounded-xl bg-emerald-600 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 active:scale-95 transition flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Aprovechar Descuento</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* SECCIÓN ESPECÍFICA PARA PROVEEDOR */}
      {/* ============================================================ */}
      {isSupplier && (
        <div className="space-y-6">
          
          {/* Fila: Información de sus Productos + Nuevos Restaurantes Emergentes */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Info de sus Productos */}
            <div className="lg:col-span-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-brand/10 text-brand flex items-center justify-center">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-800">Catálogo de Productos Propios</h2>
                    <p className="text-xs text-slate-400">Estado de tus referencias activas y disponibilidad</p>
                  </div>
                </div>
                <Link
                  to="/catalogo"
                  className="rounded-lg bg-brand px-2.5 py-1 text-xs font-bold text-white hover:bg-brand-dark transition"
                >
                  Gestionar Catálogo
                </Link>
              </div>

              {data.my_products && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                      <span className="text-[11px] text-slate-400 block font-semibold">SKUS ACTIVOS</span>
                      <span className="text-xl font-black text-slate-800">{data.my_products.total_skus}</span>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                      <span className="text-[11px] text-slate-400 block font-semibold">STOCK BAJO</span>
                      <span className="text-xl font-black text-amber-600">{data.my_products.low_stock_count}</span>
                    </div>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {data.my_products.items.map((p) => (
                      <div key={p.id} className="py-2 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold text-slate-800">{p.name}</p>
                          <p className="text-[11px] text-slate-400 font-mono">
                            SKU: {p.sku || 'N/A'} · {formatMoney(p.price_per_unit)} / {p.unit}
                          </p>
                        </div>
                        <div className="text-right">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              p.stock_available > 10
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {p.stock_available} en stock
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Clientes Potenciales Basados en lo que Venden (Proveedores) */}
            <div className="lg:col-span-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-800">Clientes Potenciales para tu Negocio</h2>
                    <p className="text-xs text-slate-400">Restaurantes sugeridos según los insumos que tú vendes</p>
                  </div>
                </div>
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-800">
                  Alta Compatibilidad
                </span>
              </div>

              <div className="space-y-3">
                {(data.prospective_restaurants || data.emerging_restaurants || []).map((r: any) => (
                  <div key={r.id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 hover:bg-white hover:border-emerald-300 transition space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-slate-900">{r.name}</p>
                          <span className="rounded-full bg-emerald-100 px-2 py-0.2 text-[9px] font-bold text-emerald-800 uppercase">
                            {r.category || 'Gastronomía'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">{r.address} · {r.city || 'Santander'}</p>
                      </div>

                      {r.compatibility_score && (
                        <span className="rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 text-[10px] font-black shrink-0">
                          {r.compatibility_score}% Match
                        </span>
                      )}
                    </div>

                    {r.potential_needs && Array.isArray(r.potential_needs) && (
                      <div className="flex flex-wrap items-center gap-1 text-[10px] text-slate-600">
                        <span className="font-semibold text-slate-400">Insumos clave:</span>
                        {r.potential_needs.map((need: string, idx: number) => (
                          <span key={idx} className="rounded bg-white px-1.5 py-0.5 border border-slate-200 text-slate-700">
                            {need}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                      {r.phone ? (
                        <a
                          href={`https://wa.me/57${r.phone.replace(/\D/g, '')}?text=Hola%20${encodeURIComponent(r.name)},%20te%20escribo%20de%20Xupply%20para%20presentarte%20nuestro%20catálogo%20mayorista`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-bold text-emerald-700 hover:text-emerald-800"
                        >
                          <span className="inline-flex items-center gap-1">
                            <IconMessage className="w-4 h-4 text-emerald-600" />
                            Contactar por WhatsApp
                          </span>
                        </a>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Sin contacto telefónico</span>
                      )}

                      <button
                        type="button"
                        onClick={() => navigate('/catalogo')}
                        className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-700 transition shadow-2xs"
                      >
                        Ofrecer Catálogo
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* SECCIÓN ESPECÍFICA PARA DOMICILIARIO */}
      {/* ============================================================ */}
      {isDomiciliario && (
        <div className="rounded-2xl border border-sky-300 bg-sky-50/50 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-sky-200">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-sky-600 text-white flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Misiones y Rutas de Despacho Asignadas</h2>
                <p className="text-xs text-slate-500">Transmisión de GPS en vivo activada</p>
              </div>
            </div>
            <Link
              to="/logistica"
              className="rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white hover:bg-sky-700 transition shadow-sm flex items-center gap-1.5"
            >
              <span>Abrir Mapa GPS en Vivo</span>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl bg-white p-3 border border-sky-200">
              <span className="text-xs text-slate-400 block font-semibold">ESTADO DE TELEMETRÍA</span>
              <div className="flex items-center gap-2 mt-1">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-sm font-bold text-emerald-700">GPS Conectado y Transmitiendo</span>
              </div>
            </div>
            <div className="rounded-xl bg-white p-3 border border-sky-200">
              <span className="text-xs text-slate-400 block font-semibold">ENTREGAS ACTIVAS HOY</span>
              <span className="text-lg font-black text-slate-900">{data.today_deliveries.length} pedidos en ruta</span>
            </div>
          </div>
        </div>
      )}

      {/* 4. Últimos Pedidos Recientes */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-sm font-bold text-slate-800">Últimos Pedidos Registrados</h2>
          </div>
          <Link to="/pedidos" className="text-xs font-bold text-brand hover:underline">
            Ver todos los pedidos →
          </Link>
        </div>

        {data.recent.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">No hay pedidos recientes registrados.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.recent.map((o) => {
              const st = ORDER_STATUS[o.status] ?? { label: o.status, color: 'bg-slate-100 text-slate-700' };
              return (
                <Link
                  key={o.id}
                  to={`/pedidos/${o.id}`}
                  className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 hover:bg-white hover:border-brand/40 transition shadow-2xs space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold font-mono text-slate-900">{o.order_code}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${st.color}`}>
                      {st.label}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 truncate">
                    {o.restaurant_name} → {o.supplier_name}
                  </p>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pt-1 border-t border-slate-100">
                    <span>{formatDate(o.created_at)}</span>
                    <span className="font-extrabold text-slate-800">{formatMoney(o.total)}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}