import { Router } from 'express';
import { authRequired, roleRequired } from '../../../shared/middleware/auth';
import { consumoHistorico, ultimoPedido, catalogoPrecios, proveedoresVigentes } from './agent.controller';

const router = Router();
router.use(authRequired);

router.get('/consumo-historico', roleRequired('gerente', 'admin'), consumoHistorico);
router.get('/ultimo-pedido', roleRequired('gerente', 'admin'), ultimoPedido);
router.get('/catalogo-precios', roleRequired('gerente', 'admin'), catalogoPrecios);
router.get('/proveedores-vigentes', roleRequired('gerente', 'admin'), proveedoresVigentes);

export default router;
