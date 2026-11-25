/**
 * Glifo y badge de vehículo compartidos por `deliveries` e `identity/team`.
 * Las clases y los SVG son los que ya tenían cada módulo: solo se unifican.
 */

const VEHICLES = {
  camion: {
    label: 'Camión',
    glyphMd: 'w-5 h-5 text-indigo-600 shrink-0',
    glyphSm: 'w-3.5 h-3.5 text-indigo-600 shrink-0',
    badge:
      'inline-flex items-center gap-1 rounded-lg bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-xs font-bold text-indigo-800',
    path: 'M8 17a2 2 0 100 4 2 2 0 000-4zm10 0a2 2 0 100 4 2 2 0 000-4zM3 5h11v10H3V5zm11 3h4l3 4v3h-7V8z',
  },
  furgon: {
    label: 'Furgón',
    glyphMd: 'w-5 h-5 text-blue-600 shrink-0',
    glyphSm: 'w-3.5 h-3.5 text-blue-600 shrink-0',
    badge:
      'inline-flex items-center gap-1 rounded-lg bg-blue-50 border border-blue-200 px-2 py-0.5 text-xs font-bold text-blue-800',
    path: 'M5 16h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2zm1 0a2 2 0 104 0m6 0a2 2 0 104 0',
  },
  camioneta: {
    label: 'Camioneta',
    glyphMd: 'w-5 h-5 text-emerald-600 shrink-0',
    glyphSm: 'w-3.5 h-3.5 text-emerald-600 shrink-0',
    badge:
      'inline-flex items-center gap-1 rounded-lg bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xs font-bold text-emerald-800',
    path: 'M9 17a2 2 0 11-4 0 2 2 0 014 0zm10 0a2 2 0 11-4 0 2 2 0 014 0zM4 9l2-4h10l2 4M3 13h18v4H3v-4z',
  },
  moto: {
    label: 'Moto',
    glyphMd: 'w-5 h-5 text-sky-600 shrink-0',
    glyphSm: 'w-3.5 h-3.5 text-sky-600 shrink-0',
    badge:
      'inline-flex items-center gap-1 rounded-lg bg-sky-50 border border-sky-200 px-2 py-0.5 text-xs font-bold text-sky-800',
    path: 'M5 16a3 3 0 100-6 3 3 0 000 6zm14 0a3 3 0 100-6 3 3 0 000 6zm-7-6l3-4h3m-6 4l-3 4H5m7-4v4',
  },
} as const;

function vehicleStyle(type?: string | null) {
  const key = (type || '').toLowerCase();
  return key === 'camion' || key === 'furgon' || key === 'camioneta' ? VEHICLES[key] : VEHICLES.moto;
}

export function VehicleGlyph({ type, size = 'md' }: { type?: string | null; size?: 'sm' | 'md' }) {
  const vehicle = vehicleStyle(type);
  return (
    <svg
      className={size === 'sm' ? vehicle.glyphSm : vehicle.glyphMd}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={vehicle.path} />
    </svg>
  );
}

export function vehicleLabel(type?: string | null): string {
  return vehicleStyle(type).label;
}

export default function VehicleBadge({ type, plate }: { type?: string | null; plate?: string | null }) {
  if (!type || type === 'ninguno') return null;
  const vehicle = vehicleStyle(type);
  return (
    <span className={vehicle.badge}>
      <VehicleGlyph type={type} size="sm" />
      <span>
        {vehicle.label}
        {plate ? `· ${plate}` : ''}
      </span>
    </span>
  );
}
