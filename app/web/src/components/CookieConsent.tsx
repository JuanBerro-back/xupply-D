import { useState, useEffect } from 'react';
import Modal from './Modal';

interface CookiePreferences {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
  functional: boolean;
}

const defaultPreferences: CookiePreferences = {
  necessary: true, // Always true
  analytics: false,
  marketing: false,
  functional: false,
};

export default function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>(defaultPreferences);

  useEffect(() => {
    const stored = localStorage.getItem('xupply_cookie_consent');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setPreferences(parsed);
        applyCookies(parsed);
      } catch (e) {
        setShowBanner(true);
      }
    } else {
      setShowBanner(true);
    }
  }, []);

  const applyCookies = (prefs: CookiePreferences) => {
    // Inyectar Google Analytics
    if (prefs.analytics) {
      if (!document.getElementById('ga-script')) {
        const script = document.createElement('script');
        script.id = 'ga-script';
        script.async = true;
        script.src = 'https://www.googletagmanager.com/gtag/js?id=G-XUPPLY123';
        document.head.appendChild(script);

        const scriptInline = document.createElement('script');
        scriptInline.id = 'ga-inline';
        scriptInline.innerHTML = `
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-XUPPLY123');
        `;
        document.head.appendChild(scriptInline);
      }
    } else {
      // Intentar remover los scripts si son deshabilitados
      document.getElementById('ga-script')?.remove();
      document.getElementById('ga-inline')?.remove();
      // Nota: Remover el script no borra las cookies previas establecidas. El usuario tendría que limpiar sus cookies del navegador.
    }

    // Inyectar Meta/Facebook Pixel
    if (prefs.marketing) {
      if (!document.getElementById('fb-pixel')) {
        const script = document.createElement('script');
        script.id = 'fb-pixel';
        script.innerHTML = `
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '123456789XUPPLY');
          fbq('track', 'PageView');
        `;
        document.head.appendChild(script);
      }
    } else {
      document.getElementById('fb-pixel')?.remove();
    }
  };

  const acceptAll = () => {
    const all = { necessary: true, analytics: true, marketing: true, functional: true };
    localStorage.setItem('xupply_cookie_consent', JSON.stringify(all));
    setPreferences(all);
    applyCookies(all);
    setShowBanner(false);
  };

  const rejectAll = () => {
    const none = { necessary: true, analytics: false, marketing: false, functional: false };
    localStorage.setItem('xupply_cookie_consent', JSON.stringify(none));
    setPreferences(none);
    applyCookies(none);
    setShowBanner(false);
  };

  const savePreferences = () => {
    localStorage.setItem('xupply_cookie_consent', JSON.stringify(preferences));
    applyCookies(preferences);
    setShowModal(false);
    setShowBanner(false);
  };

  const togglePreference = (key: keyof CookiePreferences) => {
    if (key === 'necessary') return; // Cannot toggle necessary
    setPreferences(p => ({ ...p, [key]: !p[key] }));
  };

  if (!showBanner && !showModal) return null;

  return (
    <>
      {showBanner && !showModal && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white p-4 shadow-xl dark:border-gray-800 dark:bg-[#0b1120]">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex-1 text-sm text-gray-600 dark:text-gray-300">
              <h3 className="mb-1 font-bold text-gray-900 dark:text-white">Usamos cookies 🍪</h3>
              <p>
                Utilizamos cookies propias y de terceros para mejorar nuestros servicios, personalizar tu experiencia, 
                analizar el tráfico y mostrar publicidad relevante. Puedes aceptar todas las cookies, rechazarlas o configurar tus preferencias.
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row">
              <button
                onClick={() => setShowModal(true)}
                className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                Configurar
              </button>
              <button
                onClick={rejectAll}
                className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                Rechazar no esenciales
              </button>
              <button
                onClick={acceptAll}
                className="rounded bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
              >
                Aceptar todas
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <Modal title="Configuración de Cookies" onClose={() => {}}>
          <div className="space-y-4 text-sm">
            <p className="text-gray-600 dark:text-gray-400">
              Personaliza tus preferencias de cookies. Las cookies estrictamente necesarias no pueden desactivarse ya que son esenciales para el funcionamiento básico del sitio.
            </p>
            
            <div className="flex items-center justify-between rounded-lg border p-3 dark:border-gray-700">
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white">Estrictamente Necesarias</h4>
                <p className="text-xs text-gray-500">Permiten el funcionamiento básico de la plataforma (ej. inicio de sesión, carrito).</p>
              </div>
              <input type="checkbox" checked disabled className="h-5 w-5 rounded border-gray-300 text-brand focus:ring-brand" />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3 dark:border-gray-700">
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white">Funcionales</h4>
                <p className="text-xs text-gray-500">Permiten recordar tus preferencias y personalizar tu experiencia.</p>
              </div>
              <input 
                type="checkbox" 
                checked={preferences.functional} 
                onChange={() => togglePreference('functional')}
                className="h-5 w-5 rounded border-gray-300 text-brand focus:ring-brand" 
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3 dark:border-gray-700">
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white">Analíticas</h4>
                <p className="text-xs text-gray-500">Nos ayudan a entender cómo interactúas con la plataforma para mejorarla.</p>
              </div>
              <input 
                type="checkbox" 
                checked={preferences.analytics} 
                onChange={() => togglePreference('analytics')}
                className="h-5 w-5 rounded border-gray-300 text-brand focus:ring-brand" 
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3 dark:border-gray-700">
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white">Marketing</h4>
                <p className="text-xs text-gray-500">Se utilizan para mostrarte anuncios relevantes y medir su eficacia.</p>
              </div>
              <input 
                type="checkbox" 
                checked={preferences.marketing} 
                onChange={() => togglePreference('marketing')}
                className="h-5 w-5 rounded border-gray-300 text-brand focus:ring-brand" 
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                onClick={acceptAll}
                className="rounded border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                Aceptar todas
              </button>
              <button
                onClick={savePreferences}
                className="rounded bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark"
              >
                Guardar preferencias
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
