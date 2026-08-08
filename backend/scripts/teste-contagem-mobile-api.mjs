/**
 * Teste E2E da contagem mobile (API local):
 * - crítica semanal (só itens críticos)
 * - completa (todas as seções)
 * Preenche todos os itens, salva, valida regras e remove as contagens de teste
 * (não finaliza para não alterar saldo real).
 *
 * Uso:
 *   node backend/scripts/teste-contagem-mobile-api.mjs
 *   node backend/scripts/teste-contagem-mobile-api.mjs --base=http://localhost:5000
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
dotenv.config({ path: path.join(root, '.env'), override: false });
dotenv.config({ path: path.join(root, 'backend', '.env'), override: true });
process.env.DB_NAME = process.env.DB_NAME_DEV || 'vision_check_dev';

const { signToken } = await import('../src/auth.js');
const { calcularQtdContagem } = await import('../src/services/estoqueContagem.js');

const args = process.argv.slice(2);
const getArg = (k, def) => {
  const hit = args.find((a) => a.startsWith(`${k}=`));
  return hit ? hit.slice(k.length + 1) : def;
};
const BASE = String(getArg('--base', 'http://localhost:5000')).replace(/\/$/, '');
const API = `${BASE}/auditoria/api`;
const ID_LOJA = Number(getArg('--loja', '21'));
const ID_USER = Number(getArg('--user', '3'));

const { pool } = await import('../src/db.js');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function api(method, urlPath, body, token) {
  const res = await fetch(`${API}${urlPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(data?.error || `${method} ${urlPath} → ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function payloadItens(itens) {
  return itens.map((i) => {
    const caixaOk = i.permite_contagem_caixa !== false;
    const pcOk = i.permite_contagem_pc_fd !== false;
    const kgOk = i.permite_contagem_kg_und !== false;
    // Nenhum campo liberado (raro): marca QTD 0 pela API legada.
    if (!caixaOk && !pcOk && !kgOk) {
      return { id_item: i.id_item, estoque_contado: 0 };
    }
    let caixa = null;
    let pc = null;
    let kg = null;
    // Preenche o 1º campo liberado com 1; demais liberados com 0 (conta como preenchido).
    if (caixaOk) {
      caixa = 1;
      if (pcOk) pc = 0;
      if (kgOk) kg = 0;
    } else if (pcOk) {
      pc = 1;
      if (kgOk) kg = 0;
    } else {
      kg = 1;
    }
    return {
      id_item: i.id_item,
      contagem_caixa: caixaOk ? caixa : null,
      contagem_pc_fd: pcOk ? pc : null,
      contagem_kg_und: kgOk ? kg : null,
    };
  });
}

function esperadoTotalCmv(itens, draft) {
  let total = 0;
  for (const i of itens) {
    if (i.entra_cmv === false) continue;
    const d = draft.find((x) => x.id_item === i.id_item) || {};
    let qtd = null;
    if (d.estoque_contado != null && d.contagem_caixa === undefined) {
      qtd = Number(d.estoque_contado);
    } else {
      qtd = calcularQtdContagem({
        contagem_caixa: d.contagem_caixa,
        contagem_pc_fd: d.contagem_pc_fd,
        contagem_kg_und: d.contagem_kg_und,
        und_convertida: i.und_convertida,
        und_parcial: i.und_parcial,
        permite_contagem_caixa: i.permite_contagem_caixa,
        permite_contagem_pc_fd: i.permite_contagem_pc_fd,
        permite_contagem_kg_und: i.permite_contagem_kg_und,
      });
    }
    if (qtd != null) total += qtd * (Number(i.valor_unidade) || 0);
  }
  return Math.round(total * 100) / 100;
}

async function limparAbertasTipo(tipo) {
  // Em DEV o teste precisa de contagem limpa (sem itens-fantasma de cabeçalho).
  const { rows } = await pool.query(
    `SELECT id_contagem, titulo FROM estoque_contagens
     WHERE id_loja = $1 AND status = 'aberta' AND COALESCE(tipo,'completa') = $2`,
    [ID_LOJA, tipo],
  );
  for (const r of rows) {
    await pool.query('DELETE FROM estoque_itens WHERE id_contagem = $1', [r.id_contagem]);
    await pool.query('DELETE FROM estoque_contagens WHERE id_contagem = $1', [r.id_contagem]);
    console.log(`  limpou aberta #${r.id_contagem} (${tipo}) — ${r.titulo || ''}`);
  }
}

/** Cabeçalhos da planilha que entraram como “insumo” por engano. */
async function desativarCabecalhosFantasma() {
  const { rowCount } = await pool.query(
    `UPDATE insumos
     SET ativo = FALSE, atualizado_em = NOW()
     WHERE id_loja = $1
       AND (
         codigo ~ '^TRC-(CONGELADOS|RESFRIADOS|MOLHOS|SOBREMESA|EMBALAGENS|LIMPEZA|REFRIGERANTES|BRINDES|LANCAMENTO)'
         OR upper(descricao) IN (
           'CONGELADOS','RESFRIADOS','MOLHOS E CONDIMENTOS','SOBREMESA',
           'EMBALAGENS E ESTOCAVEIS','LIMPEZA','REFRIGERANTES BEG - LATAS - CO2',
           'BRINDES','LANÇAMENTO','LANCAMENTO'
         )
       )`,
    [ID_LOJA],
  );
  if (rowCount) console.log(`desativou ${rowCount} cabeçalho(s) fantasma`);
}

async function rodarTipo(token, tipo) {
  console.log(`\n══ ${tipo} ══`);
  await limparAbertasTipo(tipo);

  const criada = await api(
    'POST',
    '/estoque/contagens/iniciar-sabado',
    { id_loja: ID_LOJA, tipo },
    token,
  );
  assert(criada?.id_contagem, 'sem id_contagem');
  assert(criada.status === 'aberta', 'status deveria ser aberta');
  assert((criada.itens || []).length > 0, 'contagem sem itens');
  await pool.query(
    `UPDATE estoque_contagens SET titulo = $2 WHERE id_contagem = $1`,
    [criada.id_contagem, `TESTE AUTO ${tipo} ${new Date().toISOString().slice(0, 10)}`],
  );
  console.log(`  criada #${criada.id_contagem} com ${criada.itens.length} itens`);

  if (tipo === 'critica_semanal') {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM insumos
       WHERE id_loja = $1 AND ativo AND contagem_critica = TRUE`,
      [ID_LOJA],
    );
    assert(
      criada.itens.length === rows[0].n,
      `crítica: esperava ${rows[0].n} itens, veio ${criada.itens.length}`,
    );
  }

  const secoes = [...new Set(criada.itens.map((i) => i.secao_contagem || 'OUTROS'))];
  const bloqueadosPc = criada.itens.filter((i) => i.permite_contagem_pc_fd === false).length;
  const bloqueadosKg = criada.itens.filter((i) => i.permite_contagem_kg_und === false).length;
  const foraCmv = criada.itens.filter((i) => i.entra_cmv === false).length;
  console.log(`  seções: ${secoes.length} → ${secoes.join(' | ')}`);
  console.log(`  pc bloqueado=${bloqueadosPc} kg bloqueado=${bloqueadosKg} fora CMV=${foraCmv}`);

  if (tipo === 'completa') {
    assert(secoes.length >= 5, `completa deveria ter várias seções, veio ${secoes.length}`);
    assert(bloqueadosPc > 0 || bloqueadosKg > 0, 'esperava células pretas (campos bloqueados)');
  }

  const draft = payloadItens(criada.itens);
  const esperado = esperadoTotalCmv(criada.itens, draft);

  const salva = await api('PUT', `/estoque/contagens/${criada.id_contagem}/itens`, { itens: draft }, token);
  assert(salva.pendentes === 0, `ainda há ${salva.pendentes} pendentes após preencher`);
  assert(
    Math.abs(Number(salva.total_valor) - esperado) < 0.1,
    `TOTAL CMV divergente: API=${salva.total_valor} esperado=${esperado}`,
  );

  // Campos bloqueados devem voltar null
  for (const i of salva.itens) {
    if (i.permite_contagem_pc_fd === false) {
      assert(i.contagem_pc_fd == null, `item ${i.codigo} PC deveria estar bloqueado/null`);
    }
    if (i.permite_contagem_kg_und === false) {
      assert(i.contagem_kg_und == null, `item ${i.codigo} KG deveria estar bloqueado/null`);
    }
    assert(i.estoque_contado != null, `item ${i.codigo} sem estoque_contado`);
  }

  console.log(`  OK preenchida — pendentes=0 TOTAL CMV=R$ ${Number(salva.total_valor).toFixed(2)}`);

  // Cleanup sem finalizar (protege saldo)
  await api('DELETE', `/estoque/contagens/${criada.id_contagem}`, null, token);
  console.log(`  removida #${criada.id_contagem} (sem finalizar — saldo intacto)`);

  return {
    tipo,
    id: criada.id_contagem,
    itens: criada.itens.length,
    secoes: secoes.length,
    total_valor: Number(salva.total_valor),
    bloqueadosPc,
    bloqueadosKg,
    foraCmv,
  };
}

async function main() {
  const { rows: users } = await pool.query(
    `SELECT id_usuario, email, perfil FROM usuarios WHERE id_usuario = $1`,
    [ID_USER],
  );
  assert(users.length, `usuário #${ID_USER} não encontrado`);
  const user = users[0];
  const token = signToken(user);
  console.log(`API ${API}`);
  console.log(`user #${user.id_usuario} ${user.email} loja=${ID_LOJA}`);
  await desativarCabecalhosFantasma();

  // smoke
  await api('GET', `/estoque/contagens?id_loja=${ID_LOJA}`, null, token);

  const critica = await rodarTipo(token, 'critica_semanal');
  const completa = await rodarTipo(token, 'completa');

  console.log('\n══ RESUMO ══');
  console.log(JSON.stringify({ critica, completa }, null, 2));
  console.log('\nTESTE OK');
}

main()
  .catch((e) => {
    console.error('\nTESTE FALHOU:', e.message);
    if (e.data) console.error(e.data);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => {});
  });
