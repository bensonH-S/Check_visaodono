/**
 * Importa um Excel "Restaurante e Produto Venda" com várias lojas (setor Grupo Alvim).
 */
import { importarVendasLoja } from '../estoqueMotor.js';
import { parseVendasExcelBuffer, agruparItensPorLoja } from './parseVendasExcel.js';
import { listarLojasBkOfficeSync } from './syncVendas.js';
import { carregarAliasesBkn } from './bknAlias.js';

export async function importarVendasGrupoExcel({
  buffer,
  dataPadrao = null,
  processar = true,
  arquivo_nome = 'grupo-bkoffice.xlsx',
} = {}) {
  if (!buffer?.length) {
    throw Object.assign(new Error('Excel vazio'), { status: 400 });
  }

  const lojas = await listarLojasBkOfficeSync({ ids: 'all' });
  const aliases = await carregarAliasesBkn();
  const parsed = parseVendasExcelBuffer(buffer, { dataPadrao });
  const itens = parsed
    .map((r) => ({
      ...r,
      data_venda: r.data_venda || dataPadrao,
    }))
    .filter((r) => r.data_venda && r.codigo && r.qtde > 0);

  if (!itens.length) {
    throw Object.assign(
      new Error('Nenhuma linha de produto no Excel. Confirme o relatório Restaurante e Produto Venda.'),
      { status: 422 },
    );
  }

  const { grupos, semLoja } = agruparItensPorLoja(itens, lojas, aliases);
  if (!grupos.size) {
    throw Object.assign(
      new Error(
        'Excel sem BK Number/restaurante reconhecido. Não dá para fatiar o grupo nas lojas.',
      ),
      { status: 422, code: 'GRUPO_SEM_LOJA' },
    );
  }

  const resultados = [];
  for (const g of grupos.values()) {
    const venda_total =
      Math.round(
        g.itens.reduce((a, i) => a + (Number(i.venda_liquida ?? i.valor) || 0), 0) * 100,
      ) / 100;
    const imported = await importarVendasLoja({
      id_loja: g.loja.id_loja,
      itens: g.itens,
      origem: 'bkoffice',
      arquivo_nome,
      criado_por: null,
      processar,
    });
    resultados.push({
      id_loja: g.loja.id_loja,
      bk_number: g.loja.bk_number,
      name: g.loja.name,
      linhas: g.itens.length,
      venda_total,
      import: imported,
    });
  }

  const dias = [...new Set(itens.map((i) => i.data_venda))].sort();
  return {
    ok: true,
    lojas: resultados.length,
    linhas: itens.length,
    linhas_sem_loja: semLoja.length,
    de: dias[0] || dataPadrao,
    ate: dias[dias.length - 1] || dataPadrao,
    venda_total:
      Math.round(resultados.reduce((a, r) => a + (Number(r.venda_total) || 0), 0) * 100) / 100,
    resultados,
  };
}
