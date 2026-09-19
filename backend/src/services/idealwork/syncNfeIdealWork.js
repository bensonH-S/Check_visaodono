import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../../db.js';
import { parseNfeXml } from '../nfeXml.js';
import { persistirEstoqueNfe } from '../estoquePersistirNfe.js';
import { baixarNfesWorkexpress } from './workexpressClient.js';
import { JANELA_NF_DIAS } from '../estoqueFornecedorCredencial.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..', '..', '..', '..');

function log(...a) {
  console.log('[idealwork-nfe]', ...a);
}

export async function syncNfeIdealWork({
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

  const outDir = path.join(projectRoot, 'Logs', 'idealwork-nfe', String(idLoja));
  fs.mkdirSync(outDir, { recursive: true });

  const downloads = await baixarNfesWorkexpress({
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
    try {
      nfe = parseNfeXml(dl.xml);
    } catch (e) {
      processadas.push({ notaLabel: dl.chave, ok: false, erro: e.message });
      continue;
    }
    const xmlPath = path.join(outDir, `${nfe.chave || dl.chave}.xml`);
    fs.writeFileSync(xmlPath, dl.xml, 'utf8');
    processadas.push(
      await persistirEstoqueNfe({
        idLoja,
        fornecedor: 'idealwork',
        nfe,
        arquivoPath: xmlPath,
        statusPortal: `pedido ${dl.id_pedido}`,
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
