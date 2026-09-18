# Build do wppconnect-server (WhatsApp API) para o Vision Check.
# Clona o oficial e aplica os patches do Alvim (QR/logout, pn-lid, lib 2.x).
FROM node:22-alpine AS build
WORKDIR /usr/src/wpp-server

RUN apk add --no-cache \
    git \
    chromium \
    vips \
    vips-dev \
    fftw-dev \
    gcc \
    g++ \
    make \
    python3 \
    libc6-compat \
    pkgconfig

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV YARN_ENABLE_IMMUTABLE_INSTALLS=false

RUN git clone --depth 1 https://github.com/wppconnect-team/wppconnect-server.git .
COPY patches /tmp/wpp-patches
RUN git apply --whitespace=nowarn /tmp/wpp-patches/*.patch

RUN corepack enable && corepack prepare yarn@4.14.1 --activate
RUN yarn install
RUN yarn build

FROM node:22-alpine AS runtime
WORKDIR /usr/src/wpp-server

RUN apk add --no-cache chromium vips fftw

COPY --from=build /usr/src/wpp-server/dist ./dist
COPY --from=build /usr/src/wpp-server/node_modules ./node_modules
COPY --from=build /usr/src/wpp-server/package.json ./package.json

ENV NODE_ENV=production
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
COPY config.runtime.js ./dist/config.js
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh
EXPOSE 21465

ENTRYPOINT ["./entrypoint.sh"]
