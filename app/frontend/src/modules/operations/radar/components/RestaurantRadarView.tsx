import { Link } from 'react-router-dom';
import type { RadarAlert, RadarOffer } from '../../../../shared/types';
import { RadarIcon } from './RadarIcon';
import { LEVEL_BADGE, OFFER_BADGE, money, timeLeft } from '../radarHelpers';
import { ShareModal } from './ShareModal';
import type { RadarInteractions } from '../hooks';

type Props = Pick<RadarInteractions, 'alerts' | 'offers' | 'shares' | 'loading' | 'canManage' | 'busy' | 'respondOffer' | 'closeAlert' | 'toggleShare' | 'shareModal' | 'setShareModal' | 'shareForm' | 'setShareForm' | 'suppliers' | 'createShare'>;

export function RestaurantRadarView({ ...props }: Props) {
  const { alerts, offers, shares, loading, canManage, busy, respondOffer, closeAlert, toggleShare, shareModal, setShareModal, shareForm, setShareForm, suppliers, createShare } = props;
  const incoming = offers.filter((o) => o.status === 'pendiente');
  const history = offers.filter((o) => o.status !== 'pendiente');

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-gradient-to-r from-sky-700 via-sky-600 to-indigo-600 p-5 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center">
            <RadarIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-black tracking-tight">Radar de Stock</h2>
            <p className="text-sky-100 text-xs sm:text-sm">
              Cuando tu inventario baja de nivel, tus proveedores reciben la señal y te ofertan al instante.
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-white/15 border border-white/20 px-3 py-1 text-[11px] font-bold">
            🔒 Solo comparte el semáforo (nunca cifras exactas)
          </span>
          <Link
            to="/inventario"
            className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-sky-700 hover:bg-sky-50 transition"
          >
            Ver mi inventario →
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="py-10 text-center text-sm text-slate-500">Cargando radar...</div>
      ) : (
        <>
          {/* Ofertas entrantes */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">💰 Ofertas entrantes</h3>
              <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-black text-blue-700">
                {incoming.length} pendientes
              </span>
            </div>

            {incoming.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400">
                Sin ofertas por ahora. Activa el Radar abajo y verás aquí las propuestas de tus proveedores en vivo.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {incoming.map((o) => {
                  const total = Number(o.offered_qty) * Number(o.offered_price);
                  return (
                    <div
                      key={o.id}
                      className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-black text-slate-900 text-sm">{o.product_name}</p>
                          <p className="text-[11px] text-slate-500">
                            de <b className="text-slate-700">{o.supplier_name}</b>
                            {o.category ? ` · ${o.category}` : ''}
                          </p>
                        </div>
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-700">
                          ⏱ {o.eta_hours}h
                        </span>
                      </div>

                      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Cantidad</span>
                          <b className="text-slate-800">
                            {Number(o.offered_qty)} {o.unit ?? 'und'}
                          </b>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Precio unitario</span>
                          <b className="text-slate-800">{money(o.offered_price)}</b>
                        </div>
                        <div className="flex justify-between border-t border-slate-100 pt-1">
                          <span className="font-bold text-slate-700">Total</span>
                          <b className="text-brand">{money(total)}</b>
                        </div>
                      </div>

                      {o.notes && <p className="text-[11px] italic text-slate-500">"{o.notes}"</p>}

                      <p className="text-[10px] text-slate-400">Válida hasta {timeLeft(o.valid_until)}</p>

                      {canManage ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => respondOffer(o, true)}
                            disabled={busy}
                            className="flex-1 rounded-xl bg-emerald-600 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition active:scale-95 shadow"
                          >
                            Aceptar → Crear pedido
                          </button>
                          <button
                            onClick={() => respondOffer(o, false)}
                            disabled={busy}
                            className="rounded-xl border border-rose-300 bg-white px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50 transition"
                          >
                            Rechazar
                          </button>
                        </div>
                      ) : (
                        <p className="text-[10px] text-slate-400">Solo gerentes/admin pueden aceptar ofertas.</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Configuración del Radar (gerente/admin) */}
          {canManage && (
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">📡 Proveedores con acceso a tu semáforo</h3>
                  <p className="text-[11px] text-slate-500">
                    Solo los proveedores que actives aquí reciben alertas cuando tu stock baja.
                  </p>
                </div>
                <button
                  onClick={() => setShareModal(true)}
                  className="rounded-xl bg-brand px-3.5 py-2 text-xs font-bold text-white shadow hover:bg-brand-dark transition active:scale-95"
                >
                  + Activar Radar
                </button>
              </div>

              {shares.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
                  El Radar está apagado. Actívalo para que tus proveedores te oferten cuando necesites reposición.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {shares.map((s) => (
                    <div key={s.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-900">{s.supplier_name}</p>
                        <p className="text-[11px] text-slate-500">
                          Alcance: {s.scope === 'todo' ? 'todo el inventario' : `${s.scope}: ${s.category ?? ''}`} ·
                          Alerta al nivel: <b>{s.alert_on === 'critical' ? 'crítico' : 'bajo'}</b>
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-black ${
                            s.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {s.is_active ? 'ACTIVO' : 'PAUSADO'}
                        </span>
                        <button
                          onClick={() => toggleShare(s)}
                          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-50 transition"
                        >
                          {s.is_active ? 'Pausar' : 'Reactivar'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Historial / señal emitida */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">Historial de señales y ofertas</h3>
            </div>
            {history.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
                Aún no hay ofertas respondidas.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {history.map((o) => (
                  <div key={o.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {o.product_name}{' '}
                        <span className="font-normal text-slate-500">· {o.supplier_name}</span>
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {Number(o.offered_qty)} {o.unit ?? 'und'} × {money(o.offered_price)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${OFFER_BADGE[o.status]}`}>
                        {o.status}
                      </span>
                      {o.order_id && (
                        <Link
                          to={`/pedidos/${o.order_id}`}
                          className="rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-blue-700"
                        >
                          Ver pedido
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Alertas emitidas (semáforo del restaurante) */}
          {alerts.length > 0 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800">🚨 Señales emitidas a tus proveedores</h3>
                <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-black text-rose-700">
                  {alerts.length} abiertas
                </span>
              </div>
              <div className="divide-y divide-slate-100">
                {alerts.map((a) => {
                  const badge = LEVEL_BADGE[a.level] ?? LEVEL_BADGE.low;
                  return (
                    <div key={a.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-slate-900">{a.item_name}</p>
                        <p className="text-[11px] text-slate-500">
                          {a.supplier_name ? `→ ${a.supplier_name}` : ''} · {timeLeft(a.expires_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${badge.color}`}>
                          {badge.label}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                          {a.status}
                        </span>
                        <button
                          onClick={() => closeAlert(a)}
                          className="rounded-lg border border-slate-300 px-2 py-1 text-[11px] font-bold text-slate-500 hover:bg-slate-50"
                        >
                          Cerrar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}
      <ShareModal {...props} />
    </div>
  );
}
