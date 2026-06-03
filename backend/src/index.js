import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { pool } from './db.js';
import lojasRouter from './routes/lojas.js';
import usuariosRouter from './routes/usuarios.js';
import checklistRouter from './routes/checklist.js';
import visitasRouter from './routes/visitas.js';
import ncRouter from './routes/naoConformidades.js';
import dashboardRouter from './routes/dashboard.js';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 5000);

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, db: process.env.DB_NAME });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.use('/api/dashboard', dashboardRouter);
app.use('/api/lojas', lojasRouter);
app.use('/api/usuarios', usuariosRouter);
app.use('/api/checklist', checklistRouter);
app.use('/api/visitas', visitasRouter);
app.use('/api/nao-conformidades', ncRouter);

app.use((err, _req, res, _next) => {
  console.error('[API]', err.message);
  res.status(500).json({ error: err.message || 'Erro interno' });
});

app.listen(PORT, () => {
  console.log(`API Vision Check em http://localhost:${PORT}`);
});
