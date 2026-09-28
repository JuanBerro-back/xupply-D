import { useState, useRef, useEffect } from 'react';
import { api } from '../lib/api';
import { IconAi, IconClose } from './Icons';
import { useLanguage } from '../context/LanguageContext';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const QUICK_QUESTIONS_ES = [
  '¿Cómo funciona la llave de entrega?',
  '¿Qué proveedores me convienen según mi cocina?',
  '¿Cómo calcular el food cost de una receta?',
  '¿Cómo gestionar empleados y domiciliarios?',
];

const QUICK_QUESTIONS_EN = [
  'How does the security delivery key work?',
  'Which suppliers suit my restaurant type?',
  'How to calculate recipe food cost?',
  'How to manage employees and delivery staff?',
];

export default function AiFloatingWidget() {
  const { lang } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content:
        lang === 'en'
          ? 'Hello! I am **Xupply AI**. I can answer any questions about the platform, from basic usage to food cost calculation, wholesale purchasing, or delivery logistics.'
          : '¡Hola! Soy **Xupply IA**. Puedo responderte cualquier duda de la plataforma, desde preguntas básicas de uso hasta temas complejos como food cost, compras mayoristas o logística de entrega.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const quickQuestions = lang === 'en' ? QUICK_QUESTIONS_EN : QUICK_QUESTIONS_ES;

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const sendMessage = async (textToSend?: string) => {
    const queryText = (textToSend || input).trim();
    if (!queryText || loading) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: queryText }]);
    setLoading(true);

    try {
      const res = await api<{ reply: string; model: string }>('/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: queryText,
          plan: localStorage.getItem('xupply_active_plan') || 'medio',
        }),
      });

      setMessages((prev) => [...prev, { role: 'assistant', content: res.reply }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: (lang === 'en' ? 'Error querying assistant: ' : 'Disculpa, ocurrió un error consultando el asistente: ') + (err as Error).message,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Botón flotante para abrir el Asistente IA */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-20 lg:bottom-6 right-5 z-40 flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-600 via-indigo-600 to-sky-600 px-4 py-3 text-white shadow-2xl hover:scale-105 active:scale-95 transition-transform duration-200 cursor-pointer border border-white/20"
          title="Xupply IA"
          aria-label="Xupply IA"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-sm">
            <IconAi className="w-3.5 h-3.5 text-amber-300" />
          </span>
          <span className="text-xs font-bold tracking-wide">Xupply IA</span>
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
        </button>
      )}

      {/* Ventana Flotante Inteligente */}
      {isOpen && (
        <div className="fixed bottom-20 lg:bottom-6 right-4 sm:right-6 z-50 w-[94vw] sm:w-[420px] max-w-md h-[550px] max-h-[85vh] rounded-3xl border border-slate-200 bg-white shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100">
          {/* Header */}
          <div className="p-3.5 bg-gradient-to-r from-indigo-700 via-purple-700 to-sky-700 text-white flex items-center justify-between shadow-sm shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-white/15 flex items-center justify-center text-sm font-black border border-white/20">
                <IconAi className="w-4 h-4 text-amber-300" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold leading-tight">Xupply IA</h3>
                <p className="text-[10px] text-white/80">
                  {lang === 'en' ? 'Basic to complex questions · Active' : 'Preguntas básicas a complejas · Activo'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="h-7 w-7 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition cursor-pointer"
              title={lang === 'en' ? 'Close' : 'Cerrar'}
              aria-label={lang === 'en' ? 'Close' : 'Cerrar'}
            >
              <IconClose className="w-4 h-4" />
            </button>
          </div>

          {/* Quick suggestions chips */}
          <div className="p-2 bg-slate-50 border-b border-slate-100 dark:bg-slate-800/60 dark:border-slate-800 flex gap-1.5 overflow-x-auto no-scrollbar shrink-0">
            {quickQuestions.map((q, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => sendMessage(q)}
                disabled={loading}
                className="whitespace-nowrap rounded-lg bg-white border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-700 hover:border-indigo-400 hover:text-indigo-600 transition shadow-2xs dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:text-white cursor-pointer"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs leading-relaxed">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 shadow-xs ${
                    m.role === 'user'
                      ? 'bg-gradient-to-r from-indigo-600 to-sky-600 text-white rounded-br-none'
                      : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100 rounded-bl-none border border-slate-200/60 dark:border-slate-700'
                  }`}
                >
                  <p className="whitespace-pre-line">{m.content}</p>
                </div>
                <span className="text-[9px] text-slate-400 mt-0.5 px-1">
                  {m.role === 'user' ? 'Tú' : 'Xupply IA'}
                </span>
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-1 text-[11px] text-indigo-500 font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-bounce" />
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-bounce [animation-delay:0.2s]" />
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-bounce [animation-delay:0.4s]" />
                <span className="ml-1">Analizando respuesta...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Box */}
          <div className="p-2.5 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Pregunta lo que sea (básico o complejo)..."
                disabled={loading}
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold px-3 py-2 text-xs transition cursor-pointer shadow-sm"
              >
                Enviar
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
