import type { ReactNode } from 'react';
import DashboardIcon from '@mui/icons-material/Dashboard';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import AssignmentIcon from '@mui/icons-material/Assignment';
import HistoryIcon from '@mui/icons-material/History';
import StoreIcon from '@mui/icons-material/Store';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import BuildIcon from '@mui/icons-material/Build';
import AddIcon from '@mui/icons-material/Add';
import PeopleIcon from '@mui/icons-material/People';
import SettingsIcon from '@mui/icons-material/Settings';
import CategoryIcon from '@mui/icons-material/Category';
import ScheduleIcon from '@mui/icons-material/Schedule';
import DescriptionIcon from '@mui/icons-material/Description';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ThumbUpAltOutlinedIcon from '@mui/icons-material/ThumbUpAltOutlined';
import BadgeIcon from '@mui/icons-material/Badge';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import EmailIcon from '@mui/icons-material/Email';
import NotificationsIcon from '@mui/icons-material/Notifications';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import MapIcon from '@mui/icons-material/Map';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import TrackChangesIcon from '@mui/icons-material/TrackChanges';
import TuneIcon from '@mui/icons-material/Tune';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import BoltIcon from '@mui/icons-material/Bolt';
import TimelineIcon from '@mui/icons-material/Timeline';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import LanguageIcon from '@mui/icons-material/Language';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';

import { colors } from '../theme/tokens';

const iconSx = { fontSize: 20, color: colors.textPrimary };

export type PageTitleConfig = {
  title: string;
  subtitle?: string;
  titleEn?: string;
  subtitleEn?: string;
  icon: ReactNode;
};

export const PAGE_TITLES: Record<string, PageTitleConfig> = {
  '/dashboard': { title: 'Command Center', subtitle: 'Caixa da semana, canais e contagem da rede', icon: <DashboardIcon sx={iconSx} /> },
  '/': { title: 'Command Center', subtitle: 'Finanças, contagem e estoque da rede', icon: <DashboardIcon sx={iconSx} /> },
  '/ranking': { title: 'Ranking de Lojas', icon: <EmojiEventsIcon sx={iconSx} /> },
  '/inicio/mobile': { title: 'Início', icon: <DashboardIcon sx={iconSx} /> },
  '/checklist': { title: 'AutoREV', icon: <AssignmentIcon sx={iconSx} /> },
  '/visitas': { title: 'Histórico de Visitas', icon: <HistoryIcon sx={iconSx} /> },
  '/portais': { title: 'Portais', icon: <LanguageIcon sx={iconSx} /> },
  '/portais/mobile': { title: 'Portais', icon: <LanguageIcon sx={iconSx} /> },
  '/lojas': { title: 'Lojas', icon: <StoreIcon sx={iconSx} /> },
  '/nao-conformidades': { title: 'Não Conformidades', icon: <WarningAmberIcon sx={iconSx} /> },
  '/chamados': { title: 'Chamados', icon: <BuildIcon sx={iconSx} /> },
  '/energia': { title: 'Energia', icon: <BoltIcon sx={iconSx} /> },
  '/energia/novo': { title: 'Registrar ocorrência', icon: <BoltIcon sx={iconSx} /> },
  '/financeiro': {
    title: 'Agenda banco',
    titleEn: 'Bank schedule',
    subtitle: 'Lote da semana · planilha BANCO',
    subtitleEn: 'Week batch · BANK spreadsheet',
    icon: <PaymentsOutlinedIcon sx={iconSx} />,
  },
  '/financeiro/inbox': {
    title: 'Inbox',
    titleEn: 'Inbox',
    subtitle: 'DDA e notas da Receita Federal',
    subtitleEn: 'DDA and Receita Federal invoices',
    icon: <PaymentsOutlinedIcon sx={iconSx} />,
  },
  '/financeiro/conciliacao': {
    title: 'Conciliação',
    titleEn: 'Reconciliation',
    subtitle: 'Calendário do mês · concilia o dia no extrato',
    subtitleEn: 'Month calendar · reconcile the day on the statement',
    icon: <PaymentsOutlinedIcon sx={iconSx} />,
  },
  '/financeiro/caixa': {
    title: 'Fechamento de caixa',
    titleEn: 'Cash closing',
    icon: <PaymentsOutlinedIcon sx={iconSx} />,
  },
  '/financeiro/vendas': {
    title: 'Vendas',
    titleEn: 'Sales',
    icon: <PaymentsOutlinedIcon sx={iconSx} />,
  },
  '/chamados/novo': { title: 'Abrir chamado', icon: <AddIcon sx={iconSx} /> },
  '/chamados/aprovacoes': { title: 'Aprovações', icon: <ThumbUpAltOutlinedIcon sx={iconSx} /> },
  '/frota': { title: 'Frota', icon: <DirectionsCarIcon sx={iconSx} /> },
  '/frota/operacao': { title: 'Frota. Cadastro', icon: <DirectionsCarIcon sx={iconSx} /> },
  '/frota/operacao/cadastro': { title: 'Frota. Cadastro', icon: <DirectionsCarIcon sx={iconSx} /> },
  '/frota/operacao/combustivel': { title: 'Frota. Combustível', icon: <DirectionsCarIcon sx={iconSx} /> },
  '/frota/operacao/manutencoes': { title: 'Frota. Manutenções', icon: <DirectionsCarIcon sx={iconSx} /> },
  '/frota/operacao/multas': { title: 'Frota. Multas', icon: <DirectionsCarIcon sx={iconSx} /> },
  '/frota/operacao/debitos': { title: 'Frota. Débitos', icon: <DirectionsCarIcon sx={iconSx} /> },
  '/frota/veiculos': { title: 'Frota. Cadastro', icon: <DirectionsCarIcon sx={iconSx} /> },
  '/frota/acompanhamento': { title: 'Frota. Acompanhamento', icon: <TimelineIcon sx={iconSx} /> },
  '/frota/relatorio-km': { title: 'Frota. Acompanhamento', icon: <TimelineIcon sx={iconSx} /> },
  '/frota/relatorio-rotas': { title: 'Frota. Acompanhamento', icon: <TimelineIcon sx={iconSx} /> },
  '/frota/relatorio-velocidade': { title: 'Frota. Acompanhamento', icon: <TimelineIcon sx={iconSx} /> },
  '/frota/uso': { title: 'Frota. Cadastro', icon: <DirectionsCarIcon sx={iconSx} /> },
  '/frota/combustivel': { title: 'Frota. Combustível', icon: <DirectionsCarIcon sx={iconSx} /> },
  '/frota/manutencoes': { title: 'Frota. Manutenções', icon: <DirectionsCarIcon sx={iconSx} /> },
  '/frota/termos': { title: 'Frota. Termos', icon: <AssignmentTurnedInIcon sx={iconSx} /> },
  '/frota/regioes': { title: 'Frota. Regiões', icon: <MapIcon sx={iconSx} /> },
  '/escalas/visitas': { title: 'Escala de visitas', icon: <CalendarMonthIcon sx={iconSx} /> },
  '/metas': { title: 'Metas', icon: <TrackChangesIcon sx={iconSx} /> },
  '/estoque': { title: 'Estoque', icon: <Inventory2Icon sx={iconSx} /> },
  '/estoque/cmv': { title: 'Estoque', icon: <Inventory2Icon sx={iconSx} /> },
  '/estoque/vendas': { title: 'Estoque', icon: <Inventory2Icon sx={iconSx} /> },
  '/estoque/estoque': { title: 'Estoque', icon: <Inventory2Icon sx={iconSx} /> },
  '/estoque/saldo': { title: 'Estoque', icon: <Inventory2Icon sx={iconSx} /> },
  '/estoque/conferencia': { title: 'Estoque', icon: <Inventory2Icon sx={iconSx} /> },
  '/estoque/break': { title: 'Estoque', icon: <Inventory2Icon sx={iconSx} /> },
  '/estoque/pedido': { title: 'Estoque', icon: <Inventory2Icon sx={iconSx} /> },
  '/estoque/fichas': { title: 'Estoque', icon: <Inventory2Icon sx={iconSx} /> },
  '/estoque/piloto': { title: 'Estoque', icon: <Inventory2Icon sx={iconSx} /> },
  '/estoque/mobile': { title: 'Estoque. Conferência', icon: <Inventory2Icon sx={iconSx} /> },
  '/estoque/mobile/break': { title: 'Estoque. Break', icon: <Inventory2Icon sx={iconSx} /> },
  '/usuarios': { title: 'Gestão de usuários', icon: <PeopleIcon sx={iconSx} /> },
  '/configuracoes': { title: 'Configuração', icon: <SettingsIcon sx={iconSx} /> },
  '/configuracoes/canais': { title: 'Canais do app', icon: <TuneIcon sx={iconSx} /> },
  '/configuracoes/perguntas': { title: 'Checklist perguntas', icon: <AssignmentIcon sx={iconSx} /> },
  '/configuracoes/usuarios': { title: 'Usuários', icon: <PeopleIcon sx={iconSx} /> },
  '/configuracoes/lojas': { title: 'Empresas', icon: <StoreIcon sx={iconSx} /> },
  '/configuracoes/financeiro/empresas': { title: 'Empresas', icon: <StoreIcon sx={iconSx} /> },
  '/configuracoes/categorias': { title: 'Categorias', icon: <CategoryIcon sx={iconSx} /> },
  '/configuracoes/sla': { title: 'SLA', icon: <ScheduleIcon sx={iconSx} /> },
  '/cargos': { title: 'Permissões & Cargos', icon: <BadgeIcon sx={iconSx} /> },
  '/permissoes': { title: 'Permissões & Cargos', icon: <BadgeIcon sx={iconSx} /> },
  '/configuracoes/cargos': { title: 'Permissões', icon: <BadgeIcon sx={iconSx} /> },
  '/configuracoes/whatsapp': { title: 'WhatsApp', icon: <WhatsAppIcon sx={{ fontSize: 22, color: '#25D366' }} /> },
  '/configuracoes/agente-alvim': { title: 'Agente Alvim', icon: <SmartToyOutlinedIcon sx={iconSx} /> },
  '/configuracoes/smtp': { title: 'SMTP', icon: <EmailIcon sx={iconSx} /> },
  '/configuracoes/estoque-sync-nf': { title: 'Sync NF estoque', icon: <LocalShippingIcon sx={iconSx} /> },
  '/configuracoes/contagem': { title: 'Configuração da Contagem', icon: <Inventory2Icon sx={iconSx} /> },
  '/configuracoes/notificacoes': { title: 'Notificações', icon: <NotificationsIcon sx={iconSx} /> },
  '/configuracoes/auditoria': { title: 'Auditoria', icon: <HistoryIcon sx={iconSx} /> },
  '/configuracoes/financeiro': {
    title: 'Financeiro',
    titleEn: 'Finance',
    icon: <PaymentsOutlinedIcon sx={iconSx} />,
  },
  '/relatorio': { title: 'Relatório da Visita', icon: <DescriptionIcon sx={iconSx} /> },
};

function comIdioma(cfg: PageTitleConfig, idioma: 'pt' | 'en' = 'pt'): PageTitleConfig {
  if (idioma !== 'en') return cfg;
  return {
    ...cfg,
    title: cfg.titleEn || cfg.title,
    subtitle: cfg.subtitleEn || cfg.subtitle,
  };
}

export function resolvePageTitle(path: string, idioma: 'pt' | 'en' = 'pt'): PageTitleConfig {
  if (PAGE_TITLES[path]) return comIdioma(PAGE_TITLES[path], idioma);
  if (path.startsWith('/checklist/concluido')) {
    return { title: idioma === 'en' ? 'Visit completed' : 'Visita concluída', icon: <CheckCircleIcon sx={iconSx} /> };
  }
  if (path.startsWith('/relatorio/')) return comIdioma(PAGE_TITLES['/relatorio'], idioma);
  if (path.startsWith('/frota/operacao')) {
    return comIdioma(PAGE_TITLES[path] ?? PAGE_TITLES['/frota/operacao/cadastro'], idioma);
  }
  if (path.startsWith('/frota/veiculos/')) {
    return { title: idioma === 'en' ? 'Fleet. Vehicle' : 'Frota. Veículo', icon: <DirectionsCarIcon sx={iconSx} /> };
  }
  if (path.startsWith('/frota/')) return comIdioma(PAGE_TITLES[path] ?? PAGE_TITLES['/frota'], idioma);
  if (path.startsWith('/chamados/aprovacoes/')) return comIdioma(PAGE_TITLES['/chamados/aprovacoes'], idioma);
  if (path.startsWith('/energia/')) {
    return { title: 'Energia', icon: <BoltIcon sx={iconSx} /> };
  }
  if (path === '/financeiro' || path.startsWith('/financeiro/')) {
    return comIdioma(PAGE_TITLES[path] ?? PAGE_TITLES['/financeiro'], idioma);
  }
  if (path.startsWith('/chamados/')) return comIdioma(PAGE_TITLES['/chamados'], idioma);
  if (path.startsWith('/configuracoes/financeiro')) {
    return comIdioma(PAGE_TITLES['/configuracoes/financeiro'], idioma);
  }
  if (path.startsWith('/configuracoes/')) {
    return comIdioma(PAGE_TITLES[path] ?? PAGE_TITLES['/configuracoes'], idioma);
  }
  if (path === '/estoque' || path.startsWith('/estoque/')) {
    if (path.startsWith('/estoque/mobile/') && path !== '/estoque/mobile/break') {
      return { title: idioma === 'en' ? 'Stock. Count' : 'Estoque. Conferência', icon: <Inventory2Icon sx={iconSx} /> };
    }
    return comIdioma(PAGE_TITLES[path] ?? PAGE_TITLES['/estoque'], idioma);
  }
  return { title: 'Portal Grupo Alvim', icon: <DashboardIcon sx={iconSx} /> };
}
