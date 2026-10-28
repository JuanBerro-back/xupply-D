# Acceso al entorno real (admin y verificador)

Xupply no guarda contraseñas en el repositorio. El administrador real se crea
desde las variables `ADMIN_USERNAME` / `ADMIN_PASSWORD` de Vercel, y el resto de
cuentas desde el panel. Si no tienes esa contraseña, este procedimiento la
restablece sin exponerla en el código.

## 1. Obtener la cadena de conexión

`DATABASE_URL` está en:

- **Vercel** → proyecto `xupply-d` → Settings → Environment Variables → `DATABASE_URL`
- o en **Neon** → proyecto → Connection details.

Es un secreto: no la pegues en issues, chats ni commits.

## 2. Listar administradores y verificadores

Desde `app/server`:

```powershell
$env:DATABASE_URL = "postgresql://..."   # solo en esta terminal
npm run admin:credentials -- --list
```

Muestra usuario, rol, estado y último login. No muestra hashes.

> Alternativa: crea `app/server/.env` con `DATABASE_URL=...` (ya está ignorado
> por git). No lo subas al repositorio.

## 3. Restablecer o crear un administrador

```powershell
# Genera una contraseña aleatoria y la muestra una sola vez
npm run admin:credentials -- --username=admin --generate --yes

# O define una contraseña propia (mínimo 12 caracteres)
npm run admin:credentials -- --username=admin --password="TuClaveLarga123" --yes
```

Si el usuario existe, actualiza contraseña, rol y lo reactiva; además invalida
sus sesiones anteriores. Si no existe, lo crea como cuenta de plataforma (sin
restaurante ni proveedor).

## 4. Crear el verificador del back office

```powershell
npm run admin:credentials -- --username=revisor --role=verificador --generate --yes
```

Entra en `https://xupply-d.vercel.app/login` y el sistema abrirá directamente
`/admin/verificaciones`.

## 5. Crear cuentas de restaurante o proveedor

El script solo gestiona cuentas de plataforma. Para restaurantes/proveedores:

1. Inicia sesión como admin.
2. **Usuarios → Nuevo usuario**, elige el rol y asigna restaurante o proveedor.
3. O usa el registro público: la cuenta queda pendiente hasta que un verificador
   apruebe RUT, Cámara de Comercio y cédula.

## Notas de seguridad

- Nunca actives `SEED_DEMO_DATA=true` en producción: las cuentas demo
  (`demo1234`) quedan bloqueadas automáticamente.
- Rota la contraseña después de usarla en una sesión compartida.
- El script requiere `--yes` para escribir y muestra el host de la base antes de
  hacer cambios.
- Si el rol `verificador` no existe, arranca el servidor una vez para que corra
  la migración (o aplica `ensureVerificationSchema`).
