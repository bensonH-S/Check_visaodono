import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import { toAppPath } from '../config/paths';
import { mobileTabBarItemSx, mobileTabBarNavSx, mobileTabBarShellSx } from '../theme/safeArea';

export type MobileTabItem = {
  to: string;
  label: string;
  icon: ReactNode;
  end?: boolean;
  isActive?: (pathname: string) => boolean;
};

const MobileMaisContext = createContext<{ openMais: () => void }>({ openMais: () => {} });

export function useMobileMais() {
  return useContext(MobileMaisContext);
}

export function MobileMaisDrawer({
  open,
  onClose,
  items,
  accent,
}: {
  open: boolean;
  onClose: () => void;
  items: MobileTabItem[];
  accent?: string;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const path = toAppPath(location.pathname);
  /** Shell mobile dos hubs é sempre escuro — não seguir o tema claro do app. */
  const effectiveAccent = accent || '#fe6c22';

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  function irPara(to: string) {
    onClose();
    navigate(to);
  }

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="ck-mobile-mais is-open" role="presentation">
      <button type="button" className="ck-mobile-mais__backdrop" aria-label="Fechar" onClick={onClose} />
      <div
        className="ck-mobile-mais__sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Mais módulos"
      >
        <div className="ck-mobile-mais__grab" aria-hidden />
        <p className="ck-mobile-mais__title">Mais</p>
        <div className="ck-mobile-mais__list">
          {!items.length ? (
            <p className="ck-mobile-mais__title">Nenhum outro módulo nesta conta.</p>
          ) : null}
          {items.map((item) => {
            const ativo = tabItemAtivo(item, path);
            return (
              <button
                key={item.to}
                type="button"
                className={`ck-mobile-mais__item${ativo ? ' is-on' : ''}`}
                onClick={() => irPara(item.to)}
                style={ativo ? { ['--mais-accent' as string]: effectiveAccent } : undefined}
              >
                <span className="ck-mobile-mais__icon">{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function MobileMaisHost({
  items,
  accent,
  children,
}: {
  items: MobileTabItem[];
  accent?: string;
  children: ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  const location = useLocation();
  const api = useMemo(() => ({ openMais: () => setAberto(true) }), []);

  useEffect(() => {
    setAberto(false);
  }, [location.pathname, location.search]);

  return (
    <MobileMaisContext.Provider value={api}>
      {children}
      <MobileMaisDrawer open={aberto} onClose={() => setAberto(false)} items={items} accent={accent} />
    </MobileMaisContext.Provider>
  );
}

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
  fontSize = '0.7rem',
  iconSize = 20,
  hiddenOnDesktop = false,
}: Props) {
  const location = useLocation();
  const path = toAppPath(location.pathname);
  const [maisAberto, setMaisAberto] = useState(false);

  /** Dock mobile dos hubs é sempre escuro. */
  const effectiveAccent = accent || '#fe6c22';

  useEffect(() => {
    setMaisAberto(false);
  }, [location.pathname, location.search]);

  const { primary, more: moreAll } = splitMobileTabs(items, pinnedTos, maxVisible);
  const more = moreAll.filter((item) => item.to !== '/checklist/mobile');
  const maisAtivo = more.some((item) => tabItemAtivo(item, path));

  if (!items.length) return null;

  const itemSx = (ativo: boolean) => ({
    ...mobileTabBarItemSx(tabHeight),
    color: ativo ? effectiveAccent : '#94A3B8',
    fontSize,
    fontWeight: ativo ? 700 : 600,
    letterSpacing: '-0.01em',
    border: 0,
    background: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
    '& .MuiSvgIcon-root': {
      fontSize: iconSize,
      mb: 0.35,
      p: '5px',
      boxSizing: 'content-box',
      borderRadius: '12px',
      color: ativo ? effectiveAccent : 'inherit',
      bgcolor: ativo ? 'rgba(254, 108, 34, 0.16)' : 'transparent',
    },
  });

  return (
    <>
      <Box
        component="footer"
        className="mobile-tab-bar"
        sx={{
          ...mobileTabBarShellSx('#0b1721', 50),
          display: hiddenOnDesktop ? { xs: 'block', md: 'none' } : 'block',
          borderColor: 'rgba(255, 255, 255, 0.1)',
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

      <MobileMaisDrawer
        open={maisAberto}
        onClose={() => setMaisAberto(false)}
        items={more}
        accent={effectiveAccent}
      />
    </>
  );
}
