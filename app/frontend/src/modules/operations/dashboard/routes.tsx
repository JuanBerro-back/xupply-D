import { lazy } from 'react';
const Dashboard = lazy(() => import('./pages/Dashboard'));

export const DashboardPage = Dashboard;
export const dashboardRoutes: React.ReactElement[] = [];
