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
import NotificationsIcon from '@mui/icons-material/Notifications';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import MapIcon from '@mui/icons-material/Map';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import TrackChangesIcon from '@mui/icons-material/TrackChanges';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import BoltIcon from '@mui/icons-material/Bolt';
import TimelineIcon from '@mui/icons-material/Timeline';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import LanguageIcon from '@mui/icons-material/Language';

import { colors } from '../theme/tokens';

const iconSx = { fontSize: 20, color: colors.textSecondary };

export type PageTitleConfig = {
  title: string;
  icon: ReactNode;
};

export const PAGE_TITLES: Record<string, PageTitleConfig> = {
  '/dashboard': { title: 'Início', icon: <DashboardIcon sx={iconSx} /> },
  '/': { title: 'Início', icon: <DashboardIcon sx={iconSx} /> },
  '/ranking': { title: 'Ranking de Lojas', icon: <EmojiEventsIcon sx={iconSx} /> },
  '/checklist': { title: 'Checklist', icon: <AssignmentIcon sx={iconSx} /> },
  '/visitas': { title: 'Histórico de Visitas', icon: <HistoryIcon sx={iconSx} /> },
  '/portais': { title: 'Portais', icon: <LanguageIcon sx={iconSx} /> },
  '/portais/mobile': { title: 'Portais', icon: <LanguageIcon sx={iconSx} /> },
  '/lojas': { title: 'Lojas', icon: <StoreIcon sx={iconSx} /> },
  '/nao-conformidades': { title: 'Não Conformidades', icon: <WarningAmberIcon sx={iconSx} /> },
  '/chamados': { title: 'Chamados', icon: <BuildIcon sx={iconSx} /> },
  '/energia': { title: 'Energia', icon: <BoltIcon sx={iconSx} /> },
  '/energia/novo': { title: 'Registrar ocorrência', icon: <BoltIcon sx={iconSx} /> },
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
  '/configuracoes': { title: 'Configurações', icon: <SettingsIcon sx={iconSx} /> },
  '/configuracoes/perguntas': { title: 'Checklist perguntas', icon: <AssignmentIcon sx={iconSx} /> },
  '/configuracoes/usuarios': { title: 'Gestão de usuários', icon: <PeopleIcon sx={iconSx} /> },
  '/configuracoes/lojas': { title: 'Lojas', icon: <StoreIcon sx={iconSx} /> },
  '/configuracoes/categorias': { title: 'Categorias', icon: <CategoryIcon sx={iconSx} /> },
  '/configuracoes/sla': { title: 'SLA', icon: <ScheduleIcon sx={iconSx} /> },
  '/configuracoes/cargos': { title: 'Cargos', icon: <BadgeIcon sx={iconSx} /> },
  '/configuracoes/whatsapp': { title: 'WhatsApp', icon: <WhatsAppIcon sx={{ fontSize: 22, color: '#25D366' }} /> },
  '/configuracoes/estoque-sync-nf': { title: 'Sync NF estoque', icon: <LocalShippingIcon sx={iconSx} /> },
  '/configuracoes/contagem': { title: 'Configuração da Contagem', icon: <Inventory2Icon sx={iconSx} /> },
  '/configuracoes/notificacoes': { title: 'Notificações', icon: <NotificationsIcon sx={iconSx} /> },
  '/configuracoes/auditoria': { title: 'Auditoria', icon: <HistoryIcon sx={iconSx} /> },
  '/relatorio': { title: 'Relatório da Visita', icon: <DescriptionIcon sx={iconSx} /> },
};

export function resolvePageTitle(path: string): PageTitleConfig {
  if (PAGE_TITLES[path]) return PAGE_TITLES[path];
  if (path.startsWith('/checklist/concluido')) {
    return { title: 'Visita concluída', icon: <CheckCircleIcon sx={iconSx} /> };
  }
  if (path.startsWith('/relatorio/')) return PAGE_TITLES['/relatorio'];
  if (path.startsWith('/frota/operacao')) {
    return PAGE_TITLES[path] ?? PAGE_TITLES['/frota/operacao/cadastro'];
  }
  if (path.startsWith('/frota/veiculos/')) {
    return { title: 'Frota. Veículo', icon: <DirectionsCarIcon sx={iconSx} /> };
  }
  if (path.startsWith('/frota/')) return PAGE_TITLES[path] ?? PAGE_TITLES['/frota'];
  if (path.startsWith('/chamados/aprovacoes/')) return PAGE_TITLES['/chamados/aprovacoes'];
  if (path.startsWith('/energia/')) {
    return { title: 'Energia', icon: <BoltIcon sx={iconSx} /> };
  }
  if (path.startsWith('/chamados/')) return PAGE_TITLES['/chamados'];
  if (path.startsWith('/configuracoes/')) {
    return PAGE_TITLES[path] ?? PAGE_TITLES['/configuracoes'];
  }
  if (path === '/estoque' || path.startsWith('/estoque/')) {
    if (path.startsWith('/estoque/mobile/') && path !== '/estoque/mobile/break') {
      return { title: 'Estoque. Conferência', icon: <Inventory2Icon sx={iconSx} /> };
    }
    return PAGE_TITLES[path] ?? PAGE_TITLES['/estoque'];
  }
  return { title: 'Portal Grupo Alvim', icon: <DashboardIcon sx={iconSx} /> };
}
