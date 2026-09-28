export type PlanTier = 'basico' | 'medio' | 'premium';

export interface PlanLimits {
  name: string;
  price: string;
  canAccessAiPredictions: boolean;
  canAccessAiComplex: boolean;
  canAccessRecipes: boolean;
  canAccessStockAlerts: boolean;
  canAccessRecommendedSuppliers: boolean;
  canAccessTeamManagement: boolean;
  canAccessFinancialReports: boolean;
  description: string;
}

export const PLAN_CONFIG: Record<PlanTier, PlanLimits> = {
  basico: {
    name: 'Plan Básico (Esencial)',
    price: 'Gratis',
    canAccessAiPredictions: false,
    canAccessAiComplex: false,
    canAccessRecipes: false,
    canAccessStockAlerts: false,
    canAccessRecommendedSuppliers: false,
    canAccessTeamManagement: false,
    canAccessFinancialReports: false,
    description: 'Funcionalidades esenciales para ordenar insumos y gestionar pedidos básicos.',
  },
  medio: {
    name: 'Plan Medio (Crecimiento)',
    price: '$250.000 / mes',
    canAccessAiPredictions: false,
    canAccessAiComplex: true,
    canAccessRecipes: true,
    canAccessStockAlerts: true,
    canAccessRecommendedSuppliers: true,
    canAccessTeamManagement: true,
    canAccessFinancialReports: false,
    description: 'Control de recetas, alertas de punto de reorden y proveedores recomendados.',
  },
  premium: {
    name: 'Plan Premium (Acceso Total)',
    price: '$500.000 / mes',
    canAccessAiPredictions: true,
    canAccessAiComplex: true,
    canAccessRecipes: true,
    canAccessStockAlerts: true,
    canAccessRecommendedSuppliers: true,
    canAccessTeamManagement: true,
    canAccessFinancialReports: true,
    description: 'Acceso ilimitado a predicción de compras con IA, analítica avanzada y soporte prioritario.',
  },
};

export function getActivePlan(): PlanTier {
  const saved = localStorage.getItem('xupply_active_plan');
  if (saved === 'basico' || saved === 'medio' || saved === 'premium') {
    return saved;
  }
  return 'medio'; // Default to 'medio' for a great experience
}

export function setActivePlan(plan: PlanTier): void {
  localStorage.setItem('xupply_active_plan', plan);
  window.dispatchEvent(new Event('xupply_plan_changed'));
}

export function checkPlanFeature(feature: keyof Omit<PlanLimits, 'name' | 'price' | 'description'>): boolean {
  const currentPlan = getActivePlan();
  return PLAN_CONFIG[currentPlan][feature];
}

export function getPlanDetails(): PlanLimits {
  return PLAN_CONFIG[getActivePlan()];
}
