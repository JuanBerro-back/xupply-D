# syntax=docker/dockerfile:1

# ---------- Build ----------
FROM node:20-bookworm-slim AS build
WORKDIR /app

COPY app/backend/package*.json ./backend/
RUN npm ci --prefix backend --no-audit --no-fund

COPY app/frontend/package*.json ./frontend/
RUN npm ci --prefix frontend --no-audit --no-fund

COPY app/backend ./backend
COPY app/frontend ./frontend

RUN npm run build --prefix frontend && npm run build --prefix backend

# ---------- Runtime dependencies (sin devDependencies) ----------
FROM node:20-bookworm-slim AS prod-deps
WORKDIR /app
COPY app/backend/package*.json ./backend/
RUN npm ci --omit=dev --prefix backend --no-audit --no-fund

# ---------- Runtime ----------
FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=4420
WORKDIR /app

COPY --from=prod-deps /app/backend/node_modules ./backend/node_modules
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/frontend/dist ./frontend/dist
COPY --from=build /app/backend/package.json ./backend/package.json
COPY app/backend/DB ./backend/DB

# Ejecutar como usuario sin privilegios (node:node, uid/gid 1000).
USER node

EXPOSE 4420
STOPSIGNAL SIGTERM

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4420)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "backend/dist/server.js"]
