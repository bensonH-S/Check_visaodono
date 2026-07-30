/**
 * Parse do Excel de Vendas exportado do BK Office (relatório CMV).
 * Aceita variações de cabeçalho comuns no export.
 */
import * as XLSX from 'xlsx';

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
  // 22.545,39 ou 22545.39
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
  // dd/mm/yyyy
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
    if (
      n.includes('codigo') ||
      n === 'venda' ||
      n === 'cod' ||
      n === 'cod produto' ||
      n === 'produto venda'
    ) {
      if (idx.codigo == null && !n.includes('restaurante') && !n.includes('liquida')) {
        idx.codigo = i;
      }
    }
    if (n.includes('descricao') || n === 'produto' || n.includes('descric')) {
      if (idx.descricao == null) idx.descricao = i;
    }
    if (n === 'qtde' || n === 'qtd' || n.includes('quantidade') || n === 'qty') {
      if (idx.qtde == null) idx.qtde = i;
    }
    if (n.includes('venda l') || n.includes('liquida') || n === 'venda liquida') {
      if (idx.venda_liquida == null) idx.venda_liquida = i;
    }
    if (n.includes('data') || n === 'dia' || n.includes('periodo')) {
      if (idx.data == null) idx.data = i;
    }
    if (n.includes('restaurante') || n.includes('loja') || n.includes('plk')) {
      if (idx.restaurante == null) idx.restaurante = i;
    }
  });
  return idx;
}

/**
 * Detecta código + descrição em células misturadas (ex.: "1050 WHOPPER/Q").
 */
function splitCodigoDescricao(raw) {
  const s = String(raw || '').trim();
  if (!s) return { codigo: null, descricao: '' };
  const m = s.match(/^(\d+)\s+(.+)$/);
  if (m) return { codigo: m[1], descricao: m[2].trim() };
  if (/^\d+$/.test(s)) return { codigo: s, descricao: '' };
  return { codigo: s, descricao: s };
}

/**
 * @param {Buffer|ArrayBuffer|Uint8Array} buffer
 * @param {{ dataPadrao?: string|null }} opts
 * @returns {Array<{ data_venda: string|null, codigo: string, descricao: string, qtde: number, venda_liquida: number|null, restaurante?: string }>}
 */
export function parseVendasExcelBuffer(buffer, opts = {}) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });
  if (!rows.length) return [];

  // Encontra linha de cabeçalho
  let headerRow = 0;
  let colMap = {};
  for (let r = 0; r < Math.min(rows.length, 30); r++) {
    const map = mapColunas(rows[r]);
    if (map.codigo != null && (map.qtde != null || map.descricao != null)) {
      headerRow = r;
      colMap = map;
      break;
    }
  }

  if (colMap.codigo == null) {
    // Fallback: tenta layout típico BK (código | descrição | qtde ...)
    colMap = { codigo: 0, descricao: 1, qtde: 3, venda_liquida: 6, data: null };
  }

  const out = [];
  for (let r = headerRow + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || !row.length) continue;

    let codigo = String(row[colMap.codigo] ?? '').trim();
    let descricao =
      colMap.descricao != null ? String(row[colMap.descricao] ?? '').trim() : '';

    // Linhas de total / agrupamento
    if (!codigo) continue;
    const low = codigo.toLowerCase();
    if (low.includes('total') || low.includes('grupo alvim') || low.startsWith('1005196')) {
      continue;
    }

    // Às vezes código e descrição vêm na mesma coluna
    if (!descricao || /^\d+$/.test(codigo) === false) {
      const split = splitCodigoDescricao(codigo);
      if (split.codigo && /^\d+$/.test(split.codigo)) {
        codigo = split.codigo;
        if (!descricao) descricao = split.descricao;
      }
    }

    // Se a coluna "codigo" na verdade é numérica e descrição está ao lado
    if (/^\d+$/.test(codigo) && !descricao && colMap.descricao == null && row[1]) {
      descricao = String(row[1]).trim();
    }

    const qtde = parseNumeroBR(colMap.qtde != null ? row[colMap.qtde] : row[3]);
    if (qtde == null || qtde <= 0) continue;

    // Ignora linhas que parecem restaurante (código PLK longo no meio)
    if (codigo.includes(' - ') && codigo.length > 20) continue;

    const data_venda =
      excelDateToISO(colMap.data != null ? row[colMap.data] : null) || opts.dataPadrao || null;

    const venda_liquida = parseNumeroBR(
      colMap.venda_liquida != null ? row[colMap.venda_liquida] : null,
    );

    const restaurante =
      colMap.restaurante != null ? String(row[colMap.restaurante] || '').trim() : '';

    out.push({
      data_venda,
      codigo,
      descricao,
      qtde,
      venda_liquida,
      restaurante: restaurante || undefined,
    });
  }

  return out;
}

export function parseVendasExcelFile(filePath, opts = {}) {
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return parseVendasExcelBuffer(buffer, opts);
}
