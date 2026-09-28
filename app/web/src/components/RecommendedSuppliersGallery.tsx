import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { IconAi, IconStar } from './Icons';

interface SupplierItem {
  id: number;
  name: string;
  category: string;
  rating?: number;
  review_count?: number;
  city?: string;
  image_url?: string;
  highlight_badge?: string;
  recommended_for?: string;
}

interface GalleryProps {
  restaurantCategory?: string;
  suppliers?: SupplierItem[];
}

const DEFAULT_RECOMMENDED: SupplierItem[] = [
  {
    id: 1,
    name: 'Distribuidora Santander S.A.S.',
    category: 'Abarrotes, Aceites & Carga Seca',
    rating: 4.9,
    review_count: 58,
    city: 'Bucaramanga',
    image_url: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=1200&auto=format&fit=crop&q=80',
    highlight_badge: '98% Compatibilidad con tu Menú',
    recommended_for: 'Aceites vegetales, arroces, salsas base y empaques con entrega matutina garantizada',
  },
  {
    id: 2,
    name: 'Carnes & Cortes del Oriente',
    category: 'Carnes de Res, Cerdo & Aves',
    rating: 4.8,
    review_count: 42,
    city: 'Floridablanca',
    image_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=1200&auto=format&fit=crop&q=80',
    highlight_badge: 'Recomendado para BBQ & Parrilla',
    recommended_for: 'Cortes madurados, pechugas fileteadas, costillas y tocineta al por mayor',
  },
  {
    id: 3,
    name: 'Lácteos & Chocolates La Cumbre',
    category: 'Lácteos, Quesos & Repostería',
    rating: 5.0,
    review_count: 36,
    city: 'Bucaramanga',
    image_url: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=1200&auto=format&fit=crop&q=80',
    highlight_badge: 'Ideal para Postres & Brunch',
    recommended_for: 'Quesos mozzarella, crema de leche, mantequilla artesanal y coberturas de chocolate',
  },
  {
    id: 4,
    name: 'Frescos & Cosechas de Santander',
    category: 'Frutas, Vegetales & Hierbas',
    rating: 4.7,
    review_count: 29,
    city: 'Lebrija',
    image_url: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=1200&auto=format&fit=crop&q=80',
    highlight_badge: 'Cosecha Directa Fresca',
    recommended_for: 'Aguacates hass, verduras limpias, papas lavadas y cítricos seleccionados',
  },
];

export default function RecommendedSuppliersGallery({
  restaurantCategory,
  suppliers,
}: GalleryProps) {
  const { tenant } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);

  const list = (suppliers && suppliers.length > 0) ? suppliers : DEFAULT_RECOMMENDED;
  const categoryName = restaurantCategory || tenant?.category || 'Gastronomía';

  const next = () => {
    setCurrentIndex((prev) => (prev + 1) % list.length);
  };

  const prev = () => {
    setCurrentIndex((prev) => (prev - 1 + list.length) % list.length);
  };

  const activeSupplier = list[currentIndex];

  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white shadow-xl mb-6 dark:border-slate-800">
      {/* Background Hero Image with Overlay */}
      <div className="absolute inset-0 z-0 opacity-30 mix-blend-overlay transition-all duration-700">
        <img
          src={activeSupplier.image_url || 'https://images.unsplash.com/photo-1544025162-d76694265947?w=1200&auto=format&fit=crop&q=80'}
          alt={activeSupplier.name}
          className="h-full w-full object-cover object-center transform scale-105"
        />
      </div>

      <div className="relative z-10 p-5 sm:p-7 flex flex-col justify-between min-h-[340px]">
        {/* Header Tag */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300 font-black text-xs border border-emerald-500/30">
              <IconAi className="w-3.5 h-3.5 text-emerald-300" />
            </span>
            <div>
              <p className="text-[10px] uppercase font-black tracking-widest text-emerald-400">
                Recomendador de Proveedores Xupply
              </p>
              <h2 className="text-sm sm:text-base font-bold text-white">
                Proveedores Ideales para tu Restaurante: <span className="text-emerald-300 capitalize">{categoryName}</span>
              </h2>
            </div>
          </div>

          {/* Dots & Nav Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={prev}
              className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-white transition cursor-pointer"
              title="Anterior"
            >
              ←
            </button>
            <span className="text-xs text-white/70 px-1 font-mono">
              {currentIndex + 1} / {list.length}
            </span>
            <button
              type="button"
              onClick={next}
              className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-white transition cursor-pointer"
              title="Siguiente"
            >
              →
            </button>
          </div>
        </div>

        {/* Featured Card Detail */}
        <div className="my-4 grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
          <div className="md:col-span-7 space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 border border-emerald-400/40 px-3 py-1 text-xs font-bold text-emerald-300">
              <span>{activeSupplier.highlight_badge || 'Insumos Clave'}</span>
              <span>•</span>
              <span className="inline-flex items-center gap-1">
                <IconStar className="w-3 h-3 text-amber-300 fill-amber-300" />
                {activeSupplier.rating || 4.8} / 5
              </span>
            </div>

            <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {activeSupplier.name}
            </h3>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-xl">
              {activeSupplier.recommended_for || `Distribuidor mayorista de ${activeSupplier.category} en ${activeSupplier.city || 'Bucaramanga'}. Abastecimiento directo con cadena de frío garantizada y entrega express.`}
            </p>

            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                to={`/catalogo?categoria=${encodeURIComponent(activeSupplier.category)}`}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2.5 text-xs transition shadow-lg active:scale-95 cursor-pointer"
              >
                <span>Ver Catálogo de Insumos</span>
                <span>→</span>
              </Link>
              <Link
                to="/proveedores"
                className="inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold px-4 py-2.5 text-xs transition border border-white/15 cursor-pointer"
              >
                <span>Explorar Directorio</span>
              </Link>
            </div>
          </div>

          {/* Thumbnail Gallery Strip */}
          <div className="md:col-span-5 grid grid-cols-2 gap-2.5">
            {list.slice(0, 4).map((s, idx) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                className={`relative overflow-hidden rounded-2xl p-2.5 text-left transition cursor-pointer border ${
                  currentIndex === idx
                    ? 'border-emerald-400 bg-emerald-950/50 shadow-md ring-2 ring-emerald-500/50'
                    : 'border-white/10 bg-white/5 hover:bg-white/10'
                }`}
              >
                <div className="h-16 w-full rounded-xl overflow-hidden mb-1.5 bg-slate-800">
                  <img
                    src={s.image_url || 'https://images.unsplash.com/photo-1544025162-d76694265947?w=400&auto=format&fit=crop&q=80'}
                    alt={s.name}
                    className="h-full w-full object-cover"
                  />
                </div>
                <p className="font-bold text-xs text-white truncate">{s.name}</p>
                <p className="text-[10px] text-emerald-300 font-medium">{s.category}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Footer indicators */}
        <div className="flex items-center justify-between pt-2 border-t border-white/10 text-[11px] text-white/50">
          <span>Recomendación basada en categoría de cocina: {restaurantCategory}</span>
          <span>Despachos en Bucaramanga y Santander</span>
        </div>
      </div>
    </div>
  );
}
