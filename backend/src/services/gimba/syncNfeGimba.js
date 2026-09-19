import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../../db.js';
import { parseNfeXml } from '../nfeXml.js';
import { persistirEstoqueNfe } from '../estoquePersistirNfe.js';
import { baixarNfesGimba } from './gimbaClient.js';
import { JANELA_NF_DIAS } from '../estoqueFornecedorCredencial.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..', '..', '..', '..');

function log(...a) {
  console.log('[gimba-nfe]', ...a);
}

function nfeDePedido(meta) {
  const chave = String(meta.chave || '').replace(/\D/g, '');
  const itens = (meta.itens || []).filter((i) => i.descricao || i.codigo);
  if (!chave && !meta.numero) return null;
  if (!itens.length && !chave) return null;
  return {
    chave: chave.length === 44 ? chave : `GIMBA-${meta.pedido || '0'}-${meta.numero || '0'}`,
    numero: meta.numero || null,
    serie: null,
    emissao: meta.emissao,
    valor_total: meta.valor || itens.reduce((s, i) => s + (Number(i.vProd) || 0), 0),
    emitente: { cnpj: meta.cnpjCliente || '', nome: meta.emitenteNome || 'GIMBA' },
    itens: itens.length
      ? itens
      : [{ nItem: 1, codigo: '', descricao: `Pedido Gimba ${meta.pedido}`, uCom: 'UN', qCom: 1, vUnCom: 0, vProd: 0 }],
    pedido: meta.pedido,
  };
}

export async function syncNfeGimba({
  id_loja,
  user,
  pass,
  limit = 80,
  dias = JANELA_NF_DIAS,
  aplicar = false,
  registrar_entrada = false,
  data_entrega = null,
  pular_existentes = true,
} = {}) {
  const idLoja = Number(id_loja);
  if (!idLoja) throw new Error('id_loja obrigatório');

  const outDir = path.join(projectRoot, 'Logs', 'gimba-nfe', String(idLoja));
  fs.mkdirSync(outDir, { recursive: true });

  const downloads = await baixarNfesGimba({
    user,
    pass,
    dias,
    meses: 3,
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
    let nfe;
    let arquivoPath;
    if (dl.xml) {
      try {
        nfe = parseNfeXml(dl.xml);
        arquivoPath = path.join(outDir, `${nfe.chave || dl.chave || dl.nfe.numero}.xml`);
        fs.writeFileSync(arquivoPath, dl.xml, 'utf8');
      } catch (e) {
        processadas.push({ notaLabel: dl.nfe?.numero || dl.chave, ok: false, erro: e.message });
        continue;
      }
    } else {
      const temItens = (dl.nfe?.itens || []).some((i) => i.descricao || i.codigo);
      if (!temItens && !dl.nfe?.chave) {
        processadas.push({ notaLabel: dl.nfe?.numero || dl.nfe?.pedido, ok: false, erro: 'NF sem XML e sem itens' });
        continue;
      }
      nfe = nfeDePedido(dl.nfe);
      if (!nfe) {
        processadas.push({ notaLabel: dl.nfe?.pedido, ok: false, erro: 'Pedido sem NF' });
        continue;
      }
      arquivoPath = path.join(outDir, `${nfe.chave}.json`);
      fs.writeFileSync(arquivoPath, JSON.stringify(dl.nfe, null, 2), 'utf8');
    }

    processadas.push(
      await persistirEstoqueNfe({
        idLoja,
        fornecedor: 'gimba',
        nfe,
        arquivoPath,
        statusPortal: dl.nfe?.pedido ? `pedido ${dl.nfe.pedido}` : null,
        aplicar,
        pularExistentes: pular_existentes,
        registrarEntrada: registrar_entrada,
        dataEntrega: data_entrega,
        insumos,
      }),
    );
  }

  return { id_loja: idLoja, baixadas: downloads.length, processadas, outDir, aplicar };
}
