import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { AccountingTransaction } from '../types';
import { formatMoney, formatDate } from '../lib/constants';
import Modal from '../components/Modal';
import { useNotifications } from '../context/NotificationContext';

interface Summary {
  ingresos: number;
  egresos: number;
}

export default function Accounting() {
  const { push } = useNotifications();
  const [transactions, setTransactions] = useState<AccountingTransaction[]>([]);
  const [summary, setSummary] = useState<Summary>({ ingresos: 0, egresos: 0 });
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ type: 'egreso', amount: '', description: '', category: '', payment_method: 'Efectivo' });

  const load = () => {
    api<{ transactions: AccountingTransaction[]; summary: Summary }>('/accounting').then((r) => {
      setTransactions(r.transactions);
      setSummary(r.summary);
    }).catch(console.error);
  };

  useEffect(load, []);

  const submit = async () => {
    try {
      await api('/accounting', {
        method: 'POST',
        body: JSON.stringify({
          type: form.type,
          amount: Number(form.amount),
          description: form.description,
          category: form.category,
          payment_method: form.payment_method,
        }),
      });
      push({ message: 'Movimiento contable registrado', at: new Date().toISOString() });
      setModal(false);
      load();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const input = 'w-full rounded border px-3 py-2';

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold">Contabilidad</h2>
        <button onClick={() => setModal(true)} className="rounded bg-brand px-4 py-2 text-sm text-white">+ Nuevo movimiento</button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm text-gray-500">Ingresos</p>
          <p className="text-2xl font-bold text-green-600">{formatMoney(summary.ingresos)}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm text-gray-500">Egresos</p>
          <p className="text-2xl font-bold text-red-600">{formatMoney(summary.egresos)}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm text-gray-500">Balance</p>
          <p className={`text-2xl font-bold ${summary.ingresos - summary.egresos >= 0 ? 'text-brand' : 'text-red-600'}`}>
            {formatMoney(summary.ingresos - summary.egresos)}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-3 py-2">Fecha</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Descripción</th>
              <th className="px-3 py-2">Categoría</th>
              <th className="px-3 py-2 text-right">Monto</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t.id} className="border-b">
                <td className="px-3 py-2 text-xs">{formatDate(t.transaction_date)}</td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${t.type === 'ingreso' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {t.type}
                  </span>
                </td>
                <td className="px-3 py-2">{t.description ?? '—'}</td>
                <td className="px-3 py-2">{t.category ?? '—'}</td>
                <td className={`px-3 py-2 text-right font-medium ${t.type === 'ingreso' ? 'text-green-600' : 'text-red-600'}`}>
                  {formatMoney(t.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {transactions.length === 0 && <p className="p-4 text-center text-gray-500">Sin movimientos registrados.</p>}
      </div>

      {modal && (
        <Modal title="Nuevo movimiento" onClose={() => setModal(false)}>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Tipo</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className={input}>
                <option value="ingreso">Ingreso</option>
                <option value="egreso">Egreso</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Monto</label>
              <input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={input} required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Descripción</label>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={input} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Categoría</label>
                <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={input} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Método de pago</label>
                <select value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} className={input}>
                  {['Efectivo', 'Tarjeta', 'Nequi', 'PSE', 'Daviplata', 'Credito'].map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>
            <button onClick={submit} className="w-full rounded bg-brand py-2 text-white">Guardar movimiento</button>
          </div>
        </Modal>
      )}
    </div>
  );
}