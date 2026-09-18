import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getApiOrigin, setCustomApiOrigin, DEFAULT_RENDER_URL } from '../lib/api';
import { IconSettings } from '../components/Icons';
import AppDownloadNotice from '../components/AppDownloadNotice';

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Configuración de servidor / Render
  const [showConfig, setShowConfig] = useState(false);
  const [serverUrl, setServerUrl] = useState(() => getApiOrigin() || DEFAULT_RENDER_URL);
  const [pingStatus, setPingStatus] = useState<string | null>(null);
  const [pingLoading, setPingLoading] = useState(false);

  const checkConnection = async (urlToCheck?: string) => {
    const target = (urlToCheck ?? serverUrl).trim().replace(/\/+$/, '');
    setPingLoading(true);
    setPingStatus('Probando conexión...');
    try {
      const res = await fetch(`${target}/health`, { signal: AbortSignal.timeout(8000) });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.status === 'ok') {
        setPingStatus('Conectado exitosamente con Render (OK)');
      } else {
        setPingStatus(`Servidor respondió código ${res.status}`);
      }
    } catch {
      setPingStatus('Sin respuesta (Render puede estar iniciando o URL incorrecta)');
    } finally {
      setPingLoading(false);
    }
  };

  const handleSaveServerUrl = () => {
    const clean = serverUrl.trim().replace(/\/+$/, '');
    setCustomApiOrigin(clean);
    setPingStatus('URL guardada correctamente');
  };

  const handleResetServerUrl = () => {
    setServerUrl(DEFAULT_RENDER_URL);
    setCustomApiOrigin(DEFAULT_RENDER_URL);
    setPingStatus('Restablecido a URL predeterminada de Render');
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(username, password);
    } catch (err) {
      const msg = (err as Error).message || 'Error de autenticación';
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('Load failed')) {
        setError(`${msg} - Verifica la URL del servidor en Render abajo.`);
        setShowConfig(true);
      } else {
        setError(msg);
      }
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <video
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 h-full w-full object-cover"
        src="/login-bg.mp4"
      />
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative z-10 w-full max-w-md rounded-lg bg-white/95 p-6 sm:p-8 shadow-2xl backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-brand">Xupply</h1>
          <button
            type="button"
            onClick={() => setShowConfig(!showConfig)}
            className="text-xs text-gray-500 hover:text-brand flex items-center gap-1 border border-gray-200 rounded px-2 py-1"
            title="Configurar URL del backend (Render)"
          >
            <IconSettings className="w-3.5 h-3.5 text-gray-500" />
            <span>{showConfig ? 'Ocultar servidor' : 'Servidor'}</span>
          </button>
        </div>
        <p className="mb-4 text-sm text-gray-600">Plataforma B2B de pedidos, inventario, facturación y logística</p>

        {/* Banner destacado: ¿Aún no tienes Xupply App? */}
        <div className="mb-4">
          <AppDownloadNotice compact dismissible={false} />
        </div>

        {showConfig && (
          <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50/80 p-3 text-xs text-gray-700 space-y-2">
            <div className="font-semibold text-blue-900 flex justify-between items-center">
              <span>Conexión con el servidor (Render)</span>
              <button
                type="button"
                onClick={handleResetServerUrl}
                className="text-blue-600 underline font-normal text-[11px]"
              >
                Restablecer
              </button>
            </div>
            <div>
              <label className="block text-gray-600 mb-1">URL de la API / Backend:</label>
              <input
                type="text"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="https://tu-servicio.onrender.com"
                className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-xs font-mono"
              />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleSaveServerUrl}
                className="rounded bg-blue-600 px-2.5 py-1 text-white hover:bg-blue-700 text-xs font-medium"
              >
                Guardar URL
              </button>
              <button
                type="button"
                disabled={pingLoading}
                onClick={() => checkConnection()}
                className="rounded border border-blue-400 bg-white px-2.5 py-1 text-blue-700 hover:bg-blue-100 text-xs font-medium disabled:opacity-50"
              >
                {pingLoading ? 'Probando...' : 'Probar conexión'}
              </button>
            </div>
            {pingStatus && (
              <p
                className={`pt-1 font-medium ${
                  pingStatus.includes('exitosamente') ? 'text-green-700' : 'text-amber-800'
                }`}
              >
                {pingStatus}
              </p>
            )}
          </div>
        )}

        {error && <p className="mb-4 rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Usuario</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} className="w-full rounded border px-3 py-2" required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Contraseña</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded border px-3 py-2" required />
          </div>
          <button className="w-full rounded bg-brand py-2 font-medium text-white hover:bg-brand-dark">Ingresar</button>
        </form>
        <p className="mt-4 text-sm text-gray-600">
          ¿Sin cuenta? <Link to="/register" className="text-brand hover:underline">Regístrate</Link>
        </p>
        <div className="mt-4 rounded bg-gray-50 p-3 text-xs text-gray-600">
          Usuarios demo (contraseña <b>demo1234</b>): <b>admin</b> · <b>gerente</b> · <b>empleado</b> ·{' '}
          <b>proveedor</b> · <b>domiciliario</b>
        </div>
      </div>
    </div>
  );
}
