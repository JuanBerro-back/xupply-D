# syntax=docker/dockerfile:1

# ---------- Build ----------
FROM node:20-bookworm-slim AS build
WORKDIR /app

COPY app/server/package*.json ./server/
RUN npm ci --prefix server --no-audit --no-fund

COPY app/web/package*.json ./web/
RUN npm ci --prefix web --no-audit --no-fund

COPY app/server ./server
COPY app/web ./web

RUN npm run build --prefix web && npm run build --prefix server

# ---------- Runtime dependencies (sin devDependencies) ----------
FROM node:20-bookworm-slim AS prod-deps
WORKDIR /app
COPY app/server/package*.json ./server/
RUN npm ci --omit=dev --prefix server --no-audit --no-fund

# ---------- Runtime ----------
FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=4420
WORKDIR /app

COPY --from=prod-deps /app/server/node_modules ./server/node_modules
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/web/dist ./web/dist
COPY --from=build /app/server/package.json ./server/package.json
COPY app/server/DB ./server/DB

# Ejecutar como usuario sin privilegios (node:node, uid/gid 1000).
USER node

EXPOSE 4420
STOPSIGNAL SIGTERM

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4420)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/dist/server.js"]
