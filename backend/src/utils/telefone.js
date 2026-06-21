/** Normaliza telefone BR para envio WPP (55 + DDD + 9 dígitos). */
export function normalizarTelefoneBr(valor) {
  if (!valor) return null;
  let d = String(valor).replace(/\D/g, '');
  if (!d) return null;

  if (d.startsWith('55')) d = d.slice(2);
  if (d.length === 10 || d.length === 11) {
    const ddd = d.slice(0, 2);
    let local = d.slice(2);
    if (local.length === 8) local = `9${local}`;
    d = `55${ddd}${local}`;
  } else if (!String(valor).replace(/\D/g, '').startsWith('55')) {
    return null;
  } else {
    d = String(valor).replace(/\D/g, '');
  }

  if (d.length < 12 || d.length > 13) return null;
  return d;
}

export function mascaraTelefoneBr(valor) {
  const n = normalizarTelefoneBr(valor);
  if (!n) return valor || '';
  const local = n.slice(4);
  const ddd = n.slice(2, 4);
  if (local.length === 9) {
    return `(${ddd}) ${local.slice(0, 5)}-${local.slice(5)}`;
  }
  return `(${ddd}) ${local.slice(0, 4)}-${local.slice(4)}`;
}
