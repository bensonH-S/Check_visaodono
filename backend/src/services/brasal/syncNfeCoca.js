/**
 * Sync NF Coca-Cola (Conecta Brasal) → Visão do Dono.
 * Usa API de pedidos (chave + itens/preço). PDF do portal é stub vazio.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../../db.js';
import { atualizarCustoInsumo, registrarEntradas } from '../estoqueMotor.js';
import { casarItensNfe } from '../nfeXml.js';
import { baixarNfesBrasal } from './brasalClient.js';
import { classificarStatusPortal } from '../estoqueCmvReal.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..', '..', '..', '..');

function log(...a) {
  console.log('[coca-nfe]', ...a);
}

async function chaveJaExiste(idLoja, chave) {
  if (!chave) return false;
  const { rows } = await pool.query(
    `SELECT id_nfe FROM estoque_nfe WHERE id_loja = $1 AND chave = $2 LIMIT 1`,
    [idLoja, chave],
  );
  return rows.length > 0;
}

/**
 * @param {object} opts
 * @param {number} opts.id_loja
 * @param {string} opts.user
 * @param {string} opts.pass
 * @param {number} [opts.limit=5]
 * @param {number} [opts.dias=45]
 * @param {boolean} [opts.aplicar=false]
 * @param {boolean} [opts.registrar_entrada=false]
 * @param {boolean} [opts.pular_existentes=true]
 */
export async function syncNfeCoca({
  id_loja,
  user,
  pass,
  limit = 5,
  dias = 45,
  aplicar = false,
  registrar_entrada = false,
  /** Só entra no saldo se houver data_entrega — nunca usa emissão. */
  data_entrega = null,
  pular_existentes = true,
  apiBase,
} = {}) {
  const idLoja = Number(id_loja);
  if (!idLoja) throw new Error('id_loja obrigatório');

  const outDir = path.join(projectRoot, 'Logs', 'brasal-nfe', String(idLoja));
  fs.mkdirSync(outDir, { recursive: true });

  const downloads = await baixarNfesBrasal({
    user,
    pass,
    apiBase,
    dias,
    limit,
    onLog: log,
  });

  const { rows: insumos } = await pool.query(
    `SELECT id_insumo, codigo, descricao, und_convertida, und_parcial, unidade_contagem
     FROM insumos WHERE id_loja = $1 AND ativo = TRUE`,
    [idLoja],
  );

  const processadas = [];

  for (const nfe of downloads) {
    const jsonPath = path.join(outDir, `${nfe.chave || nfe.pedido}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(nfe, null, 2), 'utf8');

    const linhas = casarItensNfe(nfe.itens, insumos);
    const jaTem = pular_existentes ? await chaveJaExiste(idLoja, nfe.chave) : false;

    const resumo = {
      notaLabel: nfe.pedido || nfe.nfenum,
      chave: nfe.chave,
      numero: nfe.numero,
      emissao: nfe.emissao,
      emitente: nfe.emitente.nome,
      valor_total: nfe.valor_total,
      itens: linhas.length,
      casados: linhas.filter((l) => l.match).length,
      sem_match: linhas.filter((l) => !l.match).length,
      ja_importada: jaTem,
      fileName: path.basename(jsonPath),
      jsonPath,
      linhas: linhas.map((l) => ({
        codigo_nf: l.codigo,
        descricao: l.descricao,
        uCom: l.uCom,
        qCom: l.qCom,
        vUnCom: l.vUnCom,
        match: l.match ? l.match.codigo : null,
        match_tipo: l.match_tipo,
        preco_caixa: l.sugerido.preco_caixa,
      })),
    };

    if (!aplicar) {
      processadas.push({ ...resumo, ok: true, aplicado: false });
      continue;
    }

    if (jaTem) {
      processadas.push({ ...resumo, ok: true, aplicado: false, pulada: true });
      continue;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const statusPortal = nfe.status_pedido || null;
      let statusEntrega = classificarStatusPortal(statusPortal, {
        temRemessa: true, // só chega aqui se itens têm remessa/NF
      });
      // Coca: NF com remessa = mercadoria a caminho/pronta → gestor confere na loja
      if (statusEntrega === 'em_transito' || statusEntrega === 'aguardando_portal') {
        statusEntrega = 'aguardando_conferencia';
      }
      const { rows: nfeRows } = await client.query(
        `INSERT INTO estoque_nfe (
           id_loja, fornecedor, chave, numero, serie, emissao,
           emitente_cnpj, emitente_nome, valor_total, xml_path, status,
           status_portal, status_entrega
         ) VALUES ($1,'coca',$2,$3,$4,$5::date,$6,$7,$8,$9,'importada',$10,$11)
         RETURNING id_nfe`,
        [
          idLoja,
          nfe.chave || null,
          nfe.numero || null,
          nfe.serie || null,
          nfe.emissao,
          nfe.emitente.cnpj || null,
          nfe.emitente.nome || null,
          nfe.valor_total || null,
          jsonPath,
          statusPortal,
          statusEntrega,
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
        if (registrar_entrada && ln.sugerido.qtd_estoque > 0) {
          entradasItens.push({
            id_insumo: ln.match.id_insumo,
            quantidade: ln.sugerido.qtd_estoque,
            observacao: `NF Coca ${nfe.numero} item ${ln.nItem}`,
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
      // Entrada no saldo SÓ com data_entrega explícita.
      // Emissão da NF não serve — mercadoria pode chegar no mês seguinte.
      const dataEntrega = data_entrega ? String(data_entrega).slice(0, 10) : null;
      if (entradasItens.length && dataEntrega) {
        const r = await registrarEntradas({
          id_loja: idLoja,
          itens: entradasItens,
          observacao: `NF Coca/Brasal ${nfe.numero}`,
          id_nfe: idNfe,
          data_entrega: dataEntrega,
        });
        entradas = r.entradas;
        await pool.query(
          `UPDATE estoque_nfe
           SET data_entrega = $1::date,
               entrada_registrada = TRUE,
               entrada_em = NOW(),
               atualizado_em = NOW()
           WHERE id_nfe = $2`,
          [dataEntrega, idNfe],
        );
      } else if (registrar_entrada && !dataEntrega) {
        log(
          `NF ${nfe.numero}: registrar_entrada pediu mas sem data_entrega — fica pendente (não usa emissão).`,
        );
      }

      if (semMatch > 0) {
        await pool.query(`UPDATE estoque_nfe SET status = 'parcial', atualizado_em = NOW() WHERE id_nfe = $1`, [
          idNfe,
        ]);
      }

      processadas.push({
        ...resumo,
        ok: true,
        aplicado: true,
        id_nfe: idNfe,
        custos_atualizados: custosOk.length,
        entradas: entradas.length,
      });
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      processadas.push({ ...resumo, ok: false, erro: e.message });
    } finally {
      client.release();
    }
  }

  return {
    id_loja: idLoja,
    baixadas: downloads.length,
    processadas,
    outDir,
    aplicar,
  };
}
