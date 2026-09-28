# Desplegar Xupply en DigitalOcean

## 1. Crear el Droplet

- Ubuntu 24.04 LTS
- Plan minimo recomendado: 2 GB RAM
- Agrega una clave SSH
- En el firewall permite TCP 22, 80 y 443

Asocia un dominio al IP del Droplet con un registro `A`, por ejemplo:

```text
xupply.midominio.com -> IP_DEL_DROPLET
```

## 2. Instalar Docker

Conectado por SSH:

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
exit
```

Vuelve a entrar por SSH después del `exit`.

## 3. Descargar el proyecto

```bash
git clone https://github.com/JuanBerro-back/xupply-D.git
cd xupply-D
cp .env.production.example .env.production
nano .env.production
```

Cambia `DOMAIN`, `POSTGRES_PASSWORD` y `JWT_SECRET` por valores propios. `CLIENT_ORIGIN` debe coincidir con `https://DOMAIN`.

## 4. Iniciar

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f app
```

Caddy solicita el certificado HTTPS automáticamente cuando el dominio ya apunta al Droplet y los puertos 80/443 están abiertos.

## 5. Probar

Abre en el navegador:

```text
https://tu-dominio.com/health
```

Debe responder:

```json
{"status":"ok","service":"xupply-api"}
```

Luego abre `https://tu-dominio.com` desde Chrome en el celular e instala la PWA.

## Base de datos

El esquema se aplica automáticamente solo cuando el volumen `postgres_data` se crea por primera vez. No ejecutes comandos destructivos en producción; el volumen contiene los pedidos.
