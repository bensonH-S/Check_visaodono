/**
 * Parser leve de XML NF-e + casamento com insumos (sem deps).
 */
import { inflateRawSync } from 'zlib';

function tag(xml, name) {
  const re = new RegExp(`<(?:\\w+:)?${name}[^>]*>([\\s\\S]*?)</(?:\\w+:)?${name}>`, 'i');
  const m = String(xml || '').match(re);
  return m ? m[1].trim() : '';
}

function tagsAll(xml, name) {
  const re = new RegExp(`<(?:\\w+:)?${name}[^>]*>([\\s\\S]*?)</(?:\\w+:)?${name}>`, 'gi');
  const out = [];
  let m;
  while ((m = re.exec(String(xml || ''))) !== null) out.push(m[1]);
  return out;
}

function numBr(v, fallback = 0) {
  if (v == null || v === '') return fallback;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
}

export function normalizarTxt(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function ehUnidadeCaixa(uCom) {
  const u = normalizarTxt(uCom);
  return /^(CX|CXA|CAIXA|FD|FARDO|PC|PACOTE|DZ|DUZIA|SC|SACO)$/.test(u);
}

/** Extrai o primeiro XML de um ZIP de NF-e (store/deflate). */
export function unzipFirstXml(zipBuf) {
  const buf = Buffer.isBuffer(zipBuf) ? zipBuf : Buffer.from(zipBuf);
  let offset = 0;
  while (offset + 30 <= buf.length) {
    if (buf.readUInt32LE(offset) !== 0x04034b50) break;
    const method = buf.readUInt16LE(offset + 8);
    const flags = buf.readUInt16LE(offset + 6);
    const compSize = buf.readUInt32LE(offset + 18);
    const nameLen = buf.readUInt16LE(offset + 26);
    const extraLen = buf.readUInt16LE(offset + 28);
    const name = buf.slice(offset + 30, offset + 30 + nameLen).toString('utf8');
    const dataStart = offset + 30 + nameLen + extraLen;
    if (flags & 0x08) {
      throw Object.assign(new Error(`ZIP com data descriptor não suportado: ${name}`), {
        status: 400,
      });
    }
    const data = buf.slice(dataStart, dataStart + compSize);
    offset = dataStart + compSize;
    if (!/\.xml$/i.test(name)) continue;
    if (method === 0) return data.toString('utf8');
    if (method === 8) return inflateRawSync(data).toString('utf8');
    throw Object.assign(new Error(`Método ZIP ${method} não suportado`), { status: 400 });
  }
  throw Object.assign(new Error('XML não encontrado no ZIP da NF-e'), { status: 400 });
}

export function parseNfeXml(xmlRaw) {
  const xml = String(xmlRaw || '').replace(/^\uFEFF/, '').trim();
  if (!xml) throw Object.assign(new Error('XML vazio'), { status: 400 });

  const inf = tag(xml, 'infNFe') || xml;
  const ide = tag(inf, 'ide');
  const emit = tag(inf, 'emit');
  const dest = tag(inf, 'dest');
  const total = tag(inf, 'total');
  const icmsTot = tag(total, 'ICMSTot');

  const chaveMatch = xml.match(/Id=["']NFe(\d{44})["']/i) || xml.match(/\b(\d{44})\b/);
  const chave = chaveMatch ? chaveMatch[1] : '';
  const dhEmi = tag(ide, 'dhEmi') || tag(ide, 'dEmi');
  const emissao = dhEmi ? String(dhEmi).slice(0, 10) : null;

  const itens = tagsAll(inf, 'det').map((det, idx) => {
    const prod = tag(det, 'prod');
    return {
      nItem: numBr(tag(det, 'nItem') || idx + 1, idx + 1),
      codigo: String(tag(prod, 'cProd') || '').trim(),
      ean: String(tag(prod, 'cEAN') || '').trim(),
      descricao: String(tag(prod, 'xProd') || '').trim(),
      uCom: String(tag(prod, 'uCom') || '').trim(),
      qCom: numBr(tag(prod, 'qCom')),
      vUnCom: numBr(tag(prod, 'vUnCom')),
      vProd: numBr(tag(prod, 'vProd')),
    };
  });

  if (!itens.length) {
    throw Object.assign(new Error('Nenhum item na NF-e'), { status: 400 });
  }

  return {
    chave,
    numero: String(tag(ide, 'nNF') || '').trim(),
    serie: String(tag(ide, 'serie') || '').trim(),
    emissao,
    valor_total: numBr(tag(icmsTot, 'vNF')),
    emitente: {
      cnpj: String(tag(emit, 'CNPJ') || tag(emit, 'CPF') || '').trim(),
      nome: String(tag(emit, 'xNome') || '').trim(),
    },
    destinatario: {
      cnpj: String(tag(dest, 'CNPJ') || tag(dest, 'CPF') || '').trim(),
      nome: String(tag(dest, 'xNome') || '').trim(),
    },
    itens,
  };
}

export function casarItensNfe(itensNfe, insumosLoja) {
  const byCod = new Map();
  const byDesc = new Map();
  for (const ins of insumosLoja || []) {
    const cod = String(ins.codigo || '').trim().toUpperCase();
    if (cod) byCod.set(cod, ins);
    const d = normalizarTxt(ins.descricao);
    if (d) byDesc.set(d, ins);
  }

  return (itensNfe || []).map((it) => {
    const codNf = String(it.codigo || '').trim().toUpperCase();
    let match = codNf ? byCod.get(codNf) : null;
    let match_tipo = match ? 'codigo' : null;

    if (!match && it.ean && it.ean !== 'SEM GTIN') {
      match = byCod.get(String(it.ean).trim().toUpperCase()) || null;
      if (match) match_tipo = 'ean';
    }

    if (!match) {
      const dNf = normalizarTxt(it.descricao);
      if (dNf && byDesc.has(dNf)) {
        match = byDesc.get(dNf);
        match_tipo = 'descricao_exata';
      } else if (dNf) {
        let melhor = null;
        let melhorScore = 0;
        const tokens = dNf.split(' ').filter((t) => t.length >= 4).slice(0, 8);
        for (const [dIns, ins] of byDesc) {
          let score = 0;
          for (const t of tokens) if (dIns.includes(t)) score += 1;
          if (score >= 3 && score > melhorScore) {
            melhorScore = score;
            melhor = ins;
          }
        }
        if (melhor) {
          match = melhor;
          match_tipo = 'descricao_parcial';
        }
      }
    }

    const und = match ? Number(match.und_convertida) || 1 : 1;
    const caixa = ehUnidadeCaixa(it.uCom);
    const preco_caixa = caixa ? it.vUnCom : Math.round(it.vUnCom * und * 100) / 100;
    const qtd_estoque = caixa ? Math.round(it.qCom * und * 10000) / 10000 : it.qCom;

    return {
      ...it,
      match: match
        ? {
            id_insumo: match.id_insumo,
            codigo: match.codigo,
            descricao: match.descricao,
            und_convertida: und,
          }
        : null,
      match_tipo,
      sugerido: { preco_caixa, qtd_estoque, eh_caixa: caixa },
    };
  });
}
