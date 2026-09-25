import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { IconDashboard, IconTeam, IconKey, IconDocument } from './Icons';
import { ReactNode } from 'react';

// Si no tienes IconShieldCheck, usaremos IconCheck como fallback si no lo agrego
function IconShield({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.956 11.956 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}

export default function AdminLayout() {
  const { user } = useAuth();
  
  if (user?.role !== 'admin') {
    return <div className="p-8 text-center text-rose-500 font-bold">Acceso Denegado</div>;
  }

  const navItems = [
    { to: '/admin', label: 'Panel Principal', end: true, icon: IconDashboard },
    { to: '/admin/usuarios', label: 'Usuarios', icon: IconTeam },
    { to: '/admin/roles', label: 'Roles', icon: IconKey },
    { to: '/admin/permisos', label: 'Permisos', icon: IconShield },
    { to: '/admin/auditoria', label: 'Auditoría', icon: IconDocument },
  ];

  return (
    <div className="flex flex-col md:flex-row gap-4 h-full">
      {/* Navegación Lateral (Desktop) / Superior (Mobile) */}
      <aside className="w-full md:w-64 shrink-0">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-4 sticky top-20">
          <div className="mb-4 hidden md:block">
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Administración
            </h2>
            <p className="text-xs text-slate-400 mt-1">Super Admin Panel</p>
          </div>
          
          <nav className="flex flex-row md:flex-col gap-1.5 overflow-x-auto md:overflow-visible pb-2 md:pb-0 no-scrollbar">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-xs sm:text-sm transition whitespace-nowrap ${
                    isActive
                      ? 'bg-brand text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`
                }
              >
                <item.icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      </aside>

      {/* Contenido Principal */}
      <main className="flex-1 overflow-x-hidden min-h-[500px]">
        <Outlet />
      </main>
    </div>
  );
}
