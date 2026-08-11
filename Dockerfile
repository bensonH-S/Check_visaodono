FROM node:22-bookworm-slim AS build
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY backend/package.json backend/package-lock.json ./backend/
COPY frontend/package.json frontend/package-lock.json ./frontend/

# postinstall da raiz usa scripts/ — ainda não copiado; deps já instaladas nos 3 workspaces abaixo
RUN npm ci --ignore-scripts \
  && npm ci --prefix backend \
  && npm ci --prefix frontend

COPY . .
ARG GIT_TAG=
ENV GIT_TAG=${GIT_TAG}
RUN npm run build:web

FROM node:22-bookworm-slim
WORKDIR /app

# Playwright Chromium + deps do SO (BK Office / eSupri / Detran)
# Alpine NÃO serve — browsers oficiais do Playwright são glibc.
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV BKOFFICE_USE_CHROME=0
ENV BKOFFICE_HEADLESS=1
ENV BKOFFICE_SERVER_SYNC=1
ENV BKOFFICE_SYNC_CRON_MS=60000
ENV BKOFFICE_SYNC_ID_LOJA=21
ENV ESUPRI_USE_CHROME=0

COPY package.json package-lock.json ./
COPY backend/package.json backend/package-lock.json ./backend/
RUN npm ci --omit=dev --ignore-scripts \
  && npm ci --prefix backend --omit=dev \
  && npx playwright install --with-deps chromium \
  && rm -rf /var/lib/apt/lists/*

COPY server.js ./
COPY backend/src ./backend/src
COPY backend/migrations ./backend/migrations
COPY backend/scripts ./backend/scripts
COPY --from=build /app/frontend/dist ./frontend/dist
COPY static/ciga ./static/ciga
COPY --from=build /app/VERSION ./VERSION

ENV NODE_ENV=production
ENV PORT=3007
EXPOSE 3007

CMD ["node", "server.js", "--production"]
