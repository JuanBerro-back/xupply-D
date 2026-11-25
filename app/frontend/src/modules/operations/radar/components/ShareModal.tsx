import Modal from '../../../../shared/ui/Modal';
import type { RadarInteractions } from '../hooks';

type Props = Pick<RadarInteractions, 'shareModal' | 'setShareModal' | 'shareForm' | 'setShareForm' | 'suppliers' | 'busy' | 'createShare'>;

export function ShareModal({ ...props }: Props) {
  const { shareModal, setShareModal, shareForm, setShareForm, suppliers, busy, createShare } = props;
  return (
    <>
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
    </>
  );
}
