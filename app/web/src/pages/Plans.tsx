import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { api } from '../lib/api';
import { getActivePlan, setActivePlan, PlanTier, PLAN_CONFIG } from '../lib/planAccess';
import { IconCheck, IconClose, IconStar } from '../components/Icons';

const PLAN_DETAILS = [
  {
    id: 'basico' as PlanTier,
    name: 'Plan Básico',
    subtitle: 'Funcionalidades Esenciales',
    price: '$0',
    billing: 'Gratis de por vida',
    badge: 'Inicial',
    badgeColor: 'bg-slate-100 text-slate-700 border-slate-300',
    accentColor: 'border-slate-300',
    buttonClass: 'bg-slate-800 text-white hover:bg-slate-900',
    features: [
      { text: 'Catálogo de insumos y pedidos B2B', included: true },
      { text: 'Historial y detalle de compras', included: true },
      { text: 'Confirmación segura de entregas con código', included: true },
      { text: 'Asistente IA en modo consulta básica', included: true },
      { text: 'Recetas de platos y costeo automático', included: false },
      { text: 'Alertas de punto de reorden (Stock mínimo)', included: false },
      { text: 'Recomendaciones de proveedores por gastronomía', included: false },
      { text: 'Gestión de equipo y colaboradores', included: false },
      { text: 'Predicción de inventario con Inteligencia Artificial', included: false },
      { text: 'Analítica financiera y reportes de rentabilidad', included: false },
    ],
  },
  {
    id: 'medio' as PlanTier,
    name: 'Plan Medio',
    subtitle: 'Crecimiento y Eficiencia',
    price: '$250.000',
    billing: 'COP / mes',
    badge: 'Más Popular',
    badgeColor: 'bg-brand/10 text-brand border-brand/30',
    accentColor: 'border-brand ring-2 ring-brand/20',
    buttonClass: 'bg-brand text-white hover:bg-brand-dark shadow-md shadow-brand/20',
    features: [
      { text: 'Catálogo de insumos y pedidos B2B', included: true },
      { text: 'Historial y detalle de compras', included: true },
      { text: 'Confirmación segura de entregas con código', included: true },
      { text: 'Asistente IA completo (costos, mermas, proveedores)', included: true },
      { text: 'Recetas de platos y costeo automático', included: true },
      { text: 'Alertas de punto de reorden (Stock mínimo)', included: true },
      { text: 'Recomendaciones de proveedores por gastronomía', included: true },
      { text: 'Gestión de equipo y colaboradores', included: true },
      { text: 'Predicción de inventario con Inteligencia Artificial', included: false },
      { text: 'Analítica financiera y reportes de rentabilidad', included: false },
    ],
  },
  {
    id: 'premium' as PlanTier,
    name: 'Plan Premium',
    subtitle: 'Control Total y Automatización',
    price: '$500.000',
    billing: 'COP / mes',
    badge: 'Acceso Total VIP',
    badgeColor: 'bg-gradient-to-r from-amber-500/10 to-purple-500/10 text-purple-800 border-purple-300',
    accentColor: 'border-purple-500 ring-2 ring-purple-500/20 shadow-lg',
    buttonClass: 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 shadow-md shadow-purple-500/25',
    features: [
      { text: 'Catálogo de insumos y pedidos B2B', included: true },
      { text: 'Historial y detalle de compras', included: true },
      { text: 'Confirmación segura de entregas con código', included: true },
      { text: 'Asistente IA Avanzado con resolución de casos complejos', included: true },
      { text: 'Recetas de platos y costeo automático', included: true },
      { text: 'Alertas de punto de reorden (Stock mínimo)', included: true },
      { text: 'Recomendaciones de proveedores por gastronomía', included: true },
      { text: 'Gestión de equipo y colaboradores', included: true },
      { text: 'Predicción de inventario con Inteligencia Artificial', included: true },
      { text: 'Analítica financiera y reportes de rentabilidad', included: true },
    ],
  },
];

export default function Plans() {
  const { user } = useAuth();
  const { push } = useNotifications();
  const [currentPlan, setCurrentPlan] = useState<PlanTier>(getActivePlan());
  const [updating, setUpdating] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    const handlePlanChange = () => {
      setCurrentPlan(getActivePlan());
    };
    window.addEventListener('xupply_plan_changed', handlePlanChange);
    return () => window.removeEventListener('xupply_plan_changed', handlePlanChange);
  }, []);

  const handleSelectPlan = async (planId: PlanTier) => {
    if (planId === currentPlan) return;
    setUpdating(true);
    try {
      setActivePlan(planId);
      setCurrentPlan(planId);

      // Persist to backend if user is authenticated
      if (user) {
        try {
          await api('/auth/subscription-plan', {
            method: 'POST',
            body: JSON.stringify({ plan: planId }),
          });
        } catch {
          // Keep local state active even if offline
        }
      }

      const planName = PLAN_CONFIG[planId].name;
      setSuccessMessage(`¡Has activado el ${planName}! Tus permisos y accesos se han actualizado.`);
      push({
        message: `Plan actualizado a ${planName}`,
        at: new Date().toISOString(),
      });

      setTimeout(() => setSuccessMessage(''), 5000);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-brand-dark p-6 sm:p-10 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur-sm border border-white/20 mb-3">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Modelo Híbrido Xupply B2B</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
            Planes de Suscripción Xupply
          </h1>
          <p className="mt-2 text-sm sm:text-base text-slate-300">
            Escala tu restaurante o distribuidora. Elige el nivel de acceso que necesitas: desde operaciones básicas
            esenciales hasta analítica predictiva de demanda con Inteligencia Artificial.
          </p>

          <div className="mt-6 inline-flex flex-wrap items-center gap-3 rounded-2xl bg-white/10 backdrop-blur-md p-3 border border-white/10">
            <span className="text-xs text-slate-300 font-medium">Tu Plan Activo Actual:</span>
            <span className="rounded-xl bg-emerald-500 text-white text-xs font-bold px-3 py-1 uppercase tracking-wider shadow-sm flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              {PLAN_CONFIG[currentPlan].name}
            </span>
            <span className="text-xs text-slate-300">({PLAN_CONFIG[currentPlan].price})</span>
          </div>
        </div>
      </div>

      {successMessage && (
        <div className="rounded-2xl bg-emerald-50 border-2 border-emerald-300 p-4 text-sm font-semibold text-emerald-800 flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">
              <IconCheck className="w-4 h-4 text-emerald-600" />
            </div>
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage('')} className="text-emerald-600 hover:text-emerald-900 p-1" aria-label="Cerrar">
            <IconClose className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Cards Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {PLAN_DETAILS.map((p) => {
          const isActive = currentPlan === p.id;
          return (
            <div
              key={p.id}
              className={`relative flex flex-col rounded-3xl bg-white p-7 transition-all duration-300 border-2 ${
                isActive ? p.accentColor : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
              }`}
            >
              {isActive && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-emerald-600 px-4 py-1 text-xs font-black uppercase tracking-wider text-white shadow-md flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-white animate-ping" />
                  <span>Plan Actual Activo</span>
                </div>
              )}

              <div className="flex items-center justify-between gap-2 mb-2">
                <span className={`rounded-full border px-3 py-1 text-xs font-extrabold ${p.badgeColor}`}>
                  {p.badge}
                </span>
                <span className="text-xs text-slate-400 font-mono">Tier: {p.id.toUpperCase()}</span>
              </div>

              <h3 className="text-2xl font-black text-slate-900">{p.name}</h3>
              <p className="text-xs text-slate-500 mb-4">{p.subtitle}</p>

              <div className="mb-6 flex items-baseline gap-1.5 border-b border-slate-100 pb-5">
                <span className="text-4xl font-black text-slate-900 tracking-tight">{p.price}</span>
                <span className="text-xs font-semibold text-slate-500">{p.billing}</span>
              </div>

              <div className="mb-6 flex-1 space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Funcionalidades y Accesos:</p>
                <ul className="space-y-2.5 text-xs text-slate-700">
                  {p.features.map((f, idx) => (
                    <li key={idx} className="flex items-start gap-2.5">
                      {f.included ? (
                        <span className="h-4 w-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                          <IconCheck className="w-2.5 h-2.5" />
                        </span>
                      ) : (
                        <span className="h-4 w-4 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center shrink-0 mt-0.5">
                          <IconClose className="w-2.5 h-2.5" />
                        </span>
                      )}
                      <span className={f.included ? 'font-medium text-slate-800' : 'text-slate-400 line-through'}>
                        {f.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={() => handleSelectPlan(p.id)}
                disabled={isActive || updating}
                className={`w-full rounded-2xl py-3.5 text-sm font-bold transition active:scale-98 ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-700 border-2 border-emerald-300 cursor-default'
                    : p.buttonClass
                }`}
              >
                {isActive ? 'Plan Activo en tu Cuenta' : `Seleccionar ${p.name}`}
              </button>
            </div>
          );
        })}
      </div>

      {/* Feature Matrix Table */}
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50/70 p-5">
          <h2 className="text-lg font-bold text-slate-800">Matriz de Acceso por Nivel de Suscripción</h2>
          <p className="text-xs text-slate-500">
            Compara detalladamente cómo se habilitan las funciones en la plataforma según el plan contratado.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b bg-slate-100/70 font-black uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3">Módulo / Característica</th>
                <th className="px-5 py-3 text-center">Plan Básico</th>
                <th className="px-5 py-3 text-center">Plan Medio</th>
                <th className="px-5 py-3 text-center">Plan Premium</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="px-5 py-3 font-semibold text-slate-800">Órdenes B2B y Catálogo de Insumos</td>
                <td className="px-5 py-3 text-center text-emerald-600 font-bold">
                  <span className="inline-flex items-center gap-1 justify-center"><IconCheck className="w-3.5 h-3.5" /> Esencial</span>
                </td>
                <td className="px-5 py-3 text-center text-emerald-600 font-bold">
                  <span className="inline-flex items-center gap-1 justify-center"><IconCheck className="w-3.5 h-3.5" /> Ilimitado</span>
                </td>
                <td className="px-5 py-3 text-center text-emerald-600 font-bold">
                  <span className="inline-flex items-center gap-1 justify-center"><IconCheck className="w-3.5 h-3.5" /> Ilimitado</span>
                </td>
              </tr>
              <tr>
                <td className="px-5 py-3 font-semibold text-slate-800">Entrega Segura con Llave/Código Gerente-Domiciliario</td>
                <td className="px-5 py-3 text-center text-emerald-600 font-bold">
                  <span className="inline-flex items-center gap-1 justify-center"><IconCheck className="w-3.5 h-3.5" /> Incluido</span>
                </td>
                <td className="px-5 py-3 text-center text-emerald-600 font-bold">
                  <span className="inline-flex items-center gap-1 justify-center"><IconCheck className="w-3.5 h-3.5" /> Incluido</span>
                </td>
                <td className="px-5 py-3 text-center text-emerald-600 font-bold">
                  <span className="inline-flex items-center gap-1 justify-center"><IconCheck className="w-3.5 h-3.5" /> Incluido</span>
                </td>
              </tr>
              <tr>
                <td className="px-5 py-3 font-semibold text-slate-800">Gestión de Equipo (Empleados / Domiciliarios)</td>
                <td className="px-5 py-3 text-center text-slate-400">
                  <span className="inline-flex items-center gap-1 justify-center"><IconClose className="w-3.5 h-3.5" /> Bloqueado</span>
                </td>
                <td className="px-5 py-3 text-center text-emerald-600 font-bold">
                  <span className="inline-flex items-center gap-1 justify-center"><IconCheck className="w-3.5 h-3.5" /> Hasta 5 usuarios</span>
                </td>
                <td className="px-5 py-3 text-center text-emerald-600 font-bold">
                  <span className="inline-flex items-center gap-1 justify-center"><IconCheck className="w-3.5 h-3.5" /> Flota Ilimitada</span>
                </td>
              </tr>
              <tr>
                <td className="px-5 py-3 font-semibold text-slate-800">Recomendaciones de Proveedores según Gastronomía</td>
                <td className="px-5 py-3 text-center text-slate-400">
                  <span className="inline-flex items-center gap-1 justify-center"><IconClose className="w-3.5 h-3.5" /> Bloqueado</span>
                </td>
                <td className="px-5 py-3 text-center text-emerald-600 font-bold">
                  <span className="inline-flex items-center gap-1 justify-center"><IconCheck className="w-3.5 h-3.5" /> Activo</span>
                </td>
                <td className="px-5 py-3 text-center text-emerald-600 font-bold">
                  <span className="inline-flex items-center gap-1 justify-center"><IconCheck className="w-3.5 h-3.5" /> Prioridad VIP</span>
                </td>
              </tr>
              <tr>
                <td className="px-5 py-3 font-semibold text-slate-800">Recetario y Escandallo de Platos</td>
                <td className="px-5 py-3 text-center text-slate-400">
                  <span className="inline-flex items-center gap-1 justify-center"><IconClose className="w-3.5 h-3.5" /> Bloqueado</span>
                </td>
                <td className="px-5 py-3 text-center text-emerald-600 font-bold">
                  <span className="inline-flex items-center gap-1 justify-center"><IconCheck className="w-3.5 h-3.5" /> Activo</span>
                </td>
                <td className="px-5 py-3 text-center text-emerald-600 font-bold">
                  <span className="inline-flex items-center gap-1 justify-center"><IconCheck className="w-3.5 h-3.5" /> Ilimitado</span>
                </td>
              </tr>
              <tr>
                <td className="px-5 py-3 font-semibold text-slate-800">Alertas Inteligentes de Reorden (ROP)</td>
                <td className="px-5 py-3 text-center text-slate-400">
                  <span className="inline-flex items-center gap-1 justify-center"><IconClose className="w-3.5 h-3.5" /> Bloqueado</span>
                </td>
                <td className="px-5 py-3 text-center text-emerald-600 font-bold">
                  <span className="inline-flex items-center gap-1 justify-center"><IconCheck className="w-3.5 h-3.5" /> Activo</span>
                </td>
                <td className="px-5 py-3 text-center text-emerald-600 font-bold">
                  <span className="inline-flex items-center gap-1 justify-center"><IconCheck className="w-3.5 h-3.5" /> En Tiempo Real</span>
                </td>
              </tr>
              <tr>
                <td className="px-5 py-3 font-semibold text-slate-800">Xupply Asistente IA (Ventana Flotante)</td>
                <td className="px-5 py-3 text-center text-amber-600 font-bold">Consultas Básicas</td>
                <td className="px-5 py-3 text-center text-emerald-600 font-bold">
                  <span className="inline-flex items-center gap-1 justify-center"><IconCheck className="w-3.5 h-3.5" /> Completo</span>
                </td>
                <td className="px-5 py-3 text-center text-purple-600 font-black">
                  <span className="inline-flex items-center gap-1 justify-center"><IconStar className="w-3.5 h-3.5 fill-purple-600" /> Modo Experto Ultra</span>
                </td>
              </tr>
              <tr>
                <td className="px-5 py-3 font-semibold text-slate-800">Predicción de Inventario y Demanda Futura con IA</td>
                <td className="px-5 py-3 text-center text-slate-400">
                  <span className="inline-flex items-center gap-1 justify-center"><IconClose className="w-3.5 h-3.5" /> Bloqueado</span>
                </td>
                <td className="px-5 py-3 text-center text-slate-400">
                  <span className="inline-flex items-center gap-1 justify-center"><IconClose className="w-3.5 h-3.5" /> Bloqueado</span>
                </td>
                <td className="px-5 py-3 text-center text-purple-600 font-black">
                  <span className="inline-flex items-center gap-1 justify-center"><IconStar className="w-3.5 h-3.5 fill-purple-600" /> Algoritmo Neuronal</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}