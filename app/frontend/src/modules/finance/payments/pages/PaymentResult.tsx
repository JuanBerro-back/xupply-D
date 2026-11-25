import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../../../shared/api/client';
import { useAuth } from '../../../../shared/context/AuthContext';
import { formatMoney } from '../../../../shared/utils/constants';

interface PaymentIntentView {
  id: string;
  kind: 'pedido' | 'suscripcion';
  status: 'creado' | 'pendiente' | 'aprobado' | 'rechazado' | 'expirado' | 'reembolsado' | 'fallido';
  amount_cop: number;
  currency: string;
  reference: string;
  order_id: number | null;
  failure_reason: string | null;
  metadata: { plan?: string; order_code?: string } | null;
}

const FINAL_STATES = ['aprobado', 'rechazado', 'fallido', 'expirado', 'reembolsado'];

export default function PaymentResult() {
  const [params] = useSearchParams();
  const intentId = params.get('intent');
  const { refreshTenant } = useAuth();
  const [intent, setIntent] = useState<PaymentIntentView | null>(null);
  const [error, setError] = useState('');
  const [polling, setPolling] = useState(true);

  useEffect(() => {
    if (!intentId) {
      setError('Falta el identificador del pago.');
      setPolling(false);
      return;
    }

    let cancelled = false;
    let timer: number | undefined;

    const poll = async (attempt: number) => {
      try {
        // sync=1 hace que el backend consulte Wompi si el webhook aún no llegó.
        const res = await api<PaymentIntentView>(`/payments/intents/${intentId}?sync=1`);
        if (cancelled) return;
        setIntent(res);

        if (FINAL_STATES.includes(res.status)) {
          setPolling(false);
          if (res.status === 'aprobado') {
            refreshTenant().catch(() => undefined);
          }
          return;
        }

        // ~60 s de reintentos; luego se deja el estado pendiente visible.
        if (attempt < 20) {
          timer = window.setTimeout(() => poll(attempt + 1), 3000);
        } else {
          setPolling(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message);
          setPolling(false);
        }
      }
    };

    poll(0);
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
    // refreshTenant cambia de identidad en cada render del provider; no debe
    // reiniciar el polling.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intentId]);

  const approved = intent?.status === 'aprobado';
  const rejected = intent && ['rechazado', 'fallido', 'expirado', 'reembolsado'].includes(intent.status);

  return (
    <div className="mx-auto max-w-xl py-10">
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div
          className={`px-6 py-8 text-center text-white ${
            approved
              ? 'bg-gradient-to-br from-emerald-600 to-teal-600'
              : rejected
                ? 'bg-gradient-to-br from-rose-600 to-red-600'
                : 'bg-gradient-to-br from-slate-800 to-slate-900'
          }`}
        >
          {approved ? (
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white/20">
              <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          ) : rejected ? (
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white/20">
              <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          ) : (
            <div className="mx-auto mb-3 h-14 w-14 animate-spin rounded-full border-4 border-white/25 border-t-white" />
          )}

          <h1 className="text-2xl font-black tracking-tight">
            {approved
              ? 'Pago aprobado'
              : rejected
                ? 'El pago no se completó'
                : polling
                  ? 'Confirmando tu pago…'
                  : 'Pago pendiente'}
          </h1>
          <p className="mt-1 text-sm text-white/80">
            {approved
              ? 'La transacción fue confirmada por Wompi.'
              : rejected
                ? intent?.failure_reason || 'Wompi rechazó o anuló la transacción.'
                : 'Estamos verificando la transacción con la pasarela. No cierres esta página.'}
          </p>
        </div>

        <div className="space-y-4 p-6">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
              {error}
            </div>
          )}

          {intent && (
            <dl className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
              <div className="flex items-center justify-between py-2">
                <dt className="text-slate-500 dark:text-slate-400">Concepto</dt>
                <dd className="font-semibold text-slate-800 dark:text-slate-100">
                  {intent.kind === 'suscripcion'
                    ? `Suscripción ${intent.metadata?.plan ?? ''}`
                    : `Pedido ${intent.metadata?.order_code ?? intent.order_id ?? ''}`}
                </dd>
              </div>
              <div className="flex items-center justify-between py-2">
                <dt className="text-slate-500 dark:text-slate-400">Valor</dt>
                <dd className="font-semibold text-slate-800 dark:text-slate-100">
                  {formatMoney(intent.amount_cop)} {intent.currency}
                </dd>
              </div>
              <div className="flex items-center justify-between py-2">
                <dt className="text-slate-500 dark:text-slate-400">Referencia</dt>
                <dd className="font-mono text-xs text-slate-600 dark:text-slate-300">{intent.reference}</dd>
              </div>
              <div className="flex items-center justify-between py-2">
                <dt className="text-slate-500 dark:text-slate-400">Estado</dt>
                <dd className="font-semibold capitalize text-slate-800 dark:text-slate-100">{intent.status}</dd>
              </div>
            </dl>
          )}

          <div className="flex flex-col gap-2 pt-2 sm:flex-row">
            {intent?.kind === 'pedido' && intent.order_id ? (
              <Link
                to={`/pedidos/${intent.order_id}`}
                className="flex-1 rounded-xl bg-slate-900 px-4 py-3 text-center text-sm font-bold text-white transition hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600"
              >
                Ver pedido
              </Link>
            ) : (
              <Link
                to="/planes"
                className="flex-1 rounded-xl bg-slate-900 px-4 py-3 text-center text-sm font-bold text-white transition hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600"
              >
                Ver mi plan
              </Link>
            )}
            <Link
              to="/"
              className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-center text-sm font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Ir al inicio
            </Link>
          </div>

          {!intent && !error && (
            <p className="text-center text-xs text-slate-500 dark:text-slate-400">
              Esto puede tardar unos segundos mientras Wompi confirma la transacción.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
