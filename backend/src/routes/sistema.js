/**
 * Rotas de sistema — backup de banco (somente TI / administrador).
 */
import { Router } from 'express';
import fs from 'fs';
import { pool } from '../db.js';
import { temPermissao } from '../permissoes.js';
import { auditar } from '../auditoriaHelpers.js';
import { logger } from '../logger.js';
import {
  gerarBackupSqlGzip,
  listarBackupsLocais,
  caminhoBackupSeguro,
} from '../services/dbBackup.js';
import { obterConfiguracaoSmtp, salvarConfiguracaoSmtp } from '../services/smtpConfig.js';
import { testarEnvioSmtp } from '../services/mailer.js';

const router = Router();

async function ehUsuarioTi(user) {
  if (!user) return false;
  if (String(user.perfil || '').toLowerCase() === 'administrador') return true;
  if (temPermissao(user, 'sistema.backup')) return true;
  let cargo = String(user.cargo_aprovacao || '').toLowerCase();
  if (!cargo && user.sub) {
    try {
      const { rows } = await pool.query(
        `SELECT cargo_aprovacao, perfil FROM usuarios WHERE id_usuario = $1 LIMIT 1`,
        [user.sub],
      );
      cargo = String(rows[0]?.cargo_aprovacao || rows[0]?.perfil || '').toLowerCase();
    } catch {
      cargo = '';
    }
  }
  return cargo === 'ti';
}

async function requireTi(req, res, next) {
  try {
    if (!(await ehUsuarioTi(req.user))) {
      return res.status(403).json({ error: 'Acesso restrito ao TI' });
    }
    next();
  } catch (e) {
    next(e);
  }
}

router.get('/backup', requireTi, async (_req, res, next) => {
  try {
    const items = listarBackupsLocais();
    res.json({
      items,
      db_name: process.env.DB_NAME || null,
      db_host: process.env.DB_HOST || null,
    });
  } catch (e) {
    next(e);
  }
});

router.post('/backup/gerar', requireTi, async (req, res, next) => {
  try {
    const meta = await gerarBackupSqlGzip();
    await auditar(req, {
      modulo: 'sistema',
      acao: 'backup',
      entidade: 'banco',
      descricao: `Gerou dump ${meta.fileName} (${meta.tables} tabelas, ${meta.sizeBytes} bytes)`,
      detalhes: {
        fileName: meta.fileName,
        dbName: meta.dbName,
        tables: meta.tables,
        sizeBytes: meta.sizeBytes,
      },
    });
    res.json({
      ok: true,
      fileName: meta.fileName,
      sizeBytes: meta.sizeBytes,
      dbName: meta.dbName,
      tables: meta.tables,
      download: `/sistema/backup/download/${encodeURIComponent(meta.fileName)}`,
    });
  } catch (e) {
    logger.error('sistema', 'Falha ao gerar backup', { error: e.message });
    next(e);
  }
});

router.get('/backup/download/:fileName', requireTi, async (req, res, next) => {
  try {
    const full = caminhoBackupSeguro(req.params.fileName);
    if (!full) return res.status(404).json({ error: 'Arquivo não encontrado' });

    await auditar(req, {
      modulo: 'sistema',
      acao: 'acesso',
      entidade: 'banco',
      descricao: `Download do dump ${req.params.fileName}`,
      detalhes: { fileName: req.params.fileName },
    });

    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${pathBasename(req.params.fileName)}"`,
    );
    fs.createReadStream(full).pipe(res);
  } catch (e) {
    next(e);
  }
});

function pathBasename(name) {
  return String(name || '').replace(/[/\\]/g, '');
}

function requireConfigVer(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Não autenticado' });
  }
  if (
    temPermissao(req.user, 'configuracoes.ver') ||
    temPermissao(req.user, 'usuarios.gerenciar') ||
    String(req.user.perfil || '').toLowerCase() === 'administrador'
  ) {
    return next();
  }
  return res.status(403).json({ error: 'Permissão negada para configurações' });
}

router.get('/smtp', requireConfigVer, async (_req, res, next) => {
  try {
    const config = await obterConfiguracaoSmtp();
    res.json(config);
  } catch (e) {
    next(e);
  }
});

router.post('/smtp', requireConfigVer, async (req, res, next) => {
  try {
    const usuarioNome = req.user?.nome || req.user?.email || 'Usuário';
    const config = await salvarConfiguracaoSmtp(req.body, usuarioNome);
    await auditar(req, {
      modulo: 'configuracoes',
      acao: 'alteracao',
      entidade: 'smtp',
      descricao: `Atualizou configurações de SMTP (${config.host}:${config.port}, ativo: ${config.ativo})`,
      detalhes: { host: config.host, port: config.port, usuario: config.usuario, ativo: config.ativo },
    });
    res.json(config);
  } catch (e) {
    next(e);
  }
});

router.post('/smtp/teste', requireConfigVer, async (req, res, next) => {
  try {
    const { para, assunto, mensagem } = req.body;
    const resultado = await testarEnvioSmtp({ para, assunto, mensagem });
    await auditar(req, {
      modulo: 'configuracoes',
      acao: 'operacao',
      entidade: 'smtp',
      descricao: `Enviou e-mail de teste SMTP para ${para}`,
      detalhes: { para },
    });
    res.json(resultado);
  } catch (e) {
    logger.error('sistema', 'Falha ao testar envio SMTP', { error: e.message });
    res.status(400).json({ error: e.message || 'Falha ao enviar e-mail de teste' });
  }
});

export default router;
export { ehUsuarioTi };

