FROM node:20-bookworm-slim AS build
WORKDIR /app

COPY app/server/package*.json ./server/
RUN npm ci --prefix server
COPY app/web/package*.json ./web/
RUN npm ci --prefix web

COPY app/server ./server
COPY app/web ./web
RUN npm run build --prefix web && npm run build --prefix server

FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/server/package*.json ./server/
COPY --from=build /app/server/node_modules ./server/node_modules
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/web/dist ./web/dist
COPY app/server/DB ./server/DB

EXPOSE 4420
CMD ["node", "server/dist/server.js"]
