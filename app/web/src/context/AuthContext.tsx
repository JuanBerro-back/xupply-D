import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { api, getToken, setToken, clearToken } from '../lib/api';
import { connectSocket, disconnectSocket } from '../lib/socket';
import { User, TenantInfo } from '../types';

export interface RegisterData {
  username: string;
  password: string;
  name: string;
  email: string;
  phone: string;
  type: 'restaurante' | 'proveedor';
  category?: string;
}

interface AuthContextValue {
  user: User | null;
  tenant: TenantInfo | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
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
        connectSocket({ userId: u.id, restaurantId: u.restaurant_id, supplierId: u.supplier_id });
        return api<TenantInfo>('/auth/tenant-info');
      })
      .then((t) => {
        setTenant(t);
        document.title = getDisplayName(t);
      })
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  const login = async (username: string, password: string) => {
    const res = await api<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    setToken(res.token);
    setUser(res.user);
    connectSocket({ userId: res.user.id, restaurantId: res.user.restaurant_id, supplierId: res.user.supplier_id });
    try {
      const t = await api<TenantInfo>('/auth/tenant-info');
      setTenant(t);
      document.title = getDisplayName(t);
    } catch {
      document.title = 'Xupply';
    }
  };

  const register = async (data: RegisterData) => {
    const res = await api<{ token: string; user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    setToken(res.token);
    setUser(res.user);
    connectSocket({ userId: res.user.id, restaurantId: res.user.restaurant_id, supplierId: res.user.supplier_id });
    try {
      const t = await api<TenantInfo>('/auth/tenant-info');
      setTenant(t);
      document.title = getDisplayName(t);
    } catch {
      document.title = 'Xupply';
    }
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
