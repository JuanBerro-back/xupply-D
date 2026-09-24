import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { InventoryItem } from '../types';
import Modal from '../components/Modal';
import { useNotifications } from '../context/NotificationContext';

interface ItemForm {
  name: string;
  category: string;
  unit: string;
  current_stock: string;
  min_stock: string;
  max_stock: string;
  cost_per_unit: string;
}

const emptyForm: ItemForm = {
  name: '',
  category: '',
  unit: 'kg',
  current_stock: '0',
  min_stock: '0',
  max_stock: '0',
  cost_per_unit: '0',
};

export default function Inventory() {
  const { push } = useNotifications();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [alerts, setAlerts] = useState<InventoryItem[]>([]);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<ItemForm>(emptyForm);

  const load = () => {
    api<InventoryItem[]>('/inventory').then(setItems).catch(console.error);
    api<InventoryItem[]>('/inventory/alerts').then(setAlerts).catch(console.error);
    api<any[]>('/inventory/predictions').then(setPredictions).catch(console.error);
  };

  useEffect(() => {
    load();
  }, []);

  const addMovement = async (id: number, type: 'entrada' | 'salida', quantity: number) => {
    try {
      await api(`/inventory/${id}/movements`, { method: 'POST', body: JSON.stringify({ type, quantity }) });
      push({ message: `Movimiento ${type} registrado`, at: new Date().toISOString() });
      load();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const createItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api('/inventory', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          category: form.category,
          unit: form.unit,
          current_stock: Number(form.current_stock),
          min_stock: Number(form.min_stock),
          max_stock: Number(form.max_stock),
          cost_per_unit: Number(form.cost_per_unit),
        }),
      });
      setModal(false);
      push({ message: 'Ítem de inventario creado', at: new Date().toISOString() });
      load();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const set = (k: keyof ItemForm) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const input = 'w-full rounded border px-3 py-2';

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold">Inventario</h2>
        <div className="flex items-center gap-2">
          <Link
            to="/radar"
            className="rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 transition"
          >
            📡 Radar de Stock
          </Link>
          <button onClick={() => { setForm(emptyForm); setModal(true); }} className="rounded bg-brand px-4 py-2 text-sm text-white">
            + Nuevo ítem
          </button>
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4">
          <h3 className="mb-2 font-semibold text-red-700">Alertas de stock ({alerts.length})</h3>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
            {alerts.map((a) => (
              <div key={a.id} className="rounded border bg-white p-2 text-sm">
                <b>{a.name}</b> · {a.current_stock}/{a.min_stock} {a.unit}
                <span className="ml-2 rounded bg-red-100 px-2 py-0.5 text-xs text-red-700">{a.stock_status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {predictions.length > 0 && (
        <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50 p-4">
          <h3 className="mb-2 font-semibold text-indigo-700">Predicción IA de inventario</h3>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
            {predictions.map((p) => (
              <div key={p.id} className="rounded border bg-white p-2 text-sm">
                <b>{p.item_name}</b>
                <p className="text-xs">Urgencia: {p.urgency} · Tendencia: {p.trend}</p>
                <p className="text-xs font-medium text-indigo-700">Pide ~{p.recommended_order_qty} {p.unit}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-3 py-2">Ítem</th>
              <th className="px-3 py-2">Categoría</th>
              <th className="px-3 py-2 text-right">Stock</th>
              <th className="px-3 py-2 text-right">Mínimo</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2 text-right">Costo</th>
              <th className="px-3 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className="border-b">
                <td className="px-3 py-2">{i.name}</td>
                <td className="px-3 py-2">{i.category ?? '—'}</td>
                <td className="px-3 py-2 text-right">{i.current_stock} {i.unit}</td>
                <td className="px-3 py-2 text-right">{i.min_stock}</td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${i.stock_status === 'critical' ? 'bg-red-100 text-red-700' : i.stock_status === 'low' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                    {i.stock_status}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">{i.cost_per_unit.toLocaleString('es-CO')}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    <button onClick={() => addMovement(i.id, 'entrada', 1)} className="rounded border px-2 py-1 text-xs text-green-600">+1</button>
                    <button onClick={() => addMovement(i.id, 'salida', 1)} className="rounded border px-2 py-1 text-xs text-red-600">-1</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <p className="p-4 text-center text-gray-500">Sin ítems de inventario.</p>}
      </div>

      {modal && (
        <Modal title="Nuevo ítem de inventario" onClose={() => setModal(false)}>
          <form onSubmit={createItem} className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Nombre</label>
              <input value={form.name} onChange={set('name')} className={input} required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Categoría</label>
              <input value={form.category} onChange={set('category')} className={input} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Unidad</label>
                <select value={form.unit} onChange={set('unit')} className={input}>
                  <option value="kg">kg</option>
                  <option value="libra">libra</option>
                  <option value="unidad">unidad</option>
                  <option value="litro">litro</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Stock actual</label>
                <input type="number" step="0.01" value={form.current_stock} onChange={set('current_stock')} className={input} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Stock mínimo</label>
                <input type="number" step="0.01" value={form.min_stock} onChange={set('min_stock')} className={input} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Stock máximo</label>
                <input type="number" step="0.01" value={form.max_stock} onChange={set('max_stock')} className={input} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Costo por unidad</label>
              <input type="number" step="0.01" value={form.cost_per_unit} onChange={set('cost_per_unit')} className={input} />
            </div>
            <button className="w-full rounded bg-brand py-2 text-white">Guardar</button>
          </form>
        </Modal>
      )}
    </div>
  );
}