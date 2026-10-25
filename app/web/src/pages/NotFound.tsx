import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-4 text-center">
      <p className="text-6xl font-black tracking-tighter text-brand/30">404</p>
      <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-900 dark:text-white">Esta página no existe</h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
        Puede que el enlace esté mal escrito o que la sección se haya movido.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Link
          to="/"
          className="rounded-2xl bg-brand px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-brand-dark active:scale-95"
        >
          Ir al inicio
        </Link>
        <Link
          to="/login"
          className="rounded-2xl border border-slate-300 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Iniciar sesión
        </Link>
      </div>
    </div>
  );
}
