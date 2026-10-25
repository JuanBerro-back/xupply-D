import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { PublicVerification } from '../types';
import {
  MAX_DOC_BYTES,
  VERIFICATION_DOC_LABELS,
  VERIFICATION_STATUS_META,
  VerificationDocType,
  formatBytes,
  uploadVerificationDocument,
} from '../lib/verification';

export default function VerificationStatus() {
  const { token = '' } = useParams();
  const [data, setData] = useState<PublicVerification | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const result = await api<PublicVerification>(`/verification/public/${token}`);
      setData(result);
    } catch (err) {
      setError((err as Error).message || 'No se pudo consultar el estado.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const uploadedByType = useMemo(() => {
    const map = new Map<string, { file_name: string; size_bytes: number; uploaded_at: string }>();
    for (const doc of data?.documents ?? []) map.set(doc.doc_type, doc);
    return map;
  }, [data]);

  const upload = async (docType: VerificationDocType, file: File) => {
    if (!data) return;
    if (file.size > MAX_DOC_BYTES) {
      setError(`${VERIFICATION_DOC_LABELS[docType]}: el archivo supera 3 MB.`);
      return;
    }
    setError('');
    setNotice('');
    setUploading(docType);
    try {
      await uploadVerificationDocument(token, docType, file);
      setNotice(`${VERIFICATION_DOC_LABELS[docType]} cargado correctamente.`);
      await load();
    } catch (err) {
      setError((err as Error).message || 'No se pudo cargar el documento.');
    } finally {
      setUploading('');
    }
  };

  const submitCorrections = async () => {
    setSubmitting(true);
    setError('');
    setNotice('');
    try {
      await api(`/verification/public/${token}/submit`, { method: 'POST' });
      setNotice('Expediente reenviado. Un verificador lo revisará de nuevo.');
      await load();
    } catch (err) {
      setError((err as Error).message || 'No se pudo reenviar el expediente.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm font-semibold text-slate-500">Consultando tu registro…</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="rounded-3xl border border-rose-200 bg-white p-8 shadow-sm dark:border-rose-500/30 dark:bg-slate-900">
          <h1 className="text-xl font-black text-slate-900 dark:text-white">Enlace no válido</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{error}</p>
          <Link to="/login" className="mt-6 inline-block rounded-xl bg-brand px-5 py-2.5 text-xs font-bold text-white hover:bg-brand-dark">
            Ir al inicio de sesión
          </Link>
        </div>
      </div>
    );
  }

  if (!data) return null;
  const meta = VERIFICATION_STATUS_META[data.status];
  const canUpload = data.can_upload;
  const uploadedCount = data.documents.length;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Registro de {data.entity_type}
            </p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900 dark:text-white">{data.name}</h1>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              NIT {data.nit || '—'} · {data.city || '—'}
            </p>
          </div>
          <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${meta.badge}`}>{meta.label}</span>
        </div>

        <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">{meta.description}</p>

        {data.reason && (
          <div
            className={`mt-4 rounded-2xl border p-4 text-sm ${
              data.status === 'rechazado'
                ? 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200'
                : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200'
            }`}
          >
            <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">Observación del verificador</p>
            <p className="mt-1 whitespace-pre-line">{data.reason}</p>
          </div>
        )}

        <div className="mt-5 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Expediente ({uploadedCount}/3)
            </p>
            {canUpload && (
              <span className="text-[10px] font-semibold text-slate-400">Puedes reemplazar un documento cuando quieras</span>
            )}
          </div>

          <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
            {data.required_documents.map((doc) => {
              const uploaded = uploadedByType.get(doc.type);
              return (
                <li key={doc.type} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{doc.label}</p>
                    <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                      {uploaded
                        ? `${uploaded.file_name} · ${formatBytes(uploaded.size_bytes)}`
                        : 'Pendiente por cargar'}
                    </p>
                  </div>
                  {uploaded ? (
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                      Cargado
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                      Falta
                    </span>
                  )}

                  {canUpload && (
                    <label className="cursor-pointer rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
                      {uploading === doc.type ? 'Subiendo…' : uploaded ? 'Reemplazar' : 'Adjuntar'}
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                        className="hidden"
                        disabled={Boolean(uploading)}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          event.currentTarget.value = '';
                          if (file) void upload(doc.type as VerificationDocType, file);
                        }}
                      />
                    </label>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {data.can_submit && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-3 dark:border-sky-500/30 dark:bg-sky-500/10">
            <div>
              <p className="text-xs font-bold text-sky-900 dark:text-sky-200">Documentos corregidos</p>
              <p className="text-[11px] text-sky-700 dark:text-sky-300">
                Envía el expediente para que vuelva a la cola de revisión.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void submitCorrections()}
              disabled={submitting}
              className="rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-sky-700 disabled:opacity-60"
            >
              {submitting ? 'Enviando…' : 'Enviar a revisión'}
            </button>
          </div>
        )}

        {notice && (
          <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
            {notice}
          </p>
        )}
        {error && (
          <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <span>Solicitud enviada: {new Date(data.submitted_at || data.created_at).toLocaleString('es-CO')}</span>
          <Link to="/login" className="font-bold text-brand hover:underline">
            Ir al inicio de sesión
          </Link>
        </div>
      </div>

      <p className="mt-4 text-center text-[11px] text-slate-400">
        ¿Necesitas ayuda? Responde al correo de verificación de Xupply indicando tu NIT {data.nit}.
      </p>
    </div>
  );
}
