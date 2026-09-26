# Scripts de Utilidad

Este directorio contiene scripts para mantenimiento, pruebas y validación del backend.

## Smoke Test (`smoke.ts`)

Verifica la integridad de las reglas de acceso (RBAC), escritura administrativa y transiciones contables (facturas).

### ⚠️ Advertencia de Seguridad
**NO EJECUTAR CONTRA BASES DE DATOS EN PRODUCCIÓN.**
El script **crea y borra** datos transaccionales, y si se activa el flag de facturas, insertará `accounting_transactions` (si existieran disparadores) lo cual ensucia los libros contables reales.
Por seguridad, el script abortará la ejecución si detecta que la URL no está definida o si la base de datos contiene la palabra `prod`.

### Uso
Usa `npm run smoke` desde el directorio `app/server/`.

```bash
cd app/server
npm run smoke                                  # Corre solo matriz de permisos
SMOKE_ALLOW_INVOICES=1 npm run smoke           # Agrega la matriz de facturas
SMOKE_PASSWORD='...' npm run smoke             # Si la contraseña demo no es la por defecto
```
