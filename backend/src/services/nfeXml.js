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
  return /^(CX|CXA|CAIXA|FD|FARDO|PC|PCT|PACOTE|DZ|DUZIA|SC|SACO)$/.test(u);
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
  const dhSaiEnt = tag(ide, 'dhSaiEnt') || tag(ide, 'dSaiEnt');
  const data_saida = dhSaiEnt ? String(dhSaiEnt).slice(0, 10) : null;

  const cobr = tag(inf, 'cobr');
  const vencimentos = tagsAll(cobr || inf, 'dVenc')
    .map((s) => String(s || '').trim().slice(0, 10))
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort();
  const data_vencimento = vencimentos[0] || null;

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
    /** Saída/expedição do fornecedor (não é chegada na loja; usado como sugestão). */
    data_saida,
    /** Primeira duplicata (cobr/dup/dVenc). Compras do mês usam esta data. */
    data_vencimento,
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

/** Sinônimos / ruído de descrição de NF × planilha Terraço. */
export function normalizarDescProduto(s) {
  let t = ` ${normalizarTxt(s)} `;
  const reps = [
    // "BAG IN BOX18L" / "BAG IN BOX 10L" (BOX colado no número)
    [/\bBAG\s*IN\s*BOX\s*/g, ' BAG '],
    [/\bBIB\b/g, ' BAG '],
    [/\bS\/A\b/g, ' '],
    [/\bSEM ACUCAR\b/g, ' ZERO '],
    [/\bLAR\b/g, ' LARANJA '],
    [/\bGUAR\b/g, ' GUARANA '],
    [/\bGUARANALATA\b/g, ' GUARANA LATA '],
    [/\bGUARANA\s*LATA\b/g, ' GUARANA LATA '],
    [/\bUND\b/g, ' UN '],
    [/\bUNID\b/g, ' UN '],
    [/\bCX COM\b/g, ' CX '],
    [/\bCOM\b/g, ' '],
    [/\bCOCA COLA\b/g, ' COCACOLA '],
    [/\bCOCA\-COLA\b/g, ' COCACOLA '],
    [/\bCOCACOLA\b/g, ' COCACOLA '],
    // "COCA BAG" (sem COLA na NF Brasal)
    [/\bCOCA\b/g, ' COCACOLA '],
  ];
  for (const [re, to] of reps) t = t.replace(re, to);
  // Pack latas: 6X310ML
  t = t.replace(/\b(\d+)\s*X\s*(\d+)\s*(ML|UN|UND|G|GR|KG)\b/g, ' $1UN $2 $3 ');
  t = t.replace(/\b(\d+)UN\b/g, ' $1 UN ');
  t = t.replace(/\b(\d+)ML\b/g, ' $1 ML ');
  // Volume free refill: 10L / 18 LT / 18,9L — NÃO virar LATA
  t = t.replace(/\b(\d+[.,]?\d*)\s*LTS?\b/g, ' $1 LITROS ');
  t = t.replace(/\b(\d+[.,]?\d*)\s*L\b/g, ' $1 LITROS ');
  // Lata por extenso permanece; LT isolado (sem número) → LATA
  t = t.replace(/\bLT\b/g, ' LATA ');
  t = t.replace(/\bLATA\b/g, ' LATA ');
  return t.replace(/\s+/g, ' ').trim();
}

const STOP_TOKENS = new Set([
  'BK',
  'BKC',
  'CX',
  'FD',
  'UN',
  'UND',
  'KG',
  'GR',
  'ML',
  'LT',
  'COM',
  'PARA',
  'ESTADO',
  'NATURAL',
  'CLEAN',
  'NAC',
  'REFRICON',
]);

/** Família de embalagem — impede BAG casar com LATA e vice-versa. */
export function familiaEmbalagem(descNorm) {
  const d = ` ${descNorm || ''} `;
  if (/\bLATA\b/.test(d)) return 'lata';
  if (/\bBAG\b|\bBIB\b/.test(d)) return 'bag';
  if (/\bSACHE\b/.test(d)) return 'sache';
  return 'outro';
}

function ehZeroDiet(descNorm) {
  return /\bZERO\b|\bDIET\b|\bLIGHT\b/.test(` ${descNorm || ''} `);
}

function tokensProduto(descNorm) {
  return String(descNorm || '')
    .split(' ')
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !STOP_TOKENS.has(t) && !/^\d+$/.test(t));
}

function scoreDesc(tokensNf, dIns) {
  let score = 0;
  for (const t of tokensNf) {
    if (dIns.includes(t)) score += t.length >= 5 ? 2 : 1;
  }
  return score;
}

function fortesCompartilhados(tokensNf, dIns) {
  return tokensNf.filter((t) => t.length >= 4 && dIns.includes(t));
}

/** Marcas / âncoras que a NF cita — o insumo precisa conter as mesmas. */
const MARCAS = [
  'FANTA',
  'SPRITE',
  'COCACOLA',
  'PEPSI',
  'HEINZ',
  'NUTELLA',
  'ANTARTICA',
  'ANTARCTICA',
  'LIPTON',
  'SCOTSMAN',
  'BACONESE',
  'STACKER',
  'MINIONS',
  'PATRULHA',
  'BAUNILHA',
  'PISTACHE',
];

function marcasEm(descNorm) {
  const d = ` ${descNorm || ''} `;
  return MARCAS.filter((m) => d.includes(` ${m} `) || d.startsWith(`${m} `) || d.includes(` ${m}`));
}

function marcasCompativeis(dNf, dIns) {
  const a = marcasEm(dNf);
  if (!a.length) return true;
  return a.every((m) => dIns.includes(m));
}

function familiaCompativel(famNf, famIns, dIns = '') {
  // BAG da NF → catálogo BAG; ou outro sem cara de lata/refri (ex.: Baconese).
  if (famNf === 'bag') {
    if (famIns === 'bag') return true;
    if (famIns === 'outro' && !/\bLATA\b|\b\d+\s*ML\b/.test(dIns)) return true;
    return false;
  }
  if (famNf === 'lata') return famIns === 'lata' || famIns === 'outro';
  if (famNf === 'sache') return famIns === 'sache' || famIns === 'outro';
  if (famIns === 'bag' && famNf !== 'bag') return false;
  return true;
}

export function casarItensNfe(itensNfe, insumosLoja) {
  const byCod = new Map();
  const byDesc = new Map();
  const insumosNorm = [];
  for (const ins of insumosLoja || []) {
    const cod = String(ins.codigo || '').trim().toUpperCase();
    // Só código exato — NÃO strip de zeros (020754≠20754 no catálogo Terraço).
    if (cod) byCod.set(cod, ins);
    const d = normalizarDescProduto(ins.descricao);
    if (d) byDesc.set(d, ins);
    insumosNorm.push({ ins, d, fam: familiaEmbalagem(d), tokens: tokensProduto(d) });
  }

  return (itensNfe || []).map((it) => {
    const codNf = String(it.codigo || '').trim().toUpperCase();
    // Tenta código NF exato e versão com zeros à esquerda (mesmo código de catálogo).
    let match = (codNf && byCod.get(codNf)) || null;
    if (!match && /^\d+$/.test(codNf)) {
      for (const pad of [6, 5, 4]) {
        const padded = codNf.padStart(pad, '0');
        if (byCod.has(padded)) {
          match = byCod.get(padded);
          break;
        }
      }
      // Também aceita catálogo sem zero se o código do catálogo for idêntico ao NF padded
      // ex.: NF 31887 e catálogo 31887 — já coberto pelo exact.
    }
    let match_tipo = match ? 'codigo' : null;

    if (!match && it.ean && it.ean !== 'SEM GTIN') {
      match = byCod.get(String(it.ean).trim().toUpperCase()) || null;
      if (match) match_tipo = 'ean';
    }

    if (!match) {
      const dNf = normalizarDescProduto(it.descricao);
      const famNf = familiaEmbalagem(dNf);
      if (dNf && byDesc.has(dNf)) {
        match = byDesc.get(dNf);
        match_tipo = 'descricao_exata';
      } else if (dNf) {
        let melhor = null;
        let melhorScore = 0;
        let empate = false;
        const tokens = tokensProduto(dNf).slice(0, 10);
        const zeroNf = ehZeroDiet(dNf);
        const candidatos = [];
        for (const row of insumosNorm) {
          if (!familiaCompativel(famNf, row.fam, row.d)) continue;
          if (zeroNf !== ehZeroDiet(row.d)) continue;
          if (!marcasCompativeis(dNf, row.d)) continue;
          // Não casar pares incompatíveis (molho×queijo, fundo×tampa, etc.)
          const conflitos = ['MOLHO', 'FUNDO', 'TAMPA', 'COPO', 'CANUDO'];
          let conflito = false;
          for (const w of conflitos) {
            const re = new RegExp(`\\b${w}\\b`);
            if (re.test(row.d) !== re.test(dNf) && re.test(`${row.d} ${dNf}`)) {
              conflito = true;
              break;
            }
          }
          if (conflito) continue;
          const fortes = fortesCompartilhados(tokens, row.d);
          if (!fortes.length) continue;
          let score = scoreDesc(tokens, row.d);
          const overlap = tokens.filter((t) => row.d.includes(t)).length;
          score += overlap * 0.01;
          // Números da NF (300ML, FD12) desempata sucos/packs parecidos
          const nums = String(it.descricao || '').match(/\d+/g) || [];
          for (const n of nums) {
            if (n.length >= 2 && row.d.includes(n)) score += 0.4;
          }
          if (score < 2) continue;
          candidatos.push({ row, score, fortes, overlap });
        }
        for (const c of candidatos) {
          const unicoForte = c.fortes.every(
            (f) => candidatos.filter((x) => x.row.d.includes(f)).length === 1,
          );
          const ok = c.score >= 3 || (c.score >= 2 && unicoForte);
          if (!ok) continue;
          if (c.score > melhorScore + 1e-9) {
            melhorScore = c.score;
            melhor = c.row.ins;
            empate = false;
          } else if (
            Math.abs(c.score - melhorScore) <= 1e-9 &&
            melhor &&
            c.row.ins.id_insumo !== melhor.id_insumo
          ) {
            empate = true;
          }
        }
        if (melhor && !empate) {
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

function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtMoedaBr(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDataBr(iso) {
  if (!iso) return '—';
  const s = String(iso).slice(0, 10);
  const [y, m, d] = s.split('-');
  return y && m && d ? `${d}/${m}/${y}` : s;
}

/** HTML legível estilo DANFE (mobile) a partir do XML parseado. */
export function renderDanfeHtml(parsed) {
  const itensRows = (parsed.itens || [])
    .map(
      (it) => `<tr>
      <td>${escHtml(it.nItem)}</td>
      <td>${escHtml(it.codigo)}</td>
      <td>${escHtml(it.descricao)}</td>
      <td class="num">${escHtml(it.qCom)} ${escHtml(it.uCom || '')}</td>
      <td class="num">${fmtMoedaBr(it.vUnCom)}</td>
      <td class="num">${fmtMoedaBr(it.vProd)}</td>
    </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>DANFE NF ${escHtml(parsed.numero || '')}</title>
  <style>
    :root { color-scheme: light; }
    body { margin: 0; font: 14px/1.35 system-ui, sans-serif; color: #142048; background: #f3f1ec; }
    .wrap { max-width: 920px; margin: 0 auto; padding: 16px 14px 40px; }
    h1 { font-size: 1.15rem; margin: 0 0 4px; }
    .muted { color: #5b647a; font-size: 0.85rem; }
    .card { background: #fff; border: 1px solid #d7dbe7; border-radius: 12px; padding: 14px; margin-top: 12px; }
    .grid { display: grid; gap: 8px; grid-template-columns: 1fr 1fr; }
    @media (max-width: 640px) { .grid { grid-template-columns: 1fr; } }
    table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
    th, td { border-bottom: 1px solid #e6e9f2; padding: 8px 6px; text-align: left; vertical-align: top; }
    th { font-size: 0.72rem; text-transform: uppercase; letter-spacing: .04em; color: #5b647a; }
    td.num, th.num { text-align: right; white-space: nowrap; }
    .chave { word-break: break-all; font-family: ui-monospace, monospace; font-size: 0.78rem; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>DANFE · NF-e ${escHtml(parsed.numero || '—')} série ${escHtml(parsed.serie || '—')}</h1>
    <p class="muted">Documento auxiliar gerado a partir do XML da nota</p>
    <div class="card grid">
      <div><strong>Emitente</strong><br/>${escHtml(parsed.emitente?.nome || '—')}<br/><span class="muted">${escHtml(parsed.emitente?.cnpj || '')}</span></div>
      <div><strong>Destinatário</strong><br/>${escHtml(parsed.destinatario?.nome || '—')}<br/><span class="muted">${escHtml(parsed.destinatario?.cnpj || '')}</span></div>
      <div><strong>Emissão</strong><br/>${escHtml(fmtDataBr(parsed.emissao))}</div>
      <div><strong>Saída</strong><br/>${escHtml(fmtDataBr(parsed.data_saida))}</div>
      <div><strong>Valor total</strong><br/>${fmtMoedaBr(parsed.valor_total)}</div>
      <div><strong>Chave</strong><br/><span class="chave">${escHtml(parsed.chave || '—')}</span></div>
    </div>
    <div class="card" style="overflow:auto">
      <table>
        <thead>
          <tr>
            <th>#</th><th>Cód.</th><th>Produto</th>
            <th class="num">Qtd</th><th class="num">Unit.</th><th class="num">Total</th>
          </tr>
        </thead>
        <tbody>${itensRows}</tbody>
      </table>
    </div>
  </div>
</body>
</html>`;
}
