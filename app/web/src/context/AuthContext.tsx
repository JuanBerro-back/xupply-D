import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { api, getToken, setToken, clearToken } from '../lib/api';
import { connectSocket, disconnectSocket, getSocket } from '../lib/socket';
import { User, TenantInfo } from '../types';

export interface RegisterData {
  username: string;
  password: string;
  name: string;
  email: string;
  phone: string;
  type: 'restaurante' | 'proveedor';
  category?: string;
  nit: string;
  address: string;
  city: string;
  department?: string;
  legal_rep_name: string;
  legal_rep_document: string;
}

export interface RegisterResult {
  pending: true;
  entity_type: 'restaurante' | 'proveedor';
  name: string;
  verification_status: string;
  verification_token: string;
  message: string;
}

interface AuthContextValue {
  user: User | null;
  tenant: TenantInfo | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<RegisterResult>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>(null!);

function getDisplayName(tenant: TenantInfo | null): string {
  if (tenant && tenant.name && tenant.type !== 'platform') {
    return `${tenant.name} - Xupply`;
  }
  return 'Xupply';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api<User>('/auth/me')
      .then((u) => {
        setUser(u);
        connectSocket({ userId: u.id, role: u.role, restaurantId: u.restaurant_id, supplierId: u.supplier_id });
        return api<TenantInfo>('/auth/tenant-info');
      })
      .then((t) => {
        setTenant(t);
        document.title = getDisplayName(t);
      })
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user) return;
    const socket = getSocket();
    if (!socket) return;
    const onSessionInvalidated = (data: any) => {
      clearToken();
      disconnectSocket();
      setUser(null);
      setTenant(null);
      // Se guarda para mostrarlo tras la recarga de /login (el aviso sobrevive
      // al cambio de página, pero no a un alert bloqueante).
      sessionStorage.setItem(
        'xupply_flash',
        data?.message || 'Tu sesión fue revocada o actualizada por el administrador.'
      );
      window.location.href = '/login';
    };
    socket.on('auth:session_invalidated', onSessionInvalidated);
    return () => {
      socket.off('auth:session_invalidated', onSessionInvalidated);
    };
  }, [user]);

  const login = async (username: string, password: string) => {
    const res = await api<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    setToken(res.token);
    setUser(res.user);
    connectSocket({ userId: res.user.id, role: res.user.role, restaurantId: res.user.restaurant_id, supplierId: res.user.supplier_id });
    try {
      const t = await api<TenantInfo>('/auth/tenant-info');
      setTenant(t);
      document.title = getDisplayName(t);
    } catch {
      document.title = 'Xupply';
    }
  };

  const register = async (data: RegisterData): Promise<RegisterResult> => {
    // El registro NO inicia sesión: la cuenta queda pendiente de verificación.
    return api<RegisterResult>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  };

  const logout = () => {
    clearToken();
    disconnectSocket();
    setUser(null);
    setTenant(null);
    document.title = 'Xupply';
  };

  return (
    <AuthContext.Provider value={{ user, tenant, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
