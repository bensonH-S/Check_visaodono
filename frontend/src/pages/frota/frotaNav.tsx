import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import PersonPinCircleIcon from '@mui/icons-material/PersonPinCircle';
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation';
import BuildIcon from '@mui/icons-material/Build';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import TimelineIcon from '@mui/icons-material/Timeline';
import MapIcon from '@mui/icons-material/Map';
import {
  getUsuario,
  temPermissao,
  podeGerenciarFrota,
  podeGerenciarRegioesFrota,
} from '../../lib/auth';
import type { UsuarioSessao } from '../../lib/auth';

export type FrotaNavItem = {
  to: string;
  label: string;
  icon: React.ReactNode;
  /** Se vazio, usa `regra`. */
  permissoes: string[];
  regra?: (user: UsuarioSessao | null) => boolean;
};

export type FrotaNavSection = {
  title: string;
  items: FrotaNavItem[];
};

const FROTA_NAV: FrotaNavSection[] = [
  {
    title: 'Operação',
    items: [
      {
        to: '/frota/veiculos',
        label: 'Veículos',
        icon: <DirectionsCarIcon fontSize="small" />,
        permissoes: ['frota.gerenciar'],
      },
      {
        to: '/frota/uso',
        label: 'Uso',
        icon: <PersonPinCircleIcon fontSize="small" />,
        permissoes: ['frota.gerenciar'],
      },
      {
        to: '/frota/combustivel',
        label: 'Combustível',
        icon: <LocalGasStationIcon fontSize="small" />,
        permissoes: ['frota.gerenciar'],
      },
      {
        to: '/frota/manutencoes',
        label: 'Manutenções',
        icon: <BuildIcon fontSize="small" />,
        permissoes: ['frota.gerenciar'],
      },
      {
        to: '/frota/termos',
        label: 'Termos',
        icon: <AssignmentTurnedInIcon fontSize="small" />,
        permissoes: ['frota.gerenciar'],
      },
    ],
  },
  {
    title: 'Relatórios',
    items: [
      {
        to: '/frota/acompanhamento',
        label: 'Acompanhamento',
        icon: <TimelineIcon fontSize="small" />,
        permissoes: ['frota.gerenciar'],
      },
    ],
  },
  {
    title: 'Configuração',
    items: [
      {
        to: '/frota/regioes',
        label: 'Regiões',
        icon: <MapIcon fontSize="small" />,
        permissoes: ['frota.gerenciar', 'frota.regioes'],
        regra: (user) => podeGerenciarRegioesFrota(user),
      },
    ],
  },
];

function itemVisivel(item: FrotaNavItem, user: UsuarioSessao | null) {
  if (item.regra && !item.regra(user)) return false;
  if (!item.permissoes.length) return Boolean(item.regra?.(user));
  return item.permissoes.some((p) => temPermissao(p, user));
}

export function getFrotaNavSections(user: UsuarioSessao | null = getUsuario()) {
  return FROTA_NAV.map((section) => ({
    ...section,
    items: section.items.filter((item) => itemVisivel(item, user)),
  })).filter((section) => section.items.length > 0);
}

export function primeiraRotaFrota(user: UsuarioSessao | null = getUsuario()) {
  return getFrotaNavSections(user)[0]?.items[0]?.to ?? '/frota/veiculos';
}

export function podeAcessarModuloFrota(user: UsuarioSessao | null = getUsuario()) {
  return podeGerenciarFrota(user) || podeGerenciarRegioesFrota(user);
}

export function isFrotaNavItemAtivo(path: string, itemTo: string) {
  return path === itemTo || path.startsWith(`${itemTo}/`);
}
