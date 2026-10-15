import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { toAppPath } from '../config/paths';
import { getUsuario } from '../lib/auth';
import FinanceIdiomaToggle from '../financeiro/FinanceIdiomaToggle';
import PortalSino from '../components/PortalSino';
import AbrirChamadoTiDialog from '../components/AbrirChamadoTiDialog';
import AnotacoesTiDialog from '../components/AnotacoesTiDialog';
import { FIN_BG, FIN_BORDER, FIN_MUTED, FIN_SURFACE, FIN_TEXT } from '../financeiro/temaFinanceiroEscuro';
import { getConfigNavSections, itemConfigAtivo } from '../pages/configuracoes/configNav';

const ACCENT = '#1B6EF3';

/**
 * Sidebar Meridian fica intacto.
 * Em Configuração: barra horizontal (seção + itens) — sem segundo menu lateral.
 */
export default function ConfiguracoesLayout() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const path = toAppPath(useLocation().pathname);
  const navigate = useNavigate();
  const user = getUsuario();
  const sections = getConfigNavSections(user);
  const ativo = itemConfigAtivo(path, user);
  const secaoAtiva = ativo?.section.title ?? sections[0]?.title ?? '';
  const itensSecao = sections.find((s) => s.title === secaoAtiva)?.items ?? [];
  const fin = path.startsWith('/configuracoes/financeiro');

  function trocarSecao(titulo: string) {
    const sec = sections.find((s) => s.title === titulo);
    const primeiro = sec?.items[0];
    if (primeiro) navigate(primeiro.to);
  }

  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        bgcolor: FIN_BG,
        color: FIN_TEXT,
      }}
    >
      <Box
        sx={{
          flexShrink: 0,
          borderBottom: `1px solid ${FIN_BORDER}`,
          bgcolor: FIN_SURFACE,
          px: { xs: 1.5, md: 2 },
          pt: 1.25,
          pb: 1,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: FIN_TEXT, letterSpacing: '-0.01em', flex: 1 }}>
            Configuração
          </Typography>
          <PortalSino variante="portal" />
          <AbrirChamadoTiDialog variante="portal" />
          <AnotacoesTiDialog variante="portal" />
          {fin ? <FinanceIdiomaToggle size="tiny" /> : null}
        </Box>

        {isMobile ? (
          <Select
            size="small"
            fullWidth
            value={ativo?.item.to ?? ''}
            displayEmpty
            onChange={(e) => navigate(String(e.target.value))}
            sx={{ fontSize: 13.5, bgcolor: FIN_BG, borderRadius: '10px' }}
          >
            {sections.flatMap((s) =>
              s.items.map((i) => (
                <MenuItem key={i.to} value={i.to} sx={{ fontSize: 13.5 }}>
                  {s.title} · {i.label}
                </MenuItem>
              )),
            )}
          </Select>
        ) : (
          <>
            <Box
              sx={{
                display: 'flex',
                gap: 0.5,
                flexWrap: 'wrap',
                mb: 1,
              }}
            >
              {sections.map((s) => {
                const on = s.title === secaoAtiva;
                return (
                  <Box
                    key={s.title}
                    component="button"
                    type="button"
                    onClick={() => trocarSecao(s.title)}
                    sx={{
                      height: 28,
                      px: 1.25,
                      borderRadius: '8px',
                      border: `1px solid ${on ? ACCENT : FIN_BORDER}`,
                      bgcolor: on ? 'rgba(27,110,243,0.08)' : 'transparent',
                      color: on ? ACCENT : FIN_MUTED,
                      fontSize: 12,
                      fontWeight: on ? 650 : 500,
                      fontFamily: 'inherit',
                      cursor: 'pointer',
                      '&:hover': {
                        borderColor: ACCENT,
                        color: ACCENT,
                      },
                    }}
                  >
                    {s.title}
                  </Box>
                );
              })}
            </Box>
            <Box
              sx={{
                display: 'flex',
                gap: 0.25,
                flexWrap: 'wrap',
                alignItems: 'center',
              }}
            >
              {itensSecao.map((item) => (
                <NavLink key={item.to} to={item.to} end style={{ textDecoration: 'none' }}>
                  {({ isActive }) => (
                    <Box
                      sx={{
                        height: 30,
                        px: 1.15,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.75,
                        borderRadius: '8px',
                        fontSize: 13,
                        fontWeight: isActive ? 650 : 500,
                        color: isActive ? ACCENT : FIN_TEXT,
                        bgcolor: isActive ? 'rgba(27,110,243,0.08)' : 'transparent',
                        '&:hover': {
                          bgcolor: isActive ? 'rgba(27,110,243,0.1)' : FIN_BG,
                        },
                        '& .MuiSvgIcon-root': {
                          fontSize: 16,
                          color: isActive ? ACCENT : FIN_MUTED,
                        },
                      }}
                    >
                      {item.icon}
                      {item.label}
                    </Box>
                  )}
                </NavLink>
              ))}
            </Box>
          </>
        )}
      </Box>

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          overflowX: 'hidden',
          px: { xs: 1.5, md: 2 },
          py: { xs: 1.25, md: 1.5 },
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
}
