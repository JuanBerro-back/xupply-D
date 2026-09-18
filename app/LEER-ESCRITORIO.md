# Xupply Escritorio

Aplicacion de escritorio (Electron) de Xupply: Backend Express + PostgreSQL + interfaz React en una sola ventana.

## Requisitos
- Node.js instalado.
- PostgreSQL 18 instalado y corriendo en el puerto 5432.

## Instalar

Abre una PowerShell en esta carpeta y ejecuta:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\setup.ps1
```

Configura la contrasena local mediante `XUPPLY_DB_PASSWORD` antes de ejecutar `Iniciar-Xupply.ps1`.

## Usar

Haz doble clic en el acceso directo de Xupply o ejecuta `npm start`.

Usuarios demo: `admin`, `gerente`, `empleado`, `proveedor`, `domiciliario`.

## Configuracion

La conexion de desarrollo se configura en `server\.env`, archivo que no debe subirse al repositorio. Usa `server\.env.example` como plantilla.

```env
PORT=4420
DATABASE_URL=postgres://usuario:contrasena@localhost:5432/xupply
JWT_SECRET=cambia-este-secreto
```

## Estructura

- `main.js`: proceso principal Electron.
- `server/`: backend Express.
- `web/`: interfaz React, PWA y proyecto Android Capacitor.
- `scripts/`: instalacion y provision local.
