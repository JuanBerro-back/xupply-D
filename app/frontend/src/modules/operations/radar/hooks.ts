import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../shared/api/client';
import { useAuth } from '../../../shared/context/AuthContext';
import { useNotifications } from '../../../shared/context/NotificationContext';
import { useSocketSubscription } from '../../../shared/hooks/useSocketSubscription';
import type { RadarAlert, RadarOffer, RadarShare, Supplier } from '../../../shared/types';
import { money } from './radarHelpers';

export function useRadar() {
  const { user } = useAuth();
  const { push } = useNotifications();

  const isSupplier = user?.role === 'proveedor_admin';
  const canManage = user?.role === 'admin' || user?.role === 'gerente';

  const [alerts, setAlerts] = useState<RadarAlert[]>([]);
  const [offers, setOffers] = useState<RadarOffer[]>([]);
  const [shares, setShares] = useState<RadarShare[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal: proveedor envía oferta
  const [offerAlert, setOfferAlert] = useState<RadarAlert | null>(null);
  const [offerForm, setOfferForm] = useState({ offered_qty: '', offered_price: '', eta_hours: '24', notes: '' });
  // Modal: restaurante comparte su semáforo con un proveedor
  const [shareModal, setShareModal] = useState(false);
  const [shareForm, setShareForm] = useState({ supplier_id: '', scope: 'todo', category: '', alert_on: 'critical' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    const jobs: Promise<unknown>[] = [];
    if (isSupplier) {
      jobs.push(api<RadarAlert[]>('/radar/alerts').then(setAlerts).catch(() => undefined));
      jobs.push(api<RadarOffer[]>('/radar/offers').then(setOffers).catch(() => undefined));
    } else {
      jobs.push(api<RadarOffer[]>('/radar/offers').then(setOffers).catch(() => undefined));
      if (canManage) {
        jobs.push(api<RadarShare[]>('/radar/shares').then(setShares).catch(() => undefined));
        jobs.push(api<RadarAlert[]>('/radar/my-alerts').then(setAlerts).catch(() => undefined));
        jobs.push(api<Supplier[]>('/suppliers').then(setSuppliers).catch(() => undefined));
      }
    }
    Promise.allSettled(jobs).finally(() => setLoading(false));
  }, [isSupplier, canManage]);

  useEffect(() => {
    load();
  }, [load]);

  // Tiempo real: refrescar cuando llegan alertas (proveedor) u ofertas (restaurante).
  // Los toasts los emite NotificationContext (un solo aviso por evento).
  const onAlert = () => load();
  const onOffer = () => load();
  useSocketSubscription({ 'radar:alert': onAlert, 'radar:offer': onOffer }, [load]);

  const sendOffer = async () => {
    if (!offerAlert) return;
    setBusy(true);
    try {
      await api(`/radar/alerts/${offerAlert.id}/offers`, {
        method: 'POST',
        body: JSON.stringify({
          offered_qty: Number(offerForm.offered_qty),
          offered_price: Number(offerForm.offered_price),
          eta_hours: Number(offerForm.eta_hours) || 24,
          notes: offerForm.notes || null,
        }),
      });
      push({ message: 'Oferta enviada al restaurante', at: new Date().toISOString() });
      setOfferAlert(null);
      setOfferForm({ offered_qty: '', offered_price: '', eta_hours: '24', notes: '' });
      load();
    } catch (err) {
      push({ message: (err as Error).message, at: new Date().toISOString() });
    } finally {
      setBusy(false);
    }
  };

  const respondOffer = async (offer: RadarOffer, accept: boolean) => {
    setBusy(true);
    try {
      const res = await api<{ order_code?: string; total?: number }>(
        `/radar/offers/${offer.id}/${accept ? 'accept' : 'reject'}`,
        { method: 'POST', body: JSON.stringify({}) }
      );
      push({
        message: accept
          ? `Oferta aceptada: pedido ${res.order_code} creado por ${money(res.total ?? 0)}`
          : 'Oferta rechazada',
        at: new Date().toISOString(),
      });
      load();
    } catch (err) {
      push({ message: (err as Error).message, at: new Date().toISOString() });
    } finally {
      setBusy(false);
    }
  };

  const closeAlert = async (alert: RadarAlert) => {
    try {
      await api(`/radar/alerts/${alert.id}/close`, { method: 'POST', body: JSON.stringify({}) });
      push({ message: 'Alerta cerrada', at: new Date().toISOString() });
      load();
    } catch (err) {
      push({ message: (err as Error).message, at: new Date().toISOString() });
    }
  };

  const createShare = async () => {
    setBusy(true);
    try {
      await api('/radar/shares', {
        method: 'POST',
        body: JSON.stringify({
          supplier_id: Number(shareForm.supplier_id),
          scope: shareForm.scope,
          category: shareForm.scope === 'categoria' ? shareForm.category : null,
          alert_on: shareForm.alert_on,
        }),
      });
      push({ message: 'Radar activado: ese proveedor recibirá tus alertas de stock', at: new Date().toISOString() });
      setShareModal(false);
      setShareForm({ supplier_id: '', scope: 'todo', category: '', alert_on: 'critical' });
      load();
    } catch (err) {
      push({ message: (err as Error).message, at: new Date().toISOString() });
    } finally {
      setBusy(false);
    }
  };

  const toggleShare = async (share: RadarShare) => {
    try {
      await api(`/radar/shares/${share.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: !share.is_active }),
      });
      load();
    } catch (err) {
      push({ message: (err as Error).message, at: new Date().toISOString() });
    }
  };

  return {
    isSupplier,
    canManage,
    alerts,
    offers,
    shares,
    suppliers,
    loading,
    offerAlert,
    setOfferAlert,
    offerForm,
    setOfferForm,
    shareModal,
    setShareModal,
    shareForm,
    setShareForm,
    busy,
    sendOffer,
    respondOffer,
    closeAlert,
    createShare,
    toggleShare,
  };
}

export type RadarInteractions = ReturnType<typeof useRadar>;
