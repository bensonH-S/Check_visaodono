/**
 * Valida ciclo de estoque entre duas contagens (timestamp A → B).
 *
 *   node backend/scripts/validar-ciclo-contagem.mjs --loja=7 --db=prod --de=83 --ate=92
 *   node backend/scripts/validar-ciclo-contagem.mjs --loja=7 --db=prod --tipo=diaria
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
const idLoja = Number(getArg('--loja', '7'));
const dbFlag = getArg('--db', 'prod');
const idDe = getArg('--de', null);
const idAte = getArg('--ate', null);
const tipo = getArg('--tipo', null);
const persistir = args.includes('--persistir');
const topN = Number(getArg('--top', '12'));

if (dbFlag === 'prod') {
  process.env.NODE_ENV = 'production';
}

const { pool } = await import('../src/db.js');
const { calcularCiclo } = await import('../src/services/estoqueCiclo.js');

try {
  const ciclo = await calcularCiclo({
    id_loja: idLoja,
    id_contagem_inicio: idDe ? Number(idDe) : null,
    id_contagem_fim: idAte ? Number(idAte) : null,
    tipo: tipo || null,
    persistir,
  });

  const header = {
    id_loja: ciclo.id_loja,
    tipo: ciclo.tipo,
    id_contagem_inicio: ciclo.id_contagem_inicio,
    id_contagem_fim: ciclo.id_contagem_fim,
    data_contagem_inicio: ciclo.data_contagem_inicio,
    data_contagem_fim: ciclo.data_contagem_fim,
    inicio_em: ciclo.inicio_em,
    fim_em: ciclo.fim_em,
    duracao_horas: ciclo.duracao_horas,
    fora_janela: ciclo.fora_janela,
    perfil: ciclo.perfil,
    id_ciclo: ciclo.id_ciclo || null,
    totais: ciclo.totais,
  };
  console.log('\n=== CICLO ===');
  console.log(JSON.stringify(header, null, 2));

  const topLivro = ciclo.itens.slice(0, topN);
  console.log(`\n=== TOP ${topN} |div_livro| ===`);
  console.log(
    JSON.stringify(
      topLivro.map((i) => ({
        codigo: i.codigo,
        descricao: i.descricao,
        ei: i.ei,
        entradas: i.entradas,
        vendas_livro: i.vendas_livro,
        consumo_teorico: i.consumo_teorico,
        breaks: i.breaks,
        esperado_livro: i.esperado_livro,
        esperado_teorico: i.esperado_teorico,
        ef: i.ef,
        div_livro: i.div_livro,
        div_teorico: i.div_teorico,
      })),
      null,
      2,
    ),
  );

  const topTeorico = [...ciclo.itens]
    .sort((a, b) => Math.abs(b.div_teorico) - Math.abs(a.div_teorico))
    .slice(0, topN);
  console.log(`\n=== TOP ${topN} |div_teorico| ===`);
  console.log(
    JSON.stringify(
      topTeorico.map((i) => ({
        codigo: i.codigo,
        ei: i.ei,
        consumo_teorico: i.consumo_teorico,
        esperado_teorico: i.esperado_teorico,
        ef: i.ef,
        div_teorico: i.div_teorico,
        div_livro: i.div_livro,
      })),
      null,
      2,
    ),
  );

  console.log('\nOK — ciclo calculado por timestamp (criado_em dos movimentos).');
  process.exit(0);
} catch (e) {
  console.error('\n=== ERRO ===');
  console.error(e.message || e);
  process.exit(1);
} finally {
  await pool.end().catch(() => {});
}
