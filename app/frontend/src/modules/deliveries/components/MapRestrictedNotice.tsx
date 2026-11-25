import { Link } from 'react-router-dom';
import { IconPin } from '../../../shared/ui/Icons';

export default function MapRestrictedNotice() {
  return (
    <div className="max-w-2xl mx-auto my-12 p-8 rounded-3xl bg-white border border-slate-200 shadow-xl text-center space-y-5">
      <div className="h-16 w-16 mx-auto rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center">
        <IconPin className="w-8 h-8 text-amber-600" />
      </div>
      <h2 className="text-2xl font-black text-slate-800">Visualización de Mapa GPS Restringida</h2>
      <p className="text-sm text-slate-600 leading-relaxed">
        Por políticas de privacidad y seguridad logística, los gerentes de restaurantes no visualizan el mapa GPS satelital de la flota de despacho.
      </p>
      <div className="rounded-2xl bg-slate-50 p-4 text-xs text-slate-700 text-left space-y-2 border border-slate-200">
        <p className="font-bold text-slate-800 text-sm">¿Cómo verificar el estado de tu pedido?</p>
        <ul className="list-disc list-inside space-y-1.5 text-slate-600">
          <li>Ingresa a la sección <b>Pedidos</b> y haz clic sobre tu orden activa.</li>
          <li>En la información del pedido podrás ver el <b>estado del despacho, la ubicación de entrega y quién lo lleva</b> (nombre del domiciliario, teléfono y vehículo).</li>
          <li>Al recibir tu pedido en el restaurante, el domiciliario te entregará la <b>Llave de Seguridad</b> para confirmar la entrega con el código.</li>
        </ul>
      </div>
      <Link
        to="/pedidos"
        className="inline-flex items-center gap-2 rounded-2xl bg-brand px-6 py-3.5 text-sm font-bold text-white hover:bg-brand-dark transition shadow-md active:scale-95"
      >
        <span>Ir a Mis Pedidos</span>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
        </svg>
      </Link>
    </div>
  );
}
