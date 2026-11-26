/**
 * Reimporta vendas da API BK Office para um intervalo de datas.
 *
 * Padrão: --dry-run (não grava).
 *   node backend/scripts/reimportar-vendas-bkoffice-api.mjs
 *   node backend/scripts/reimportar-vendas-bkoffice-api.mjs --datas=2026-11-09,2026-11-11 --lojas=12
 *   node backend/scripts/reimportar-vendas-bkoffice-api.mjs --apply
 *   node backend/scripts/reimportar-vendas-bkoffice-api.mjs --apply --ontem
 *
 * Datas padrão: 2026-11-09, 11, 12, 13, 14, 16, 17, 20, 21, 22 e 23.
 * --apply gera backup, grava e recalcula baixas numa transação só.
 * Exige a migration 172 já aplicada. Não usa --db=prod a menos que você passe.
 *
 * Env: BKOFFICE_API_TOKEN (nunca impresso).
 */
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..', '..');
dotenv.config({ path: path.join(root, '.env'), override: false });
dotenv.config({ path: path.join(root, 'backend', '.env'), override: false });

const args = process.argv.slice(2);
const getArg = (k, def) => {
  const hit = args.find((a) => a.startsWith(`${k}=`));
  return hit ? hit.slice(k.length + 1) : def;
};

if (args.includes('--help') || args.includes('-h')) {
  console.log(`Uso: node backend/scripts/reimportar-vendas-bkoffice-api.mjs [--apply] [--datas=YYYY-MM-DD,...] [--lojas=id,id] [--ontem] [--db=dev|prod]`);
  process.exit(0);
}

const apply = args.includes('--apply');
if (apply && args.includes('--dry-run')) {
  console.error('Use só um modo: --apply ou --dry-run.');
  process.exit(1);
}

const dbFlag = getArg('--db', 'dev');
if (dbFlag === 'prod') {
  process.env.NODE_ENV = 'production';
  process.env.DB_NAME = process.env.DB_NAME_PROD || process.env.DB_NAME || 'vision_check';
  console.warn('ATENÇÃO: --db=prod aponta para o banco de produção.');
} else if (dbFlag !== 'dev') {
  console.error('--db deve ser dev ou prod');
  process.exit(1);
} else {
  process.env.DB_NAME = process.env.DB_NAME_DEV || 'vision_check_dev';
}

const {
  DATAS_REIMPORT_PADRAO,
  dataCivilSP,
  diaAnteriorCivil,
  reimportarVendasApi,
} = await import('../src/services/bkoffice/importVendasApi.js');

function parseDatas(raw) {
  if (!raw) return DATAS_REIMPORT_PADRAO;
  const datas = raw
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const d of datas) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      console.error(`Data inválida: ${d}`);
      process.exit(1);
    }
  }
  return datas;
}

function parseLojas(raw) {
  if (!raw) return null;
  const ids = raw
    .split(/[,;\s]+/)
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (!ids.length) {
    console.error('--lojas sem id válido');
    process.exit(1);
  }
  return ids;
}

const datas = args.includes('--ontem')
  ? [diaAnteriorCivil(dataCivilSP())]
  : parseDatas(getArg('--datas', ''));
const idsLojas = parseLojas(getArg('--lojas', ''));

console.log({
  modo: apply ? 'apply' : 'dry-run',
  db: process.env.DB_NAME,
  datas,
  lojas: idsLojas || 'todas as BK com CNPJ (Popeyes fora)',
  token: process.env.BKOFFICE_API_TOKEN ? 'definido' : 'ausente',
});

if (!process.env.BKOFFICE_API_TOKEN) {
  console.error('Defina BKOFFICE_API_TOKEN no ambiente. O valor não é impresso.');
  process.exit(1);
}

function dinheiro(n) {
  return Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

try {
  const result = await reimportarVendasApi({ datas, idsLojas, apply });
  console.log('');
  for (const linha of result.relatorio) {
    if (linha.status !== 'ok') {
      const dia = linha.data || '—';
      console.log(
        `${linha.status}\tloja ${linha.id_loja} ${linha.name}\t${dia}\t${linha.mensagem || ''}`,
      );
      continue;
    }
    if (!apply) {
      console.log(
        `loja ${linha.id_loja} ${linha.name}\t${linha.data}\t` +
          `linhas ${linha.antes.linhas} → ${linha.depois.linhas}\t` +
          `bruto ${dinheiro(linha.antes.bruto)} → ${dinheiro(linha.depois.bruto)}\t` +
          `qtde ${linha.antes.qtde} → ${linha.depois.qtde}\t` +
          `desconto novo ${dinheiro(linha.depois.desconto)}\t` +
          `baixas excel a desfazer ${linha.baixas.movimentos_excel}, api a refazer ${linha.baixas.movimentos_api}`,
      );
    } else {
      console.log(
        `loja ${linha.id_loja} ${linha.name}\t${linha.data}\tgravado venda ${linha.id_venda} backup ${linha.id_backup}`,
      );
    }
  }
  console.log('');
  if (apply) {
    console.log(
      `rowcount backup=${result.rowcount_backup} itens_api=${result.rowcount_itens} movimentos_desfeitos=${result.rowcount_movimentos}`,
    );
  } else {
    console.log('dry-run: nenhuma linha gravada e nenhuma baixa alterada.');
    if (result.falhas) {
      console.error(`${result.falhas} loja(s)/dia(s) com falha de API. O preview acima não está completo.`);
      process.exit(2);
    }
  }
  process.exit(0);
} catch (e) {
  if (Array.isArray(e.relatorio)) {
    for (const linha of e.relatorio) {
      if (linha.status === 'ok') continue;
      console.log(
        `${linha.status}\tloja ${linha.id_loja} ${linha.name}\t${linha.data || '—'}\t${linha.mensagem || ''}`,
      );
    }
  }
  console.error(e.message || e);
  if (e.code === 'MIGRATION_PENDENTE') {
    console.error(
      'Aplique antes: node backend/scripts/run-sql.js migrations/172_estoque_vendas_bkoffice_api.sql --db=dev',
    );
  }
  process.exit(1);
}
