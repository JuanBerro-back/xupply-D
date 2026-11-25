import { lazy } from 'react';
const Landing = lazy(() => import('./pages/Landing'));

export const LandingPage = Landing;
export const landingRoutes: React.ReactElement[] = [];
