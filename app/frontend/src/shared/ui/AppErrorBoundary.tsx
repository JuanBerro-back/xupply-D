import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

/**
 * Evita la pantalla en blanco cuando un render falla. En producción no muestra
 * el stack, solo un mensaje accionable y el identificador para soporte.
 */
export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'Error de renderizado',
    };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('[UI] Error de renderizado:', error, info.componentStack);
  }

  private reload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300">
          <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01M5 19h14a2 2 0 001.84-2.75L13.74 4a2 2 0 00-3.48 0L3.16 16.25A2 2 0 005 19z"
            />
          </svg>
        </div>
        <h1 className="mt-4 text-2xl font-black tracking-tight text-slate-900 dark:text-white">Algo salió mal en esta pantalla</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Tu información está a salvo. Recarga para continuar; si el problema sigue, comparte el detalle con soporte.
        </p>
        {this.state.message && (
          <p className="mt-3 max-w-full overflow-hidden text-ellipsis rounded-xl bg-slate-100 px-3 py-2 font-mono text-[11px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            {this.state.message}
          </p>
        )}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={this.reload}
            className="rounded-2xl bg-brand px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-brand-dark active:scale-95"
          >
            Recargar la página
          </button>
          <a
            href="/"
            className="rounded-2xl border border-slate-300 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Ir al inicio
          </a>
        </div>
      </div>
    );
  }
}
