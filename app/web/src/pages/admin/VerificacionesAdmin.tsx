import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, getApiOrigin, getToken } from '../../lib/api';
import Modal from '../../components/Modal';
import {
  VerificationDetail,
  VerificationDocumentMeta,
  VerificationRequestSummary,
  VerificationStatus,
} from '../../types';
import {
  VERIFICATION_DOC_LABELS,
  VERIFICATION_STATUS_META,
  formatBytes,
} from '../../lib/verification';

const TABS: Array<{ key: VerificationStatus | 'todas'; label: string }> = [
  { key: 'pendiente', label: 'Pendientes' },
  { key: 'subsanacion', label: 'Correcciones' },
  { key: 'rechazado', label: 'Rechazadas' },
  { key: 'verificado', label: 'Verificadas' },
  { key: 'todas', label: 'Todas' },
];

const DOC_ORDER = ['rut', 'camara_comercio', 'cedula_representante'];

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
}

function daysWaiting(value?: string | null): string {
  if (!value) return '';
  const diff = Date.now() - new Date(value).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days <= 0) {
    const hours = Math.max(1, Math.floor(diff / 3_600_000));
    return `${hours} h`;
  }
  return `${days} d`;
}

function entityLabel(kind: string): string {
  return kind === 'restaurante' ? 'Restaurante' : 'Proveedor';
}

export default function VerificacionesAdmin() {
  const [tab, setTab] = useState<VerificationStatus | 'todas'>('pendiente');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<VerificationRequestSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');

  const [selected, setSelected] = useState<VerificationRequestSummary | null>(null);
  const [detail, setDetail] = useState<VerificationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  const [reason, setReason] = useState('');
  const [pendingDecision, setPendingDecision] = useState<'aprobar' | 'rechazar' | 'subsanar' | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  const [note, setNote] = useState('');
  const [preview, setPreview] = useState<{ url: string; mime: string; name: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewUrlRef = useRef<string | null>(null);

  const loadSummary = useCallback(async () => {
    try {
      const data = await api<Record<string, number>>('/verification/summary');
      setSummary(data);
    } catch {
      /* el listado ya muestra el error principal */
    }
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    setListError('');
    try {
      const params = new URLSearchParams({ status: tab, limit: '60' });
      if (query.trim()) params.set('q', query.trim());
      const data = await api<{ items: VerificationRequestSummary[]; total: number }>(
        `/verification/requests?${params.toString()}`
      );
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      setListError((err as Error).message || 'No se pudieron cargar las solicitudes.');
    } finally {
      setLoading(false);
    }
  }, [tab, query]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    const timer = setTimeout(() => void loadList(), query ? 300 : 0);
    return () => clearTimeout(timer);
  }, [loadList, query]);

  const openDetail = async (request: VerificationRequestSummary) => {
    setSelected(request);
    setDetail(null);
    setDetailError('');
    setReason('');
    setPendingDecision(null);
    setNotice('');
    setNote('');
    closePreview();
    setDetailLoading(true);
    try {
      const data = await api<VerificationDetail>(
        `/verification/requests/${request.entity_type}/${request.id}`
      );
      setDetail(data);
      setReason(data.entity.verification_reason ?? '');
    } catch (err) {
      setDetailError((err as Error).message || 'No se pudo abrir el expediente.');
    } finally {
      setDetailLoading(false);
    }
  };

  const refreshAll = async () => {
    await Promise.all([loadSummary(), loadList()]);
    if (selected) {
      try {
        const data = await api<VerificationDetail>(
          `/verification/requests/${selected.entity_type}/${selected.id}`
        );
        setDetail(data);
      } catch {
        /* se conserva el detalle actual */
      }
    }
  };

  const closePreview = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreview(null);
  };

  const loadPreview = async (kind: string, id: number, doc: VerificationDocumentMeta) => {
    setPreviewLoading(true);
    setDetailError('');
    try {
      const token = getToken();
      const res = await fetch(
        `${getApiOrigin()}/api/verification/requests/${kind}/${id}/documents/${doc.doc_type}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      if (!res.ok) throw new Error('No se pudo abrir el documento');
      const blob = await res.blob();
      closePreview();
      const url = URL.createObjectURL(blob);
      previewUrlRef.current = url;
      setPreview({ url, mime: doc.mime_type, name: doc.file_name });
    } catch (err) {
      setDetailError((err as Error).message || 'No se pudo abrir el documento.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const submitDecision = async () => {
    if (!selected || !pendingDecision) return;
    if (pendingDecision !== 'aprobar' && reason.trim().length < 5) {
      setDetailError('Explica el motivo (mínimo 5 caracteres).');
      return;
    }
    setSaving(true);
    setDetailError('');
    try {
      await api(`/verification/requests/${selected.entity_type}/${selected.id}/decision`, {
        method: 'POST',
        body: JSON.stringify({ decision: pendingDecision, reason: reason.trim() }),
      });
      setNotice(
        pendingDecision === 'aprobar'
          ? 'Cuenta aprobada: ya puede iniciar sesión.'
          : pendingDecision === 'rechazar'
          ? 'Solicitud rechazada y solicitante notificado.'
          : 'Corrección solicitada y solicitante notificado.'
      );
      setPendingDecision(null);
      await refreshAll();
    } catch (err) {
      setDetailError((err as Error).message || 'No se pudo guardar la decisión.');
    } finally {
      setSaving(false);
    }
  };

  const addNote = async () => {
    if (!selected || note.trim().length < 2) return;
    setSaving(true);
    setDetailError('');
    try {
      await api(`/verification/requests/${selected.entity_type}/${selected.id}/notes`, {
        method: 'POST',
        body: JSON.stringify({ note: note.trim() }),
      });
      setNote('');
      const data = await api<VerificationDetail>(
        `/verification/requests/${selected.entity_type}/${selected.id}`
      );
      setDetail(data);
    } catch (err) {
      setDetailError((err as Error).message || 'No se pudo guardar la nota.');
    } finally {
      setSaving(false);
    }
  };

  const status = detail?.entity.verification_status ?? selected?.verification_status ?? 'pendiente';
  const canDecide = status !== 'verificado';
  const docsByType = useMemo(() => {
    const map = new Map<string, VerificationDocumentMeta>();
    for (const doc of detail?.documents ?? []) map.set(doc.doc_type, doc);
    return map;
  }, [detail]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Verificación de cuentas</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Back office para validar que restaurantes y proveedores existan legalmente antes de operar.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refreshAll()}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Actualizar
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(['pendiente', 'subsanacion', 'verificado', 'rechazado'] as VerificationStatus[]).map((key) => {
          const meta = VERIFICATION_STATUS_META[key];
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`rounded-2xl border p-3 text-left transition ${
                tab === key
                  ? 'border-brand bg-brand/5 ring-1 ring-brand/30 dark:bg-brand/10'
                  : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {meta.label}
                </span>
              </div>
              <p className="mt-1 text-xl font-black text-slate-900 dark:text-white">{summary[key] ?? 0}</p>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-1 flex-wrap items-center gap-1.5">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition ${
                tab === item.key
                  ? 'bg-brand text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar por nombre, NIT o correo…"
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 transition focus:outline-none focus:ring-2 focus:ring-brand/30 dark:border-slate-700 dark:bg-slate-800 dark:text-white sm:w-72"
        />
      </div>

      {listError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          {listError}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 dark:border-slate-800">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Solicitudes ({total})
          </p>
          <p className="text-[11px] text-slate-400">Haz clic en una fila para revisar el expediente</p>
        </div>

        {loading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="h-14 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">No hay solicitudes en este estado.</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {query ? 'Prueba con otra búsqueda.' : 'Cuando alguien se registre aparecerá aquí.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-2 font-bold">Empresa</th>
                  <th className="px-4 py-2 font-bold">Tipo</th>
                  <th className="px-4 py-2 font-bold">NIT</th>
                  <th className="px-4 py-2 font-bold">Documentos</th>
                  <th className="px-4 py-2 font-bold">Enviada</th>
                  <th className="px-4 py-2 font-bold">Espera</th>
                  <th className="px-4 py-2 font-bold">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {items.map((item) => {
                  const meta = VERIFICATION_STATUS_META[item.verification_status];
                  return (
                    <tr
                      key={`${item.entity_type}-${item.id}`}
                      onClick={() => void openDetail(item)}
                      className="cursor-pointer transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    >
                      <td className="px-4 py-2.5">
                        <p className="font-bold text-slate-900 dark:text-white">{item.name}</p>
                        <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                          {item.email || 'Sin correo'} · {item.city || 'Sin ciudad'}
                        </p>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{entityLabel(item.entity_type)}</td>
                      <td className="px-4 py-2.5 font-mono text-[11px] text-slate-700 dark:text-slate-200">
                        {item.nit || '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            item.documents >= 3
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
                          }`}
                        >
                          {item.documents}/3
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">
                        {formatDate(item.submitted_at || item.created_at)}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">
                        {item.verification_status === 'verificado' ? '—' : daysWaiting(item.submitted_at || item.created_at)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${meta.badge}`}>
                          {meta.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <Modal
          title={`${entityLabel(selected.entity_type)} · ${selected.name}`}
          onClose={() => {
            setSelected(null);
            setDetail(null);
            closePreview();
          }}
          maxWidth="max-w-4xl"
        >
          {detailLoading ? (
            <div className="space-y-3">
              <div className="h-6 w-1/2 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
              <div className="h-24 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
              <div className="h-24 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
            </div>
          ) : detailError && !detail ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
              {detailError}
            </p>
          ) : detail ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    NIT {detail.entity.nit || '—'} · {detail.entity.city || '—'} ·{' '}
                    {detail.entity.category || 'Sin categoría'}
                  </p>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                    Dirección: {detail.entity.address || '—'}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Representante: {detail.entity.legal_rep_name || '—'} · CC {detail.entity.legal_rep_document || '—'}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Contacto: {detail.entity.email || '—'} · {detail.entity.phone || '—'}
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${VERIFICATION_STATUS_META[status].badge}`}>
                  {VERIFICATION_STATUS_META[status].label}
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                <span
                  className={`rounded-lg px-2 py-1 text-[10px] font-bold ${
                    detail.checks.nit_valid
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                      : 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'
                  }`}
                >
                  {detail.checks.nit_valid ? 'NIT con DV válido' : 'NIT inválido'}
                </span>
                <span
                  className={`rounded-lg px-2 py-1 text-[10px] font-bold ${
                    detail.checks.documents_complete
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
                  }`}
                >
                  {detail.checks.documents_complete ? 'Expediente completo' : `Faltan ${detail.missing.length} documento(s)`}
                </span>
                {detail.checks.nit_duplicate_other_type && (
                  <span className="rounded-lg bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                    NIT repetido en otro tipo de cuenta
                  </span>
                )}
                {detail.checks.email_duplicate_count > 0 && (
                  <span className="rounded-lg bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                    Correo en {detail.checks.email_duplicate_count} registro(s) más
                  </span>
                )}
              </div>

              {detail.entity.verification_reason && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                  <span className="font-bold">Última observación: </span>
                  {detail.entity.verification_reason}
                </div>
              )}

              {/* Expediente */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-700">
                <p className="border-b border-slate-100 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  Documentos
                </p>
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {DOC_ORDER.map((docType) => {
                    const doc = docsByType.get(docType);
                    return (
                      <li key={docType} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                            {VERIFICATION_DOC_LABELS[docType] || docType}
                          </p>
                          <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                            {doc ? `${doc.file_name} · ${formatBytes(doc.size_bytes)} · ${formatDate(doc.uploaded_at)}` : 'No cargado'}
                          </p>
                        </div>
                        {doc && (
                          <button
                            type="button"
                            onClick={() => void loadPreview(detail.entity_type, detail.entity.id, doc)}
                            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                          >
                            {previewLoading ? 'Abriendo…' : 'Ver'}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>

                {preview && (
                  <div className="border-t border-slate-100 p-3 dark:border-slate-800">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="truncate text-[11px] font-semibold text-slate-600 dark:text-slate-300">{preview.name}</p>
                      <button
                        type="button"
                        onClick={closePreview}
                        className="text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                      >
                        Cerrar vista
                      </button>
                    </div>
                    {preview.mime === 'application/pdf' ? (
                      <iframe title="Documento" src={preview.url} className="h-80 w-full rounded-lg border border-slate-200 dark:border-slate-700" />
                    ) : (
                      <img
                        src={preview.url}
                        alt={preview.name}
                        className="max-h-80 w-full rounded-lg border border-slate-200 object-contain dark:border-slate-700"
                      />
                    )}
                  </div>
                )}
              </div>

              {/* Solicitantes */}
              <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Usuarios de la cuenta
                </p>
                <ul className="mt-1.5 space-y-1">
                  {detail.users.map((user) => (
                    <li key={user.id} className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        {user.name} · @{user.username}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400">
                        {user.email || 'sin correo'} · {user.is_active ? 'activo' : 'bloqueado'}
                      </span>
                    </li>
                  ))}
                  {detail.users.length === 0 && (
                    <li className="text-[11px] text-slate-500 dark:text-slate-400">Sin usuarios asociados.</li>
                  )}
                </ul>
              </div>

              {/* Historial */}
              <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Historial
                </p>
                <ul className="mt-1.5 space-y-1.5">
                  {detail.events.map((event) => (
                    <li key={event.id} className="text-[11px] text-slate-600 dark:text-slate-300">
                      <span className="font-bold text-slate-800 dark:text-slate-100">{event.action}</span>
                      {event.status_to ? ` → ${event.status_to}` : ''}
                      {event.reason ? ` · ${event.reason}` : ''}
                      <span className="text-slate-400">
                        {' '}
                        · {event.actor_name || 'sistema'} · {formatDate(event.created_at)}
                      </span>
                    </li>
                  ))}
                  {detail.events.length === 0 && (
                    <li className="text-[11px] text-slate-500 dark:text-slate-400">Sin movimientos todavía.</li>
                  )}
                </ul>
              </div>

              {/* Decisión */}
              {canDecide && (
                <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Decisión de verificación
                  </p>
                  <textarea
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    rows={2}
                    placeholder="Motivo u observaciones (obligatorio al rechazar o pedir correcciones)…"
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                  />

                  {pendingDecision ? (
                    <div className="mt-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs dark:border-amber-500/40 dark:bg-amber-500/10">
                      <p className="font-bold text-amber-900 dark:text-amber-200">
                        {pendingDecision === 'aprobar'
                          ? '¿Confirmas la aprobación? La cuenta podrá iniciar sesión de inmediato.'
                          : pendingDecision === 'rechazar'
                          ? '¿Confirmas el rechazo? El solicitante recibirá el motivo por correo.'
                          : '¿Confirmas solicitar correcciones? El solicitante recibirá el enlace para volver a cargar documentos.'}
                      </p>
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => void submitDecision()}
                          disabled={saving}
                          className={`rounded-xl px-3 py-2 text-xs font-bold text-white transition disabled:opacity-60 ${
                            pendingDecision === 'aprobar'
                              ? 'bg-emerald-600 hover:bg-emerald-700'
                              : pendingDecision === 'rechazar'
                              ? 'bg-rose-600 hover:bg-rose-700'
                              : 'bg-amber-600 hover:bg-amber-700'
                          }`}
                        >
                          {saving ? 'Guardando…' : 'Confirmar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDecision(null)}
                          disabled={saving}
                          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <button
                        type="button"
                        onClick={() => setPendingDecision('aprobar')}
                        disabled={!detail.checks.documents_complete}
                        className="rounded-xl bg-emerald-600 py-2 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                        title={detail.checks.documents_complete ? 'Aprobar cuenta' : 'Faltan documentos'}
                      >
                        Aprobar
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDecision('subsanar')}
                        className="rounded-xl bg-amber-600 py-2 text-xs font-bold text-white transition hover:bg-amber-700"
                      >
                        Pedir corrección
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDecision('rechazar')}
                        className="rounded-xl bg-rose-600 py-2 text-xs font-bold text-white transition hover:bg-rose-700"
                      >
                        Rechazar
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Nota interna */}
              <div className="rounded-xl border border-dashed border-slate-300 p-3 dark:border-slate-700">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Nota interna (no se envía al solicitante)
                </p>
                <div className="mt-2 flex gap-2">
                  <input
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="ej. Llamé al representante y confirmó el RUT"
                    className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => void addNote()}
                    disabled={saving || note.trim().length < 2}
                    className="rounded-xl bg-slate-800 px-3 py-2 text-xs font-bold text-white transition hover:bg-slate-900 disabled:opacity-50 dark:bg-slate-700 dark:hover:bg-slate-600"
                  >
                    Guardar
                  </button>
                </div>
              </div>

              {notice && (
                <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                  {notice}
                </p>
              )}
              {detailError && detail && (
                <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
                  {detailError}
                </p>
              )}
            </div>
          ) : null}
        </Modal>
      )}
    </div>
  );
}
