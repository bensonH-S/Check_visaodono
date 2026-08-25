/**
 * Parse do Excel de Vendas exportado do BK Office (relatório CMV).
 * Formato esperado: Relatório "Restaurante e Produto Venda" / "Produto Venda".
 */
import fs from 'fs';
import XLSX from 'xlsx';

function normHeader(v) {
  return String(v || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function parseNumeroBR(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  let s = String(v).trim();
  if (!s) return null;
  if (s.includes(',') && s.includes('.')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  s = s.replace(/[^\d.-]/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function excelDateToISO(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10);
  }
  if (typeof v === 'number' && Number.isFinite(v)) {
    const parsed = XLSX.SSF.parse_date_code(v);
    if (parsed) {
      const mm = String(parsed.m).padStart(2, '0');
      const dd = String(parsed.d).padStart(2, '0');
      return `${parsed.y}-${mm}-${dd}`;
    }
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (m) {
    return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return null;
}

function mapColunas(headers) {
  const idx = {};
  headers.forEach((h, i) => {
    const n = normHeader(h);
    if (!n) return;

    if (n === 'produto venda' || n === 'sku' || n === 'cod produto') {
      idx.codigo = i;
      return;
    }
    if (n === 'bk number' || n === 'bknumber' || n === 'bk') {
      idx.bk_number = i;
      return;
    }
    if (n === 'quantidade' || n === 'qtde' || n === 'qtd' || n === 'qty') {
      idx.qtde = i;
      return;
    }
    if (
      n.includes('venda b') ||
      n === 'venda bruta' ||
      n === 'bruta' ||
      n === 'bruto' ||
      n === 'gross sales' ||
      // Relatório Produto Venda: coluna "Valor" ≈ bruto (antes da líquida)
      n === 'valor'
    ) {
      idx.venda_bruta = i;
      return;
    }
    if (n.includes('venda l') || n === 'venda liquida' || n === 'liquida' || n === 'net sales') {
      idx.venda_liquida = i;
      return;
    }
    if (n === 'descricao' || n.includes('descric')) {
      idx.descricao = i;
      return;
    }
    if (n === 'restaurante' || n === 'loja') {
      idx.restaurante = i;
      return;
    }
    if (n.includes('data') || n === 'dia') {
      if (idx.data == null) idx.data = i;
      return;
    }
    // fallback genérico (por último)
    if ((n === 'codigo' || n === 'cod') && idx.codigo == null) {
      idx.codigo = i;
    }
  });
  return idx;
}

/**
 * @param {Buffer|ArrayBuffer|Uint8Array} buffer
 * @param {{ dataPadrao?: string|null, bkNumber?: string|null }} opts
 */
export function parseVendasExcelBuffer(buffer, opts = {}) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });
  if (!rows.length) return [];

  let headerRow = 0;
  let colMap = {};
  for (let r = 0; r < Math.min(rows.length, 30); r++) {
    const map = mapColunas(rows[r]);
    // Relatório de produto precisa de código + quantidade
    if (map.codigo != null && map.qtde != null) {
      headerRow = r;
      colMap = map;
      break;
    }
  }

  if (colMap.codigo == null || colMap.qtde == null) {
    return [];
  }

  const filtroBk = opts.bkNumber ? String(opts.bkNumber).trim() : null;
  const out = [];

  for (let r = headerRow + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || !row.length) continue;

    const codigo = String(row[colMap.codigo] ?? '').trim();
    if (!codigo || !/^\d+$/.test(codigo)) continue;

    const descricao =
      colMap.descricao != null ? String(row[colMap.descricao] ?? '').trim() : '';
    const qtde = parseNumeroBR(row[colMap.qtde]);
    if (qtde == null || qtde <= 0) continue;

    const bk_number =
      colMap.bk_number != null ? String(row[colMap.bk_number] ?? '').trim() : '';
    if (filtroBk) {
      const a = String(bk_number).replace(/\D/g, '');
      const b = String(filtroBk).replace(/\D/g, '');
      if (!a || a !== b) continue;
    }

    const restaurante =
      colMap.restaurante != null ? String(row[colMap.restaurante] ?? '').trim() : '';
    const data_venda =
      excelDateToISO(colMap.data != null ? row[colMap.data] : null) || opts.dataPadrao || null;
    const venda_bruta = parseNumeroBR(
      colMap.venda_bruta != null ? row[colMap.venda_bruta] : null,
    );
    const venda_liquida_col = parseNumeroBR(
      colMap.venda_liquida != null ? row[colMap.venda_liquida] : null,
    );
    // CMV da franquia usa venda BRUTA do BK Office (não a líquida).
    const venda_liquida = venda_bruta != null ? venda_bruta : venda_liquida_col;

    out.push({
      data_venda,
      codigo,
      descricao,
      qtde,
      venda_liquida,
      venda_bruta: venda_bruta != null ? venda_bruta : undefined,
      bk_number: bk_number || undefined,
      restaurante: restaurante || undefined,
    });
  }

  return out;
}

export function parseVendasExcelFile(filePath, opts = {}) {
  const buffer = fs.readFileSync(filePath);
  return parseVendasExcelBuffer(buffer, opts);
}

function soDigitos(v) {
  return String(v || '').replace(/\D/g, '');
}

function normNome(v) {
  return String(v || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/burger\s*king/g, '')
    .replace(/popyes/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

function resolverLojaVenda(item, lojas, byBkn) {
  const bkn = soDigitos(item.bk_number);
  if (bkn && byBkn.has(bkn)) return byBkn.get(bkn);
  const rest = String(item.restaurante || '');
  if (!rest) return null;
  for (const l of lojas) {
    const n = soDigitos(l.bk_number);
    if (n && rest.includes(n)) return l;
  }
  const chave = normNome(rest);
  if (!chave) return null;
  for (const l of lojas) {
    const nome = normNome(l.name);
    if (nome && (nome.includes(chave) || chave.includes(nome))) return l;
  }
  return null;
}

/**
 * Quebra o Excel do grupo (várias lojas) em baldes por id_loja.
 */
export function agruparItensPorLoja(itens, lojas) {
  const byBkn = new Map();
  for (const l of lojas) {
    const n = soDigitos(l.bk_number);
    if (n) byBkn.set(n, l);
  }
  const grupos = new Map();
  const semLoja = [];
  for (const item of itens) {
    const loja = resolverLojaVenda(item, lojas, byBkn);
    if (!loja) {
      semLoja.push(item);
      continue;
    }
    if (!grupos.has(loja.id_loja)) grupos.set(loja.id_loja, { loja, itens: [] });
    grupos.get(loja.id_loja).itens.push(item);
  }
  return { grupos, semLoja };
}
