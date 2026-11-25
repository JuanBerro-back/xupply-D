import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function homeForRole(role?: string): { to: string; label: string } {
  if (role === 'admin' || role === 'verificador') return { to: '/admin', label: 'Ir al panel de administración' };
  if (role === 'domiciliario') return { to: '/repartidor', label: 'Ir a mi ruta' };
  if (role === 'proveedor_admin') return { to: '/', label: 'Ir a mi panel' };
  return { to: '/', label: 'Ir a mi panel' };
}

export default function AccessDenied() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const home = homeForRole(user?.role);

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300">
        <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01M5 19h14a2 2 0 001.84-2.75L13.74 4a2 2 0 00-3.48 0L3.16 16.25A2 2 0 005 19z"
          />
        </svg>
      </div>
      <h1 className="mt-4 text-2xl font-black tracking-tight text-slate-900 dark:text-white">No tienes acceso a esta sección</h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
        Tu rol{user?.role ? ` (${user.role.replace('_', ' ')})` : ''} no incluye este módulo. Si necesitas permiso,
        solicítalo a un administrador.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Link
          to={home.to}
          className="rounded-2xl bg-brand px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-brand-dark active:scale-95"
        >
          {home.label}
        </Link>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="rounded-2xl border border-slate-300 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Volver atrás
        </button>
      </div>
    </div>
  );
}
