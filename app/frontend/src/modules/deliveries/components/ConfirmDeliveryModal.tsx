import Modal from '../../../shared/ui/Modal';

export default function ConfirmDeliveryModal({
  orderCode,
  code,
  onCodeChange,
  onConfirm,
  onClose,
}: {
  orderCode: string;
  code: string;
  onCodeChange: (value: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal title={`Confirmar Entrega ${orderCode}`} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-xs text-slate-600">
          Solicita al cliente/restaurante el <b>código de confirmación de 4 dígitos</b> generado para este pedido:
        </p>
        <div>
          <label className="mb-1 block text-sm font-medium">Código de confirmación:</label>
          <input
            type="text"
            maxLength={4}
            value={code}
            onChange={(e) => onCodeChange(e.target.value)}
            placeholder="Ej: 4821"
            className="w-full rounded-xl border px-3 py-2 text-center text-xl font-mono tracking-widest font-bold"
            required
          />
        </div>
        <button
          onClick={onConfirm}
          disabled={code.length < 4}
          className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          Validar y Finalizar Entrega
        </button>
      </div>
    </Modal>
  );
}
