import { useState, useRef, useEffect } from 'react';
import { useNotifications } from '../context/NotificationContext';
import { useLanguage } from '../context/LanguageContext';
import { IconBell, IconEmpty } from './Icons';

export default function NotificationBell() {
  const { items, unread, clear, dismiss } = useNotifications();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative flex items-center justify-center h-9 w-9 rounded-xl bg-white/15 hover:bg-white/25 active:scale-95 text-white transition cursor-pointer"
        title={t('nav_notifications')}
        aria-label={t('nav_notifications')}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white shadow">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-slate-200 bg-white p-3 text-slate-800 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5 mb-2 px-1">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-sky-100 text-sky-700 font-black text-xs dark:bg-sky-950 dark:text-sky-300">
                <IconBell className="w-3.5 h-3.5" />
              </span>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">{t('nav_notifications')}</h3>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {items.length}
              </span>
            </div>
            {items.length > 0 && (
              <button
                type="button"
                onClick={clear}
                className="text-xs font-semibold text-sky-600 hover:text-sky-800 dark:text-sky-400 cursor-pointer"
              >
                Limpiar todo
              </button>
            )}
          </div>

          <div className="max-h-72 overflow-y-auto space-y-2 pr-1 no-scrollbar">
            {items.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                <IconEmpty className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                No tienes notificaciones pendientes.
              </div>
            ) : (
              items.map((n, i) => (
                <div
                  key={i}
                  className="group relative flex items-start justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 text-xs transition hover:bg-slate-100/80 dark:border-slate-800 dark:bg-slate-800/50 dark:hover:bg-slate-800"
                >
                  <div className="flex-1">
                    <p className="font-medium leading-relaxed text-slate-800 dark:text-slate-200">{n.message}</p>
                    <p className="mt-1 text-[10px] text-slate-400">
                      {new Date(n.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {new Date(n.at).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => dismiss(i)}
                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition p-1"
                    title="Descartar"
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
