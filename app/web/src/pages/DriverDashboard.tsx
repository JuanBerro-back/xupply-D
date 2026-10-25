import Deliveries from './Deliveries';

/**
 * Modo repartidor.
 *
 * Antes esta pantalla duplicaba el mapa con datos de demostración
 * hardcodeados (MOCK-801/MOCK-802), posiciones aproximadas por IP y una
 * segunda copia del código OSRM. Ahora reutiliza exactamente la misma vista
 * de logística en modo inmersivo: una sola fuente de datos reales, un solo
 * mapa y un solo conjunto de acciones.
 */
export default function DriverDashboard() {
  return <Deliveries focusMode />;
}
