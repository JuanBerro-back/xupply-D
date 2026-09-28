import { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { getSocket } from '../lib/socket';
import { useAuth } from './AuthContext';
import { Notification } from '../types';

interface NotificationContextValue {
  items: Notification[];
  unread: number;
  push: (n: Notification) => void;
  dismiss: (index: number) => void;
  clear: () => void;
}

const NotificationContext = createContext<NotificationContextValue>(null!);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Notification[]>([]);
  const { user } = useAuth();

  const push = useCallback((n: Notification) => {
    setItems((prev) => [{ ...n, at: n.at || new Date().toISOString() }, ...prev].slice(0, 20));
  }, []);

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !user) return;
    const onNotification = (n: Notification) => push(n);
    const onOrder = () => push({ message: 'Un pedido fue actualizado', at: new Date().toISOString() });
    const onInventory = (n: { message?: string }) =>
      push({ message: n.message ?? 'Alerta de inventario', at: new Date().toISOString() });
    const onRadarAlert = (a: { item?: string; level?: string; suggested_qty?: number; unit?: string; restaurant?: number }) =>
      push({
        message: `📡 Radar: "${a.item ?? 'insumo'}" en nivel ${a.level === 'critical' ? 'CRÍTICO' : 'BAJO'}${
          a.suggested_qty ? ` — sugieren ${a.suggested_qty}${a.unit ?? ''}` : ''
        }`,
        at: new Date().toISOString(),
      });
    const onRadarOffer = (o: { item?: string }) =>
      push({
        message: `💰 Oferta entrante en el Radar: "${o.item ?? 'insumo'}"`,
        at: new Date().toISOString(),
      });
    socket.on('notification:created', onNotification);
    socket.on('order:updated', onOrder);
    socket.on('inventory:alert', onInventory);
    socket.on('radar:alert', onRadarAlert);
    socket.on('radar:offer', onRadarOffer);
    return () => {
      socket.off('notification:created', onNotification);
      socket.off('order:updated', onOrder);
      socket.off('inventory:alert', onInventory);
      socket.off('radar:alert', onRadarAlert);
      socket.off('radar:offer', onRadarOffer);
    };
  }, [user, push]);

  const dismiss = (index: number) => setItems((prev) => prev.filter((_, i) => i !== index));
  const clear = () => setItems([]);

  return (
    <NotificationContext.Provider value={{ items, unread: items.length, push, dismiss, clear }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}