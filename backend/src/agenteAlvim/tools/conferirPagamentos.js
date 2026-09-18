/**
 * Mesa financeiro — contrato vazio até o Alvim ver a planilha de pagamentos.
 * Não inventar contas a pagar no Meridian. FreeControl é hora de freelancer, não boleto.
 *
 * Quando o Excel chegar: ingestão (aba, colunas, pago / a pagar / data),
 * regras duplicado / atrasado / pago duas vezes, aviso ao cargo financeiro.
 *
 * @param {{ linhas?: object[] }} [_input]
 */
export async function conferirPagamentos(_input = {}) {
  return {
    ok: false,
    ferramenta: 'conferir_pagamentos',
    mesa: 'financeiro',
    motivo: 'aguardando_planilha',
    aviso:
      'A mesa financeiro entra quando a planilha de pagamentos for mostrada. Não misturar com FreeControl (hora de freelancer).',
    duplicados: [],
    atrasados: [],
    pago_duas_vezes: [],
  };
}

export function mesaFinanceiroLigada(config) {
  return config?.mesa_financeiro === true;
}

export async function executarMesaFinanceiro(config) {
  if (!mesaFinanceiroLigada(config)) {
    return {
      ok: false,
      ferramenta: 'conferir_pagamentos',
      mesa: 'financeiro',
      motivo: 'mesa_financeiro_desligada',
      duplicados: [],
      atrasados: [],
      pago_duas_vezes: [],
    };
  }
  return conferirPagamentos({ linhas: [] });
}
