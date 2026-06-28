import { Outlet, useNavigate, useLocation, useMatch, NavLink } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Fab from '@mui/material/Fab';
import IconButton from '@mui/material/IconButton';
import { showWelcomeToast } from '../utils/toast';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AssignmentIcon from '@mui/icons-material/Assignment';
import HeadsetMicOutlinedIcon from '@mui/icons-material/HeadsetMicOutlined';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import BrandLogo from '../components/BrandLogo';
import NotificacoesSino from '../components/NotificacoesSino';
import MobileUsuarioMenu from '../components/MobileUsuarioMenu';
import MobilePaginaTitulo from '../components/MobilePaginaTitulo';
import PwaInstallBanner from '../components/PwaInstallBanner';
import PwaInstallDialog from '../components/PwaInstallDialog';
import AtivarPushHeaderButton from '../components/AtivarPushHeaderButton';
import { assetUrl, FAVICON_ICON, toAppPath } from '../config/paths';
import { mobilePaginaCabecalhoFixo } from '../config/mobileRoutes';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import HistoryIcon from '@mui/icons-material/History';
import { getUsuario, logout, temPermissao, podeUsarChecklist, podeUsarFrota, podeVerVisitasMobile, modoCabecalhoContextoMobile, filtraNotificacoesPorRegiaoMobile, rotuloRegiaoMobile, rotuloLojaMobile, podeReceberPainelDiretorChamados, type UsuarioSessao } from '../lib/auth';
import { useAppConfig } from '../hooks/useAppConfig';
import { useTecnicoGpsTracking } from '../hooks/useTecnicoGpsTracking';
import AtivarGpsHeaderButton from '../components/AtivarGpsHeaderButton';
import { usePageTitle } from '../hooks/usePageTitle';
import { prepararNotificacoesPush, sincronizarEstadoPush, PUSH_ATUALIZADO_EVENT } from '../utils/pushNotifications';
import { iniciarServiceWorkerPwa } from '../pwa/registerServiceWorker';
import { MOBILE_PAGE_COLUMN, MOBILE_SCROLL_AREA, MOBILE_VIEWPORT, MOBILE_WATERMARK_LOGO, mobileTabBarItemSx, mobileTabBarNavSx, mobileTabBarShellSx, safeAreaBottomCalc, safeAreaRightCalc, safeAreaTopPadding, safeAreaX } from '../theme/safeArea';
import {
  ChamadosMobileLojaProvider,
  useChamadosMobileLoja,
} from '../context/ChamadosMobileLojaContext';

const PAGE_BG = '#f5f5f3';
const NAVY = '#1B2A6B';
const ORANGE = '#E8520A';
const TAB_NAV_H = 52;

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
          py: { xs: 0.25, sm: 0.25 },
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
          <LocationOnOutlinedIcon sx={{ fontSize: { xs: 18, sm: 16 }, color: '#E8520A', flexShrink: 0 }} />
          <Typography
            variant="body2"
            component="span"
            sx={{
              color: NAVY,
              fontWeight: 600,
              fontSize: { xs: '0.82rem', sm: '0.78rem' },
              lineHeight: 1.3,
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
  const appConfig = useAppConfig();
  useTecnicoGpsTracking(appConfig);
  const { idLoja } = useChamadosMobileLoja();
  const isNovo = Boolean(useMatch('/chamados/mobile/novo')) || path === '/chamados/mobile/novo';
  const isDetalhe = Boolean(useMatch('/chamados/mobile/:idChamado'));
  const paginaCabecalhoFixo = mobilePaginaCabecalhoFixo(path);
  const isChamadosSubPage = isNovo || isDetalhe;
  const isChecklist = path === '/checklist/mobile' || path.startsWith('/checklist/mobile/');
  const isChecklistConcluido = path.startsWith('/checklist/mobile/concluido/');
  const isFrota = path === '/frota/mobile' || path.startsWith('/frota/mobile/');
  const isFrotaSub = isFrota && path !== '/frota/mobile';
  const isVisitas = path === '/visitas/mobile';
  const isRelatorio = path.startsWith('/relatorio/visita/');
  const isChecklistHub = path === '/checklist/mobile';
  const isChecklistEmAndamento = isChecklist && !isChecklistHub && !isChecklistConcluido;
  const temBotaoVoltar =
    isDetalhe ||
    isNovo ||
    isFrotaSub ||
    isRelatorio ||
    isChecklistConcluido ||
    isChecklistEmAndamento;
  const isSubPage = isChamadosSubPage || isFrotaSub || isRelatorio;
  const podeAbrir = user && temPermissao('chamados.abrir', user);
  const podeChecklist = user && podeUsarChecklist(user);
  const podeChamados = user && (temPermissao('chamados.ver', user) || temPermissao('chamados.abrir', user));
  const veSinoChamados = !!podeChamados || (user != null && podeReceberPainelDiretorChamados(user));
  const podeFrota = user && podeUsarFrota(user);
  const podeVisitas = user && podeVerVisitasMobile(user);
  const modoCabecalho = modoCabecalhoContextoMobile(user);
  const multiplasLojasHeader = (user?.lojas?.length ?? 0) > 1;

  const contextoAtuacaoMobile =
    modoCabecalho === 'regiao'
      ? rotuloRegiaoMobile(user)
      : modoCabecalho === 'loja'
        ? rotuloLojaMobile(user, idLoja)
        : null;
  const tagLojaCompleta = modoCabecalho === 'loja';
  const tagRegiaoMobile = contextoAtuacaoMobile
    ? tagLojaCompleta
      ? contextoAtuacaoMobile
      : contextoAtuacaoMobile.length > 14
        ? `${contextoAtuacaoMobile.slice(0, 12)}…`
        : contextoAtuacaoMobile
    : null;

  const mobileTabs = [
    {
      to: '/checklist/mobile',
      label: 'Checklist',
      icon: <AssignmentIcon fontSize="small" />,
      show: !!podeChecklist,
    },
    {
      to: '/visitas/mobile',
      label: 'Visitas',
      icon: <HistoryIcon fontSize="small" />,
      show: !!podeVisitas,
    },
    {
      to: '/chamados/mobile',
      label: 'Chamados',
      icon: <HeadsetMicOutlinedIcon fontSize="small" />,
      show: !!podeChamados,
    },
    {
      to: '/frota/mobile',
      label: 'Frota',
      icon: <DirectionsCarIcon fontSize="small" />,
      show: !!podeFrota,
    },
  ].filter((t) => t.show);

  const mostrarTabs = mobileTabs.length >= 1 && !isSubPage && !isChecklistConcluido;
  const rodapeTotalH = mostrarTabs ? TAB_NAV_H : 0;

  const subtituloPagina = isNovo
    ? 'Novo chamado'
    : isDetalhe
      ? 'Detalhes do chamado'
      : isChecklistConcluido
        ? 'Visita concluída'
        : isChecklist
          ? 'Checklist'
          : isVisitas
            ? 'Visitas e relatórios'
          : isRelatorio
            ? 'Relatório da visita'
          : isFrotaSub
            ? path.includes('abastecimento')
              ? 'Abastecimento'
              : path.includes('termo')
                ? 'Termo de ferramentas'
                : path.includes('manutencao')
                  ? 'Manutenção do veículo'
                  : 'Veículo'
            : isFrota
              ? 'Frota'
              : 'Chamados';

  usePageTitle(
    isNovo
      ? 'Novo chamado'
      : isDetalhe
        ? 'Detalhes do chamado'
        : isChecklistConcluido
          ? 'Visita concluída'
          : isChecklist
            ? 'Checklist'
            : isVisitas
              ? 'Visitas e relatórios'
            : isRelatorio
              ? 'Relatório da visita'
            : isFrotaSub
              ? 'Frota'
              : isFrota
                ? 'Frota'
                : 'Chamados'
  );

  useEffect(() => {
    if (!user) return;
    iniciarServiceWorkerPwa();
    const atualizarBotaoPush = () => {
      void sincronizarEstadoPush();
    };
    void sincronizarEstadoPush().then(() => {
      prepararNotificacoesPush();
    });
    window.addEventListener(PUSH_ATUALIZADO_EVENT, atualizarBotaoPush);
    return () => window.removeEventListener(PUSH_ATUALIZADO_EVENT, atualizarBotaoPush);
  }, [user]);

  const welcomeShown = useRef(false);

  useEffect(() => {
    const nome = (location.state as { welcome?: string } | null)?.welcome;
    if (!nome || welcomeShown.current) return;
    welcomeShown.current = true;
    showWelcomeToast(nome);
    navigate(location.pathname + location.search + location.hash, { replace: true, state: {} });
  }, [location.state, location.pathname, location.search, location.hash, navigate]);

  function rotaVoltarMobile() {
    if (isFrotaSub) return '/frota/mobile';
    if (isRelatorio) return '/visitas/mobile';
    if (isChecklistConcluido || isChecklistEmAndamento) return '/checklist/mobile';
    if (isNovo || isDetalhe) return '/chamados/mobile';
    return '/chamados/mobile';
  }

  return (
    <Box
      sx={{
        ...MOBILE_VIEWPORT,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        bgcolor: PAGE_BG,
      }}
    >
      <PwaInstallDialog />
      <Box
        component="header"
        className="mobile-app-header"
        sx={{
          position: 'relative',
          zIndex: 30,
          flexShrink: 0,
          bgcolor: PAGE_BG,
          ...safeAreaX(16),
          pt: safeAreaTopPadding(8),
          pb: 0.25,
          boxShadow: 'none',
          overflow: 'visible',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 0.75 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0, flex: 1 }}>
            {temBotaoVoltar && (
              <IconButton
                type="button"
                size="small"
                onClick={() => navigate(rotaVoltarMobile(), { replace: true })}
                aria-label="Voltar"
                sx={{ color: NAVY, ml: -0.5, flexShrink: 0 }}
              >
                <ArrowBackIcon fontSize="small" />
              </IconButton>
            )}
            <BrandLogo
              maxWidth={temBotaoVoltar ? 84 : 98}
              sx={{ flexShrink: 0 }}
            />
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, flexShrink: 0 }}>
            <AtivarGpsHeaderButton gpsAtivo={appConfig.gpsTecnicosEnabled !== false} />
            <AtivarPushHeaderButton />
            {veSinoChamados && (
              <NotificacoesSino
                variante="mobile"
                contexto="chamados-mobile"
                idLoja={filtraNotificacoesPorRegiaoMobile(user) ? null : idLoja}
              />
            )}
            <MobileUsuarioMenu
              user={user}
              onLogout={() => {
                logout();
                navigate('/login/mobile');
              }}
            />
          </Box>
        </Box>
        <PwaInstallBanner />
        {modoCabecalho === 'loja' &&
          !isSubPage &&
          !isChecklist &&
          !isFrota &&
          !isVisitas &&
          !isRelatorio &&
          multiplasLojasHeader && (
          <Box
            sx={{
              mt: 0.5,
              width: '100%',
              px: 1,
              py: 0.5,
              borderRadius: 1.5,
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
          position: 'relative',
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'fixed',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            ...MOBILE_WATERMARK_LOGO,
            backgroundImage: `url(${assetUrl(FAVICON_ICON)})`,
            backgroundSize: 'contain',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
            opacity: 0.035,
            pointerEvents: 'none',
            zIndex: 0,
          },
        }}
      >
        <Box
          sx={{
            position: 'relative',
            zIndex: 1,
            flexShrink: 0,
            ...safeAreaX(16),
          }}
        >
          <Box sx={{ maxWidth: 480, mx: 'auto', width: '100%' }}>
            <MobilePaginaTitulo
              titulo={subtituloPagina}
              nomeUsuario={user?.nome}
              tagRegiao={tagRegiaoMobile}
              tagRegiaoTitulo={contextoAtuacaoMobile}
              tagExpandida={tagLojaCompleta}
              ocultarTagLoja={isDetalhe}
            />
          </Box>
        </Box>
        <Box
          sx={{
            position: 'relative',
            zIndex: 1,
            ...(paginaCabecalhoFixo ? MOBILE_PAGE_COLUMN : MOBILE_SCROLL_AREA),
            ...safeAreaX(16),
            pb: safeAreaBottomCalc(rodapeTotalH + 16),
          }}
        >
          <Outlet />
        </Box>
      </Box>

      {podeAbrir && !isSubPage && !isChecklist && !isFrota && !isVisitas && !isRelatorio && (
        <Fab
          aria-label="Abrir novo chamado"
          onClick={() => navigate('/chamados/mobile/novo')}
          sx={{
            position: 'fixed',
            right: safeAreaRightCalc(20),
            bottom: safeAreaBottomCalc(rodapeTotalH + 16),
            zIndex: 40,
            bgcolor: '#E8520A',
            color: '#fff',
            boxShadow: '0 6px 20px rgba(232, 82, 10, 0.42)',
            '&:hover': { bgcolor: '#d14a09' },
          }}
        >
          <AddIcon />
        </Fab>
      )}

      {mostrarTabs && (
        <Box
          component="footer"
          className="mobile-tab-bar"
          sx={mobileTabBarShellSx()}
        >
          <Box component="nav" sx={mobileTabBarNavSx(TAB_NAV_H)}>
            {mobileTabs.map((item) => {
              const abaChecklist = item.to === '/checklist/mobile';
              const abaChamados = item.to === '/chamados/mobile';
              const abaFrota = item.to === '/frota/mobile';
              const abaVisitas = item.to === '/visitas/mobile';
              const abaComSubpaginas = abaChecklist || abaChamados || abaFrota || abaVisitas;
              return (
              <NavLink
                key={item.to}
                to={item.to}
                end={!abaComSubpaginas}
                style={{ textDecoration: 'none', flex: 1 }}
              >
                {({ isActive }) => {
                  const ativa = abaChecklist
                    ? isChecklist
                    : abaChamados
                      ? path === '/chamados/mobile' || path.startsWith('/chamados/mobile/')
                      : abaFrota
                        ? isFrota
                        : abaVisitas
                          ? isVisitas || isRelatorio
                          : isActive;
                  return (
                  <Box
                    sx={{
                      ...mobileTabBarItemSx(TAB_NAV_H),
                      color: ativa ? ORANGE : 'text.secondary',
                      fontSize: '0.625rem',
                      fontWeight: ativa ? 700 : 500,
                      '& .MuiSvgIcon-root': {
                        fontSize: 22,
                        mb: 0.25,
                        color: ativa ? ORANGE : 'inherit',
                      },
                    }}
                  >
                    {item.icon}
                    {item.label}
                  </Box>
                  );
                }}
              </NavLink>
              );
            })}
          </Box>
        </Box>
      )}
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
