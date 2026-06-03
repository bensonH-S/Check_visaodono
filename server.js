/**
 * Entrada da aplicação (raiz do projeto).
 * Nginx/Docker apontam para: node server.js --production
 */
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { pool } from './backend/src/db.js';
import lojasRouter from './backend/src/routes/lojas.js';
import usuariosRouter from './backend/src/routes/usuarios.js';
import checklistRouter from './backend/src/routes/checklist.js';
import visitasRouter from './backend/src/routes/visitas.js';
import ncRouter from './backend/src/routes/naoConformidades.js';
import dashboardRouter from './backend/src/routes/dashboard.js';
import {
  APP_BASE_PATH,
  SERVE_WEB,
  PORT,
  apiPrefix,
  staticBase,
  isProd,
} from './config/server.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, 'backend', '.env') });

const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));

const api = express.Router();

api.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      ok: true,
      db: process.env.DB_NAME,
      base: APP_BASE_PATH || '/',
      mode: isProd ? 'production' : 'development',
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

api.use('/dashboard', dashboardRouter);
api.use('/lojas', lojasRouter);
api.use('/usuarios', usuariosRouter);
api.use('/checklist', checklistRouter);
api.use('/visitas', visitasRouter);
api.use('/nao-conformidades', ncRouter);

const API_PREFIX = apiPrefix();
app.use(API_PREFIX, api);

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
  console.log(`[server] ${isProd ? 'produção' : 'desenvolvimento'} — http://localhost:${PORT}${API_PREFIX}`);
});
