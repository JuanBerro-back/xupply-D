import Modal from './Modal';

/**
 * Modal de cambio de contraseña usado por `identity/team` y `admin`.
 * La lógica de guardado sigue en cada página (los endpoints y mensajes son
 * distintos); aquí solo se unifica el marcado y las clases.
 */
export default function PasswordResetModal({
  name,
  password,
  saving,
  dark = false,
  description = 'del usuario',
  onPasswordChange,
  onClose,
  onSubmit,
}: {
  name: string;
  password: string;
  saving: boolean;
  dark?: boolean;
  description?: string;
  onPasswordChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <Modal
      title={`Cambiar contraseña: ${name}`}
      onClose={() => {
        if (!saving) onClose();
      }}
      maxWidth="max-w-sm"
    >
      <div className="space-y-3">
        <p className={dark ? 'text-xs text-slate-600 dark:text-slate-300' : 'text-xs text-slate-600'}>
          Se cerrarán las sesiones activas {description}. Mínimo 8 caracteres.
        </p>
        <input
          type="password"
          value={password}
          onChange={(event) => onPasswordChange(event.target.value)}
          placeholder="Nueva contraseña"
          autoComplete="new-password"
          minLength={8}
          className={
            dark
              ? 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand/30 dark:border-slate-700 dark:bg-slate-800 dark:text-white'
              : 'w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30'
          }
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className={
              dark
                ? 'rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
                : 'rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50'
            }
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={saving || password.length < 8}
            className="rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white hover:bg-brand-dark disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Actualizar contraseña'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
