import { useState } from 'react';
import { isCapacitorNative, getApkDownloadUrl } from '../lib/api';
import { useLanguage } from '../context/LanguageContext';
import { IconAndroid, IconDownload, IconClose, IconCheck } from './Icons';

interface AppDownloadNoticeProps {
  className?: string;
  compact?: boolean;
  dismissible?: boolean;
}

export default function AppDownloadNotice({
  className = '',
  compact = false,
  dismissible = true,
}: AppDownloadNoticeProps) {
  const { lang } = useLanguage();
  const [dismissed, setDismissed] = useState(() => {
    if (!dismissible || typeof window === 'undefined') return false;
    return sessionStorage.getItem('xupply_hide_app_notice') === 'true';
  });
  const [copied, setCopied] = useState(false);

  // Si el usuario ya está usando la app nativa en Android, o si fue descartado (cuando es descartable)
  if (isCapacitorNative() || (dismissible && dismissed)) {
    return null;
  }

  // URL directa de descarga del instalador APK
  const downloadUrl = getApkDownloadUrl();

  const handleDismiss = () => {
    if (dismissible) {
      setDismissed(true);
      sessionStorage.setItem('xupply_hide_app_notice', 'true');
    }
  };

  const handleCopyLink = async () => {
    const fullUrl = `${window.location.origin}/Xupply.apk`;
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  if (compact) {
    return (
      <div
        className={`rounded-2xl border-2 border-emerald-500/70 bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950 p-3.5 text-white shadow-lg flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 ${className}`}
        role="region"
        aria-label="Aviso de descarga de Xupply App"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-400/50">
            <IconAndroid className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-black text-white leading-tight">
              {lang === 'en' ? "Don't have Xupply App yet?" : '¿Aún no tienes Xupply App?'}
            </p>
            <p className="text-[11px] text-emerald-300 font-medium">
              {lang === 'en' ? 'Download official Android APK (v1.0)' : 'Descarga el APK oficial para Android'}
            </p>
          </div>
        </div>

        <a
          href={downloadUrl}
          download="Xupply.apk"
          className="shrink-0 inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black text-xs transition shadow-md cursor-pointer"
        >
          <IconDownload className="w-4 h-4 text-slate-950" />
          <span>{lang === 'en' ? 'Download APK' : 'Descargar APK'}</span>
        </a>
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden rounded-3xl border-2 border-emerald-500/50 bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 p-4 sm:p-5 text-white shadow-lg transition duration-200 dark:border-emerald-500/40 ${className}`}
      role="region"
      aria-label="Aviso de descarga de Xupply App"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Contenido principal */}
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="h-12 w-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30 shadow-inner">
            <IconAndroid className="w-6 h-6 text-emerald-400" />
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-black tracking-tight text-white">
                {lang === 'en' ? "Don't have Xupply App yet?" : '¿Aún no tienes Xupply App?'}
              </h3>
              <span className="rounded-full bg-emerald-500/20 border border-emerald-400/40 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-300">
                Android APK · Gratis
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-300 leading-relaxed max-w-xl">
              {lang === 'en'
                ? 'Get real-time GPS tracking, instant order dispatch alerts, and secure delivery codes directly in your pocket.'
                : 'Lleva el control de pedidos, confirmación de entregas con llave de seguridad y telemetría GPS directamente en tu celular Android.'}
            </p>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
          <a
            href={downloadUrl}
            download="Xupply.apk"
            className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black px-4 py-2.5 text-xs shadow-md transition cursor-pointer"
            title="Descargar archivo Xupply.apk"
          >
            <IconDownload className="w-4 h-4 text-slate-950" />
            <span>{lang === 'en' ? 'Download APK' : 'Descargar APK'}</span>
          </a>

          <button
            type="button"
            onClick={handleCopyLink}
            className="inline-flex items-center gap-1.5 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 text-slate-200 font-bold px-3 py-2.5 text-xs transition cursor-pointer border border-white/15"
            title="Copiar enlace para abrir o enviar por WhatsApp"
          >
            {copied ? (
              <>
                <IconCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-300">{lang === 'en' ? 'Copied!' : '¡Copiado!'}</span>
              </>
            ) : (
              <span>{lang === 'en' ? 'Copy Link' : 'Copiar Enlace'}</span>
            )}
          </button>

          {dismissible && (
            <button
              type="button"
              onClick={handleDismiss}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
              title={lang === 'en' ? 'Dismiss' : 'Ocultar aviso'}
              aria-label="Cerrar aviso"
            >
              <IconClose className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
