FROM node:22-bookworm-slim AS build
WORKDIR /app

# Só o frontend. Mudança em backend/src não recompila o Vite.
COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN npm ci --prefix frontend

COPY scripts/write-version.js ./scripts/write-version.js
COPY frontend ./frontend
RUN node scripts/write-version.js && npm run build --prefix frontend

# Tag não entra no Vite: a API lê este arquivo. Bump de tag não reconstrói o bundle.
ARG GIT_TAG=
RUN printf '%s\n' "${GIT_TAG:-dev}" > /app/VERSION

FROM node:22-bookworm-slim
WORKDIR /app

# Playwright Chromium + deps do SO (BK Office / eSupri / Detran)
# Alpine NÃO serve — browsers oficiais do Playwright são glibc.
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV BKOFFICE_USE_CHROME=0
ENV BKOFFICE_HEADLESS=1
# Sync Playwright no VPS desligado — kit PC envia por HTTPS
ENV BKOFFICE_SERVER_SYNC=0
ENV BKOFFICE_SYNC_CRON_MS=0
ENV BKOFFICE_SYNC_ID_LOJA=21
ENV ESUPRI_USE_CHROME=0
# Defina no .env do host (não commitar):
# BKOFFICE_KIT_TOKEN=...
# API_BASE=https://grupoalvim.com.br/auditoria/api

COPY package.json package-lock.json ./
COPY backend/package.json backend/package-lock.json ./backend/
RUN npm ci --omit=dev --ignore-scripts \
  && npm ci --prefix backend --omit=dev \
  && npx playwright install --with-deps chromium \
  && rm -rf /var/lib/apt/lists/*

COPY server.js ./
COPY backend/src ./backend/src
COPY backend/config ./backend/config
COPY backend/migrations ./backend/migrations
COPY backend/scripts ./backend/scripts
COPY --from=build /app/frontend/dist ./frontend/dist
COPY frontend/public/Logo_Alvim_Icone.png frontend/public/CIGA.png ./frontend/public/
COPY static/ciga ./static/ciga
COPY --from=build /app/VERSION ./VERSION
ARG GIT_TAG=
ENV APP_VERSION=${GIT_TAG}

ENV NODE_ENV=production
ENV PORT=3007
EXPOSE 3007

CMD ["node", "server.js", "--production"]
