# Arquitectura del frontend (`app/frontend/src`)

Organización por **dominio**, no por tipo de archivo. Cada funcionalidad vive en
`modules/<modulo>/` y comparte únicamente lo que usan **dos o más módulos**, que
vive en `shared/`.

Regla de oro: **para encontrar un archivo, busca el dominio primero**.

## Si es X, va en Y

| Si es... | Va en... |
| --- | --- |
| Una pantalla/vista de un dominio | `modules/<modulo>/pages/` |
| Un componente usado solo por ese dominio | `modules/<modulo>/components/` |
| Un hook específico del dominio | `modules/<modulo>/hooks/` |
| Las llamadas a la API del dominio | `modules/<modulo>/api/` |
| Cálculos o helpers del dominio | `modules/<modulo>/utils/` |
| Tipos/interfaces del dominio | `modules/<modulo>/types.ts` (solo si hay tipos reales) |
| Las rutas del dominio | `modules/<modulo>/routes.tsx` |
| Un cliente/transporte HTTP usado por varios módulos | `shared/api/client.ts` |
| El cliente de Socket.IO global | `shared/api/socket.ts` |
| Un proveedor de contexto global (auth, carrito, tema, idioma, notificaciones) | `shared/context/` |
| Una guardia de ruta (`RequireAuth`, `RolesAllowed`, `AdminAccessAllowed`) | `shared/routing/guards.tsx` |
| Un componente de UI usado por 2+ módulos | `shared/ui/` |
| Una constante/helper usado por 2+ módulos | `shared/utils/` |
| Estilos globales / Tailwind base | `shared/styles/index.css` |
| Tipos usados por 2+ módulos | `shared/types.ts` |
| El ensamblado de los routers de todos los módulos | `App.tsx` (solamente) |
| El entry point, providers y service worker | `main.tsx` |

## Reglas de dependencia

- Hay **9 dominios**. Cada dominio puede contener varios submódulos, y los
  archivos conservan su nombre original: solo cambia la carpeta.
- `App.tsx` **solo ensambla** los `routes.tsx` de los módulos. No contiene
  lógica de negocio ni guards; la única decisión que toma es el redirect de `/`
  usando los `Page` exportados por `operations/dashboard/routes.tsx` y
  `public/landing/routes.tsx`.
- Un módulo **nunca** importa archivos internos de otro módulo (`pages`,
  `components`, `api`, `utils`, `types`). Si dos módulos necesitan lo mismo,
  se sube a `shared/` o baja al dominio si ya solo lo usa ese dominio.
- `modules/*/routes.tsx` es la superficie pública de cada módulo. `shell`
  únicamente aporta `notFoundRoute`.
- `shared/` no importa desde `modules/`. Depende solo de React, React Router y
  de otros archivos de `shared/`. Esto garantiza que no haya ciclos.
- No hay aliases de TypeScript: **todas las importaciones son relativas**.
- No hay barrel files (`index.ts`) que reexporten módulos.

## Cómo agregar un módulo

1. Crear `modules/<modulo>/` con `routes.tsx`, más `pages/`, `components/`,
   `hooks/`, `api/`, `utils/` y `types.ts` según se necesiten.
2. Exportar desde `routes.tsx` un arreglo de elementos `<Route>` (o los
   elementos puntuales si el módulo no tiene rutas propias, como `dashboard`).
3. Agregar su import y su spread en el arreglo `allRoutes` de `App.tsx`.
4. Si algo del módulo lo necesita otro módulo, moverlo a `shared/` (no
   importarlo directamente).
5. Verificar: `npm run typecheck && npm run build` en `app/frontend`.

## Árbol final

```text
app/frontend/src/
├── App.tsx                       # ensambla los routes de los 9 módulos + root
├── main.tsx                      # entry, providers, PWA
├── vite-env.d.ts
├── shared/
│   ├── api/
│   │   ├── client.ts
│   │   └── socket.ts
│   ├── context/
│   │   ├── AuthContext.tsx
│   │   ├── CartContext.tsx
│   │   ├── LanguageContext.tsx
│   │   ├── NotificationContext.tsx
│   │   └── ThemeContext.tsx
│   ├── hooks/
│   │   └── useSocketSubscription.ts
│   ├── routing/
│   │   └── guards.tsx
│   ├── styles/
│   │   └── index.css
│   ├── ui/
│   │   ├── AccessDenied.tsx
│   │   ├── AppDownloadNotice.tsx
│   │   ├── AppErrorBoundary.tsx
│   │   ├── BottomNav.tsx
│   │   ├── ConfirmDialog.tsx
│   │   ├── CookieConsent.tsx
│   │   ├── FeedbackHost.tsx
│   │   ├── HamburgerDrawer.tsx
│   │   ├── Icons.tsx
│   │   ├── Logo.tsx
│   │   ├── Modal.tsx
│   │   ├── Navbar.tsx
│   │   ├── NotificationBell.tsx
│   │   ├── PasswordResetModal.tsx
│   │   ├── RecommendedSuppliersGallery.tsx
│   │   ├── TermsModal.tsx
│   │   └── VehicleBadge.tsx
│   ├── utils/
│   │   ├── constants.ts
│   │   ├── feedback.ts
│   │   ├── permissions.ts
│   │   └── verification.ts
│   └── types.ts
└── modules/
    ├── identity/
    │   ├── auth/         routes.tsx + pages/{Login.tsx,Login.css,Register.tsx}
    │   ├── verification/ routes.tsx + pages/VerificationStatus.tsx
    │   ├── profile/      routes.tsx + pages/MyProfile.tsx
    │   └── team/         {routes,types}.tsx + components/ + pages/TeamManagement.tsx
    ├── public/
    │   ├── landing/      routes.tsx + hooks.ts + landingData.ts + components/ + pages/{Landing.tsx,Landing.css}
    │   ├── app-download/ routes.tsx + pages/DownloadApp.tsx
    │   └── shell/        routes.tsx (not-found) + pages/NotFound.tsx
    ├── catalog/
    │   ├── catalog/      routes.tsx + pages/Catalog.tsx
    │   ├── cart/         routes.tsx + components/SideCart.tsx + pages/CartPage.tsx
    │   ├── directory/    routes.tsx + pages/{ComercioProfile,PosiblesClientes,Suppliers}.tsx
    │   └── utils/        productImage.ts
    ├── orders/
    │   ├── routes.tsx
    │   ├── components/OrderCard.tsx
    │   └── pages/{OrderDetail,Orders}.tsx
    ├── deliveries/
    │   ├── {routes,types}.tsx
    │   ├── components/
    │   ├── pages/{Deliveries,DriverDashboard}.tsx
    │   └── utils/{geo,location,positions}.ts
    ├── finance/
    │   ├── invoicing/    routes.tsx + pages/{Accounting,Invoices}.tsx
    │   ├── payments/     routes.tsx + pages/PaymentResult.tsx
    │   └── plans/        routes.tsx + pages/Plans.tsx + utils/planAccess.ts
    ├── operations/
    │   ├── inventory/    routes.tsx + pages/Inventory.tsx
    │   ├── radar/        routes.tsx + hooks.ts + radarHelpers.ts + components/ + pages/Radar.tsx
    │   └── dashboard/    routes.tsx + pages/Dashboard.tsx
    ├── ai/
    │   ├── routes.tsx
    │   ├── components/AiFloatingWidget.tsx
    │   └── pages/AiAssistant.tsx
    └── admin/
        ├── {routes,types}.tsx
        ├── components/
        └── pages/{AuditoriaAdmin,ComerciosAdmin,PermisosAdmin,RolesAdmin,UsuariosAdmin,VerificacionesAdmin}.tsx
```

## Verificación

```bash
cd app/frontend
npm run typecheck
npm run build
```
