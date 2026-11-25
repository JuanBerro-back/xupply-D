import { DependencyList, useEffect } from 'react';
import { getSocket } from '../api/socket';

type SocketHandler = (...args: any[]) => void;

/**
 * Suscribe handlers al socket global y los da de baja al desmontar.
 * `deps` sustituye a las dependencias del useEffect original de cada pantalla,
 * de modo que el alta/baja y el cierre de la sesión se conservan.
 */
export function useSocketSubscription(handlers: Record<string, SocketHandler>, deps: DependencyList): void {
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const entries = Object.entries(handlers);
    for (const [event, handler] of entries) socket.on(event, handler);

    return () => {
      for (const [event, handler] of entries) socket.off(event, handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
