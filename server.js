/**
 * Entrada única — .env, rotas, API e SPA.
 * Produção: node server.js --production
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.join(__dirname, '.env'), override: false });
dotenv.config({ path: path.join(__dirname, 'backend', '.env'), override: false });

const APP_BASE_PATH = '/auditoria';
const PROD_PORT = 3007;
const DEV_PORT = 5000;
const isProd = process.argv.includes('--production');
const SERVE_WEB = isProd;
const PORT = Number(process.env.PORT) || (isProd ? PROD_PORT : DEV_PORT);
const API_PREFIX = `${APP_BASE_PATH}/api`;
const STATIC_BASE = `${APP_BASE_PATH}/`;

for (const key of ['DB_HOST', 'DB_USER', 'DB_PASS', 'DB_NAME']) {
  if (!process.env[key]) {
    console.error(
      `[server] Falta ${key}. Crie .env na raiz ou use backend/.env (copie DB_* de backend/.env.example).`
    );
    process.exit(1);
  }
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
const { uploadsRoot } = await import('./backend/src/fotos.js');
const { authMiddleware } = await import('./backend/src/auth.js');

const app = express();

app.use(cors());
app.use(express.json({ limit: '15mb' }));

app.use(`${API_PREFIX}/uploads`, express.static(uploadsRoot()));
app.use('/api/uploads', express.static(uploadsRoot()));

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

api.use('/auth', authRouter);

api.use(authMiddleware);
api.use('/dashboard', dashboardRouter);
api.use('/lojas', lojasRouter);
api.use('/usuarios', usuariosRouter);
api.use('/checklist', checklistRouter);
api.use('/visitas', visitasRouter);
api.use('/nao-conformidades', ncRouter);
api.use('/manutencao', manutencaoRouter);

app.use(API_PREFIX, api);
app.use('/api', api);

app.use((err, _req, res, _next) => {
  console.error('[API]', err.message);
  res.status(500).json({ error: err.message || 'Erro interno' });
});

if (SERVE_WEB) {
  const dist = path.join(__dirname, 'frontend', 'dist');
  app.use(STATIC_BASE, express.static(dist, { index: 'index.html' }));
  app.get(`${APP_BASE_PATH}/*`, (_req, res) => {
    res.sendFile(path.join(dist, 'index.html'));
  });
  console.log(`[server] SPA ${STATIC_BASE} → ${dist}`);
}

app.listen(PORT, () => {
  garantirSchema();
  console.log(`[server] ${isProd ? 'produção' : 'dev'} — :${PORT}${API_PREFIX}`);
  console.log(`[server] DB ${process.env.DB_HOST}/${process.env.DB_NAME}`);
});
