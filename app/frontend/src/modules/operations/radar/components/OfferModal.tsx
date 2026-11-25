import Modal from '../../../../shared/ui/Modal';
import { money } from '../radarHelpers';
import type { RadarInteractions } from '../hooks';

type Props = Pick<RadarInteractions, 'offerAlert' | 'setOfferAlert' | 'offerForm' | 'setOfferForm' | 'busy' | 'sendOffer'>;

export function OfferModal({ ...props }: Props) {
  const { offerAlert, setOfferAlert, offerForm, setOfferForm, busy, sendOffer } = props;
  return (
    <>
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
    </>
  );
}
