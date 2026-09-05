import AssignmentIcon from '@mui/icons-material/Assignment';
import CategoryIcon from '@mui/icons-material/Category';
import ScheduleIcon from '@mui/icons-material/Schedule';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import NotificationsIcon from '@mui/icons-material/Notifications';
import HistoryIcon from '@mui/icons-material/History';
import EmailIcon from '@mui/icons-material/Email';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import { getUsuario, temPermissao } from '../../lib/auth';
import type { UsuarioSessao } from '../../lib/auth';

export type ConfigNavItem = {
  to: string;
  label: string;
  icon: React.ReactNode;
  permissoes: string[];
  /** Regra extra além das permissões (uso raro). */
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
        permissoes: ['configuracoes.perguntas'],
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
        permissoes: ['configuracoes.auditoria'],
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
        to: '/configuracoes/notificacoes',
        label: 'Notificações',
        icon: <NotificationsIcon fontSize="small" />,
        permissoes: ['configuracoes.notificacoes'],
      },
      {
        to: '/configuracoes/whatsapp',
        label: 'WhatsApp',
        icon: <WhatsAppIcon fontSize="small" sx={{ color: '#25D366' }} />,
        permissoes: ['configuracoes.ver'],
      },
      {
        to: '/configuracoes/smtp',
        label: 'SMTP',
        icon: <EmailIcon fontSize="small" />,
        permissoes: ['configuracoes.ver', 'usuarios.gerenciar'],
      },
    ],
  },
  {
    title: 'Estoque',
    items: [
      {
        to: '/configuracoes/contagem',
        label: 'Configuração da Contagem',
        icon: <Inventory2Icon fontSize="small" />,
        permissoes: ['estoque.produtos'],
      },
      {
        to: '/configuracoes/estoque-sync-nf',
        label: 'Sync NF estoque',
        icon: <LocalShippingIcon fontSize="small" />,
        permissoes: ['configuracoes.ver', 'estoque.operacional'],
      },
    ],
  },
];

function itemVisivel(item: ConfigNavItem, user: UsuarioSessao | null) {
  if (!user) return false;
  if (user.perfil === 'administrador' || user.cargo_aprovacao === 'administrador') return true;
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
