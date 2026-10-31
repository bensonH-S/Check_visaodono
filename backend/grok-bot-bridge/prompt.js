/**
 * Revisão do pedido. A quantidade já foi calculada. O modelo só marca.
 * Não devolve caixa nova.
 */

export const FLAGS = ['certo', 'errado', 'ajustar'];

export function montarPrompt(loja, itens) {
  const linhas = itens.map((item) => ({
    codigo: String(item.codigo || '').trim(),
    descricao: String(item.descricao || '').slice(0, 80),
    caixas: Number(item.caixas) || 0,
    estoque: Number(item.estoque) || 0,
    unidade: String(item.unidade || 'und'),
    ritmo_dia: Number(item.ritmo_dia) || 0,
    cobertura_dias: item.cobertura_dias == null ? null : Number(item.cobertura_dias),
  }));
  return [
    'Você revisa uma sugestão de pedido de restaurante. A quantidade em caixas já foi calculada por uma regra fixa. Não recalcule e não proponha um número novo de caixas.',
    'Para cada item, escolha uma marca:',
    '- certo: a quantidade combina com o estoque e o ritmo',
    '- errado: a quantidade destoa (estoque alto demais para pedir isso, ou ritmo baixo)',
    '- ajustar: a direção parece certa, mas a quantidade pede uma olhada',
    'motivo: uma frase curta em português, no máximo 14 palavras. Sem preço, sem pedido de compra.',
    'Responda só JSON neste formato: {"itens":[{"codigo":"...","flag":"certo","motivo":"..."}]}',
    'Copie o codigo exatamente como veio.',
    `Loja: ${String(loja || '').slice(0, 80)}`,
    JSON.stringify(linhas),
  ].join('\n');
}

export function interpretarRevisao(texto, codigosValidos) {
  const bruto = String(texto || '').trim();
  const inicio = bruto.indexOf('{');
  const fim = bruto.lastIndexOf('}');
  if (inicio < 0 || fim <= inicio) return [];
  let json;
  try {
    json = JSON.parse(bruto.slice(inicio, fim + 1));
  } catch {
    return [];
  }
  const lista = Array.isArray(json?.itens) ? json.itens : [];
  const permitidos = new Set((codigosValidos || []).map((c) => String(c || '').trim().toUpperCase()));
  const saida = [];
  const vistos = new Set();
  for (const item of lista) {
    const codigo = String(item?.codigo || '').trim().toUpperCase();
    const flag = String(item?.flag || '').trim().toLowerCase();
    if (!codigo || !permitidos.has(codigo) || !FLAGS.includes(flag) || vistos.has(codigo)) continue;
    vistos.add(codigo);
    saida.push({
      codigo,
      flag,
      motivo: String(item?.motivo || '').replace(/\s+/g, ' ').trim().slice(0, 160),
    });
  }
  return saida;
}
