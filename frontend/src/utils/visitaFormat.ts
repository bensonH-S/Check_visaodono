export function formatarLocalVisita(v: {
  city?: string | null;
  state?: string | null;
  neighborhood?: string | null;
}): string {
  const bairro = v.neighborhood?.trim();
  const cidade = v.city?.trim();
  const uf = v.state?.trim();
  const cidadeUf = cidade && uf ? `${cidade}/${uf}` : cidade || uf || '';
  if (bairro && cidadeUf) return `${bairro} · ${cidadeUf}`;
  return bairro || cidadeUf || '—';
}

export function formatarHoraVisita(hora?: string | null): string | null {
  if (!hora?.trim()) return null;
  return hora.trim().slice(0, 5);
}
