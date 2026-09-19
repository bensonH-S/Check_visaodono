/**
 * Grava NF baixada do portal em estoque_nfe + itens (mesmo fluxo Platlog/Coca).
 */
import { pool } from '../db.js';
import { atualizarCustoInsumo, registrarEntradas } from './estoqueMotor.js';
import { casarItensNfe } from './nfeXml.js';
import { classificarStatusPortal } from './estoqueCmvReal.js';

export async function chaveNfeJaExiste(idLoja, chave) {
  if (!chave) return false;
  const { rows } = await pool.query(
    `SELECT id_nfe FROM estoque_nfe WHERE id_loja = $1 AND chave = $2 LIMIT 1`,
    [idLoja, chave],
  );
  return rows.length > 0;
}

export function chaveDentroDaJanela(chave, meses = 3) {
  const c = String(chave || '').replace(/\D/g, '');
  if (c.length !== 44) return true;
  const yy = Number(c.slice(2, 4));
  const mm = Number(c.slice(4, 6));
  if (!yy || mm < 1 || mm > 12) return true;
  const emis = new Date(2000 + yy, mm - 1, 1);
  const corte = new Date();
  corte.setMonth(corte.getMonth() - Number(meses || 3));
  corte.setDate(1);
  corte.setHours(0, 0, 0, 0);
  return emis >= corte;
}

function dataBrParaIso(s) {
  const t = String(s || '').trim();
  const m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  return null;
}

export function dataDentroDaJanela(data, dias = 90) {
  const iso = dataBrParaIso(data);
  if (!iso) return true;
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return true;
  const corte = new Date();
  corte.setDate(corte.getDate() - Number(dias || 90));
  corte.setHours(0, 0, 0, 0);
  return d >= corte;
}

/**
 * @param {object} opts
 * @param {number} opts.idLoja
 * @param {string} opts.fornecedor
 * @param {object} opts.nfe — chave, numero, serie, emissao, emitente, valor_total, itens
 * @param {string} [opts.arquivoPath]
 * @param {string} [opts.statusPortal]
 * @param {boolean} [opts.aplicar]
 * @param {boolean} [opts.pularExistentes]
 * @param {boolean} [opts.registrarEntrada]
 * @param {string} [opts.dataEntrega]
 * @param {object[]} opts.insumos
 */
export async function persistirEstoqueNfe({
  idLoja,
  fornecedor,
  nfe,
  arquivoPath = null,
  statusPortal = null,
  aplicar = false,
  pularExistentes = true,
  registrarEntrada = false,
  dataEntrega = null,
  insumos = [],
} = {}) {
  const linhas = casarItensNfe(nfe.itens || [], insumos);
  const jaTem = pularExistentes ? await chaveNfeJaExiste(idLoja, nfe.chave) : false;
  const resumo = {
    notaLabel: nfe.numero || nfe.chave || nfe.pedido,
    chave: nfe.chave,
    numero: nfe.numero,
    emissao: nfe.emissao,
    emitente: nfe.emitente?.nome,
    valor_total: nfe.valor_total,
    itens: linhas.length,
    casados: linhas.filter((l) => l.match).length,
    sem_match: linhas.filter((l) => !l.match).length,
    ja_importada: jaTem,
    arquivoPath,
  };

  if (!aplicar) return { ...resumo, ok: true, aplicado: false };
  if (jaTem) return { ...resumo, ok: true, aplicado: false, pulada: true };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`ALTER TABLE estoque_nfe ADD COLUMN IF NOT EXISTS data_vencimento DATE`);
    const statusEntrega = classificarStatusPortal(statusPortal, {
      temRemessa: true,
      temDataSaida: !!nfe.data_saida,
    });
    const { rows: nfeRows } = await client.query(
      `INSERT INTO estoque_nfe (
         id_loja, fornecedor, chave, numero, serie, emissao,
         emitente_cnpj, emitente_nome, valor_total, xml_path, status,
         data_saida, status_portal, status_entrega, data_vencimento
       ) VALUES ($1,$2,$3,$4,$5,$6::date,$7,$8,$9,$10,'importada',$11::date,$12,$13,$14::date)
       RETURNING id_nfe`,
      [
        idLoja,
        fornecedor,
        nfe.chave || null,
        nfe.numero || null,
        nfe.serie || null,
        nfe.emissao,
        nfe.emitente?.cnpj || null,
        nfe.emitente?.nome || null,
        nfe.valor_total || null,
        arquivoPath,
        nfe.data_saida || null,
        statusPortal,
        statusEntrega === 'em_transito' || statusEntrega === 'aguardando_portal'
          ? 'aguardando_conferencia'
          : statusEntrega,
        nfe.data_vencimento || nfe.emissao || null,
      ],
    );
    const idNfe = nfeRows[0].id_nfe;
    const custosOk = [];
    const entradasItens = [];
    let semMatch = 0;

    for (const ln of linhas) {
      await client.query(
        `INSERT INTO estoque_nfe_itens (
           id_nfe, n_item, codigo_nf, ean, descricao, u_com, q_com, v_un_com, v_prod,
           id_insumo, match_tipo, preco_caixa_aplicado, qtd_estoque
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          idNfe,
          ln.nItem,
          ln.codigo,
          ln.ean || null,
          ln.descricao,
          ln.uCom,
          ln.qCom,
          ln.vUnCom,
          ln.vProd,
          ln.match?.id_insumo || null,
          ln.match_tipo,
          ln.match ? ln.sugerido.preco_caixa : null,
          ln.match ? ln.sugerido.qtd_estoque : null,
        ],
      );
      if (!ln.match) {
        semMatch += 1;
        continue;
      }
      custosOk.push(ln);
      if (registrarEntrada && ln.sugerido.qtd_estoque > 0) {
        entradasItens.push({
          id_insumo: ln.match.id_insumo,
          quantidade: ln.sugerido.qtd_estoque,
          observacao: `NF ${fornecedor} ${nfe.numero} item ${ln.nItem}`,
        });
      }
    }

    await client.query('COMMIT');

    for (const ln of custosOk) {
      await atualizarCustoInsumo(idLoja, {
        id_insumo: ln.match.id_insumo,
        preco_caixa: ln.sugerido.preco_caixa,
        fonte: 'nf',
      });
    }

    let entradas = [];
    const entrega = dataEntrega ? String(dataEntrega).slice(0, 10) : null;
    if (entradasItens.length && entrega) {
      const r = await registrarEntradas({
        id_loja: idLoja,
        itens: entradasItens,
        observacao: `NF ${fornecedor} ${nfe.numero}`,
        id_nfe: idNfe,
        data_entrega: entrega,
      });
      entradas = r.entradas;
      await pool.query(
        `UPDATE estoque_nfe
         SET data_entrega = $1::date, entrada_registrada = TRUE, entrada_em = NOW(), atualizado_em = NOW()
         WHERE id_nfe = $2`,
        [entrega, idNfe],
      );
    }

    if (semMatch > 0) {
      await pool.query(`UPDATE estoque_nfe SET status = 'parcial', atualizado_em = NOW() WHERE id_nfe = $1`, [
        idNfe,
      ]);
    }

    return {
      ...resumo,
      ok: true,
      aplicado: true,
      id_nfe: idNfe,
      custos_atualizados: custosOk.length,
      entradas: entradas.length,
    };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    return { ...resumo, ok: false, erro: e.message };
  } finally {
    client.release();
  }
}
