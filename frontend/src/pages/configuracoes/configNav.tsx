import AssignmentIcon from '@mui/icons-material/Assignment';
import PeopleIcon from '@mui/icons-material/People';
import StoreIcon from '@mui/icons-material/Store';
import CategoryIcon from '@mui/icons-material/Category';
import ScheduleIcon from '@mui/icons-material/Schedule';
import BadgeIcon from '@mui/icons-material/Badge';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import HistoryIcon from '@mui/icons-material/History';
import { getUsuario, temPermissao, podeVerAuditoria } from '../../lib/auth';
import type { UsuarioSessao } from '../../lib/auth';

export type ConfigNavItem = {
  to: string;
  label: string;
  icon: React.ReactNode;
  permissoes: string[];
  /** Regra extra (ex.: cargo CEO/Diretor). Se falhar, o item some mesmo com permissão. */
  regra?: (user: UsuarioSessao | null) => boolean;
};

export type ConfigNavSection = {
  title: string;
  items: ConfigNavItem[];
};

const CONFIG_NAV: ConfigNavSection[] = [
  {
    title: 'Checklist',
    items: [
      {
        to: '/configuracoes/perguntas',
        label: 'Perguntas',
        icon: <AssignmentIcon fontSize="small" />,
        permissoes: ['configuracoes.ver'],
      },
    ],
  },
  {
    title: 'Cadastros',
    items: [
      {
        to: '/configuracoes/usuarios',
        label: 'Usuários',
        icon: <PeopleIcon fontSize="small" />,
        permissoes: ['usuarios.gerenciar'],
      },
      {
        to: '/configuracoes/lojas',
        label: 'Lojas',
        icon: <StoreIcon fontSize="small" />,
        permissoes: ['portal.lojas.ver'],
      },
    ],
  },
  {
    title: 'Sistema',
    items: [
      {
        to: '/configuracoes/auditoria',
        label: 'Auditoria',
        icon: <HistoryIcon fontSize="small" />,
        permissoes: [],
        regra: podeVerAuditoria,
      },
    ],
  },
  {
    title: 'Manutenção',
    items: [
      {
        to: '/configuracoes/categorias',
        label: 'Categorias',
        icon: <CategoryIcon fontSize="small" />,
        permissoes: ['configuracoes.ver'],
      },
      {
        to: '/configuracoes/sla',
        label: 'SLA',
        icon: <ScheduleIcon fontSize="small" />,
        permissoes: ['configuracoes.ver'],
      },
      {
        to: '/configuracoes/cargos',
        label: 'Cargos',
        icon: <BadgeIcon fontSize="small" />,
        permissoes: ['configuracoes.ver'],
      },
      {
        to: '/configuracoes/whatsapp',
        label: 'WhatsApp',
        icon: <WhatsAppIcon fontSize="small" sx={{ color: '#25D366' }} />,
        permissoes: ['configuracoes.ver'],
      },
    ],
  },
];

function itemVisivel(item: ConfigNavItem, user: UsuarioSessao | null) {
  if (item.regra && !item.regra(user)) return false;
  if (!item.permissoes.length) return Boolean(item.regra?.(user));
  return item.permissoes.some((p) => temPermissao(p, user));
}

export function getConfigNavSections(user: UsuarioSessao | null = getUsuario()) {
  return CONFIG_NAV.map((section) => ({
    ...section,
    items: section.items.filter((item) => itemVisivel(item, user)),
  })).filter((section) => section.items.length > 0);
}

export function primeiraRotaConfig(user: UsuarioSessao | null = getUsuario()) {
  return getConfigNavSections(user)[0]?.items[0]?.to ?? '/';
}
