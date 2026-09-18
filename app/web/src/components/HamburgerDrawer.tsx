import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import TermsModal from './TermsModal';
import AppDownloadNotice from './AppDownloadNotice';
import {
  IconDashboard,
  IconCatalog,
  IconOrders,
  IconCart,
  IconInventory,
  IconGps,
  IconTeam,
  IconSuppliers,
  IconPlans,
  IconAi,
  IconInvoice,
  IconAccounting,
  IconSettings,
  IconBell,
  IconDocument,
  IconSun,
  IconMoon,
  IconContrast,
  IconGlobe,
  IconLogout,
  IconClose,
} from './Icons';

interface HamburgerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function HamburgerDrawer({ isOpen, onClose }: HamburgerDrawerProps) {
  const { user, tenant, logout } = useAuth();
  const { count, openCart } = useCart();
  const { isDarkMode, isHighContrast, toggleDarkMode, toggleHighContrast } = useTheme();
  const { lang, toggleLanguage, t } = useLanguage();
  const navigate = useNavigate();

  const [termsOpen, setTermsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  // Preferencias de alertas
  const [soundAlerts, setSoundAlerts] = useState(() => localStorage.getItem('pref_sound') !== 'false');
  const [stockAlerts, setStockAlerts] = useState(() => localStorage.getItem('pref_stock') !== 'false');

  const handleLogout = () => {
    onClose();
    logout();
    navigate('/login');
  };

  if (!isOpen) return null;

  const isSupplier = user?.role === 'proveedor_admin';
  const isDomiciliario = user?.role === 'domiciliario';
  const isOwner = user?.role === 'admin' || user?.role === 'gerente' || user?.role === 'proveedor_admin';
  const isRestaurant = !isSupplier && (!!user?.restaurant_id || user?.role === 'gerente' || user?.role === 'empleado');
  const canTrack = user?.role === 'admin' || isSupplier || isDomiciliario;

  const linkItemClass =
    'flex items-center justify-between px-3.5 py-2.5 rounded-xl text-slate-700 hover:bg-slate-100 font-medium transition text-xs sm:text-sm dark:text-slate-200 dark:hover:bg-slate-800';

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Drawer */}
      <aside className="fixed top-0 right-0 bottom-0 w-full sm:w-96 max-w-[92vw] bg-white z-50 shadow-2xl flex flex-col justify-between overflow-hidden animate-in slide-in-from-right duration-300 dark:bg-slate-900 dark:text-slate-100 border-l border-slate-200 dark:border-slate-800">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/40">
          <div className="flex items-center gap-2.5">
            <div
              className={`h-10 w-10 rounded-2xl flex items-center justify-center font-black text-white shadow-sm text-lg ${
                isSupplier ? 'bg-emerald-600' : 'bg-brand'
              }`}
            >
              Z
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                {user?.name || user?.username}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                {user?.role?.replace('_', ' ')} · {tenant?.name || 'Xupply'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition cursor-pointer"
            aria-label="Cerrar menú lateral"
          >
            <IconClose className="w-5 h-5" />
          </button>
        </div>

        {/* Content with all app modules */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 text-sm">
          {/* Aviso / Acceso de Descarga de la App */}
          <AppDownloadNotice compact />

          {/* Módulos Principales */}
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
              {lang === 'es' ? 'Módulos Principales' : 'Main Modules'}
            </p>
            <div className="space-y-1" onClick={onClose}>
              <Link to="/" className={linkItemClass}>
                <span className="flex items-center gap-3">
                  <IconDashboard className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  <span>{t('nav.dashboard')}</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono">PANEL</span>
              </Link>

              {!isDomiciliario && (
                <Link to="/catalogo" className={linkItemClass}>
                  <span className="flex items-center gap-3">
                    <IconCatalog className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>{t('nav.catalog')}</span>
                  </span>
                  <span className="text-[10px] text-brand font-bold bg-brand/10 px-2 py-0.5 rounded-md">B2B</span>
                </Link>
              )}

              <Link to="/pedidos" className={linkItemClass}>
                <span className="flex items-center gap-3">
                  <IconOrders className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>{t('nav.orders')}</span>
                </span>
              </Link>

              {!isSupplier && !isDomiciliario && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    openCart();
                  }}
                  className={`${linkItemClass} w-full text-left cursor-pointer`}
                >
                  <span className="flex items-center gap-3">
                    <IconCart className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                    <span>{t('nav.cart')}</span>
                  </span>
                  {count > 0 && (
                    <span className="rounded-full bg-rose-500 px-2 py-0.5 text-xs font-black text-white">
                      {count}
                    </span>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Operaciones & Logística */}
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
              {lang === 'es' ? 'Operaciones & Cadena de Suministro' : 'Operations & Supply Chain'}
            </p>
            <div className="space-y-1" onClick={onClose}>
              {isRestaurant && (
                <Link to="/inventario" className={linkItemClass}>
                  <span className="flex items-center gap-3">
                    <IconInventory className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span>{t('nav.inventory')}</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">STOCK</span>
                </Link>
              )}

              {canTrack && (
                <Link to="/logistica" className={linkItemClass}>
                  <span className="flex items-center gap-3">
                    <IconGps className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                    <span>{t('nav.deliveries')}</span>
                  </span>
                  <span className="text-[10px] text-sky-700 bg-sky-100 dark:bg-sky-900/50 dark:text-sky-300 font-bold px-2 py-0.5 rounded-md">
                    {lang === 'es' ? 'EN VIVO' : 'LIVE'}
                  </span>
                </Link>
              )}

              {isOwner && (
                <Link to="/equipo" className={linkItemClass}>
                  <span className="flex items-center gap-3">
                    <IconTeam className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span>
                      {isSupplier
                        ? lang === 'es' ? 'Flota de Domiciliarios' : 'Driver Fleet'
                        : lang === 'es' ? 'Equipo de Empleados' : 'Staff Team'}
                    </span>
                  </span>
                  <span className="text-[10px] text-purple-700 bg-purple-100 dark:bg-purple-900/50 dark:text-purple-300 font-bold px-2 py-0.5 rounded-md">
                    {isSupplier ? 'FLOTA' : 'EQUIPO'}
                  </span>
                </Link>
              )}

              <Link to="/proveedores" className={linkItemClass}>
                <span className="flex items-center gap-3">
                  <IconSuppliers className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  <span>{t('nav.suppliers')}</span>
                </span>
              </Link>
            </div>
          </div>

          {/* Finanzas & Inteligencia */}
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
              {lang === 'es' ? 'Finanzas & Automatización' : 'Finance & Automation'}
            </p>
            <div className="space-y-1" onClick={onClose}>
              {isOwner && !isDomiciliario && (
                <>
                  <Link to="/facturacion" className={linkItemClass}>
                    <span className="flex items-center gap-3">
                      <IconInvoice className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span>{t('nav.invoices')}</span>
                    </span>
                  </Link>

                  <Link to="/contabilidad" className={linkItemClass}>
                    <span className="flex items-center gap-3">
                      <IconAccounting className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>{t('nav.accounting')}</span>
                    </span>
                    <span className="text-[10px] text-emerald-700 bg-emerald-100 dark:bg-emerald-900/50 dark:text-emerald-300 font-bold px-2 py-0.5 rounded-md">PEPS</span>
                  </Link>
                </>
              )}

              <Link to="/planes" className={linkItemClass}>
                <span className="flex items-center gap-3">
                  <IconPlans className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                  <span>{t('nav.plans')}</span>
                </span>
                <span className="text-[10px] text-amber-700 bg-amber-100 dark:bg-amber-900/50 dark:text-amber-300 font-bold px-2 py-0.5 rounded-md">XUPPLY</span>
              </Link>

              <Link to="/xupply-ia" className={linkItemClass}>
                <span className="flex items-center gap-3">
                  <IconAi className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>{t('nav.ai')}</span>
                </span>
                <span className="text-[10px] text-purple-700 bg-purple-100 dark:bg-purple-900/50 dark:text-purple-300 font-bold px-2 py-0.5 rounded-md">IA 2.0</span>
              </Link>
            </div>
          </div>

          {/* Configuración y Preferencias */}
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
              {t('settings.title')}
            </p>
            <div className="space-y-1">
              {/* Settings Toggle */}
              <button
                type="button"
                onClick={() => setSettingsOpen(!settingsOpen)}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-slate-700 hover:bg-slate-100 font-medium transition text-left text-xs sm:text-sm dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
              >
                <span className="flex items-center gap-3">
                  <IconSettings className="w-4 h-4 text-slate-500" />
                  <span>{t('settings.profile')}</span>
                </span>
                <span className="text-xs text-slate-400">{settingsOpen ? '▲' : '▼'}</span>
              </button>

              {settingsOpen && (
                <div className="pl-9 pr-3 py-2 bg-slate-50 rounded-xl space-y-1 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300 animate-in fade-in">
                  <p><b>{lang === 'es' ? 'Negocio' : 'Business'}:</b> {tenant?.name || 'Xupply'}</p>
                  <p><b>{lang === 'es' ? 'Tipo' : 'Type'}:</b> {isSupplier ? 'Proveedor Mayorista' : 'Restaurante'}</p>
                  <p><b>{lang === 'es' ? 'Usuario' : 'User'}:</b> @{user?.username}</p>
                  <p><b>{lang === 'es' ? 'Rol' : 'Role'}:</b> {user?.role}</p>
                </div>
              )}

              {/* Preferencias Toggle */}
              <button
                type="button"
                onClick={() => setPreferencesOpen(!preferencesOpen)}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-slate-700 hover:bg-slate-100 font-medium transition text-left text-xs sm:text-sm dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
              >
                <span className="flex items-center gap-3">
                  <IconBell className="w-4 h-4 text-slate-500" />
                  <span>{t('settings.alerts')}</span>
                </span>
                <span className="text-xs text-slate-400">{preferencesOpen ? '▲' : '▼'}</span>
              </button>

              {preferencesOpen && (
                <div className="pl-9 pr-3 py-2.5 bg-slate-50 rounded-xl space-y-2 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300 animate-in fade-in">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span>{lang === 'es' ? 'Alertas sonoras de pedidos' : 'Order sound alerts'}</span>
                    <input
                      type="checkbox"
                      checked={soundAlerts}
                      onChange={(e) => {
                        setSoundAlerts(e.target.checked);
                        localStorage.setItem('pref_sound', String(e.target.checked));
                      }}
                      className="rounded text-brand"
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span>{lang === 'es' ? 'Aviso de stock bajo' : 'Low stock notices'}</span>
                    <input
                      type="checkbox"
                      checked={stockAlerts}
                      onChange={(e) => {
                        setStockAlerts(e.target.checked);
                        localStorage.setItem('pref_stock', String(e.target.checked));
                      }}
                      className="rounded text-brand"
                    />
                  </label>
                </div>
              )}

              {/* Términos y Condiciones */}
              <button
                type="button"
                onClick={() => setTermsOpen(true)}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-slate-700 hover:bg-slate-100 font-medium transition text-left text-xs sm:text-sm dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
              >
                <IconDocument className="w-4 h-4 text-slate-500" />
                <span>{t('settings.terms')}</span>
              </button>
            </div>
          </div>

          {/* Accesibilidad, Modo Oscuro & Idioma */}
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
              {lang === 'es' ? 'Accesibilidad & Visualización' : 'Accessibility & Display'}
            </p>
            <div className="space-y-2.5 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
              {/* Modo Oscuro / Claro Switch */}
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-medium text-xs text-slate-700 dark:text-slate-200">
                  {isDarkMode ? (
                    <IconMoon className="w-4 h-4 text-indigo-400" />
                  ) : (
                    <IconSun className="w-4 h-4 text-amber-500" />
                  )}
                  <span>{isDarkMode ? t('theme.dark') : t('theme.light')}</span>
                </span>
                <button
                  type="button"
                  onClick={toggleDarkMode}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 cursor-pointer ${
                    isDarkMode ? 'bg-indigo-600 justify-end' : 'bg-slate-300 dark:bg-slate-700 justify-start'
                  }`}
                  aria-label="Alternar modo oscuro"
                >
                  <div className="bg-white w-4 h-4 rounded-full shadow-md transform transition-transform" />
                </button>
              </div>

              {/* Modo Alto Contraste (Accesibilidad) */}
              <div className="flex items-center justify-between border-t border-slate-200/60 dark:border-slate-700/50 pt-2">
                <span className="flex items-center gap-2 font-medium text-xs text-slate-700 dark:text-slate-200">
                  <IconContrast className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                  <span>{isHighContrast ? t('theme.high_contrast') : t('theme.normal_contrast')}</span>
                </span>
                <button
                  type="button"
                  onClick={toggleHighContrast}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 cursor-pointer ${
                    isHighContrast ? 'bg-amber-500 justify-end' : 'bg-slate-300 dark:bg-slate-700 justify-start'
                  }`}
                  aria-label="Alternar alto contraste"
                >
                  <div className="bg-white w-4 h-4 rounded-full shadow-md transform transition-transform" />
                </button>
              </div>

              {/* Selector Rápido de Idioma */}
              <div className="flex items-center justify-between border-t border-slate-200/60 dark:border-slate-700/50 pt-2">
                <span className="flex items-center gap-2 font-medium text-xs text-slate-700 dark:text-slate-200">
                  <IconGlobe className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                  <span>{t('lang.label')}</span>
                </span>
                <button
                  type="button"
                  onClick={toggleLanguage}
                  className="rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-3 py-1 text-xs font-bold text-slate-800 dark:text-white shadow-2xs hover:bg-slate-100 dark:hover:bg-slate-600 transition cursor-pointer"
                >
                  {lang === 'es' ? 'ES (Español)' : 'EN (English)'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer: Cerrar Sesión */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-bold py-3 text-sm shadow-md transition active:scale-95 cursor-pointer"
          >
            <IconLogout className="w-4 h-4" />
            <span>{t('nav.logout')}</span>
          </button>
        </div>
      </aside>

      {/* Modal de Términos y Condiciones */}
      <TermsModal isOpen={termsOpen} onClose={() => setTermsOpen(false)} />
    </>
  );
}
