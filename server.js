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
dotenv.config({ path: path.join(__dirname, 'backend', '.env'), override: false });

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

const APP_VERSION = resolveAppVersion();

const APP_BASE_PATH = '/auditoria';
const PROD_PORT = 3007;
const DEV_PORT = 5000;
const isProd = process.argv.includes('--production');
const SERVE_WEB = isProd;
const PORT = isProd ? Number(process.env.PORT) || PROD_PORT : DEV_PORT;
const API_PREFIX = `${APP_BASE_PATH}/api`;
const STATIC_BASE = `${APP_BASE_PATH}/`;

for (const key of ['DB_HOST', 'DB_USER', 'DB_NAME']) {
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
const { initPushNotifications, getVapidPublicKey } = await import('./backend/src/pushNotifications.js');
await import('./backend/src/cryptoMedia.js');
initPushNotifications();
const { authMiddleware } = await import('./backend/src/auth.js');
const { attachLojasUsuario } = await import('./backend/src/lojasUsuario.js');
const { attachPermissoesUsuario } = await import('./backend/src/permissoes.js');

const app = express();

app.use(cors());
app.use(express.json({ limit: '80mb' }));

function garantirSchema() {
  pool
    .query('ALTER TABLE respostas ALTER COLUMN foto_url TYPE TEXT')
    .catch((e) => console.warn('[schema]', e.message));
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
    console.error('[health]', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

api.get('/public/config', (_req, res) => {
  res.json({
    version: APP_VERSION,
    environment: isProd ? (process.env.APP_ENV || 'Production') : 'Development',
    support: {
      name: process.env.SUPPORT_NAME || 'Benson Henrique',
      phone: process.env.SUPPORT_PHONE || '+55 61 9109-4654',
      email: process.env.SUPPORT_EMAIL || 'benson.henrique@grupoalvim.com.br',
    },
    pushEnabled: Boolean(getVapidPublicKey()),
  });
});

api.get('/public/push/vapid-key', (_req, res) => {
  const publicKey = getVapidPublicKey();
  if (!publicKey) {
    return res.status(503).json({ error: 'Push notifications não configuradas' });
  }
  res.json({ publicKey });
});

api.use('/auth', authRouter);

api.use(authMiddleware);
api.use(attachPermissoesUsuario);
api.use(attachLojasUsuario);
api.use('/dashboard', dashboardRouter);
api.use('/lojas', lojasRouter);
api.use('/usuarios', usuariosRouter);
api.use('/cargos', cargosRouter);
api.use('/checklist', checklistRouter);
api.use('/visitas', visitasRouter);
api.use('/nao-conformidades', ncRouter);
api.use('/manutencao', manutencaoRouter);
api.use('/push', pushRouter);

app.use(API_PREFIX, api);
app.use('/api', api);

app.use((err, _req, res, _next) => {
  console.error('[API]', err.message);
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
        } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    })
  );

  app.get(`${APP_BASE_PATH}/*`, (_req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.sendFile(indexHtml);
  });
  console.log(`[server] SPA ${STATIC_BASE} → ${dist}`);
}

app.listen(PORT, async () => {
  garantirSchema();
  console.log(`[server] ${isProd ? 'produção' : 'dev'} — :${PORT}${API_PREFIX}`);
  console.log(`[server] versão ${APP_VERSION}`);
  console.log(`[server] DB ${process.env.DB_HOST}/${process.env.DB_NAME}`);
  if (!process.env.DB_PASS) {
    console.warn('[server] DB_PASS vazio — o PostgreSQL local exige senha. Preencha no .env e reinicie.');
  }
  try {
    await pool.query('SELECT 1');
    console.log('[server] Conexão com PostgreSQL OK');
  } catch (e) {
    console.error('[server] Falha ao conectar no PostgreSQL:', e.message);
    console.error('[server] Ajuste DB_PASS no .env (senha do usuário postgres) e reinicie npm run dev');
  }
});
