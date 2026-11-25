import type { Product } from '../../../shared/types';

export const CATEGORY_FALLBACK_IMAGES: Record<string, string> = {
  Carnes: 'https://images.unsplash.com/photo-1603048588665-791ca8aea617?auto=format&fit=crop&w=600&q=80',
  Pollo: 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?auto=format&fit=crop&w=600&q=80',
  Cerdo: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80',
  Mariscos: 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?auto=format&fit=crop&w=600&q=80',
  Lacteos: 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?auto=format&fit=crop&w=600&q=80',
  'Lácteos': 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?auto=format&fit=crop&w=600&q=80',
  Verduras: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=600&q=80',
  Frutas: 'https://images.unsplash.com/photo-1619566636858-adf3ef46400b?auto=format&fit=crop&w=600&q=80',
  Bebidas: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=600&q=80',
  Granos: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80',
  Condimentos: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=600&q=80',
};

export function getProductImage(product: Product): string {
  if (product.image_url && product.image_url.trim().startsWith('http')) {
    return product.image_url.trim();
  }
  const cat = (product.category || '').toLowerCase();
  const name = (product.name || '').toLowerCase();
  for (const [key, url] of Object.entries(CATEGORY_FALLBACK_IMAGES)) {
    if (cat.includes(key.toLowerCase()) || name.includes(key.toLowerCase())) {
      return url;
    }
  }
  if (name.includes('res') || name.includes('carne') || name.includes('lomo') || name.includes('costilla')) {
    return CATEGORY_FALLBACK_IMAGES.Carnes;
  }
  if (name.includes('pollo') || name.includes('pechuga') || name.includes('muslo')) {
    return CATEGORY_FALLBACK_IMAGES.Pollo;
  }
  if (name.includes('chicharron') || name.includes('cerdo')) {
    return CATEGORY_FALLBACK_IMAGES.Cerdo;
  }
  if (name.includes('queso') || name.includes('leche') || name.includes('mantequilla')) {
    return CATEGORY_FALLBACK_IMAGES.Lacteos;
  }
  if (name.includes('camaron') || name.includes('pescado') || name.includes('atun')) {
    return CATEGORY_FALLBACK_IMAGES.Mariscos;
  }
  if (name.includes('tomate') || name.includes('cebolla') || name.includes('pimenton') || name.includes('papa')) {
    return CATEGORY_FALLBACK_IMAGES.Verduras;
  }
  if (name.includes('agua') || name.includes('gaseosa') || name.includes('jugo') || name.includes('bebida')) {
    return CATEGORY_FALLBACK_IMAGES.Bebidas;
  }
  return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80';
}
