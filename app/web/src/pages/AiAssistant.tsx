import { useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface PredictResponse {
  summary: { item: string; current_stock: number; urgency: string; recommended_order_qty: number; trend: string }[];
  recommendation: string;
}

interface ReportResponse {
  title: string;
  recommendation: string;
}

export default function AiAssistant() {
  const { user } = useAuth();
  const { push } = useNotifications();
  const [plan, setPlan] = useState('basico');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'Hola, soy Xupply IA. ¿En qué te ayudo hoy?' },
  ]);
  const [sending, setSending] = useState(false);
  const [predictions, setPredictions] = useState<PredictResponse | null>(null);
  const [report, setReport] = useState<ReportResponse | null>(null);

  const send = async () => {
    if (!input.trim()) return;
    setSending(true);
    try {
      setMessages((m) => [...m, { role: 'user', content: input }]);
      const res = await api<{ reply: string; model: string }>('/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ message: input, plan }),
      });
      setMessages((m) => [...m, { role: 'assistant', content: `${res.reply} (modelo: ${res.model})` }]);
      setInput('');
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  const runPrediction = async () => {
    try {
      const res = await api<PredictResponse>('/ai/predict-inventory', { method: 'POST', body: '{}' });
      setPredictions(res);
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const runReport = async () => {
    try {
      const res = await api<ReportResponse>('/ai/report', { method: 'POST', body: JSON.stringify({ type: 'general' }) });
      setReport(res);
      push({ message: 'Reporte generado con Xupply IA', at: new Date().toISOString() });
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const inputCls = 'w-full rounded border px-3 py-2';

  return (
    <div>
      <h2 className="mb-4 text-xl font-bold">Xupply IA</h2>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="text-sm text-gray-500">Plan simulado:</label>
        <select value={plan} onChange={(e) => setPlan(e.target.value)} className={inputCls + ' w-40'}>
          <option value="basico">Básico</option>
          <option value="medio">Medio</option>
          <option value="premium">Premium</option>
        </select>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex h-[28rem] flex-col rounded-lg border bg-white p-4">
          <div className="mb-3 flex-1 space-y-3 overflow-y-auto">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] rounded-lg p-3 text-sm ${
                  m.role === 'user' ? 'ml-auto bg-brand text-white' : 'bg-gray-100'
                }`}
              >
                {m.content}
              </div>
            ))}
            {sending && <div className="text-xs text-gray-400">Escribiendo...</div>}
          </div>
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder="Pregunta por pedidos, inventario, facturas, rutas..."
              className="flex-1 rounded border px-3 py-2 text-sm"
            />
            <button onClick={send} disabled={sending} className="rounded bg-brand px-4 py-2 text-sm text-white">Enviar</button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border bg-white p-4">
            <h3 className="mb-2 font-semibold">Herramientas IA</h3>
            <div className="flex gap-3">
              <button onClick={runPrediction} className="flex-1 rounded border border-indigo-500 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-500 hover:text-white">
                Predecir inventario
              </button>
              <button onClick={runReport} className="flex-1 rounded border border-brand py-2 text-sm font-medium text-brand hover:bg-brand hover:text-white">
                Generar reporte
              </button>
            </div>
          </div>

          {predictions && (
            <div className="rounded-lg border bg-white p-4">
              <h3 className="mb-2 font-semibold">Predicción de inventario</h3>
              <p className="mb-2 text-sm text-gray-600">{predictions.recommendation}</p>
              <div className="max-h-48 space-y-1 overflow-y-auto text-sm">
                {predictions.summary.map((s) => (
                  <div key={s.item} className="flex justify-between border-b py-1">
                    <span>{s.item}</span>
                    <span className={`text-xs font-medium ${s.urgency === 'high' ? 'text-red-600' : s.urgency === 'medium' ? 'text-yellow-600' : 'text-green-600'}`}>
                      {s.urgency} · pedir {s.recommended_order_qty}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {report && (
            <div className="rounded-lg border bg-white p-4">
              <h3 className="mb-2 font-semibold">{report.title}</h3>
              <p className="text-sm text-gray-600">{report.recommendation}</p>
              <p className="mt-2 text-xs text-gray-400">
                Usuario: {user?.role === 'proveedor_admin' ? 'proveedor' : 'restaurante'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}