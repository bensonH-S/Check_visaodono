export const ALIAS_LOJAS = {
  'bk asa s': '408 SUL',
  'bk asa sul': '408 SUL',
  'bk 201n': '201 NORTE',
  'bk 201 norte': '201 NORTE',
  'bk carref': 'SEBASTI',
  'bk ss': 'SEBASTI',
  'bk lago': 'LAGO SUL',
  'bk estrut': 'ESTRUTURAL',
  'bk plaza': 'PLAZA',
  'bk caldas': 'CALDAS',
  'bk sudo': 'SUDOESTE',
  'bk unai': 'UNAI',
  'bk 707 n': '706/7',
  'bk 707 norte': '706/7',
  'bk ceila': 'CEILANDIA',
  'bk ceilandia': 'CEILANDIA',
  'bk venan': 'VENANCIO',
  'bk venancio': 'VENANCIO',
  'bk ceilndia': 'CEILANDIA',
  'bk so sebastio': 'SEBASTI',
  'bk venncio': 'VENANCIO',
  'bk planal': 'PLANALTINA',
  'bk recanto': 'RECANTO',
  'bk sobradin': 'SOBRADINHO',
  'bk terrao': 'TERRACO',
  'bk terraco': 'TERRACO',
  'bk noro': 'NOROESTE',
  'bk sama': 'SAMBAIA',
  'bk samambaia': 'SAMBAIA',
  'bk ponte': 'PONTE ALTA',
  'bk gilberto': 'LAGO SUL',
  'bk sao sebastiao': 'SEBASTI',
  'bk caldas novas': 'CALDAS',
  'bk df plaza': 'PLAZA',
  popeyes: 'POPYES',
  'popeyes val': 'POPYES',
  popval: 'POPYES',
};

export function norm(s) {
  return String(s || '')
    .replace(/\uFFFD/g, '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const ABREVS_POR_SUFIXO = [
  ['408 SUL', ['asa s', 'asa sul', '408 sul', '408']],
  ['201 NORTE', ['201n', '201 norte', '201 n']],
  ['SEBASTI', ['ss', 'sao sebastiao', 'sebastiao']],
  ['LAGO SUL', ['lago', 'gilberto']],
  ['ESTRUTURAL', ['estrut', 'estrutural']],
  ['PLAZA', ['plaza', 'df plaza']],
  ['CALDAS', ['caldas', 'caldas novas']],
  ['SUDOESTE', ['sudo', 'sudoeste']],
  ['UNAI', ['unai', 'unai']],
  ['706/7', ['707 n', '707n', '706/7', '707 norte']],
  ['CEILANDIA', ['ceila', 'ceilandia']],
  ['VENANCIO', ['venan', 'venancio']],
  ['PLANALTINA', ['planal', 'planaltina']],
  ['RECANTO', ['recanto']],
  ['SOBRADINHO', ['sobradin', 'sobradinho']],
  ['TERRACO', ['terrao', 'terrac', 'terraco shopping']],
  ['NOROESTE', ['noro', 'noroeste']],
  ['SAMBAIA', ['sama', 'samambaia', 'sambaia']],
  ['PONTE ALTA', ['ponte', 'ponte alta', 'gama']],
  ['POPYES', ['popeyes', 'popeyes val', 'valparaiso']],
];

export function buildLojaIndex(lojas) {
  const index = new Map();
  const lista = [];

  function registrar(loja, chave) {
    const k = norm(chave);
    if (!k || k.length < 2) return;
    if (!index.has(k)) {
      index.set(k, loja);
      lista.push({ chave: k, loja });
    }
  }

  for (const loja of lojas) {
    const nomeNorm = norm(loja.name);
    if (nomeNorm.startsWith('ga -')) continue;

    registrar(loja, loja.name);
    if (loja.bk_number) {
      registrar(loja, loja.bk_number);
      registrar(loja, `bkn ${loja.bk_number}`);
    }

    const semPrefixo = loja.name
      .replace(/^BURGER KING\s*-\s*/i, '')
      .replace(/^POPYES\s*-\s*/i, '')
      .trim();
    registrar(loja, semPrefixo);
    registrar(loja, `BK ${semPrefixo}`);

    const sufixoNorm = norm(semPrefixo);
    for (const [trecho, abrevs] of ABREVS_POR_SUFIXO) {
      const t = norm(trecho);
      if (sufixoNorm.includes(t) || t.includes(sufixoNorm.split(' ')[0])) {
        for (const a of abrevs) registrar(loja, `bk ${a}`);
        registrar(loja, trecho);
      }
    }
  }

  return { index, lista };
}

export async function carregarLojas(client) {
  const { rows } = await client.query(
    `SELECT id_loja, name, bk_number FROM lojas WHERE is_active = TRUE`,
  );
  const { index, lista } = buildLojaIndex(rows);
  return { rows, index, lista };
}

function rotulosParaMatch(rotulo) {
  const base = String(rotulo || '');
  const sem = base.replace(/\uFFFD/g, '');
  return [...new Set([base, sem, base.replace(/\uFFFD/g, 'a'), base.replace(/\uFFFD/g, 'i')])];
}

export function resolverLoja(lojasDb, rotulo) {
  for (const candidato of rotulosParaMatch(rotulo)) {
    const hit = resolverLojaUma(lojasDb, candidato);
    if (hit) return hit;
  }
  return null;
}

function resolverLojaUma(lojasDb, rotulo) {
  const n = norm(rotulo);
  if (!n) return null;

  const { index, lista, rows } = lojasDb;

  // Subway Unaí não é BK Unaí — não entra no ranking das lojas Burger King.
  if (n.includes('subway')) {
    return rows.find((l) => norm(l.name).includes('subway')) || null;
  }

  if (index.has(n)) return index.get(n);

  const semBk = n.replace(/^bk\s+/, '');
  if (index.has(semBk)) return index.get(semBk);
  if (index.has(`bk ${semBk}`)) return index.get(`bk ${semBk}`);

  const alias = ALIAS_LOJAS[n];
  if (alias) {
    const alvo = norm(alias);
    if (index.has(alvo)) return index.get(alvo);
    const hit = lista.find(({ chave }) => chave.includes(alvo) || alvo.includes(chave));
    if (hit) return hit.loja;
  }

  const candidatas = rows.filter((l) => !norm(l.name).startsWith('ga -'));
  let melhor = null;
  let melhorScore = 0;
  for (const loja of candidatas) {
    const ln = norm(loja.name);
    const sufixo = ln.replace(/^burger king\s*-\s*/, '').replace(/^popyes\s*-\s*/, '');
    let score = 0;
    if (ln.includes(n) || n.includes(sufixo)) {
      score = Math.max(n.length, sufixo.length) + 5;
    } else {
      const palavras = semBk.split(/\s+/).filter((p) => p.length >= 3);
      for (const p of palavras) {
        if (sufixo.includes(p)) score += p.length;
      }
    }
    if (score > melhorScore) {
      melhorScore = score;
      melhor = loja;
    }
  }
  return melhorScore >= 3 ? melhor : null;
}
