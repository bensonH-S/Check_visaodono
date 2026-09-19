export type CanalApp = 'portal' | 'mobile';

export type ModuloCanalCodigo =
  | 'dashboard'
  | 'checklist'
  | 'chamados'
  | 'nc'
  | 'metas'
  | 'energia'
  | 'frota'
  | 'escala'
  | 'visitas'
  | 'mapa'
  | 'estoque'
  | 'break'
  | 'ranking'
  | 'freelancers'
  | 'portais';

export type ModuloCanalFlags = {
  codigo: ModuloCanalCodigo;
  nome: string;
  secao: string;
  descricao: string;
  temPortal: boolean;
  temMobile: boolean;
  portal: boolean;
  mobile: boolean;
};

export type ModulosCanalMapa = Record<ModuloCanalCodigo, ModuloCanalFlags>;

export const CATALOGO_MODULOS: readonly Omit<ModuloCanalFlags, 'portal' | 'mobile'>[] = [
  {
    codigo: 'dashboard',
    nome: 'Command Center',
    secao: 'Portal',
    descricao: 'Visão estratégica da rede.',
    temPortal: true,
    temMobile: false,
  },
  {
    codigo: 'checklist',
    nome: 'AutoREV',
    secao: 'Operação',
    descricao: 'Checklist operacional das lojas.',
    temPortal: true,
    temMobile: true,
  },
  {
    codigo: 'chamados',
    nome: 'Chamados',
    secao: 'Operação',
    descricao: 'Manutenção: abertura e acompanhamento.',
    temPortal: true,
    temMobile: true,
  },
  {
    codigo: 'nc',
    nome: 'Não Conformidades',
    secao: 'Operação',
    descricao: 'Pendências de checklist para correção.',
    temPortal: true,
    temMobile: true,
  },
  {
    codigo: 'metas',
    nome: 'Metas',
    secao: 'Operação',
    descricao: 'Indicadores, rankings e prêmios.',
    temPortal: true,
    temMobile: false,
  },
  {
    codigo: 'energia',
    nome: 'Energia',
    secao: 'Operação',
    descricao: 'Ocorrências da concessionária.',
    temPortal: true,
    temMobile: true,
  },
  {
    codigo: 'frota',
    nome: 'Frota',
    secao: 'Campo',
    descricao: 'Veículos, combustível e manutenções.',
    temPortal: true,
    temMobile: true,
  },
  {
    codigo: 'escala',
    nome: 'Planejamento',
    secao: 'Campo',
    descricao: 'Escala de visitas e gestores.',
    temPortal: true,
    temMobile: true,
  },
  {
    codigo: 'visitas',
    nome: 'Visitas',
    secao: 'Campo',
    descricao: 'Histórico de visitas e relatórios.',
    temPortal: true,
    temMobile: true,
  },
  {
    codigo: 'mapa',
    nome: 'Mapa de técnicos',
    secao: 'Campo',
    descricao: 'Localização da equipe em campo.',
    temPortal: false,
    temMobile: true,
  },
  {
    codigo: 'estoque',
    nome: 'Estoque & CMV',
    secao: 'Gestão',
    descricao: 'Contagem, saldo e CMV.',
    temPortal: true,
    temMobile: true,
  },
  {
    codigo: 'break',
    nome: 'Break',
    secao: 'Gestão',
    descricao: 'Baixa de break no celular.',
    temPortal: false,
    temMobile: true,
  },
  {
    codigo: 'ranking',
    nome: 'Indicadores',
    secao: 'Gestão',
    descricao: 'Ranking de lojas no portal.',
    temPortal: true,
    temMobile: false,
  },
  {
    codigo: 'freelancers',
    nome: 'Freelas',
    secao: 'App',
    descricao: 'Aprovação de freelancers no celular.',
    temPortal: false,
    temMobile: true,
  },
  {
    codigo: 'portais',
    nome: 'Portais',
    secao: 'App',
    descricao: 'Atalhos de sistemas no celular.',
    temPortal: false,
    temMobile: true,
  },
] as const;

function padraoPortal(item: (typeof CATALOGO_MODULOS)[number]): boolean {
  if (!item.temPortal) return false;
  return item.codigo !== 'checklist' && item.codigo !== 'chamados';
}

function padraoMobile(item: (typeof CATALOGO_MODULOS)[number]): boolean {
  return item.temMobile;
}

export const MODULOS_CANAL_PADRAO: ModulosCanalMapa = Object.fromEntries(
  CATALOGO_MODULOS.map((item) => [
    item.codigo,
    {
      ...item,
      portal: padraoPortal(item),
      mobile: padraoMobile(item),
    },
  ]),
) as ModulosCanalMapa;

export const MODULOS_CANAL_EVENT = 'meridian:modulos-canal';
const STORAGE_KEY = 'meridian.modulosCanal';

const ROTAS_PORTAL: Array<{ prefix: string; codigo: ModuloCanalCodigo }> = [
  { prefix: '/dashboard', codigo: 'dashboard' },
  { prefix: '/checklist', codigo: 'checklist' },
  { prefix: '/nao-conformidades', codigo: 'nc' },
  { prefix: '/metas', codigo: 'metas' },
  { prefix: '/chamados', codigo: 'chamados' },
  { prefix: '/energia', codigo: 'energia' },
  { prefix: '/frota', codigo: 'frota' },
  { prefix: '/escalas/visitas', codigo: 'escala' },
  { prefix: '/visitas', codigo: 'visitas' },
  { prefix: '/estoque', codigo: 'estoque' },
  { prefix: '/ranking', codigo: 'ranking' },
];

const ROTAS_MOBILE: Array<{ prefix: string; codigo: ModuloCanalCodigo }> = [
  { prefix: '/checklist/mobile', codigo: 'checklist' },
  { prefix: '/chamados/mobile', codigo: 'chamados' },
  { prefix: '/visitas/mobile', codigo: 'visitas' },
  { prefix: '/frota/mobile', codigo: 'frota' },
  { prefix: '/escalas/visitas/mobile', codigo: 'escala' },
  { prefix: '/nc/mobile', codigo: 'nc' },
  { prefix: '/estoque/mobile/break', codigo: 'break' },
  { prefix: '/estoque/mobile', codigo: 'estoque' },
  { prefix: '/energia/mobile', codigo: 'energia' },
  { prefix: '/freelancers/aprovacao/mobile', codigo: 'freelancers' },
  { prefix: '/mapa/mobile', codigo: 'mapa' },
  { prefix: '/portais/mobile', codigo: 'portais' },
];

function matchCodigo(path: string, tabela: Array<{ prefix: string; codigo: ModuloCanalCodigo }>) {
  const p = String(path || '');
  const hit = tabela
    .filter((r) => p === r.prefix || p.startsWith(`${r.prefix}/`))
    .sort((a, b) => b.prefix.length - a.prefix.length)[0];
  return hit?.codigo ?? null;
}

export function codigoModuloPortal(path: string): ModuloCanalCodigo | null {
  const p = String(path || '');
  if (p === '/chamados/aprovacoes' || p.startsWith('/chamados/aprovacoes/')) return null;
  return matchCodigo(p, ROTAS_PORTAL);
}

export function codigoModuloMobile(path: string): ModuloCanalCodigo | null {
  return matchCodigo(path, ROTAS_MOBILE);
}

export function normalizarModulosCanal(raw?: Partial<ModulosCanalMapa> | null): ModulosCanalMapa {
  const mapa = { ...MODULOS_CANAL_PADRAO };
  for (const item of CATALOGO_MODULOS) {
    const extra = raw?.[item.codigo];
    mapa[item.codigo] = {
      ...item,
      portal: item.temPortal
        ? extra?.portal !== undefined
          ? Boolean(extra.portal)
          : padraoPortal(item)
        : false,
      mobile: item.temMobile
        ? extra?.mobile !== undefined
          ? Boolean(extra.mobile)
          : padraoMobile(item)
        : false,
    };
  }
  return mapa;
}

export function moduloNoCanal(
  modulos: Partial<ModulosCanalMapa> | null | undefined,
  codigo: ModuloCanalCodigo,
  canal: CanalApp,
): boolean {
  const item = CATALOGO_MODULOS.find((m) => m.codigo === codigo);
  if (!item) return true;
  if (canal === 'portal' && !item.temPortal) return false;
  if (canal === 'mobile' && !item.temMobile) return false;
  const mapa = normalizarModulosCanal(modulos);
  return Boolean(mapa[codigo][canal]);
}

export function lerModulosCanalCache(): ModulosCanalMapa {
  if (typeof window === 'undefined') return MODULOS_CANAL_PADRAO;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return MODULOS_CANAL_PADRAO;
    return normalizarModulosCanal(JSON.parse(raw));
  } catch {
    return MODULOS_CANAL_PADRAO;
  }
}

export function gravarModulosCanalCache(modulos: Partial<ModulosCanalMapa> | null | undefined) {
  const mapa = normalizarModulosCanal(modulos);
  if (typeof window === 'undefined') return mapa;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(mapa));
    window.dispatchEvent(new CustomEvent(MODULOS_CANAL_EVENT, { detail: mapa }));
  } catch {
    /* ignore quota */
  }
  return mapa;
}
