/**
 * Entrada única — .env, rotas, API e SPA.
 * Produção: node server.js --production
 */
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function normalizeAppVersion(raw) {
  const v = String(raw || '').trim();
  if (!v || v === 'dev') return 'dev';
  const match = v.match(/^(v\d+(?:\.\d+)*)/i);
  return match ? match[1] : v;
}

dotenv.config({ path: path.join(__dirname, '.env'), override: false });
// backend/.env prevalece (credenciais Fulltrack, DB, etc.)
dotenv.config({ path: path.join(__dirname, 'backend', '.env'), override: true });

function readVersionFromDist() {
  const distVersionFile = path.join(__dirname, 'frontend', 'dist', 'app-version.json');
  if (!fs.existsSync(distVersionFile)) return 'dev';
  try {
    const { version } = JSON.parse(fs.readFileSync(distVersionFile, 'utf8'));
    return normalizeAppVersion(version);
  } catch {
    return 'dev';
  }
}

function resolveAppVersion() {
  const versionFile = path.join(__dirname, 'VERSION');
  if (fs.existsSync(versionFile)) {
    const fromFile = normalizeAppVersion(fs.readFileSync(versionFile, 'utf8'));
    if (fromFile !== 'dev') return fromFile;
  }

  const fromDist = readVersionFromDist();
  if (fromDist !== 'dev') return fromDist;

  try {
    return normalizeAppVersion(
      execSync('git describe --tags --abbrev=0', {
        encoding: 'utf8',
        cwd: __dirname,
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim()
    );
  } catch {
    return 'dev';
  }
}

const APP_VERSION_AT_BOOT = resolveAppVersion();

const APP_BASE_PATH = '/auditoria';
const PROD_PORT = 3007;
const DEV_PORT = 5000;
const isProd = process.argv.includes('--production');
const SERVE_WEB = isProd;
const PORT = isProd ? Number(process.env.PORT) || PROD_PORT : DEV_PORT;
const API_PREFIX = `${APP_BASE_PATH}/api`;
const STATIC_BASE = `${APP_BASE_PATH}/`;

// Local → vision_check_dev; produção sem DB_NAME → vision_check
process.env.DB_NAME = isProd
  ? String(process.env.DB_NAME || '').trim() || 'vision_check'
  : 'vision_check_dev';

for (const key of ['DB_HOST', 'DB_USER']) {
  if (!process.env[key]) {
    console.error(
      `[server] Falta ${key}. Crie .env na raiz ou use backend/.env (copie DB_* de backend/.env.example).`
    );
    process.exit(1);
  }
}
if (process.env.DB_PASS === undefined) {
  process.env.DB_PASS = '';
}

const express = (await import('express')).default;
const cors = (await import('cors')).default;
const { logger, middlewareHttpLogger, registrarHandlersGlobais, getLogDir } = await import(
  './backend/src/logger.js'
);
registrarHandlersGlobais();
const { pool } = await import('./backend/src/db.js');
const lojasRouter = (await import('./backend/src/routes/lojas.js')).default;
const usuariosRouter = (await import('./backend/src/routes/usuarios.js')).default;
const checklistRouter = (await import('./backend/src/routes/checklist.js')).default;
const visitasRouter = (await import('./backend/src/routes/visitas.js')).default;
const ncRouter = (await import('./backend/src/routes/naoConformidades.js')).default;
const dashboardRouter = (await import('./backend/src/routes/dashboard.js')).default;
const authRouter = (await import('./backend/src/routes/auth.js')).default;
const manutencaoRouter = (await import('./backend/src/routes/manutencao.js')).default;
const cargosRouter = (await import('./backend/src/routes/cargos.js')).default;
const pushRouter = (await import('./backend/src/routes/push.js')).default;
const { initPushNotifications, getVapidPublicKey, obterSaudeVapidPublica } = await import('./backend/src/pushNotifications.js');
const { gpsTecnicosConfigPublica } = await import('./backend/src/gpsTecnicos.js');
const wppRouter = (await import('./backend/src/routes/wpp.js')).default;
const frotaRouter = (await import('./backend/src/routes/frota.js')).default;
const escalaVisitasRouter = (await import('./backend/src/routes/escalaVisitas.js')).default;
const metasRouter = (await import('./backend/src/routes/metas.js')).default;
const estoqueRouter = (await import('./backend/src/routes/estoque.js')).default;
const auditoriaRouter = (await import('./backend/src/routes/auditoria.js')).default;
const freelancersAprovacaoRouter = (await import('./backend/src/routes/freelancersAprovacao.js')).default;
const sistemaRouter = (await import('./backend/src/routes/sistema.js')).default;
await import('./backend/src/cryptoMedia.js');
initPushNotifications();
const { authMiddleware } = await import('./backend/src/auth.js');
const { attachLojasUsuario } = await import('./backend/src/lojasUsuario.js');
const { attachPermissoesUsuario } = await import('./backend/src/permissoes.js');
const { middlewareAuditoriaHttp } = await import('./backend/src/auditoriaHelpers.js');

const app = express();

app.use(cors());
app.use(express.json({ limit: '80mb' }));
app.use(middlewareHttpLogger());

function garantirSchema() {
  pool
    .query('ALTER TABLE respostas ALTER COLUMN foto_url TYPE TEXT')
    .catch((e) => logger.warn('schema', e.message));
}

const api = express.Router();

api.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      ok: true,
      db: process.env.DB_NAME,
      base: APP_BASE_PATH,
      mode: isProd ? 'production' : 'development',
      api: API_PREFIX,
    });
  } catch (e) {
    logger.error('health', 'Falha no health check', { error: e.message });
    res.status(500).json({ ok: false, error: e.message });
  }
});

api.get('/public/config', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  // Em dev a tag pode mudar sem reiniciar o processo; resolve a cada request.
  const version = isProd ? APP_VERSION_AT_BOOT : resolveAppVersion();
  res.json({
    version,
    environment: isProd ? (process.env.APP_ENV || 'Production') : 'Development',
    support: {
      name: process.env.SUPPORT_NAME || 'Benson Henrique',
      phone: process.env.SUPPORT_PHONE || '+55 61 9109-4654',
      email: process.env.SUPPORT_EMAIL || 'benson.henrique@grupoalvim.com.br',
    },
    pushEnabled: Boolean(getVapidPublicKey()),
    push: obterSaudeVapidPublica(),
    ...gpsTecnicosConfigPublica(),
  });
});

api.get('/public/push/vapid-key', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  const publicKey = getVapidPublicKey();
  if (!publicKey) {
    return res.status(503).json({ error: 'Push notifications não configuradas' });
  }
  res.json({ publicKey });
});

api.get('/public/push/health', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.json(obterSaudeVapidPublica());
});

/** Log do service worker quando push chega com app fechado (sem auth). */
api.post('/public/push/sw-event', (req, res) => {
  const evento = String(req.body?.event || 'push_recebido');
  const meta = req.body?.meta && typeof req.body.meta === 'object' ? req.body.meta : {};
  logger.info('push-sw', evento, {
    ...meta,
    userAgent: req.headers['user-agent'],
  });
  res.json({ ok: true });
});

api.use('/auth', authRouter);

/** Rotas /public/* nunca exigem login (mesmo se registradas depois por engano). */
api.use((req, res, next) => {
  if (req.path === '/public' || req.path.startsWith('/public/')) {
    return res.status(404).json({ error: 'Rota pública não encontrada' });
  }
  next();
});

api.use(authMiddleware);
api.use(attachPermissoesUsuario);
api.use(middlewareAuditoriaHttp);
api.use(attachLojasUsuario);
api.use('/dashboard', dashboardRouter);
api.use('/lojas', lojasRouter);
api.use('/usuarios', usuariosRouter);
api.use('/cargos', cargosRouter);
api.use('/checklist', checklistRouter);
api.use('/visitas', visitasRouter);
api.use('/nao-conformidades', ncRouter);
api.use('/manutencao', manutencaoRouter);
api.use('/frota', frotaRouter);
api.use('/escalas/visitas', escalaVisitasRouter);
api.use('/metas', metasRouter);
api.use('/estoque', estoqueRouter);
api.use('/auditoria', auditoriaRouter);
api.use('/freelancers-aprovacao', freelancersAprovacaoRouter);
api.use('/sistema', sistemaRouter);
api.use('/push', pushRouter);
api.use('/wpp', wppRouter);

app.use(API_PREFIX, api);
app.use('/api', api);

app.use((err, req, res, _next) => {
  logger.exception('api', err, {
    method: req.method,
    url: req.originalUrl,
    userId: req.user?.sub ?? req.user?.id_usuario ?? null,
  });
  const msg = String(err.message || '');
  const erroDb =
    msg.includes('SASL') ||
    msg.includes('password authentication failed') ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('ENOTFOUND');
  if (erroDb) {
    return res.status(503).json({
      error:
        'Banco de dados indisponível. Verifique DB_PASS e se o PostgreSQL está rodando (arquivo .env na raiz).',
    });
  }
  res.status(500).json({ error: err.message || 'Erro interno' });
});

if (SERVE_WEB) {
  const dist = path.join(__dirname, 'frontend', 'dist');
  const indexHtml = path.join(dist, 'index.html');
  const swJs = path.join(dist, 'sw.js');
  const manifestWeb = path.join(dist, 'manifest.webmanifest');

  app.get(`${STATIC_BASE}sw.js`, (_req, res) => {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Service-Worker-Allowed', `${APP_BASE_PATH}/`);
    res.sendFile(swJs, (err) => {
      if (err) {
        logger.error('pwa', 'Arquivo sw.js não encontrado no build', { path: swJs });
        res.status(404).json({ error: 'Service worker não encontrado' });
      }
    });
  });

  app.get(`${STATIC_BASE}manifest.webmanifest`, (_req, res) => {
    res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.sendFile(manifestWeb, (err) => {
      if (err) res.status(404).end();
    });
  });

  app.get(APP_BASE_PATH, (_req, res) => {
    res.redirect(302, `${STATIC_BASE}login`);
  });

  app.use(
    STATIC_BASE,
    express.static(dist, {
      index: 'index.html',
      setHeaders(res, filePath) {
        if (filePath.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        } else if (filePath.endsWith('sw.js') || filePath.endsWith('manifest.webmanifest')) {
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
          res.setHeader('Service-Worker-Allowed', `${APP_BASE_PATH}/`);
        } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    })
  );

  app.get(`${APP_BASE_PATH}/*`, (req, res, next) => {
    const sub = req.path.slice(APP_BASE_PATH.length) || '/';
    if (
      sub.endsWith('.js') ||
      sub.endsWith('.css') ||
      sub.endsWith('.webmanifest') ||
      sub.endsWith('.png') ||
      sub.endsWith('.ico') ||
      sub.includes('/assets/')
    ) {
      return next();
    }
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.sendFile(indexHtml);
  });
  console.log(`[server] SPA ${STATIC_BASE} → ${dist}`);
  logger.info('server', 'SPA estática configurada', { dist, base: STATIC_BASE });
}

app.listen(PORT, async () => {
  garantirSchema();
  try {
    const { ensureCatalogoPermissoes } = await import('./backend/src/permissoes.js');
    const { initAuditoria } = await import('./backend/src/services/auditoria.js');
    await ensureCatalogoPermissoes();
    await initAuditoria();
  } catch (e) {
    logger.warn('schema', 'Catálogo de permissões / auditoria não sincronizado', { error: e.message });
  }
  const modo = isProd ? 'produção' : 'dev';
  const dbHost = process.env.DB_HOST || '?';
  const dbName = process.env.DB_NAME || '?';
  let dbStatus = '❌ Offline';
  try {
    await pool.query('SELECT 1');
    dbStatus = '✅ Online';
    logger.info('server', 'Conexão PostgreSQL OK');
  } catch (e) {
    logger.error('server', 'Falha ao conectar PostgreSQL', { error: e.message });
  }

  logger.info('server', 'API iniciada', {
    modo,
    port: PORT,
    api: API_PREFIX,
    versao: APP_VERSION_AT_BOOT,
    db: `${dbHost}/${dbName}`,
    dbStatus,
    logs: getLogDir(),
  });

  console.log(`
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║       🚀 Visão do Dono — Check / Auditoria                     ║
║                                                                ║
║    Versão: ${String(APP_VERSION_AT_BOOT).padEnd(47)}     ║
║    Modo: ${String(modo).padEnd(49)}     ║    
║    Servidor: http://localhost:${String(PORT).padEnd(33)}║
║    API: ${String(API_PREFIX).padEnd(50)}     ║
║                                                                ║
║    Banco: ${String(dbName).padEnd(48)}     ║
║    Host: ${String(dbHost).padEnd(49)}     ║
║    Status: ${String(dbStatus).padEnd(47)}    ║
║    Logs → ${String(getLogDir()).padEnd(48)}     ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
  `);

  try {
    const { fulltrackStatus } = await import('./backend/src/services/fulltrackFleet.js');
    const ft = fulltrackStatus();
    console.log(
      `[server] Fulltrack ${ft.ativo ? 'ativo' : 'inativo'}` +
        ` (api_key=${ft.tem_api_key ? 'ok' : 'ausente'}, secret=${ft.tem_secret_key ? 'ok' : 'ausente'}, url=${ft.base_url}` +
        (ft.motivo ? `, motivo=${ft.motivo}` : '') +
        ')',
    );
  } catch (e) {
    console.log(`[server] Fulltrack status indisponível: ${e.message}`);
  }
  if (String(process.env.WPP_ENABLED || '').toLowerCase() === 'true') {
    const { wppConfig } = await import('./backend/src/services/wppClient.js');
    const wpp = wppConfig();
    console.log(`[server] WhatsApp WPP_HOST=${process.env.WPP_HOST} base=${wpp.base}`);
    logger.info('server', 'WhatsApp habilitado', { host: process.env.WPP_HOST, base: wpp.base });
  }
  if (!process.env.DB_PASS) {
    logger.warn('server', 'DB_PASS vazio no .env');
    console.warn('[server] DB_PASS vazio — o PostgreSQL local exige senha. Preencha no .env e reinicie.');
  }
  if (dbStatus.includes('Online')) {
    const { iniciarMonitorSlaNotificacoes } = await import('./backend/src/services/slaNotificacoes.js');
    iniciarMonitorSlaNotificacoes();
    const { iniciarMonitorTimeCampoNotificacoes } = await import(
      './backend/src/services/timeCampoNotificacoes.js'
    );
    iniciarMonitorTimeCampoNotificacoes();
    try {
      const { iniciarSchedulerBkOffice } = await import(
        './backend/src/services/bkoffice/syncVendas.js'
      );
      iniciarSchedulerBkOffice();
    } catch (e) {
      logger.warn('server', 'Scheduler BK Office não iniciado', { error: e.message });
    }
    if (!isProd) {
      try {
        const { ensureAuthUsersSeNecessario } = await import('./backend/src/seedAuth.js');
        await ensureAuthUsersSeNecessario();
      } catch (e) {
        logger.warn('server', 'Auto-seed de usuários ignorado', { error: e.message });
        console.warn('[server] Usuários não criados automaticamente:', e.message);
      }
    }
  } else {
    console.error('[server] Falha ao conectar no PostgreSQL — ajuste DB_* no .env e reinicie npm run dev');
  }
});
