import XLSX from 'xlsx';

function simNao(v) {
  return v === false ? 'Nao' : 'Sim';
}

function montarLinha(p) {
  return {
    codigo: p.codigo || '',
    descricao: p.descricao || '',
    secao: String(p.secao_contagem || '').trim() || 'OUTROS',
    und: String(p.unidade_contagem || 'UND').toUpperCase(),
    caixa: simNao(p.permite_contagem_caixa),
    pc_fd: simNao(p.permite_contagem_pc_fd),
    kg_und: simNao(p.permite_contagem_kg_und),
    _diaria: p.contagem_diaria === true,
    _critica: p.contagem_critica === true,
  };
}

function colunasPlanilha(linhas) {
  return linhas.map((l) => ({
    Codigo: l.codigo,
    Descricao: l.descricao,
    Secao: l.secao,
    UND: l.und,
    Caixa: l.caixa,
    'Pc/fd': l.pc_fd,
    'Kg/und': l.kg_und,
  }));
}

function sheetFrom(linhas) {
  const ws = XLSX.utils.json_to_sheet(colunasPlanilha(linhas));
  ws['!cols'] = [
    { wch: 12 },
    { wch: 52 },
    { wch: 18 },
    { wch: 8 },
    { wch: 8 },
    { wch: 8 },
    { wch: 8 },
  ];
  return ws;
}

export function montarWorkbookClassificacao({ linhas }) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheetFrom(linhas), 'Todos');
  XLSX.utils.book_append_sheet(
    wb,
    sheetFrom(linhas.filter((l) => l._diaria)),
    'Diario',
  );
  XLSX.utils.book_append_sheet(
    wb,
    sheetFrom(linhas.filter((l) => l._critica)),
    'Semanal',
  );
  return wb;
}

export function classificarInsumos(rows) {
  return rows.map(montarLinha);
}

export function workbookParaBuffer(wb) {
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}
