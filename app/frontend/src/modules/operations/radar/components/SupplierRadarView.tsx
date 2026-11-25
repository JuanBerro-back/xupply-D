import { Link } from 'react-router-dom';
import { RadarIcon } from './RadarIcon';
import { LEVEL_BADGE, OFFER_BADGE, money, timeLeft } from '../radarHelpers';
import { OfferModal } from './OfferModal';
import type { RadarInteractions } from '../hooks';

type Props = Pick<RadarInteractions, 'alerts' | 'offers' | 'loading' | 'offerAlert' | 'setOfferAlert' | 'offerForm' | 'setOfferForm' | 'busy' | 'sendOffer'>;

export function SupplierRadarView({ ...props }: Props) {
  const { alerts, offers, loading, offerAlert, setOfferAlert, offerForm, setOfferForm, busy, sendOffer } = props;
  const openAlerts = alerts.filter((a) => a.status === 'abierta');

  return (
      <div className="space-y-5">
        <div className="rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 p-5 text-white shadow-lg">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center">
              <RadarIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight">Radar de Necesidades</h2>
              <p className="text-emerald-100 text-xs sm:text-sm">
                Tus clientes necesitan insumos <b>ahora mismo</b>. Oferta antes que la competencia.
              </p>
            </div>
          </div>
          <p className="mt-3 rounded-xl bg-black/15 border border-white/10 px-3 py-2 text-[11px] text-emerald-50">
            🔒 Por privacidad solo ves el <b>semáforo de criticidad</b> y la cantidad sugerida — nunca el stock
            exacto ni las ventas del restaurante.
          </p>
        </div>

        {loading ? (
          <div className="py-10 text-center text-sm text-slate-500">Cargando radar...</div>
        ) : (
          <>
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800">Necesidades entrantes</h3>
                <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-black text-rose-700">
                  {openAlerts.length} sin oferta
                </span>
              </div>

              {openAlerts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400">
                  No hay restaurantes con stock crítico en tu radar. Te avisaremos en vivo cuando alguien baje de
                  nivel.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {openAlerts.map((a) => {
                    const badge = LEVEL_BADGE[a.level] ?? LEVEL_BADGE.low;
                    return (
                      <div
                        key={a.id}
                        className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-2.5 hover:border-emerald-300 hover:shadow-sm transition"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-black text-slate-900 text-sm">{a.item_name}</p>
                            <p className="text-[11px] text-slate-500">
                              {a.restaurant_name}
                              {a.category ? ` · ${a.category}` : ''}
                            </p>
                          </div>
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-black ${badge.color}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${badge.dot} animate-pulse`} />
                            {badge.label}
                          </span>
                        </div>

                        <div className="flex items-center justify-between rounded-lg bg-white border border-slate-200 px-3 py-2">
                          <span className="text-[11px] text-slate-500">Cantidad sugerida</span>
                          <span className="text-sm font-black text-slate-800">
                            {Number(a.suggested_qty)} {a.unit ?? 'und'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] text-slate-400">⏱ {timeLeft(a.expires_at)}</span>
                          <button
                            onClick={() => {
                              setOfferAlert(a);
                              setOfferForm({
                                offered_qty: String(Number(a.suggested_qty)),
                                offered_price: '',
                                eta_hours: '24',
                                notes: '',
                              });
                            }}
                            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-emerald-700 active:scale-95 transition"
                          >
                            Ofertar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800">Mis ofertas enviadas</h3>
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                  {offers.length} en total
                </span>
              </div>
              {offers.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
                  Aún no has enviado ofertas desde el Radar.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {offers.map((o) => (
                    <div key={o.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-900">
                          {o.product_name}{' '}
                          <span className="font-normal text-slate-500">
                            · {o.restaurant_name ?? 'Restaurante'}
                          </span>
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {Number(o.offered_qty)} {o.unit ?? 'und'} × {money(o.offered_price)} ={' '}
                          <b className="text-slate-700">{money(Number(o.offered_qty) * Number(o.offered_price))}</b>{' '}
                          · ETA {o.eta_hours}h
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${OFFER_BADGE[o.status]}`}>
                          {o.status}
                        </span>
                        {o.status === 'aceptada' && o.order_id && (
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
          </>
        )}

        <OfferModal {...props} />
      </div>
  );
}
