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

const NAVY = '#1B2A6B';

const iconSx = { fontSize: 22, color: NAVY };

export type PageTitleConfig = {
  title: string;
  icon: ReactNode;
};

export const PAGE_TITLES: Record<string, PageTitleConfig> = {
  '/': { title: 'Início', icon: <DashboardIcon sx={iconSx} /> },
  '/ranking': { title: 'Ranking de Lojas', icon: <EmojiEventsIcon sx={iconSx} /> },
  '/checklist': { title: 'Checklist — Visão de Dono', icon: <AssignmentIcon sx={iconSx} /> },
  '/visitas': { title: 'Histórico de Visitas', icon: <HistoryIcon sx={iconSx} /> },
  '/lojas': { title: 'Lojas', icon: <StoreIcon sx={iconSx} /> },
  '/nao-conformidades': { title: 'Não Conformidades', icon: <WarningAmberIcon sx={iconSx} /> },
  '/chamados': { title: 'Chamados', icon: <BuildIcon sx={iconSx} /> },
  '/chamados/novo': { title: 'Abrir chamado', icon: <AddIcon sx={iconSx} /> },
  '/chamados/aprovacoes': { title: 'Aprovações', icon: <ThumbUpAltOutlinedIcon sx={iconSx} /> },
  '/usuarios': { title: 'Gestão de usuários', icon: <PeopleIcon sx={iconSx} /> },
  '/configuracoes': { title: 'Configurações', icon: <SettingsIcon sx={iconSx} /> },
  '/configuracoes/categorias': { title: 'Categorias', icon: <CategoryIcon sx={iconSx} /> },
  '/configuracoes/sla': { title: 'SLA', icon: <ScheduleIcon sx={iconSx} /> },
  '/configuracoes/cargos': { title: 'Cargos', icon: <BadgeIcon sx={iconSx} /> },
  '/relatorio': { title: 'Relatório da Visita', icon: <DescriptionIcon sx={iconSx} /> },
};

export function resolvePageTitle(path: string): PageTitleConfig {
  if (PAGE_TITLES[path]) return PAGE_TITLES[path];
  if (path.startsWith('/checklist/concluido')) {
    return { title: 'Visita concluída', icon: <CheckCircleIcon sx={iconSx} /> };
  }
  if (path.startsWith('/relatorio/')) return PAGE_TITLES['/relatorio'];
  if (path.startsWith('/chamados/aprovacoes/')) return PAGE_TITLES['/chamados/aprovacoes'];
  if (path.startsWith('/chamados/')) return PAGE_TITLES['/chamados'];
  return { title: 'Portal Grupo Alvim', icon: <DashboardIcon sx={iconSx} /> };
}
