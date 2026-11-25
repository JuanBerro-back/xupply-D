export interface BucaramangaPoint {
  sector: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

export const BUCARAMANGA_DESTINATIONS: BucaramangaPoint[] = [
  {
    sector: 'Cabecera del Llano',
    name: 'Restaurante Rancho Grande BGA',
    address: 'Carrera 35 #48-22, Cabecera del Llano, Bucaramanga',
    lat: 7.1168,
    lng: -73.1095,
  },
  {
    sector: 'Cañaveral (Floridablanca)',
    name: 'Burgers & Grill Central',
    address: 'Calle 30 #26-10, Parque Caracolí / Cañaveral, Floridablanca',
    lat: 7.0665,
    lng: -73.1030,
  },
  {
    sector: 'Provenza',
    name: 'Trattoria Bella Napoli',
    address: 'Calle 105 #24-32, Provenza, Bucaramanga',
    lat: 7.0845,
    lng: -73.1175,
  },
  {
    sector: 'Centro Cívico',
    name: 'La Castellana Gourmet',
    address: 'Calle 35 #10-43, Plaza Cívica Luis Carlos Galán, Centro, Bucaramanga',
    lat: 7.1165,
    lng: -73.1255,
  },
  {
    sector: 'Cacique / El Tejar',
    name: 'El Corral BGA',
    address: 'Transversal 93 #34-99, El Tejar / C.C. Cacique, Bucaramanga',
    lat: 7.0984,
    lng: -73.1090,
  },
  {
    sector: 'San Pío / Sotomayor',
    name: 'Fogón Santandereano',
    address: 'Calle 45 #33-18, Parque San Pío, Sotomayor, Bucaramanga',
    lat: 7.1190,
    lng: -73.1125,
  },
  {
    sector: 'Ciudadela Real de Minas',
    name: 'Parrilla Real',
    address: 'Calle 56 #17W-40, Real de Minas, Bucaramanga',
    lat: 7.1055,
    lng: -73.1290,
  },
  {
    sector: 'San Francisco / UIS',
    name: 'Asador del Norte',
    address: 'Carrera 27 #10-40, San Francisco / UIS, Bucaramanga',
    lat: 7.1415,
    lng: -73.1210,
  },
];

export const BUCARAMANGA_DISPATCH_HUBS: BucaramangaPoint[] = [
  {
    sector: 'Centroabastos (Chimitá)',
    name: 'Central de Abastos de Bucaramanga Bodega 8',
    address: 'Km 4 Vía Palenque - Chimitá, Bucaramanga',
    lat: 7.1320,
    lng: -73.1650,
  },
  {
    sector: 'Zona Industrial Palenque',
    name: 'Parque Logístico Palenque',
    address: 'Anillo Vial Km 2.5, Complejo Industrial, Girón - Bucaramanga',
    lat: 7.0850,
    lng: -73.1680,
  },
  {
    sector: 'Centro / La Concordia',
    name: 'Distribuidora Mayorista Santander',
    address: 'Carrera 15 #28-40, La Concordia, Bucaramanga',
    lat: 7.1235,
    lng: -73.1285,
  },
  {
    sector: 'San Francisco',
    name: 'Frigorífico & Alimentos San Francisco',
    address: 'Carrera 22 #18-35, San Francisco, Bucaramanga',
    lat: 7.1345,
    lng: -73.1215,
  },
];

export function resolveBucaramangaCoords(address?: string | null, seed = 0): BucaramangaPoint {
  if (address) {
    const a = address.toLowerCase();
    if (a.includes('cañaveral') || a.includes('canaveral') || a.includes('floridablanca') || a.includes('caracolí')) {
      return BUCARAMANGA_DESTINATIONS[1];
    }
    if (a.includes('provenza') || a.includes('105')) {
      return BUCARAMANGA_DESTINATIONS[2];
    }
    if (a.includes('cacique') || a.includes('tejar') || a.includes('93')) {
      return BUCARAMANGA_DESTINATIONS[4];
    }
    if (a.includes('cabecera') || a.includes('cuadra') || a.includes('35')) {
      return BUCARAMANGA_DESTINATIONS[0];
    }
    if (a.includes('san pio') || a.includes('san pío') || a.includes('sotomayor')) {
      return BUCARAMANGA_DESTINATIONS[5];
    }
    if (a.includes('centro') || a.includes('cívica') || a.includes('civica')) {
      return BUCARAMANGA_DESTINATIONS[3];
    }
    if (a.includes('real de minas') || a.includes('ciudadela')) {
      return BUCARAMANGA_DESTINATIONS[6];
    }
    if (a.includes('san francisco') || a.includes('uis')) {
      return BUCARAMANGA_DESTINATIONS[7];
    }
  }

  const idx = Math.abs(seed) % BUCARAMANGA_DESTINATIONS.length;
  return BUCARAMANGA_DESTINATIONS[idx];
}
