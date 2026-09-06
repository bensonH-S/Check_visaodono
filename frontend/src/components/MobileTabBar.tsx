import { useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import Typography from '@mui/material/Typography';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import { toAppPath } from '../config/paths';
import { colors, radius } from '../theme/tokens';
import { mobileTabBarItemSx, mobileTabBarNavSx, mobileTabBarShellSx } from '../theme/safeArea';
import { useAppTheme } from '../context/ThemeContext';

export type MobileTabItem = {
  to: string;
  label: string;
  icon: ReactNode;
  end?: boolean;
  isActive?: (pathname: string) => boolean;
};

type Props = {
  items: MobileTabItem[];
  /** Rotas que devem ficar na barra, nesta ordem, quando houver overflow. */
  pinnedTos?: string[];
  /** Slots na barra (incluindo Mais). Acima disso, o resto vai para o painel. */
  maxVisible?: number;
  accent?: string;
  tabHeight?: number;
  fontSize?: string;
  iconSize?: number;
  hiddenOnDesktop?: boolean;
};

export function tabItemAtivo(item: MobileTabItem, pathname: string) {
  if (item.isActive) return item.isActive(pathname);
  if (item.end) return pathname === item.to;
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

export function splitMobileTabs(
  items: MobileTabItem[],
  pinnedTos: string[] = [],
  maxVisible = 4,
): { primary: MobileTabItem[]; more: MobileTabItem[] } {
  if (items.length <= maxVisible) return { primary: items, more: [] };

  const primarySlots = Math.max(1, maxVisible - 1);
  const pinned = pinnedTos
    .map((to) => items.find((item) => item.to === to))
    .filter((item): item is MobileTabItem => Boolean(item));
  const rest = items.filter((item) => !pinnedTos.includes(item.to));
  const primary = [...pinned, ...rest].slice(0, primarySlots);
  const primaryTos = new Set(primary.map((item) => item.to));
  return {
    primary,
    more: items.filter((item) => !primaryTos.has(item.to)),
  };
}

export default function MobileTabBar({
  items,
  pinnedTos = [],
  maxVisible = 4,
  accent,
  tabHeight = 52,
  fontSize = '0.625rem',
  iconSize = 20,
  hiddenOnDesktop = false,
}: Props) {
  const navigate = useNavigate();
  const path = toAppPath(useLocation().pathname);
  const [maisAberto, setMaisAberto] = useState(false);
  const { mode } = useAppTheme();
  const escuro = mode === 'dark';

  const defaultAccent = escuro ? '#FF7A3D' : '#1B2A6B';
  const effectiveAccent = accent || defaultAccent;

  const { primary, more } = splitMobileTabs(items, pinnedTos, maxVisible);
  const maisAtivo = more.some((item) => tabItemAtivo(item, path));

  if (!items.length) return null;

  function irPara(to: string) {
    setMaisAberto(false);
    navigate(to);
  }

  const itemSx = (ativo: boolean) => ({
    ...mobileTabBarItemSx(tabHeight),
    color: ativo ? effectiveAccent : (escuro ? '#94A3B8' : colors.textMuted),
    fontSize,
    fontWeight: ativo ? 600 : 500,
    border: 0,
    background: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
    '& .MuiSvgIcon-root': { fontSize: iconSize, mb: 0.25, color: ativo ? effectiveAccent : 'inherit' },
  });

  return (
    <>
      <Box
        component="footer"
        className="mobile-tab-bar"
        sx={{
          ...mobileTabBarShellSx(colors.surface, 50),
          display: hiddenOnDesktop ? { xs: 'block', md: 'none' } : 'block',
          borderColor: colors.border,
        }}
      >
        <Box component="nav" sx={{ ...mobileTabBarNavSx(tabHeight), display: 'flex' }}>
          {primary.map((item) => {
            const ativo = tabItemAtivo(item, path);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `mobile-tab-bar__link${ativo || isActive ? ' active is-active' : ''}`
                }
                style={{ textDecoration: 'none', flex: 1 }}
              >
                <Box
                  className={`mobile-tab-bar__item${ativo ? ' is-active' : ''}`}
                  sx={itemSx(ativo)}
                >
                  {item.icon}
                  {item.label}
                </Box>
              </NavLink>
            );
          })}
          {more.length > 0 && (
            <Box
              component="button"
              type="button"
              aria-label="Mais módulos"
              aria-expanded={maisAberto}
              className={`mobile-tab-bar__btn mobile-tab-bar__btn--more${maisAtivo ? ' is-active active' : ''}`}
              onClick={() => setMaisAberto(true)}
              sx={{ ...itemSx(maisAtivo), flex: 1 }}
            >
              <MoreHorizIcon />
              Mais
            </Box>
          )}
        </Box>
      </Box>

      <Drawer
        anchor="bottom"
        open={maisAberto}
        onClose={() => setMaisAberto(false)}
        slotProps={{
          paper: {
            sx: {
              bgcolor: escuro ? '#1E293B' : '#FFFFFF',
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              border: escuro ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
              maxHeight: '72vh',
              pb: 'env(safe-area-inset-bottom, 0px)',
            },
          },
        }}
      >
        <Box sx={{ px: 2, pt: 1.25, pb: 2 }}>
          <Box
            sx={{
              width: 36,
              height: 4,
              borderRadius: 2,
              bgcolor: escuro ? 'rgba(255, 255, 255, 0.2)' : colors.borderStrong,
              mx: 'auto',
              mb: 1.5,
            }}
          />
          <Typography sx={{ fontWeight: 700, color: escuro ? '#F8FAFC' : colors.navy, fontSize: '0.9375rem', mb: 1.25 }}>
            Mais
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {more.map((item) => {
              const ativo = tabItemAtivo(item, path);
              return (
                <Box
                  key={item.to}
                  component="button"
                  type="button"
                  onClick={() => irPara(item.to)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.25,
                    width: '100%',
                    textAlign: 'left',
                    px: 1.25,
                    py: 1.1,
                    border: 0,
                    borderRadius: `${radius.md}px`,
                    bgcolor: ativo
                      ? (escuro ? 'rgba(255, 122, 61, 0.16)' : colors.navyMuted)
                      : 'transparent',
                    color: ativo
                      ? (escuro ? '#FF7A3D' : colors.navy)
                      : (escuro ? '#F8FAFC' : colors.textPrimary),
                    fontWeight: ativo ? 600 : 500,
                    fontSize: '0.875rem',
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    '&:hover': {
                      bgcolor: ativo
                        ? (escuro ? 'rgba(255, 122, 61, 0.22)' : colors.navyMuted)
                        : (escuro ? 'rgba(255, 255, 255, 0.06)' : colors.canvasAlt),
                    },
                    '& .MuiSvgIcon-root': {
                      fontSize: 22,
                      color: ativo
                        ? effectiveAccent
                        : (escuro ? '#94A3B8' : colors.textSecondary),
                    },
                  }}
                >
                  {item.icon}
                  {item.label}
                </Box>
              );
            })}
          </Box>
        </Box>
      </Drawer>
    </>
  );
}
