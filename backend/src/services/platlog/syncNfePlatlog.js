/**
 * Sync NF-e Platlog (eSupri) → Visão do Dono.
 * Baixa XMLs, grava estoque_nfe, atualiza custo dos insumos (custo_fonte=nf).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../../db.js';
import { atualizarCustoInsumo, registrarEntradas } from '../estoqueMotor.js';
import { casarItensNfe, parseNfeXml, unzipFirstXml } from '../nfeXml.js';
import { baixarNfesFinanceiroEsupri } from './esupriClient.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// platlog → services → src → backend → repo root
const projectRoot = path.join(__dirname, '..', '..', '..', '..');

function log(...a) {
  console.log('[platlog-nfe]', ...a);
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
 * @param {boolean} [opts.aplicar=false] — grava DB + custo
 * @param {boolean} [opts.registrar_entrada=false]
 * @param {boolean} [opts.headless=true]
 * @param {boolean} [opts.pular_existentes=true]
 */
export async function syncNfePlatlog({
  id_loja,
  user,
  pass,
  limit = 5,
  aplicar = false,
  registrar_entrada = false,
  headless = true,
  pular_existentes = true,
  baseUrl,
} = {}) {
  const idLoja = Number(id_loja);
  if (!idLoja) throw new Error('id_loja obrigatório');

  const outDir = path.join(projectRoot, 'Logs', 'esupri-nfe', String(idLoja));
  fs.mkdirSync(outDir, { recursive: true });

  const downloads = await baixarNfesFinanceiroEsupri({
    user,
    pass,
    baseUrl,
    headless,
    limit,
    onLog: log,
  });

  const { rows: insumos } = await pool.query(
    `SELECT id_insumo, codigo, descricao, und_convertida, und_parcial, unidade_contagem
     FROM insumos WHERE id_loja = $1 AND ativo = TRUE`,
    [idLoja],
  );

  const processadas = [];

  for (const dl of downloads) {
    const zipPath = path.join(outDir, dl.fileName);
    fs.writeFileSync(zipPath, dl.zipBuffer);

    let xml;
    let nfe;
    try {
      xml = unzipFirstXml(dl.zipBuffer);
      nfe = parseNfeXml(xml);
    } catch (e) {
      processadas.push({
        notaLabel: dl.notaLabel,
        ok: false,
        erro: e.message,
        fileName: dl.fileName,
      });
      continue;
    }

    const xmlPath = path.join(outDir, `${nfe.chave || path.parse(dl.fileName).name}.xml`);
    fs.writeFileSync(xmlPath, xml, 'utf8');

    const linhas = casarItensNfe(nfe.itens, insumos);
    const jaTem = pular_existentes ? await chaveJaExiste(idLoja, nfe.chave) : false;

    const resumo = {
      notaLabel: dl.notaLabel,
      chave: nfe.chave,
      numero: nfe.numero,
      emissao: nfe.emissao,
      emitente: nfe.emitente.nome,
      valor_total: nfe.valor_total,
      itens: linhas.length,
      casados: linhas.filter((l) => l.match).length,
      sem_match: linhas.filter((l) => !l.match).length,
      ja_importada: jaTem,
      fileName: dl.fileName,
      xmlPath,
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
      const { rows: nfeRows } = await client.query(
        `INSERT INTO estoque_nfe (
           id_loja, fornecedor, chave, numero, serie, emissao,
           emitente_cnpj, emitente_nome, valor_total, xml_path, status
         ) VALUES ($1,'platlog',$2,$3,$4,$5::date,$6,$7,$8,$9,'importada')
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
          xmlPath,
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
            observacao: `NF Platlog ${nfe.numero} item ${ln.nItem}`,
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
      if (entradasItens.length) {
        const r = await registrarEntradas({
          id_loja: idLoja,
          itens: entradasItens,
          observacao: `NF-e Platlog ${nfe.numero}`,
          referencia: nfe.chave || nfe.numero,
        });
        entradas = r.entradas;
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
