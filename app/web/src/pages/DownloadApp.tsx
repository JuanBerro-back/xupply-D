import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getApkDownloadUrl } from '../lib/api';
import { IconDownload, IconAndroid } from '../components/Icons';
import { ArrowLeft } from 'lucide-react';

export default function DownloadApp() {
  const [downloadStarted, setDownloadStarted] = useState(false);
  const [showRetry, setShowRetry] = useState(false);

  useEffect(() => {
    // Iniciar la descarga automáticamente después de 2 segundos
    const downloadTimer = setTimeout(() => {
      triggerDownload();
    }, 2000);

    // Mostrar el botón de reintento después de 6 segundos
    const retryTimer = setTimeout(() => {
      setShowRetry(true);
    }, 6000);

    return () => {
      clearTimeout(downloadTimer);
      clearTimeout(retryTimer);
    };
  }, []);

  const triggerDownload = () => {
    setDownloadStarted(true);
    
    // Crear un elemento <a> invisible para forzar la descarga
    const a = document.createElement('a');
    a.href = getApkDownloadUrl();
    a.download = 'Xupply.apk';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b1120] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Elementos decorativos de fondo */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/10 dark:bg-emerald-500/5 blur-[120px] rounded-full pointer-events-none" />
      
      <div className="absolute top-4 left-4 z-10">
        <Link to="/" className="flex items-center gap-2 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors bg-white/50 dark:bg-slate-900/50 backdrop-blur-md px-4 py-2 rounded-full font-medium">
          <ArrowLeft className="w-5 h-5" /> Volver al inicio
        </Link>
      </div>

      <div className="relative z-10 max-w-md w-full bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 text-center">
        
        <div className="w-24 h-24 mx-auto bg-emerald-100 dark:bg-emerald-950/30 rounded-full flex items-center justify-center mb-6 relative">
          <IconAndroid className="w-12 h-12 text-emerald-500" />
          
          {/* Animación de descarga circular */}
          {!downloadStarted ? (
            <div className="absolute inset-0 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          ) : (
            <div className="absolute inset-0 border-4 border-emerald-500 rounded-full animate-pulse" />
          )}
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mb-2">
          {!downloadStarted ? 'Preparando descarga...' : 'Descargando aplicación'}
        </h1>
        
        <p className="text-slate-500 dark:text-slate-400 mb-8 font-medium">
          La descarga del instalador oficial Xupply.apk comenzará en un momento.
        </p>

        <div className={`transition-all duration-500 ${showRetry ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
              ¿No se ha descargado todavía?
            </p>
            <button 
              onClick={triggerDownload}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black transition shadow-md"
            >
              <IconDownload className="w-5 h-5" /> Presiona y hazlo de nuevo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
