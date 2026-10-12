import AssignmentIcon from '@mui/icons-material/Assignment';
import TuneIcon from '@mui/icons-material/Tune';
import CategoryIcon from '@mui/icons-material/Category';
import ScheduleIcon from '@mui/icons-material/Schedule';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import NotificationsIcon from '@mui/icons-material/Notifications';
import HistoryIcon from '@mui/icons-material/History';
import EmailIcon from '@mui/icons-material/Email';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import PeopleIcon from '@mui/icons-material/People';
import BadgeIcon from '@mui/icons-material/Badge';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import PeopleOutlinedIcon from '@mui/icons-material/PeopleOutlined';
import HubOutlinedIcon from '@mui/icons-material/HubOutlined';
import { getUsuario, temPermissao } from '../../lib/auth';
import type { UsuarioSessao } from '../../lib/auth';

export type ConfigNavItem = {
  to: string;
  label: string;
  descricao: string;
  icon: React.ReactNode;
  permissoes: string[];
  regra?: (user: UsuarioSessao | null) => boolean;
};

export type ConfigNavSection = {
  title: string;
  items: ConfigNavItem[];
};

const FIN = '/configuracoes/financeiro';
const PERM_FIN = ['financeiro.ver'];

const CONFIG_NAV: ConfigNavSection[] = [
  {
    title: 'Cadastros',
    items: [
      {
        to: `${FIN}/empresas`,
        label: 'Empresas',
        descricao: 'Lojas e holdings — CNPJ, BK e endereço.',
        icon: <StorefrontOutlinedIcon fontSize="small" />,
        permissoes: ['financeiro.ver', 'portal.lojas.ver', 'configuracoes.ver'],
      },
      {
        to: '/configuracoes/usuarios',
        label: 'Usuários',
        descricao: 'Contas de acesso ao portal e aos apps.',
        icon: <PeopleIcon fontSize="small" />,
        permissoes: ['usuarios.gerenciar'],
      },
      {
        to: '/configuracoes/cargos',
        label: 'Permissões',
        descricao: 'Cargos e o que cada um pode fazer.',
        icon: <BadgeIcon fontSize="small" />,
        permissoes: ['usuarios.gerenciar', 'configuracoes.ver'],
      },
    ],
  },
  {
    title: 'Financeiro',
    items: [
      { to: `${FIN}/contas`, label: 'Contas bancárias', descricao: 'Caixa, Banco do Brasil e Itaú.', icon: <AccountBalanceOutlinedIcon fontSize="small" />, permissoes: PERM_FIN },
      { to: `${FIN}/plano`, label: 'Plano de contas', descricao: 'Classificação do que é a pagar.', icon: <AccountTreeOutlinedIcon fontSize="small" />, permissoes: PERM_FIN },
      { to: `${FIN}/fornecedores`, label: 'Fornecedores', descricao: 'Cadastro financeiro e plano padrão.', icon: <LocalShippingOutlinedIcon fontSize="small" />, permissoes: PERM_FIN },
      { to: `${FIN}/formas`, label: 'Formas de pagamento', descricao: 'Boleto, guia e formas do freelancer.', icon: <PaymentsOutlinedIcon fontSize="small" />, permissoes: PERM_FIN },
      { to: `${FIN}/usuarios`, label: 'Aprovação', descricao: 'Quem prepara e quem autoriza.', icon: <PeopleOutlinedIcon fontSize="small" />, permissoes: PERM_FIN },
      { to: `${FIN}/bkoffice`, label: 'BK Office', descricao: 'Acesso da API de vendas.', icon: <HubOutlinedIcon fontSize="small" />, permissoes: PERM_FIN },
      { to: `${FIN}/itau`, label: 'Itaú', descricao: 'Caixa postal VAN do DDA.', icon: <AccountBalanceOutlinedIcon fontSize="small" />, permissoes: PERM_FIN },
      { to: `${FIN}/bb`, label: 'Banco do Brasil', descricao: 'API de DDA por empresa.', icon: <AccountBalanceOutlinedIcon fontSize="small" />, permissoes: PERM_FIN },
    ],
  },
  {
    title: 'Estoque',
    items: [
      {
        to: '/configuracoes/contagem',
        label: 'Padrão da contagem',
        descricao: 'Itens da diária, crítica e campos liberados.',
        icon: <Inventory2Icon fontSize="small" />,
        permissoes: ['estoque.produtos'],
      },
      {
        to: '/configuracoes/estoque-sync-nf',
        label: 'Sync NF estoque',
        descricao: 'Entrada de notas no estoque.',
        icon: <LocalShippingIcon fontSize="small" />,
        permissoes: ['configuracoes.ver', 'estoque.operacional'],
      },
    ],
  },
  {
    title: 'Operação',
    items: [
      {
        to: '/configuracoes/perguntas',
        label: 'Perguntas do checklist',
        descricao: 'Roteiro das visitas e pontos do AutoREV.',
        icon: <AssignmentIcon fontSize="small" />,
        permissoes: ['configuracoes.perguntas'],
      },
      {
        to: '/configuracoes/categorias',
        label: 'Categorias',
        descricao: 'Tipos de chamado e classificação.',
        icon: <CategoryIcon fontSize="small" />,
        permissoes: ['configuracoes.ver'],
      },
      {
        to: '/configuracoes/sla',
        label: 'SLA',
        descricao: 'Prazos e urgência dos chamados.',
        icon: <ScheduleIcon fontSize="small" />,
        permissoes: ['configuracoes.ver'],
      },
    ],
  },
  {
    title: 'Comunicação',
    items: [
      {
        to: '/configuracoes/notificacoes',
        label: 'Notificações',
        descricao: 'Quem recebe alerta e por qual canal.',
        icon: <NotificationsIcon fontSize="small" />,
        permissoes: ['configuracoes.notificacoes'],
      },
      {
        to: '/configuracoes/whatsapp',
        label: 'WhatsApp',
        descricao: 'Conexão e envio pelo WhatsApp.',
        icon: <WhatsAppIcon fontSize="small" />,
        permissoes: ['configuracoes.ver'],
      },
      {
        to: '/configuracoes/agente-alvim',
        label: 'Agente Alvim',
        descricao: 'Assistente e cobranças automáticas.',
        icon: <SmartToyOutlinedIcon fontSize="small" />,
        permissoes: ['configuracoes.ver'],
      },
      {
        to: '/configuracoes/smtp',
        label: 'E-mail (SMTP)',
        descricao: 'Servidor de e-mail do sistema.',
        icon: <EmailIcon fontSize="small" />,
        permissoes: ['configuracoes.ver', 'usuarios.gerenciar'],
      },
    ],
  },
  {
    title: 'Sistema',
    items: [
      {
        to: '/configuracoes/canais',
        label: 'Canais do app',
        descricao: 'O que aparece no portal e no celular.',
        icon: <TuneIcon fontSize="small" />,
        permissoes: ['configuracoes.ver', 'usuarios.gerenciar'],
      },
      {
        to: '/configuracoes/auditoria',
        label: 'Auditoria',
        descricao: 'Histórico de ações no sistema.',
        icon: <HistoryIcon fontSize="small" />,
        permissoes: ['configuracoes.auditoria'],
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

export function itemConfigAtivo(path: string, user: UsuarioSessao | null = getUsuario()) {
  let melhor: { section: ConfigNavSection; item: ConfigNavItem } | null = null;
  for (const section of getConfigNavSections(user)) {
    for (const item of section.items) {
      if (path === item.to || path.startsWith(`${item.to}/`)) {
        if (!melhor || item.to.length > melhor.item.to.length) melhor = { section, item };
      }
    }
  }
  return melhor;
}

export function primeiraRotaConfig(user: UsuarioSessao | null = getUsuario()) {
  return getConfigNavSections(user)[0]?.items[0]?.to ?? '/';
}
