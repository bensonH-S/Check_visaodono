const RE_SO_DATA = /^(\d{4})-(\d{2})-(\d{2})/;

export function fmtNota(n) {
  if (n == null) return '—';
  return `${Number(n).toFixed(0)}%`;
}

export function fmtData(d) {
  if (d == null || d === '') return '—';
  const s = String(d).trim();
  const m = RE_SO_DATA.exec(s);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  if (d instanceof Date && !Number.isNaN(d.getTime())) {
    const y = d.getUTCFullYear();
    const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${day}/${mo}/${y}`;
  }
  return s.slice(0, 10);
}

export function formatarLocalVisita(v) {
  const bairro = v.neighborhood?.trim();
  const cidade = v.city?.trim();
  const uf = v.state?.trim();
  const cidadeUf = cidade && uf ? `${cidade}/${uf}` : cidade || uf || '';
  if (bairro && cidadeUf) return `${bairro} · ${cidadeUf}`;
  return bairro || cidadeUf || '—';
}

export function formatarHoraVisita(hora) {
  if (!hora?.trim()) return null;
  return hora.trim().slice(0, 5);
}
