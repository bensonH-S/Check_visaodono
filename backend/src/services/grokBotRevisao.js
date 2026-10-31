/**
 * Pede a revisão ao processo local. Não mexe na quantidade calculada.
 * Ponte fora do ar ou sem chave: lista vazia, a tela segue sem marca.
 */

const URL_PADRAO = 'http://127.0.0.1:8787/revisar';

export async function revisarSugestaoGrokBot({ loja, itens } = {}) {
  const lista = Array.isArray(itens) ? itens.slice(0, 60) : [];
  if (!lista.length) return { ok: false, itens: [] };
  const url = String(process.env.GROK_BOT_BRIDGE_URL || URL_PADRAO).trim();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const resposta = await fetch(url, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loja: loja || '', itens: lista }),
    });
    if (!resposta.ok) return { ok: false, itens: [] };
    const json = await resposta.json();
    const marcas = Array.isArray(json?.itens) ? json.itens : [];
    return {
      ok: Boolean(json?.ok) && marcas.length > 0,
      itens: marcas
        .filter((item) => item && ['certo', 'errado', 'ajustar'].includes(item.flag))
        .map((item) => ({
          codigo: String(item.codigo || '').trim().toUpperCase(),
          flag: item.flag,
          motivo: String(item.motivo || '').slice(0, 160),
        }))
        .filter((item) => item.codigo),
    };
  } catch {
    return { ok: false, itens: [] };
  } finally {
    clearTimeout(timer);
  }
}
