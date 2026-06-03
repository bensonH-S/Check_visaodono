import './env.js';
import { assertEnv } from './env.js';

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './backend/src/db.js';
import lojasRouter from './backend/src/routes/lojas.js';
import usuariosRouter from './backend/src/routes/usuarios.js';
import checklistRouter from './backend/src/routes/checklist.js';
import visitasRouter from './backend/src/routes/visitas.js';
import ncRouter from './backend/src/routes/naoConformidades.js';
import dashboardRouter from './backend/src/routes/dashboard.js';
import { uploadsRoot } from './backend/src/fotos.js';
import {
  APP_BASE_PATH,
  SERVE_WEB,
  PORT,
  apiPrefix,
  staticBase,
  isProd,
} from './config/server.js';

assertEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());
app.use(express.json({ limit: '15mb' }));

const API_PREFIX = apiPrefix();
app.use(`${API_PREFIX}/uploads`, express.static(uploadsRoot()));
if (APP_BASE_PATH && API_PREFIX !== '/api') {
  app.use('/api/uploads', express.static(uploadsRoot()));
}

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
      api: apiPrefix(),
    });
  } catch (e) {
    console.error('[health]', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

api.use('/dashboard', dashboardRouter);
api.use('/lojas', lojasRouter);
api.use('/usuarios', usuariosRouter);
api.use('/checklist', checklistRouter);
api.use('/visitas', visitasRouter);
api.use('/nao-conformidades', ncRouter);

app.use(API_PREFIX, api);

/** Nginx/proxy às vezes encaminha /api sem o prefixo /auditoria */
if (APP_BASE_PATH && API_PREFIX !== '/api') {
  app.use('/api', api);
}

app.use((err, _req, res, _next) => {
  console.error('[API]', err.message);
  res.status(500).json({ error: err.message || 'Erro interno' });
});

if (SERVE_WEB) {
  const dist = path.join(__dirname, 'frontend', 'dist');
  const base = staticBase();
  app.use(base, express.static(dist, { index: 'index.html' }));
  const spaFallback = APP_BASE_PATH ? `${APP_BASE_PATH}/*` : '/*';
  app.get(spaFallback, (_req, res) => {
    res.sendFile(path.join(dist, 'index.html'));
  });
  console.log(`[server] SPA ${base} → ${dist}`);
}

app.listen(PORT, () => {
  garantirSchema();
  console.log(`[server] ${isProd ? 'produção' : 'dev'} — :${PORT}${API_PREFIX}`);
  console.log(`[server] DB ${process.env.DB_HOST}/${process.env.DB_NAME}`);
});
