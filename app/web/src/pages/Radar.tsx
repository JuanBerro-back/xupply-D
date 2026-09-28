import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { getSocket } from '../lib/socket';
import Modal from '../components/Modal';
import { RadarAlert, RadarOffer, RadarShare, Supplier } from '../types';

const money = (n: string | number) =>
  Number(n).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

const LEVEL_BADGE: Record<string, { label: string; color: string; dot: string }> = {
  critical: { label: 'CRÍTICO', color: 'bg-rose-100 text-rose-700 border-rose-200', dot: 'bg-rose-500' },
  low: { label: 'BAJO', color: 'bg-amber-100 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
};

const OFFER_BADGE: Record<string, string> = {
  pendiente: 'bg-blue-100 text-blue-700',
  aceptada: 'bg-emerald-100 text-emerald-700',
  rechazada: 'bg-rose-100 text-rose-700',
  expirada: 'bg-slate-100 text-slate-500',
};

function RadarIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function timeLeft(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'vencida';
  const h = Math.floor(ms / 3600000);
  if (h >= 24) return `${Math.floor(h / 24)}d restantes`;
  if (h > 0) return `${h}h restantes`;
  return `${Math.max(1, Math.floor(ms / 60000))} min restantes`;
}

export default function Radar() {
  const { user } = useAuth();
  const { push } = useNotifications();

  const isSupplier = user?.role === 'proveedor_admin';
  const canManage = user?.role === 'admin' || user?.role === 'gerente';

  const [alerts, setAlerts] = useState<RadarAlert[]>([]);
  const [offers, setOffers] = useState<RadarOffer[]>([]);
  const [shares, setShares] = useState<RadarShare[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal: proveedor envía oferta
  const [offerAlert, setOfferAlert] = useState<RadarAlert | null>(null);
  const [offerForm, setOfferForm] = useState({ offered_qty: '', offered_price: '', eta_hours: '24', notes: '' });
  // Modal: restaurante comparte su semáforo con un proveedor
  const [shareModal, setShareModal] = useState(false);
  const [shareForm, setShareForm] = useState({ supplier_id: '', scope: 'todo', category: '', alert_on: 'critical' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    const jobs: Promise<unknown>[] = [];
    if (isSupplier) {
      jobs.push(api<RadarAlert[]>('/radar/alerts').then(setAlerts).catch(() => undefined));
      jobs.push(api<RadarOffer[]>('/radar/offers').then(setOffers).catch(() => undefined));
    } else {
      jobs.push(api<RadarOffer[]>('/radar/offers').then(setOffers).catch(() => undefined));
      if (canManage) {
        jobs.push(api<RadarShare[]>('/radar/shares').then(setShares).catch(() => undefined));
        jobs.push(api<RadarAlert[]>('/radar/my-alerts').then(setAlerts).catch(() => undefined));
        jobs.push(api<Supplier[]>('/suppliers').then(setSuppliers).catch(() => undefined));
      }
    }
    Promise.allSettled(jobs).finally(() => setLoading(false));
  }, [isSupplier, canManage]);

  useEffect(() => {
    load();
  }, [load]);

  // Tiempo real: refrescar cuando llegan alertas (proveedor) u ofertas (restaurante).
  // Los toasts los emite NotificationContext (un solo aviso por evento).
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onAlert = () => load();
    const onOffer = () => load();
    socket.on('radar:alert', onAlert);
    socket.on('radar:offer', onOffer);
    return () => {
      socket.off('radar:alert', onAlert);
      socket.off('radar:offer', onOffer);
    };
  }, [load]);

  const sendOffer = async () => {
    if (!offerAlert) return;
    setBusy(true);
    try {
      await api(`/radar/alerts/${offerAlert.id}/offers`, {
        method: 'POST',
        body: JSON.stringify({
          offered_qty: Number(offerForm.offered_qty),
          offered_price: Number(offerForm.offered_price),
          eta_hours: Number(offerForm.eta_hours) || 24,
          notes: offerForm.notes || null,
        }),
      });
      push({ message: 'Oferta enviada al restaurante', at: new Date().toISOString() });
      setOfferAlert(null);
      setOfferForm({ offered_qty: '', offered_price: '', eta_hours: '24', notes: '' });
      load();
    } catch (err) {
      push({ message: (err as Error).message, at: new Date().toISOString() });
    } finally {
      setBusy(false);
    }
  };

  const respondOffer = async (offer: RadarOffer, accept: boolean) => {
    setBusy(true);
    try {
      const res = await api<{ order_code?: string; total?: number }>(
        `/radar/offers/${offer.id}/${accept ? 'accept' : 'reject'}`,
        { method: 'POST', body: JSON.stringify({}) }
      );
      push({
        message: accept
          ? `Oferta aceptada: pedido ${res.order_code} creado por ${money(res.total ?? 0)}`
          : 'Oferta rechazada',
        at: new Date().toISOString(),
      });
      load();
    } catch (err) {
      push({ message: (err as Error).message, at: new Date().toISOString() });
    } finally {
      setBusy(false);
    }
  };

  const closeAlert = async (alert: RadarAlert) => {
    try {
      await api(`/radar/alerts/${alert.id}/close`, { method: 'POST', body: JSON.stringify({}) });
      push({ message: 'Alerta cerrada', at: new Date().toISOString() });
      load();
    } catch (err) {
      push({ message: (err as Error).message, at: new Date().toISOString() });
    }
  };

  const createShare = async () => {
    setBusy(true);
    try {
      await api('/radar/shares', {
        method: 'POST',
        body: JSON.stringify({
          supplier_id: Number(shareForm.supplier_id),
          scope: shareForm.scope,
          category: shareForm.scope === 'categoria' ? shareForm.category : null,
          alert_on: shareForm.alert_on,
        }),
      });
      push({ message: 'Radar activado: ese proveedor recibirá tus alertas de stock', at: new Date().toISOString() });
      setShareModal(false);
      setShareForm({ supplier_id: '', scope: 'todo', category: '', alert_on: 'critical' });
      load();
    } catch (err) {
      push({ message: (err as Error).message, at: new Date().toISOString() });
    } finally {
      setBusy(false);
    }
  };

  const toggleShare = async (share: RadarShare) => {
    try {
      await api(`/radar/shares/${share.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: !share.is_active }),
      });
      load();
    } catch (err) {
      push({ message: (err as Error).message, at: new Date().toISOString() });
    }
  };

  // ------------------------------------------------------------------
  // VISTA PROVEEDOR: bandeja de necesidades entrantes + ofertas enviadas
  // ------------------------------------------------------------------
  if (isSupplier) {
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

        {/* Modal de oferta */}
        {offerAlert && (
          <Modal title={`Ofertar: ${offerAlert.item_name}`} onClose={() => setOfferAlert(null)}>
            <div className="space-y-3">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
                <b>{offerAlert.restaurant_name}</b> necesita{' '}
                <b>
                  {Number(offerAlert.suggested_qty)} {offerAlert.unit ?? 'und'}
                </b>{' '}
                (nivel {offerAlert.level === 'critical' ? 'CRÍTICO' : 'BAJO'}).
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">Cantidad a ofrecer *</label>
                  <input
                    type="number"
                    min="1"
                    value={offerForm.offered_qty}
                    onChange={(e) => setOfferForm({ ...offerForm, offered_qty: e.target.value })}
                    className="w-full rounded-xl border px-3 py-2 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">Precio unitario ($) *</label>
                  <input
                    type="number"
                    min="0"
                    value={offerForm.offered_price}
                    onChange={(e) => setOfferForm({ ...offerForm, offered_price: e.target.value })}
                    placeholder="Ej: 16500"
                    className="w-full rounded-xl border px-3 py-2 text-sm"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">Entrega en (horas)</label>
                <select
                  value={offerForm.eta_hours}
                  onChange={(e) => setOfferForm({ ...offerForm, eta_hours: e.target.value })}
                  className="w-full rounded-xl border px-3 py-2 text-sm bg-white"
                >
                  <option value="6">6 horas (urgente)</option>
                  <option value="12">12 horas</option>
                  <option value="24">24 horas</option>
                  <option value="48">48 horas</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">Nota para el restaurante</label>
                <textarea
                  value={offerForm.notes}
                  onChange={(e) => setOfferForm({ ...offerForm, notes: e.target.value })}
                  rows={2}
                  placeholder="Ej: Precio válido hasta mañana, entrega misma tarde"
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                />
              </div>

              {offerForm.offered_qty && offerForm.offered_price && (
                <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-600 flex justify-between">
                  <span>Total de la oferta:</span>
                  <b className="text-slate-900">
                    {money(Number(offerForm.offered_qty) * Number(offerForm.offered_price))}
                  </b>
                </div>
              )}

              <button
                onClick={sendOffer}
                disabled={busy || !offerForm.offered_qty || !offerForm.offered_price}
                className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50 shadow transition active:scale-95"
              >
                Enviar Oferta al Restaurante
              </button>
            </div>
          </Modal>
        )}
      </div>
    );
  }

  // ------------------------------------------------------------------
  // VISTA RESTAURANTE: ofertas entrantes + configuración del Radar
  // ------------------------------------------------------------------
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

      {/* Modal: activar Radar con un proveedor */}
      {shareModal && (
        <Modal title="Activar Radar con un proveedor" onClose={() => setShareModal(false)}>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">Proveedor *</label>
              <select
                value={shareForm.supplier_id}
                onChange={(e) => setShareForm({ ...shareForm, supplier_id: e.target.value })}
                className="w-full rounded-xl border px-3 py-2 text-sm bg-white"
              >
                <option value="">-- Elige un proveedor --</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.category ? `· ${s.category}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">Alcance del Radar</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'todo', label: 'Todo el inventario', desc: 'Alerta ante cualquier caída' },
                  { id: 'categoria', label: 'Solo una categoría', desc: 'Ej: Carnes, Bebidas...' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setShareForm({ ...shareForm, scope: opt.id })}
                    className={`rounded-xl border p-2.5 text-left transition ${
                      shareForm.scope === opt.id
                        ? 'border-brand bg-brand/5 ring-2 ring-brand/20'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <p className="text-xs font-bold text-slate-800">{opt.label}</p>
                    <p className="text-[10px] text-slate-500">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {shareForm.scope === 'categoria' && (
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">Categoría *</label>
                <input
                  value={shareForm.category}
                  onChange={(e) => setShareForm({ ...shareForm, category: e.target.value })}
                  placeholder="Ej: Res, Pollo, Bebidas"
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                />
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">Alertar cuando el stock esté en</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'critical', label: 'Solo CRÍTICO', desc: 'Menos ruido, alertas fuertes' },
                  { id: 'low', label: 'CRÍTICO o BAJO', desc: 'Avisos anticipados' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setShareForm({ ...shareForm, alert_on: opt.id })}
                    className={`rounded-xl border p-2.5 text-left transition ${
                      shareForm.alert_on === opt.id
                        ? 'border-brand bg-brand/5 ring-2 ring-brand/20'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <p className="text-xs font-bold text-slate-800">{opt.label}</p>
                    <p className="text-[10px] text-slate-500">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-900">
              El proveedor verá un <b>semáforo</b> (crítico/bajo) y una cantidad sugerida calculada de tu consumo
              promedio. <b>Nunca</b> verá tus existencias exactas ni tus ventas.
            </div>

            <button
              onClick={createShare}
              disabled={busy || !shareForm.supplier_id || (shareForm.scope === 'categoria' && !shareForm.category)}
              className="w-full rounded-xl bg-brand py-2.5 text-sm font-bold text-white hover:bg-brand-dark disabled:opacity-50 shadow transition active:scale-95"
            >
              Activar Radar
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
