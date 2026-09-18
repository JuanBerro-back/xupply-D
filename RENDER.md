# Publicar Xupply en Render

1. Sube esta carpeta a un repositorio privado de GitHub.
2. En Render selecciona **New > Blueprint** y conecta el repositorio.
3. Render detectara `render.yaml` y creara el servicio web `xupply` y PostgreSQL `xupply-db`.
4. Cuando el servicio este creado, abre **Shell** en el servicio web y ejecuta:

```bash
psql "$DATABASE_URL" -f server/DB/xupply_schema_postgresql.sql
```

5. Espera a que `/health` responda `{"status":"ok","service":"xupply-api"}`.
6. Abre la URL HTTPS de Render en Chrome desde el telefono e instala Xupply desde el menu del navegador.

## Variables

`DATABASE_URL` y `JWT_SECRET` las genera Render. `CLIENT_ORIGIN=*` permite que la PWA y Socket.IO funcionen durante la primera publicacion. Cuando tengas un dominio fijo, cambia esa variable por la URL exacta de la aplicacion.

## GPS

El navegador pedira permiso de ubicacion al usuario domiciliario. El backend debe permanecer accesible por HTTPS y la entrega debe estar asignada para que se envien las coordenadas.
