/**
 * Classifica despesa tributária pelo texto (descrição, fornecedor, plano, documento).
 * Base para selo na Agenda e futura checagem na Receita/Fazenda.
 */

const REGRAS = [
  { tipo: 'iptu', re: /\biptu\b/i },
  { tipo: 'pis', re: /\bpis\b(?!\w)/i },
  { tipo: 'cofins', re: /\bcofins\b/i },
  { tipo: 'icms_difal', re: /\bdifal\b|\bicms[\s\-]*difal\b|\bicms[\s\-]*st\b|\bsubstitui[cç][aã]o\s+tribut/i },
  { tipo: 'icms', re: /\bicms\b/i },
  { tipo: 'iss', re: /\biss(?:qn)?\b/i },
  { tipo: 'fgts', re: /\bfgts\b|\bgfd\b/i },
  { tipo: 'inss', re: /\binss\b|\bgps\b/i },
  { tipo: 'irrf', re: /\birrf\b|\birpj\b|\bcsll\b/i },
  { tipo: 'darf', re: /\bdarf\b|\bpgfn\b|\bsispar\b|receitas?\s+federais/i },
  { tipo: 'simples', re: /\bdas\b|\bsimples\s+nacional\b|\bmei\b/i },
]

const ROTULO = {
  iptu: 'IPTU',
  pis: 'PIS',
  cofins: 'COFINS',
  icms_difal: 'ICMS DIFAL',
  icms: 'ICMS',
  iss: 'ISS',
  fgts: 'FGTS',
  inss: 'INSS',
  irrf: 'IRRF/CSLL',
  darf: 'DARF',
  simples: 'Simples/DAS',
  outro_tributo: 'Tributo',
}

/** Portais oficiais para dupla checagem (abrir em nova aba). */
const PORTAL = {
  iptu: 'https://www.gov.br/pt-br/servicos',
  pis: 'https://cav.receita.fazenda.gov.br/autenticacao/login',
  cofins: 'https://cav.receita.fazenda.gov.br/autenticacao/login',
  icms_difal: 'https://www.nfe.fazenda.gov.br/portal/principal.aspx',
  icms: 'https://www.nfe.fazenda.gov.br/portal/principal.aspx',
  iss: 'https://www.gov.br/pt-br/servicos',
  fgts: 'https://www.fgts.gov.br/',
  inss: 'https://cav.receita.fazenda.gov.br/autenticacao/login',
  irrf: 'https://cav.receita.fazenda.gov.br/autenticacao/login',
  darf: 'https://cav.receita.fazenda.gov.br/autenticacao/login',
  simples: 'https://www8.receita.fazenda.gov.br/SimplesNacional/',
  outro_tributo: 'https://cav.receita.fazenda.gov.br/autenticacao/login',
}

export function rotuloTributo(tipo) {
  return ROTULO[tipo] || ''
}

export function portalTributo(tipo) {
  return PORTAL[tipo] || PORTAL.outro_tributo
}

export function classificarTributo({
  descricao,
  fornecedor,
  plano,
  documento_ref,
  forma_pagamento,
  freecontrol_tipo,
  fonte,
} = {}) {
  // Free Control não é tributo (freelance/treino).
  if (String(fonte || '').toLowerCase() === 'freecontrol') return null
  if (String(freecontrol_tipo || '')) return null

  const blob = [
    descricao,
    fornecedor,
    plano,
    documento_ref,
    forma_pagamento === 'guia' ? 'guia' : '',
  ]
    .map((x) => String(x || ''))
    .join(' ')

  if (!blob.trim()) return null

  for (const regra of REGRAS) {
    if (regra.re.test(blob)) return regra.tipo
  }

  // Guia genérica com palavras fiscais
  if (/\bguia\b/i.test(blob) && /\b(tribut|imposto|contribuic|arrecad)/i.test(blob)) {
    return 'outro_tributo'
  }
  return null
}

export function ehTributo(despesa) {
  return !!classificarTributo(despesa) || !!despesa?.tributo_tipo
}
