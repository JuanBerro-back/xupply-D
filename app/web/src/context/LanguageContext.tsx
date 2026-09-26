import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Language = 'es' | 'en';

const DICTIONARY: Record<Language, Record<string, string>> = {
  es: {
    // Nav & General
    'nav.dashboard': 'Panel de control',
    'nav.catalog': 'Proveedores',
    'nav.orders': 'Restaurantes',
    'nav.cart': 'Carrito',
    'nav.deliveries': 'Mapa GPS & Rutas',
    'nav.inventory': 'Inventario (ROP)',
    'nav.team': 'Equipo',
    'nav.suppliers': 'Proveedores',
    'nav.plans': 'Planes Xupply',
    'nav.ai': 'Asistente IA',
    'nav.invoices': 'Facturación DIAN',
    'nav.accounting': 'Contabilidad PEPS',
    'nav.menu': 'Menú',
    'nav.logout': 'Cerrar Sesión',
    'nav.dropdown_dashboard': 'Dashboard',
    'nav.full_drawer': 'Menú Lateral',
    'nav.notifications': 'Notificaciones',
    'nav_notifications': 'Notificaciones',

    // Themes & Accessibility
    'theme.dark': 'Modo Oscuro',
    'theme.light': 'Modo Claro',
    'theme.high_contrast': 'Alto Contraste',
    'theme.normal_contrast': 'Contraste Estándar',
    'lang.label': 'Idioma',
    'lang.es': 'Español',
    'lang.en': 'English',

    // Roles
    'role.gerente': 'Gerente Restaurante',
    'role.proveedor_admin': 'Proveedor Mayorista',
    'role.domiciliario': 'Domiciliario / Conductor',
    'role.empleado': 'Empleado Operativo',
    'role.admin': 'Administrador',

    // Dashboard Hub
    'hub.title': 'Centro de Módulos & Panel',
    'hub.subtitle': 'Accede rápidamente a todos los módulos autorizados para tu rol.',
    'hub.hide': 'Ocultar Módulos',
    'hub.show': 'Ver Todos los Módulos',
    'hub.active_modules': 'Módulos Activos',
    'hub.collapse': 'Contraer Panel',
    'hub.quick_actions': 'Acciones Rápidas',
    'hub.new_order': 'Nueva Orden',
    'hub.view_orders': 'Ver Pedidos',
    'hub.security_key': 'Llave de Seguridad',
    'hub.telemetry_active': 'GPS Activo y Transmitiendo',

    // AI
    'ai.title': 'Xupply IA',
    'ai.subtitle': 'Asistente gastronómico y logístico 24/7',
    'ai.welcome': 'Hola, soy Xupply IA. ¿En qué te puedo asesorar hoy?',
    'ai.placeholder': 'Escribe tu pregunta aquí...',
    'ai.send': 'Enviar',

    // Settings
    'settings.title': 'Configuración & Sistema',
    'settings.profile': 'Ajustes de Perfil',
    'settings.alerts': 'Preferencias de Alertas',
    'settings.terms': 'Términos y Condiciones',
  },
  en: {
    // Nav & General
    'nav.dashboard': 'Home / Dashboard',
    'nav.catalog': 'Suppliers',
    'nav.orders': 'Restaurants',
    'nav.cart': 'Cart',
    'nav.deliveries': 'GPS Map & Routes',
    'nav.inventory': 'Inventory (ROP)',
    'nav.team': 'Team',
    'nav.suppliers': 'Suppliers',
    'nav.plans': 'Xupply Plans',
    'nav.ai': 'AI Assistant',
    'nav.invoices': 'DIAN Invoicing',
    'nav.accounting': 'FIFO Accounting',
    'nav.menu': 'Menu',
    'nav.logout': 'Sign Out',
    'nav.dropdown_dashboard': 'Dashboard',
    'nav.full_drawer': 'Side Drawer',
    'nav.notifications': 'Notifications',
    'nav_notifications': 'Notifications',

    // Themes & Accessibility
    'theme.dark': 'Dark Mode',
    'theme.light': 'Light Mode',
    'theme.high_contrast': 'High Contrast',
    'theme.normal_contrast': 'Standard Contrast',
    'lang.label': 'Language',
    'lang.es': 'Spanish',
    'lang.en': 'English',

    // Roles
    'role.gerente': 'Restaurant Manager',
    'role.proveedor_admin': 'Wholesale Supplier',
    'role.domiciliario': 'Courier / Driver',
    'role.empleado': 'Staff Member',
    'role.admin': 'Administrator',

    // Dashboard Hub
    'hub.title': 'Modules & Control Center',
    'hub.subtitle': 'Quick access to all authorized modules for your role.',
    'hub.hide': 'Hide Modules',
    'hub.show': 'Show All Modules',
    'hub.active_modules': 'Active Modules',
    'hub.collapse': 'Collapse Hub',
    'hub.quick_actions': 'Quick Actions',
    'hub.new_order': 'New Order',
    'hub.view_orders': 'View Orders',
    'hub.security_key': 'Security Handover Key',
    'hub.telemetry_active': 'GPS Active & Streaming',

    // AI
    'ai.title': 'Xupply AI',
    'ai.subtitle': '24/7 Foodservice & logistics copilot',
    'ai.welcome': 'Hello, I am Xupply AI. How can I help you today?',
    'ai.placeholder': 'Type your question here...',
    'ai.send': 'Send',

    // Settings
    'settings.title': 'Settings & System',
    'settings.profile': 'Profile Settings',
    'settings.alerts': 'Alert Preferences',
    'settings.terms': 'Terms and Conditions',
  },
};

interface LanguageContextType {
  lang: Language;
  toggleLanguage: () => void;
  setLanguage: (l: Language) => void;
  t: (key: string, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Language>(() => {
    if (typeof window === 'undefined') return 'es';
    const saved = localStorage.getItem('xupply_lang');
    if (saved === 'en' || saved === 'es') return saved;
    return 'es';
  });

  useEffect(() => {
    localStorage.setItem('xupply_lang', lang);
    document.documentElement.lang = lang;
  }, [lang]);

  const toggleLanguage = () => {
    setLang((prev) => (prev === 'es' ? 'en' : 'es'));
  };

  const setLanguage = (newLang: Language) => {
    setLang(newLang);
  };

  const t = (key: string, fallback?: string): string => {
    const dict = DICTIONARY[lang] || DICTIONARY.es;
    return dict[key] || fallback || key;
  };

  return (
    <LanguageContext.Provider value={{ lang, toggleLanguage, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage debe usarse dentro de un LanguageProvider');
  }
  return context;
}
