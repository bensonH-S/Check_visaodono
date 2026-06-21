import fs from 'fs';
import path from 'path';
import { getLogsDir } from './projectPaths.js';

const TZ = process.env.TZ || 'America/Sao_Paulo';
const LOG_DIR = getLogsDir();

const ICONES = {
  ERROR: '✗',
  WARN: '△',
  INFO: '✓',
  DEBUG: '·',
};

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

function formatarDataHora(date = new Date()) {
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const valor = (tipo) => partes.find((p) => p.type === tipo)?.value ?? '';

  return {
    data: `${valor('day')}-${valor('month')}-${valor('year')}`,
    hora: `${valor('hour')}:${valor('minute')}:${valor('second')}`,
  };
}

function formatarMeta(meta) {
  if (!meta || !Object.keys(meta).length) return '';
  return ` ${JSON.stringify(meta)}`;
}

export function formatarLinhaLog(level, category, message, meta, date = new Date()) {
  const { data, hora } = formatarDataHora(date);
  const icone = ICONES[level] ?? '·';
  return `${data} ${hora} ${icone} [${category}] ${message}${formatarMeta(meta)}`;
}

/** Interpreta linha legível ou JSON legado. */
export function parseLinhaLog(linha) {
  const texto = String(linha || '').trim();
  if (!texto) return null;

  const legivel = texto.match(
    /^(\d{2}-\d{2}-\d{4}) (\d{2}:\d{2}:\d{2}) ([✗✓△·]) \[([^\]]+)\] (.+)$/,
  );
  if (legivel) {
    const icone = legivel[3];
    const level =
      icone === '✗' ? 'ERROR' : icone === '△' ? 'WARN' : icone === '✓' ? 'INFO' : 'DEBUG';
    return {
      data: legivel[1],
      hora: legivel[2],
      icone,
      level,
      category: legivel[4],
      message: legivel[5],
      raw: texto,
    };
  }

  try {
    const e = JSON.parse(texto);
    const ts = e.ts ? new Date(e.ts) : new Date();
    const { data, hora } = formatarDataHora(ts);
    const level = e.level || 'INFO';
    const meta = e.meta ? formatarMeta(e.meta).trim() : '';
    const message = meta ? `${e.message} ${meta}` : e.message;
    return {
      data,
      hora,
      icone: ICONES[level] ?? '·',
      level,
      category: e.category || '?',
      message,
      raw: texto,
    };
  } catch {
    return { raw: texto };
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
  const linha = `${formatarLinhaLog(level, category, message, meta)}\n`;
  fs.appendFileSync(arquivoDoDia(), linha, 'utf8');

  if (level === 'ERROR') console.error(linha.trim());
  else if (level === 'WARN') console.warn(linha.trim());
  else console.log(linha.trim());
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
