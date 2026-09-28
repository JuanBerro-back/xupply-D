import Modal from './Modal';

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TermsModal({ isOpen, onClose }: TermsModalProps) {
  if (!isOpen) return null;

  return (
    <Modal title="Términos y Condiciones de Xupply B2B" onClose={onClose}>
      <div className="max-h-[65vh] overflow-y-auto pr-2 space-y-4 text-xs text-slate-600 leading-relaxed dark:text-slate-300">
        <div className="rounded-xl bg-sky-50 border border-sky-100 p-3 text-sky-900 dark:bg-sky-950/40 dark:border-sky-800 dark:text-sky-200">
          <p className="font-bold text-sm mb-1">Ecosistema Logístico y Plataforma Gastronómica B2B</p>
          <p>
            Vigente a partir de Septiembre 2026. Al utilizar Xupply como restaurante, proveedor o domiciliario, aceptas
            los siguientes términos de operación y comercio electrónico.
          </p>
        </div>

        <div>
          <h4 className="font-bold text-slate-800 text-sm mb-1 dark:text-white">1. Objeto y Alcance de la Plataforma</h4>
          <p>
            Xupply es una plataforma tecnológica que facilita la digitalización, compraventa mayorista de insumos
            alimentarios, monitoreo logístico y costeo gastronómico entre restaurantes y proveedores autorizados.
          </p>
        </div>

        <div>
          <h4 className="font-bold text-slate-800 text-sm mb-1 dark:text-white">2. Protocolo de Entrega y Llave de Seguridad</h4>
          <p>
            Para garantizar la autenticidad e integridad en la entrega de materias primas, cada despacho cuenta con una
            <b> Llave de Seguridad (código único de 4 dígitos)</b> portada por el domiciliario. La entrega se considera
            oficialmente recibida y aceptada a conformidad cuando el gerente del restaurante ingresa dicha llave en el
            sistema Xupply.
          </p>
        </div>

        <div>
          <h4 className="font-bold text-slate-800 text-sm mb-1 dark:text-white">3. Jerarquía y Manejo de Equipos</h4>
          <p>
            Los gerentes de restaurantes son responsables exclusivos del personal operativo (empleados) asignados a su
            establecimiento. Los proveedores asumen la coordinación y veracidad de datos de sus conductores y flota de
            reparto vehicular.
          </p>
        </div>

        <div>
          <h4 className="font-bold text-slate-800 text-sm mb-1 dark:text-white">4. Planes de Suscripción y Facturación</h4>
          <p>
            Los planes de suscripción (Básico, Medio y Premium) otorgan acceso escalonado a módulos de inteligencia
            artificial, contabilidad, reportes predictivos y soporte prioritario. Los cargos y facturación se generan de
            acuerdo a la tarifa vigente seleccionada.
          </p>
        </div>

        <div>
          <h4 className="font-bold text-slate-800 text-sm mb-1 dark:text-white">5. Privacidad y Seguridad de Datos</h4>
          <p>
            Xupply resguarda la información confidencial de clientes, recetas, precios pactados y geolocalización en
            estricto cumplimiento de la normativa de protección de datos personales (Ley 1581 de Colombia).
          </p>
        </div>

        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-brand hover:bg-brand-dark text-white font-bold px-4 py-2 text-xs transition cursor-pointer shadow-sm"
          >
            Entendido y Aceptar
          </button>
        </div>
      </div>
    </Modal>
  );
}
