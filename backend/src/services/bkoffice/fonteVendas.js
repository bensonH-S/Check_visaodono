/**
 * Fonte das vendas BK Office.
 *
 * Padrão: API oficial (origem bkoffice_api).
 * O Excel/Playwright continua no código, mas só roda com BKOFFICE_EXCEL_SYNC=1
 * ou BKOFFICE_VENDAS_FONTE=excel.
 */

export const ORIGEM_API = 'bkoffice_api';
export const ORIGEM_EXCEL = 'bkoffice';

/**
 * Dia que já tem venda da API não entra de novo pelo Excel.
 * Relatórios e CMV teórico usam uma fonte por loja/dia.
 */
export const SQL_VENDA_FONTE_BK = `
  v.origem IN ('bkoffice_api', 'bkoffice')
  AND NOT (
    v.origem = 'bkoffice'
    AND EXISTS (
      SELECT 1
      FROM estoque_vendas api_pref
      WHERE api_pref.id_loja = v.id_loja
        AND api_pref.data_venda = v.data_venda
        AND api_pref.origem = 'bkoffice_api'
    )
  )
`;

export const FILTRO_VENDA_BK = `AND ${SQL_VENDA_FONTE_BK}`;

export function excelSyncLegadoAtivo(env = process.env) {
  const flag = String(env.BKOFFICE_EXCEL_SYNC ?? '').trim().toLowerCase();
  if (flag === '1' || flag === 'true' || flag === 'sim') return true;
  if (flag === '0' || flag === 'false' || flag === 'nao' || flag === 'não') return false;
  const fonte = String(env.BKOFFICE_VENDAS_FONTE || 'api').trim().toLowerCase();
  return fonte === 'excel';
}

export function apiSyncAtivo(env = process.env) {
  const flag = String(env.BKOFFICE_API_SYNC ?? '').trim().toLowerCase();
  if (flag === '0' || flag === 'false' || flag === 'nao' || flag === 'não') return false;
  if (flag === '1' || flag === 'true' || flag === 'sim') return true;
  return !excelSyncLegadoAtivo(env);
}

export function erroExcelLegadoDesligado() {
  return Object.assign(
    new Error(
      'Importação de vendas por Excel está desligada (legado). Defina BKOFFICE_EXCEL_SYNC=1 para reativar. A fonte padrão é a API BK Office.',
    ),
    { status: 409, code: 'EXCEL_LEGADO_DESLIGADO' },
  );
}
