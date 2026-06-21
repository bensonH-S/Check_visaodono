import fs from 'fs';
import path from 'path';
import { getLogsDir } from './projectPaths.js';

const TZ = process.env.TZ || 'America/Sao_Paulo';
const LOG_DIR = getLogsDir();

function dataHoje() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
}

function arquivoDoDia(data = dataHoje()) {
  return path.join(LOG_DIR, `${data}.log`);
}

function garantirPastaLogs() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function serializarErro(err) {
  if (!err) return undefined;
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
      ...(err.statusCode ? { statusCode: err.statusCode } : {}),
    };
  }
  return { message: String(err) };
}

function escreverLinha(level, category, message, meta) {
  garantirPastaLogs();
  const entrada = {
    ts: new Date().toISOString(),
    level,
    category,
    message,
  };
  if (meta && Object.keys(meta).length) entrada.meta = meta;

  const linha = `${JSON.stringify(entrada)}\n`;
  fs.appendFileSync(arquivoDoDia(), linha, 'utf8');

  const prefixo = `[${level}] [${category}]`;
  const extra = meta ? ` ${JSON.stringify(meta)}` : '';
  if (level === 'ERROR') console.error(prefixo, message + extra);
  else if (level === 'WARN') console.warn(prefixo, message + extra);
  else console.log(prefixo, message + extra);
}

export function getLogDir() {
  return LOG_DIR;
}

export function getArquivoLogHoje() {
  return arquivoDoDia();
}

export const logger = {
  info(category, message, meta) {
    escreverLinha('INFO', category, message, meta);
  },

  warn(category, message, meta) {
    escreverLinha('WARN', category, message, meta);
  },

  error(category, message, meta) {
    escreverLinha('ERROR', category, message, meta);
  },

  debug(category, message, meta) {
    if (process.env.LOG_DEBUG === '1' || process.env.NODE_ENV !== 'production') {
      escreverLinha('DEBUG', category, message, meta);
    }
  },

  http(req, res, durationMs) {
    const url = req.originalUrl || req.url || '';
    const meta = {
      method: req.method,
      url,
      status: res.statusCode,
      ms: durationMs,
      ip: req.ip || req.socket?.remoteAddress,
      userId: req.user?.sub ?? req.user?.id_usuario ?? null,
    };
    const level = res.statusCode >= 500 ? 'ERROR' : res.statusCode >= 400 ? 'WARN' : 'INFO';
    escreverLinha(level, 'http', `${req.method} ${url} ${res.statusCode} ${durationMs}ms`, meta);
  },

  exception(category, err, meta) {
    escreverLinha('ERROR', category, err?.message || 'Exceção', {
      ...meta,
      error: serializarErro(err),
    });
  },
};

export function middlewareHttpLogger() {
  return (req, res, next) => {
    const inicio = Date.now();
    res.on('finish', () => {
      const pathLog = req.originalUrl || req.url || '';
      const ehApi =
        pathLog.startsWith('/api') ||
        pathLog.startsWith('/auditoria/api') ||
        pathLog.includes('/api/');
      if (!ehApi) return;
      logger.http(req, res, Date.now() - inicio);
    });
    next();
  };
}

export function registrarHandlersGlobais() {
  process.on('uncaughtException', (err) => {
    logger.exception('process', err, { tipo: 'uncaughtException' });
  });

  process.on('unhandledRejection', (reason) => {
    logger.exception('process', reason instanceof Error ? reason : new Error(String(reason)), {
      tipo: 'unhandledRejection',
    });
  });
}
