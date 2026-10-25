import { useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, RegisterData, RegisterResult } from '../context/AuthContext';
import { IconFood, IconTruck } from '../components/Icons';
import {
  MAX_DOC_BYTES,
  VERIFICATION_DOCS,
  VERIFICATION_DOC_LABELS,
  VerificationDocType,
  uploadVerificationDocument,
} from '../lib/verification';

const RESTAURANT_CATEGORIES = [
  { value: 'postres', label: 'Postres, Heladería & Pastelería' },
  { value: 'brunch', label: 'Brunch, Café & Panadería Artesanal' },
  { value: 'bbq', label: 'BBQ, Carnes & Parrilla' },
  { value: 'asiatico', label: 'Asiático (Sushi, Ramen, Wok)' },
  { value: 'latino', label: 'Latino & Comida Colombiana / Típica' },
  { value: 'hamburguesas', label: 'Hamburguesas, Alitas & Fast Food' },
  { value: 'pizzeria', label: 'Pizzería & Cocina Italiana' },
  { value: 'saludable', label: 'Saludable, Bowls & Vegano' },
];

type FormState = RegisterData;

const empty: FormState = {
  username: '',
  password: '',
  name: '',
  email: '',
  phone: '',
  type: 'restaurante',
  category: 'latino',
  nit: '',
  address: '',
  city: 'Bucaramanga',
  department: 'Santander',
  legal_rep_name: '',
  legal_rep_document: '',
};

const STEPS = ['Empresa', 'Representante', 'Documentos'];

const inputClass =
  'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 transition focus:outline-none focus:ring-2 focus:ring-brand/30 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white';
const labelClass = 'mb-1 block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(empty);
  const [docs, setDocs] = useState<Partial<Record<VerificationDocType, File>>>({});
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [uploadWarning, setUploadWarning] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<RegisterResult | null>(null);
  const [copied, setCopied] = useState(false);
  const firstFieldRef = useRef<HTMLInputElement | null>(null);

  const set = (key: keyof FormState) => (e: { target: { value: string } }) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const statusLink = useMemo(
    () => (result ? `${window.location.origin}/verificacion/${result.verification_token}` : ''),
    [result]
  );

  const validateStep = (current: number): string => {
    if (current === 0) {
      if (!form.name.trim()) return 'Escribe la razón social o nombre del negocio.';
      if (!/^\d{9,15}$/.test(form.nit.replace(/[.\s-]/g, ''))) {
        return 'El NIT debe tener entre 9 y 15 dígitos (incluye el dígito de verificación).';
      }
      if (!form.address.trim()) return 'La dirección de la empresa es obligatoria.';
      if (!form.city.trim()) return 'La ciudad es obligatoria.';
      if (!/^\d{7,10}$/.test(form.phone.replace(/\D/g, ''))) {
        return 'Escribe un teléfono de contacto válido.';
      }
    }
    if (current === 1) {
      if (!/^[a-z0-9._-]{3,40}$/.test(form.username.trim().toLowerCase())) {
        return 'El usuario debe tener entre 3 y 40 caracteres: minúsculas, números, punto, guion o guion bajo.';
      }
      if (form.password.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) {
        return 'El correo corporativo es obligatorio y debe ser válido.';
      }
      if (!form.legal_rep_name.trim()) return 'Escribe el nombre del representante legal.';
      if (!/^\d{6,12}$/.test(form.legal_rep_document.replace(/[.\s]/g, ''))) {
        return 'La cédula del representante legal no es válida.';
      }
    }
    if (current === 2) {
      const missing = VERIFICATION_DOCS.filter((doc) => !docs[doc]);
      if (missing.length) {
        return `Adjunta: ${missing.map((doc) => VERIFICATION_DOC_LABELS[doc]).join(', ')}.`;
      }
    }
    return '';
  };

  const next = () => {
    const message = validateStep(step);
    if (message) {
      setError(message);
      return;
    }
    setError('');
    setStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  };

  const back = () => {
    setError('');
    setStep((prev) => Math.max(prev - 1, 0));
  };

  const pickDoc = (doc: VerificationDocType) => (e: { target: { files?: FileList | null } }) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_DOC_BYTES) {
      setError(`${VERIFICATION_DOC_LABELS[doc]}: el archivo supera 3 MB.`);
      return;
    }
    setError('');
    setDocs((prev) => ({ ...prev, [doc]: file }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    for (let index = 0; index < STEPS.length; index++) {
      const message = validateStep(index);
      if (message) {
        setStep(index);
        setError(message);
        return;
      }
    }

    setError('');
    setUploadWarning('');
    setLoading(true);
    let created: RegisterResult | null = null;
    try {
      created = await register({
        ...form,
        name: form.name.trim(),
        username: form.username.trim().toLowerCase(),
        email: form.email.trim(),
        nit: form.nit.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        category: form.type === 'restaurante' ? form.category || 'latino' : undefined,
      });

      // Los documentos se envían uno por uno para no superar el límite del API.
      const failures: string[] = [];
      for (let index = 0; index < VERIFICATION_DOCS.length; index++) {
        const doc = VERIFICATION_DOCS[index];
        const file = docs[doc];
        if (!file) continue;
        setProgress(`Subiendo ${VERIFICATION_DOC_LABELS[doc]} (${index + 1}/${VERIFICATION_DOCS.length})…`);
        try {
          await uploadVerificationDocument(created.verification_token, doc, file);
        } catch (uploadErr) {
          failures.push(`${VERIFICATION_DOC_LABELS[doc]}: ${(uploadErr as Error).message}`);
        }
      }
      if (failures.length) {
        setUploadWarning(
          `Tu cuenta quedó creada, pero estos documentos no se pudieron cargar: ${failures.join(
            ' · '
          )}. Puedes subirlos desde el enlace de seguimiento.`
        );
      }
      setResult(created);
    } catch (err) {
      setError((err as Error).message || 'No se pudo completar el registro.');
      if (created) setResult(created);
    } finally {
      setLoading(false);
      setProgress('');
    }
  };

  const copyLink = async () => {
    if (!statusLink || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(statusLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* sin permiso de portapapeles */
    }
  };

  if (result) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-4 py-10 dark:bg-[#0b1120]">
        <div className="absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full bg-amber-300/30 blur-[120px] dark:bg-amber-500/10" />
        <div className="absolute -bottom-40 -right-40 h-[600px] w-[600px] rounded-full bg-emerald-300/30 blur-[120px] dark:bg-emerald-500/10" />
        <div className="relative z-10 w-full max-w-lg rounded-3xl border border-white/50 bg-white/85 p-8 text-center shadow-2xl backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/85">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
            <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l2 2m6-2a8 8 0 11-16 0 8 8 0 0116 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Registro en revisión</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Recibimos la solicitud de <strong>{result.name}</strong>. Un verificador revisará el RUT, la Cámara de
            Comercio y la cédula del representante legal.
          </p>

          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            <p className="font-bold">Mientras la cuenta esté en revisión no podrás iniciar sesión.</p>
            <p className="mt-1">Te avisaremos por correo cuando esté aprobada o si necesitamos correcciones.</p>
          </div>

          {uploadWarning && (
            <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-left text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
              {uploadWarning}
            </div>
          )}

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-left dark:border-slate-700 dark:bg-slate-800/60">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Enlace de seguimiento
            </p>
            <p className="mt-1 break-all font-mono text-[11px] text-slate-700 dark:text-slate-200">{statusLink}</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={copyLink}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
              >
                {copied ? 'Copiado' : 'Copiar enlace'}
              </button>
              <button
                type="button"
                onClick={() => navigate(`/verificacion/${result.verification_token}`)}
                className="rounded-xl bg-brand px-3 py-2 text-xs font-bold text-white transition hover:bg-brand-dark"
              >
                Ver estado
              </button>
            </div>
          </div>

          <p className="mt-5 text-[11px] text-slate-500 dark:text-slate-400">
            Guarda este enlace: también lo enviamos al correo {form.email}.
          </p>
          <Link to="/login" className="mt-4 inline-block text-xs font-bold text-brand hover:underline">
            Volver al inicio de sesión
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-4 py-8 dark:bg-[#0b1120]">
      <div className="pointer-events-none absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full bg-sky-400/30 blur-[120px] dark:bg-sky-500/10" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-[600px] w-[600px] rounded-full bg-emerald-400/30 blur-[120px] dark:bg-emerald-500/10" />

      <div className="relative z-10 w-full max-w-2xl rounded-3xl border border-white/50 bg-white/85 p-6 shadow-2xl backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/85 sm:p-8">
        <div className="mb-5 text-center">
          <div className="mb-2 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-2xl font-black text-brand">
            Z
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Crear cuenta Xupply</h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Registro con verificación de empresa: RUT, Cámara de Comercio y cédula del representante.
          </p>
        </div>

        {/* Progreso */}
        <ol className="mb-5 grid grid-cols-3 gap-2">
          {STEPS.map((label, index) => (
            <li key={label} className="flex items-center gap-2">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-black ${
                  index < step
                    ? 'bg-emerald-500 text-white'
                    : index === step
                    ? 'bg-brand text-white'
                    : 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                }`}
              >
                {index < step ? '✓' : index + 1}
              </span>
              <span
                className={`truncate text-[11px] font-bold ${
                  index === step ? 'text-slate-900 dark:text-white' : 'text-slate-400'
                }`}
              >
                {label}
              </span>
            </li>
          ))}
        </ol>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
            <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          {step === 0 && (
            <>
              <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1.5 dark:bg-slate-800/50">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, type: 'restaurante' })}
                  className={`flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-bold transition ${
                    form.type === 'restaurante'
                      ? 'bg-white text-brand shadow-sm dark:bg-slate-700'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  <IconFood className="h-4 w-4" />
                  <span>Restaurante</span>
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, type: 'proveedor' })}
                  className={`flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-bold transition ${
                    form.type === 'proveedor'
                      ? 'bg-white text-emerald-600 shadow-sm dark:bg-slate-700'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  <IconTruck className="h-4 w-4" />
                  <span>Proveedor</span>
                </button>
              </div>

              <div>
                <label className={labelClass}>
                  {form.type === 'restaurante' ? 'Razón social del restaurante *' : 'Razón social del proveedor *'}
                </label>
                <input
                  ref={firstFieldRef}
                  value={form.name}
                  onChange={set('name')}
                  placeholder={form.type === 'restaurante' ? 'ej. Burger & Co. S.A.S.' : 'ej. Distribuidora del Oriente S.A.S.'}
                  className={inputClass}
                  required
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>NIT con dígito de verificación *</label>
                  <input
                    value={form.nit}
                    onChange={set('nit')}
                    placeholder="900.123.456-7"
                    inputMode="numeric"
                    className={inputClass}
                    required
                  />
                  <p className="mt-1 text-[10px] text-slate-400">Se valida el dígito de verificación antes de crear la cuenta.</p>
                </div>
                <div>
                  <label className={labelClass}>Teléfono de la empresa *</label>
                  <input
                    value={form.phone}
                    onChange={set('phone')}
                    placeholder="315 123 4567"
                    inputMode="tel"
                    className={inputClass}
                    required
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Dirección de la empresa *</label>
                <input
                  value={form.address}
                  onChange={set('address')}
                  placeholder="Cra 27 #45-32, Cabecera"
                  className={inputClass}
                  required
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Ciudad *</label>
                  <input value={form.city} onChange={set('city')} className={inputClass} required />
                </div>
                <div>
                  <label className={labelClass}>Departamento</label>
                  <input value={form.department} onChange={set('department')} className={inputClass} />
                </div>
              </div>

              {form.type === 'restaurante' && (
                <div className="space-y-2 rounded-2xl border border-brand/20 bg-brand/5 p-4 dark:border-brand/30 dark:bg-brand/10">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-brand-dark dark:text-brand-light">
                    Clasificación gastronómica *
                  </label>
                  <p className="text-[11px] leading-tight text-slate-500 dark:text-slate-400">
                    Según tus platos principales te recomendaremos proveedores mayoristas.
                  </p>
                  <select
                    value={form.category}
                    onChange={set('category')}
                    className="w-full rounded-xl border border-brand/30 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand/40 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white"
                  >
                    {RESTAURANT_CATEGORIES.map((category) => (
                      <option key={category.value} value={category.value}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}

          {step === 1 && (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Nombre del representante legal *</label>
                  <input
                    value={form.legal_rep_name}
                    onChange={set('legal_rep_name')}
                    placeholder="Nombre completo"
                    className={inputClass}
                    required
                  />
                </div>
                <div>
                  <label className={labelClass}>Cédula del representante *</label>
                  <input
                    value={form.legal_rep_document}
                    onChange={set('legal_rep_document')}
                    placeholder="1.098.765.432"
                    inputMode="numeric"
                    className={inputClass}
                    required
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                La cédula debe corresponder al representante legal que figura en el certificado de Cámara de Comercio.
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Usuario de acceso *</label>
                  <input
                    value={form.username}
                    onChange={set('username')}
                    placeholder="ej. gerencia_local"
                    autoComplete="username"
                    className={inputClass}
                    required
                  />
                </div>
                <div>
                  <label className={labelClass}>Contraseña *</label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={set('password')}
                    placeholder="Mínimo 8 caracteres"
                    autoComplete="new-password"
                    className={inputClass}
                    required
                    minLength={8}
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Correo corporativo *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={set('email')}
                  placeholder="contacto@negocio.com"
                  autoComplete="email"
                  className={inputClass}
                  required
                />
                <p className="mt-1 text-[10px] text-slate-400">
                  Aquí recibirás el enlace de seguimiento y la decisión de verificación.
                </p>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                <p className="font-bold">Documentos obligatorios</p>
                <p className="mt-0.5">
                  PDF, JPG o PNG · máximo 3 MB por archivo. Los revisa una persona del equipo de verificación.
                </p>
              </div>

              <div className="space-y-3">
                {VERIFICATION_DOCS.map((doc) => {
                  const file = docs[doc];
                  return (
                    <div
                      key={doc}
                      className={`rounded-2xl border p-3 ${
                        file
                          ? 'border-emerald-300 bg-emerald-50/60 dark:border-emerald-500/40 dark:bg-emerald-500/10'
                          : 'border-dashed border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                            {VERIFICATION_DOC_LABELS[doc]} *
                          </p>
                          <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                            {file ? `${file.name} · ${(file.size / 1024).toFixed(0)} KB` : 'Sin adjuntar'}
                          </p>
                        </div>
                        <label className="shrink-0 cursor-pointer rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200">
                          {file ? 'Cambiar' : 'Adjuntar'}
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                            className="hidden"
                            onChange={pickDoc(doc)}
                          />
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                Al enviar el registro aceptas que Xupply verifique la información con las autoridades y entidades
                competentes. Los documentos se almacenan cifrados en tránsito y solo los consulta el equipo de
                verificación.
              </div>
            </>
          )}

          <div className="flex items-center gap-2 pt-1">
            {step > 0 && (
              <button
                type="button"
                onClick={back}
                disabled={loading}
                className="rounded-2xl border border-slate-300 px-4 py-3 text-xs font-bold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Atrás
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={next}
                className="flex-1 rounded-2xl bg-brand py-3 text-sm font-bold text-white shadow-md shadow-brand/20 transition hover:bg-brand-dark active:scale-[0.99]"
              >
                Continuar
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading}
                className="flex-1 rounded-2xl bg-brand py-3 text-sm font-bold text-white shadow-md shadow-brand/20 transition hover:bg-brand-dark active:scale-[0.99] disabled:opacity-60"
              >
                {loading ? progress || 'Enviando registro…' : 'Enviar a verificación'}
              </button>
            )}
          </div>
        </form>

        <p className="mt-5 text-center text-xs text-slate-500">
          ¿Ya tienes cuenta en Xupply?{' '}
          <Link to="/login" className="font-bold text-brand hover:underline">
            Inicia sesión aquí
          </Link>
        </p>
      </div>
    </div>
  );
}
