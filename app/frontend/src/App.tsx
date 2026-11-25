import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './shared/context/AuthContext';
import CookieConsent from './shared/ui/CookieConsent';
import FeedbackHost from './shared/ui/FeedbackHost';
import AppErrorBoundary from './shared/ui/AppErrorBoundary';

const Navbar = lazy(() => import('./shared/ui/Navbar'));
const BottomNav = lazy(() => import('./shared/ui/BottomNav'));
const SideCart = lazy(() => import('./modules/catalog/cart/components/SideCart'));
const AiFloatingWidget = lazy(() => import('./modules/ai/components/AiFloatingWidget'));

import { authRoutes } from './modules/identity/auth/routes';
import { verificationRoutes } from './modules/identity/verification/routes';
import { notFoundRoute, rootRoute } from './modules/public/shell/routes';
import { appDownloadRoutes } from './modules/public/app-download/routes';
import { catalogRoutes } from './modules/catalog/catalog/routes';
import { cartRoutes } from './modules/catalog/cart/routes';
import { ordersRoutes } from './modules/orders/routes';
import { inventoryRoutes } from './modules/operations/inventory/routes';
import { radarRoutes } from './modules/operations/radar/routes';
import { invoicingRoutes } from './modules/finance/invoicing/routes';
import { directoryRoutes } from './modules/catalog/directory/routes';
import { deliveriesRoutes } from './modules/deliveries/routes';
import { plansRoutes } from './modules/finance/plans/routes';
import { paymentsRoutes } from './modules/finance/payments/routes';
import { aiRoutes } from './modules/ai/routes';
import { teamRoutes } from './modules/identity/team/routes';
import { profileRoutes } from './modules/identity/profile/routes';
import { adminRoutes } from './modules/admin/routes';
import { dashboardRoutes } from './modules/operations/dashboard/routes';
import { landingRoutes } from './modules/public/landing/routes';

const allRoutes = [
  ...authRoutes,
  ...verificationRoutes,
  rootRoute,
  ...appDownloadRoutes,
  ...catalogRoutes,
  ...cartRoutes,
  ...ordersRoutes,
  ...inventoryRoutes,
  ...radarRoutes,
  ...invoicingRoutes,
  ...directoryRoutes,
  ...deliveriesRoutes,
  ...plansRoutes,
  ...paymentsRoutes,
  ...aiRoutes,
  ...teamRoutes,
  ...profileRoutes,
  ...adminRoutes,
  ...dashboardRoutes,
  ...landingRoutes,
  notFoundRoute,
];

export default function App() {
  const { user } = useAuth();

  return (
    <Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center text-gray-500">Cargando…</div>}>
    <div className="min-h-screen bg-slate-50 text-slate-800 dark:bg-[#0b1120] dark:text-slate-100 antialiased transition-colors duration-300">
      {user && <Navbar />}
      <main className={user ? 'mx-auto max-w-7xl px-4 py-6 pb-24 sm:pb-6' : ''}>
        <AppErrorBoundary>
        <Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center text-gray-500">Cargando…</div>}>
        <Routes>
          {allRoutes}
        </Routes>
        </Suspense>
        </AppErrorBoundary>
      </main>
      {user && <BottomNav />}
      {user && user.role !== 'admin' && user.role !== 'verificador' && <SideCart />}
      {user && (user.role === 'gerente' || user.role === 'proveedor_admin') && <AiFloatingWidget />}
      <CookieConsent />
      <FeedbackHost />
    </div>
    </Suspense>
  );
}
