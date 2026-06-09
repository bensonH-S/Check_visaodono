import { Outlet, useNavigate, useLocation, useMatch } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Fab from '@mui/material/Fab';
import IconButton from '@mui/material/IconButton';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LogoutIcon from '@mui/icons-material/Logout';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import BrandLogo from '../components/BrandLogo';
import AppFooter from '../components/AppFooter';
import NotificacoesSino from '../components/NotificacoesSino';
import { toAppPath } from '../config/paths';
import { getUsuario, logout, temPermissao, type UsuarioSessao } from '../lib/auth';
import { usePageTitle } from '../hooks/usePageTitle';
import {
  ChamadosMobileLojaProvider,
  useChamadosMobileLoja,
} from '../context/ChamadosMobileLojaContext';

const PAGE_BG = '#f5f5f3';
const NAVY = '#1B2A6B';
const FOOTER_H = 64;

function nomeLoja(loja: UsuarioSessao['lojas'][number]) {
  return loja.nome;
}

function SeletorLocalizacao({ user }: { user: UsuarioSessao | null }) {
  const { idLoja, setIdLoja } = useChamadosMobileLoja();
  const [expandido, setExpandido] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const lojas = user?.lojas ?? [];
  const multiplas = lojas.length > 1;
  const lojaAtual = lojas.find((l) => l.id_loja === idLoja) ?? lojas[0];

  useEffect(() => {
    if (!expandido) return;
    function fecharFora(e: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setExpandido(false);
      }
    }
    document.addEventListener('mousedown', fecharFora);
    document.addEventListener('touchstart', fecharFora);
    return () => {
      document.removeEventListener('mousedown', fecharFora);
      document.removeEventListener('touchstart', fecharFora);
    };
  }, [expandido]);

  if (!lojas.length) {
    return (
      <Typography variant="caption" sx={{ color: NAVY, fontWeight: 600 }}>
        Unidade não informada
      </Typography>
    );
  }

  return (
    <Box
      ref={containerRef}
      sx={{
        position: 'relative',
        width: '100%',
        zIndex: expandido ? 60 : 'auto',
      }}
    >
      <Box
        role={multiplas ? 'button' : undefined}
        tabIndex={multiplas ? 0 : undefined}
        onClick={() => multiplas && setExpandido((v) => !v)}
        onKeyDown={(e) => {
          if (multiplas && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            setExpandido((v) => !v);
          }
        }}
        sx={{
          width: '100%',
          overflowX: 'auto',
          overflowY: 'hidden',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
          textAlign: 'center',
          cursor: multiplas ? 'pointer' : 'default',
          borderRadius: 2,
          py: { xs: 0.5, sm: 0.5 },
          bgcolor: multiplas && expandido ? 'rgba(27, 42, 107, 0.06)' : 'transparent',
          '&:hover': multiplas ? { bgcolor: 'rgba(27, 42, 107, 0.06)' } : undefined,
        }}
      >
        <Box
          component="span"
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.75,
            whiteSpace: 'nowrap',
            px: 0.5,
          }}
        >
          <LocationOnOutlinedIcon sx={{ fontSize: { xs: 20, sm: 18 }, color: '#E8520A', flexShrink: 0 }} />
          <Typography
            variant="body2"
            component="span"
            sx={{
              color: NAVY,
              fontWeight: 600,
              fontSize: { xs: '0.9rem', sm: '0.8rem' },
              lineHeight: 1.35,
            }}
          >
            {nomeLoja(lojaAtual)}
          </Typography>
        </Box>
      </Box>

      {multiplas && expandido && (
        <Box
          sx={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            mt: 0.75,
            zIndex: 70,
            borderRadius: 2,
            border: '1px solid rgba(27, 42, 107, 0.15)',
            bgcolor: '#fff',
            maxHeight: { xs: 380, sm: 420 },
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            boxShadow: '0 8px 24px rgba(27, 42, 107, 0.18)',
          }}
        >
          {lojas.map((loja) => {
            const ativa = loja.id_loja === lojaAtual?.id_loja;
            return (
              <Box
                key={loja.id_loja}
                role="button"
                tabIndex={0}
                onClick={() => {
                  setIdLoja(loja.id_loja);
                  setExpandido(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setIdLoja(loja.id_loja);
                    setExpandido(false);
                  }
                }}
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 1,
                  px: { xs: 1.5, sm: 1.25 },
                  py: { xs: 1.25, sm: 1 },
                  minHeight: { xs: 48, sm: 44 },
                  cursor: 'pointer',
                  bgcolor: ativa ? 'rgba(232, 82, 10, 0.08)' : 'transparent',
                  borderBottom: '1px solid rgba(27, 42, 107, 0.08)',
                  '&:last-child': { borderBottom: 'none' },
                  '&:hover': { bgcolor: ativa ? 'rgba(232, 82, 10, 0.12)' : 'rgba(27, 42, 107, 0.04)' },
                }}
              >
                <LocationOnOutlinedIcon
                  sx={{
                    fontSize: { xs: 20, sm: 18 },
                    color: ativa ? '#E8520A' : 'text.secondary',
                    flexShrink: 0,
                    mt: 0.15,
                  }}
                />
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: ativa ? 700 : 600,
                    fontSize: { xs: '0.875rem', sm: '0.8rem' },
                    color: ativa ? NAVY : 'text.secondary',
                    lineHeight: 1.4,
                    textAlign: 'left',
                    flex: 1,
                    minWidth: 0,
                    whiteSpace: 'normal',
                    wordBreak: 'break-word',
                  }}
                >
                  {nomeLoja(loja)}
                </Typography>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}

function ChamadosMobileLayoutInner() {
  const navigate = useNavigate();
  const location = useLocation();
  const path = toAppPath(location.pathname);
  const user = getUsuario();
  const { idLoja } = useChamadosMobileLoja();
  const isNovo = Boolean(useMatch('/chamados/mobile/novo')) || path === '/chamados/mobile/novo';
  const isDetalhe = Boolean(useMatch('/chamados/mobile/:idChamado'));
  const isSubPage = isNovo || isDetalhe;
  const podeAbrir = user && temPermissao('chamados.abrir', user);

  const [welcome, setWelcome] = useState('');

  const subtituloPagina = isNovo
    ? 'Novo chamado'
    : isDetalhe
      ? 'Detalhes do chamado'
      : 'Chamados';

  usePageTitle(isNovo ? 'Novo chamado' : isDetalhe ? 'Detalhes do chamado' : 'Chamados');

  useEffect(() => {
    const nome = (location.state as { welcome?: string } | null)?.welcome;
    if (!nome) return;
    setWelcome(nome);
    navigate(location.pathname + location.search + location.hash, { replace: true, state: {} });
  }, [location.state, location.pathname, location.search, location.hash, navigate]);

  return (
    <Box
      sx={{
        height: '100%',
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        bgcolor: PAGE_BG,
      }}
    >
      <Box
        component="header"
        sx={{
          position: 'relative',
          zIndex: 30,
          flexShrink: 0,
          bgcolor: '#fff',
          px: 2,
          pt: 'max(12px, env(safe-area-inset-top))',
          pb: 1.5,
          borderBottom: '1px solid rgba(27, 42, 107, 0.1)',
          boxShadow: '0 2px 12px rgba(27, 42, 107, 0.06)',
          overflow: 'visible',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, flex: 1 }}>
            {isSubPage && (
              <IconButton
                type="button"
                size="small"
                onClick={() => navigate('/chamados/mobile', { replace: true })}
                aria-label="Voltar"
                sx={{ color: NAVY, ml: -0.5, flexShrink: 0 }}
              >
                <ArrowBackIcon fontSize="small" />
              </IconButton>
            )}
            <BrandLogo maxWidth={68} sx={{ flexShrink: 0 }} />
            <Box sx={{ minWidth: 0 }}>
              <Typography
                sx={{
                  fontWeight: 800,
                  color: '#E8520A',
                  fontSize: '1rem',
                  lineHeight: 1.15,
                }}
              >
                Vision Check
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 600,
                  lineHeight: 1.25,
                  color: NAVY,
                  display: 'block',
                  fontSize: '0.75rem',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {subtituloPagina}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, flexShrink: 0 }}>
            <NotificacoesSino variante="mobile" contexto="chamados-mobile" idLoja={idLoja} />
            <IconButton
              size="small"
              onClick={() => {
                logout();
                navigate('/login/mobile');
              }}
              aria-label="Sair"
              sx={{ color: NAVY }}
            >
              <LogoutIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>
        {!isSubPage && (
          <Box
            sx={{
              mt: 1,
              width: '100%',
              px: 1.25,
              py: 0.75,
              borderRadius: 2,
              bgcolor: 'rgba(27, 42, 107, 0.04)',
              border: '1px solid rgba(27, 42, 107, 0.08)',
            }}
          >
            <SeletorLocalizacao user={user} />
          </Box>
        )}
      </Box>

      <Box
        component="main"
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          px: 2,
          pt: 2,
          pb: `calc(${FOOTER_H}px + ${podeAbrir && !isSubPage ? 64 : 16}px + env(safe-area-inset-bottom, 0px))`,
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <Outlet />
      </Box>

      {podeAbrir && !isSubPage && (
        <Fab
          color="primary"
          aria-label="Abrir novo chamado"
          onClick={() => navigate('/chamados/mobile/novo')}
          sx={{
            position: 'fixed',
            right: 20,
            bottom: `calc(${FOOTER_H}px + 16px + env(safe-area-inset-bottom, 0px))`,
            zIndex: 40,
            boxShadow: '0 6px 20px rgba(27, 42, 107, 0.35)',
          }}
        >
          <AddIcon />
        </Fab>
      )}

      <Box
        component="footer"
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 30,
          pb: 'env(safe-area-inset-bottom, 0px)',
          bgcolor: PAGE_BG,
        }}
      >
        <AppFooter compact fullText />
      </Box>

      <Snackbar
        open={!!welcome}
        autoHideDuration={2500}
        onClose={() => setWelcome('')}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity="success" variant="filled" onClose={() => setWelcome('')} sx={{ width: '100%' }}>
          Bem-vindo, {welcome}!
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default function ChamadosMobileLayout() {
  return (
    <ChamadosMobileLojaProvider>
      <ChamadosMobileLayoutInner />
    </ChamadosMobileLojaProvider>
  );
}
