FROM node:22-alpine AS build
WORKDIR /app
RUN apk add --no-cache git

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

FROM node:22-alpine
WORKDIR /app

# Chromium do sistema para Playwright (BK Office / eSupri) — Alpine não traz browsers do npx playwright
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    font-noto-emoji \
    dbus \
    udev \
  && rm -rf /var/cache/apk/*

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
# Alpine chromium package — path comum (chromium-browser ou chromium)
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV CHROMIUM_PATH=/usr/bin/chromium-browser
# No container não há Chrome canal Windows nem display
ENV BKOFFICE_USE_CHROME=0
ENV BKOFFICE_HEADLESS=1
ENV ESUPRI_USE_CHROME=0

# Garante path válido (algumas versões Alpine só têm /usr/bin/chromium)
RUN if [ ! -e /usr/bin/chromium-browser ] && [ -e /usr/bin/chromium ]; then \
      ln -sf /usr/bin/chromium /usr/bin/chromium-browser; \
    fi \
 && (test -x /usr/bin/chromium-browser || test -x /usr/bin/chromium)
COPY package.json package-lock.json ./
COPY backend/package.json backend/package-lock.json ./backend/
RUN npm ci --omit=dev --ignore-scripts \
  && npm ci --prefix backend --omit=dev

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
