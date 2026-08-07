# Worker mínimo: só sync BK Office (Playwright) → Postgres produção
# Roda na Oracle Free (São Paulo). ARM (Ampere) ou x86.
FROM mcr.microsoft.com/playwright:v1.62.0-jammy

WORKDIR /app

ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV BKOFFICE_USE_CHROME=0
ENV BKOFFICE_HEADLESS=1
ENV SYNC_INTERVAL_MS=60000

COPY package.json package-lock.json ./
COPY backend/package.json backend/package-lock.json ./backend/
RUN npm ci --omit=dev --ignore-scripts \
  && npm ci --prefix backend --omit=dev

COPY server.js ./
COPY backend/src ./backend/src
COPY backend/scripts ./backend/scripts
COPY workers/bkoffice ./workers/bkoffice

CMD ["node", "workers/bkoffice/loop.mjs"]
