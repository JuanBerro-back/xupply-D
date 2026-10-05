import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useLanguage } from '../context/LanguageContext';
import { Home, Search, ShoppingBag, Menu, Package, Truck, Radar } from 'lucide-react';

export default function BottomNav() {
  const { user } = useAuth();
  const location = useLocation();
  const { count, openCart } = useCart();
  const { t, lang } = useLanguage();

  if (!user) return null;

  const isSupplier = user.role === 'proveedor_admin';
  const isDomiciliario = user.role === 'domiciliario';
  const isAdmin = user.role === 'admin';

  if (isAdmin) return null; // Admin uses desktop layout

  const isActive = (path: string) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  const navItemClass = (path: string) => `
    flex flex-col items-center justify-center w-full py-2 gap-1 text-[10px] font-medium transition-colors
    ${isActive(path) 
      ? isSupplier ? 'text-emerald-600 dark:text-emerald-400' : 'text-sky-600 dark:text-sky-400' 
      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
    }
  `;

  return (
    <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 pb-safe shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)]">
      <div className="flex items-center justify-around px-2">
        <Link to="/" className={navItemClass('/')}>
          <Home className={`w-6 h-6 ${isActive('/') ? 'fill-current opacity-20' : ''}`} strokeWidth={isActive('/') ? 2.5 : 2} />
          <span>{t('nav.dashboard')}</span>
        </Link>

        {!isDomiciliario && (
          <Link to="/catalogo" className={navItemClass('/catalogo')}>
            <Search className={`w-6 h-6`} strokeWidth={isActive('/catalogo') ? 2.5 : 2} />
            <span>{t('nav.catalog')}</span>
          </Link>
        )}

        {isSupplier && (
          <Link to="/radar" className={navItemClass('/radar')}>
            <Radar className={`w-6 h-6`} strokeWidth={isActive('/radar') ? 2.5 : 2} />
            <span>Radar</span>
          </Link>
        )}

        <Link to="/pedidos" className={navItemClass('/pedidos')}>
          <Package className={`w-6 h-6 ${isActive('/pedidos') ? 'fill-current opacity-20' : ''}`} strokeWidth={isActive('/pedidos') ? 2.5 : 2} />
          <span>{t('nav.orders')}</span>
        </Link>

        {!isSupplier && !isDomiciliario && (
          <button 
            onClick={openCart}
            className="flex flex-col items-center justify-center w-full py-2 gap-1 text-[10px] font-medium text-slate-500 dark:text-slate-400 relative"
          >
            <div className="relative">
              <ShoppingBag className="w-6 h-6" strokeWidth={2} />
              {count > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[9px] font-black w-4 h-4 flex items-center justify-center rounded-full border-2 border-white dark:border-slate-900">
                  {count}
                </span>
              )}
            </div>
            <span>{t('nav.cart')}</span>
          </button>
        )}

        <button 
          onClick={() => window.dispatchEvent(new Event('xupply_open_drawer'))}
          className="flex flex-col items-center justify-center w-full py-2 gap-1 text-[10px] font-medium text-slate-500 dark:text-slate-400"
        >
          <Menu className="w-6 h-6" strokeWidth={2} />
          <span>{lang === 'en' ? 'Menu' : 'Menú'}</span>
        </button>
      </div>
    </nav>
  );
}
