import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import NotificationBell from './NotificationBell';
import HamburgerDrawer from './HamburgerDrawer';
import { IconMenu, IconLogout, IconSun, IconMoon, IconGlobe } from './Icons';

export default function Navbar() {
  const { user, tenant, logout } = useAuth();
  const { count, openCart } = useCart();
  const { lang, toggleLanguage, t } = useLanguage();
  const { isDarkMode, toggleDarkMode } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const handleOpenDrawer = () => setDrawerOpen(true);
    window.addEventListener('xupply_open_drawer', handleOpenDrawer);
    return () => window.removeEventListener('xupply_open_drawer', handleOpenDrawer);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isSupplier = user?.role === 'proveedor_admin';
  const isDomiciliario = user?.role === 'domiciliario';

  const brandName = tenant && tenant.name && tenant.type !== 'platform'
    ? `${tenant.name} · Xupply`
    : 'Xupply';

  const isActive = (path: string) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  const linkClass = (path: string) =>
    `flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition duration-150 ${
      isActive(path)
        ? isSupplier
          ? 'bg-white text-emerald-800 shadow-sm font-bold'
          : 'bg-white text-brand shadow-sm font-bold'
        : 'text-white/90 hover:bg-white/15 hover:text-white'
    }`;

  return (
    <>
      <header
        className={`sticky top-0 z-30 text-white shadow-md transition-colors duration-300 ${
          isSupplier
            ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 dark:from-emerald-950 dark:via-teal-950 dark:to-emerald-950 border-b border-emerald-500/30'
            : 'bg-gradient-to-r from-sky-700 via-sky-600 to-sky-700 dark:from-slate-900 dark:via-sky-950 dark:to-slate-900 border-b border-sky-500/20'
        }`}
      >
        <div className="mx-auto max-w-7xl px-4 py-2.5 flex items-center justify-between gap-3">
          {/* Logo & Marca */}
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2 group">
              <div
                className={`h-9 w-9 rounded-2xl bg-white flex items-center justify-center shadow-sm font-black text-xl group-hover:scale-105 transition ${
                  isSupplier ? 'text-emerald-700' : 'text-brand'
                }`}
              >
                Z
              </div>
              <div className="flex flex-col">
                <span className="text-base font-black tracking-tight leading-none text-white drop-shadow-sm">
                  {brandName}
                </span>
                <span
                  className={`text-[10px] font-medium tracking-wide mt-0.5 ${
                    isSupplier ? 'text-emerald-100' : 'text-sky-100'
                  }`}
                >
                  {isSupplier
                    ? 'Portal Proveedor (Mayorista)'
                    : isDomiciliario
                    ? 'App Domiciliario'
                    : 'Plataforma Gastronómica B2B'}
                </span>
              </div>
            </Link>
          </div>

          {/* Accesos Rápidos Principales (Desktop) */}
          <nav className="hidden sm:flex items-center gap-1.5 bg-black/15 p-1 rounded-2xl border border-white/10 backdrop-blur-md">
            <Link to="/" className={linkClass('/')}>
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span>Inicio</span>
            </Link>

            {!isDomiciliario && (
              <Link to="/catalogo" className={linkClass('/catalogo')}>
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                <span>Catálogo</span>
              </Link>
            )}

            <Link to="/pedidos" className={linkClass('/pedidos')}>
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <span>Pedidos</span>
            </Link>
          </nav>

          {/* Acciones del Lado Derecho: Carrito, Campanita, Menú Hamburguesa */}
          <div className="flex items-center gap-2">
            {/* Carrito Flotante (Restaurantes) */}
            {!isSupplier && !isDomiciliario && (
              <button
                type="button"
                onClick={openCart}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 active:scale-95 text-white transition text-xs font-bold border border-white/15 cursor-pointer"
                title="Abrir Carrito"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                <span className="hidden sm:inline">Carrito</span>
                {count > 0 && (
                  <span className="rounded-full bg-rose-500 px-1.5 py-0.2 text-[10px] font-black text-white shadow-xs">
                    {count}
                  </span>
                )}
              </button>
            )}

            {/* Campanita de Notificaciones */}
            <NotificationBell />

            {/* Acceso Rápido: Cambio de Idioma Instantáneo */}
            <button
              type="button"
              onClick={toggleLanguage}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 active:scale-95 text-white transition text-xs font-black border border-white/20 cursor-pointer shadow-2xs"
              title={lang === 'es' ? 'Switch to English' : 'Cambiar a Español'}
              aria-label="Cambiar idioma"
            >
              <IconGlobe className="w-3.5 h-3.5" />
              <span>{lang.toUpperCase()}</span>
            </button>

            {/* Acceso Rápido: Modo Oscuro Funcional */}
            <button
              type="button"
              onClick={toggleDarkMode}
              className={`flex items-center justify-center h-9 w-9 rounded-xl transition active:scale-95 cursor-pointer border shadow-2xs ${
                isDarkMode
                  ? 'bg-slate-900 text-amber-300 border-slate-700'
                  : 'bg-white/15 hover:bg-white/25 text-white border-white/20'
              }`}
              title={isDarkMode ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
              aria-label="Modo oscuro"
            >
              {isDarkMode ? <IconSun className="w-4 h-4" /> : <IconMoon className="w-4 h-4" />}
            </button>

            {/* Perfil de Usuario */}
            <div className="hidden md:flex items-center gap-2 bg-black/20 px-3 py-1.5 rounded-xl border border-white/10">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <div className="text-right">
                <p className="text-xs font-bold leading-tight truncate max-w-[120px] text-white">
                  {user?.name || user?.username}
                </p>
                <p className="text-[10px] text-white/75 capitalize leading-tight">
                  {user?.role?.replace('_', ' ')}
                </p>
              </div>
            </div>


            {/* BOTÓN PROMINENTE DE MENÚ HAMBURGUESA CON TODO EL MENÚ */}
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="flex items-center gap-2 rounded-2xl bg-white text-slate-900 hover:bg-slate-100 active:scale-95 px-3.5 py-2 text-xs font-black shadow-md transition cursor-pointer border border-white/20"
              title="Abrir Menú Completo Xupply"
              aria-label="Abrir menú hamburguesa"
            >
              <IconMenu className="w-4 h-4 text-brand" />
              <span>{t('nav.menu')}</span>
            </button>

            {/* Salida Rápida */}
            <button
              onClick={handleLogout}
              className="hidden lg:flex shrink-0 items-center justify-center h-9 w-9 rounded-xl bg-rose-500/80 hover:bg-rose-600 active:scale-95 text-white transition border border-rose-400/50 cursor-pointer"
              title="Cerrar sesión"
            >
              <IconLogout className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Drawer Hamburguesa con Todo el Menú */}
      <HamburgerDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
