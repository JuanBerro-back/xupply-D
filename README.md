# Xupply

Plataforma B2B para la digitalizacion de restaurantes y empresas distribuidoras de la region metropolitana de Bucaramanga: catalogo mayorista, pedidos con seguimiento GPS en tiempo real, facturacion electronica, inventario, contabilidad e inteligencia artificial.

## Modulos

- **Catálogo mayorista**: categorias, productos y proveedores recomendados segun tu cocina.
- **Pedidos B2B**: carrito, ordenes, facturas y seguimiento en vivo de entregas (GPS satelital y asignacion vehicular).
- **Inventario y contabilidad**: control de stock, reportes de flujo de caja y facturacion electronica.
- **Asistente Xupply IA**: copiloto sobre food cost, compras mayoristas y logistica de entrega (disponible segun el plan).
- **Planes de suscripción**: basico, medio y premium (Xupply Lite, Pro y Max).
- **Roles**: admin, gerente, empleado, proveedor y domiciliario.
- **Multiplataforma**: PWA instalable, app Android (Capacitor) y aplicacion de escritorio (Electron).

## Estructura

```
app/
  server/   Backend Express + PostgreSQL + Socket.IO (TypeScript)
  web/      Frontend React + Vite + Tailwind (TypeScript, PWA)
  web/android/  Proyecto Android Capacitor (com.xupply.app)
  main.js   Proceso principal Electron (app de escritorio)
  scripts/  Instalacion y provision local (PostgreSQL)
xupply_schema_postgresql.sql  Esquema de base de datos
```

## Requisitos

- Node.js 20+ (desarrollo)
- PostgreSQL 16 o 18 (desarrollo)
- Docker + Docker Compose (produccion opcional)

## Puesta en marcha (desarrollo)

```bash
# Backend
cd app/server
npm install
cp .env.example .env
npm run dev          # http://localhost:4000

# Frontend
cd app/web
npm install
npm run dev          # http://localhost:5173
```

Crea la base `xupply` y aplica el esquema `app/server/DB/xupply_schema_postgresql.sql`.

### Usuarios de prueba

Usuarios demo (contrasena: `demo1234`): `admin`, `gerente`, `empleado`, `proveedor`, `domiciliario`.

## Modo portatil (Windows, sin instalar nada)

Copia la carpeta `XupplyPortable` a una unidad local y ejecuta `Iniciar-Xupply.cmd`. Levanta PostgreSQL, carga el esquema y abre la ventana de Electron. Ve `LEER-YA.txt` para detalles.

## Despliegue

- **Render**: sigue `RENDER.md` (`render.yaml` crea el servicio web `xupply` y la base `xupply-db`).
- **DigitalOcean**: sigue `DIGITALOCEAN.md` (Docker Compose + Caddy con HTTPS automatico).
- **APK**: usa `build-apk.ps1` (compila con Capacitor y deja `Xupply.apk` en `app/web/public`).

## Variables de entorno

Espejo en `.env.production.example` y `app/server/.env.example`:

| Variable        | Descripcion                                   |
| --------------- | --------------------------------------------- |
| `DOMAIN`        | Dominio de produccion (Caddy).                |
| `POSTGRES_DB`   | Nombre de la base de datos (`xupply`).        |
| `POSTGRES_USER` | Usuario de base de datos.                     |
| `POSTGRES_PASSWORD` | Contrasena de base de datos.              |
| `DATABASE_URL`  | Cadena de conexion PostgreSQL.                |
| `JWT_SECRET`    | Secreto para tokens.                          |
| `CLIENT_ORIGIN` | Origen permitido (CORS) para la PWA/Socket.IO.|

## Verificacion de salud

El endpoint `/health` responde `{"status":"ok","service":"xupply-api"}`.

---

Documentacion adicional: `RENDER.md`, `DIGITALOCEAN.md`, `app/LEER-ESCRITORIO.md` y `LEER-YA.txt`.