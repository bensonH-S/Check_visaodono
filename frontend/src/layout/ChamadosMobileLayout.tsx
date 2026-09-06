import { Outlet, useNavigate, useLocation, useMatch } from 'react-router-dom';
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
import MapOutlinedIcon from '@mui/icons-material/MapOutlined';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import BoltIcon from '@mui/icons-material/Bolt';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import BrandLogo from '../components/BrandLogo';
import NotificacoesSino from '../components/NotificacoesSino';
import MobileUsuarioMenu from '../components/MobileUsuarioMenu';
import MobilePaginaTitulo from '../components/MobilePaginaTitulo';
import PwaInstallBanner from '../components/PwaInstallBanner';
import PwaUpdateBanner from '../components/PwaUpdateBanner';
import PwaInstallDialog from '../components/PwaInstallDialog';
import AtivarPushHeaderButton from '../components/AtivarPushHeaderButton';
import { assetUrl, FAVICON_ICON, toAppPath } from '../config/paths';
import { mobilePaginaCabecalhoFixo } from '../config/mobileRoutes';
import MapaTecnicosListaLojas from '../components/mapa/MapaTecnicosListaLojas';
import { MapaTecnicosMobileProvider } from '../pages/mapa/MapaTecnicosMobileContext';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import HistoryIcon from '@mui/icons-material/History';
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation';
import BuildIcon from '@mui/icons-material/Build';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import FreeBreakfastOutlinedIcon from '@mui/icons-material/FreeBreakfastOutlined';
import LanguageIcon from '@mui/icons-material/Language';
import { getUsuario, logout, temPermissao, podeUsarChecklist, podeUsarFrota, podeVerVisitasMobile, podeVerMapaTecnicosMobile, podeVerEscalaVisitas, podeVerNcMobile, podeVerEnergia, podeAbrirEnergia, podeAprovarFreelancers, podeConferenciaEstoque, podeBreakEstoque, modoCabecalhoContextoMobile, filtraNotificacoesPorRegiaoMobile, rotuloRegiaoMobile, rotuloLojaMobile, podeReceberPainelDiretorChamados, modoAppTecnicoFrotaRestrito, ehEscalaDeliveryOnly, primeiraRotaMobileApp, type UsuarioSessao } from '../lib/auth';
import { useAppTheme } from '../context/ThemeContext';
import ThemeToggleButton from '../components/ThemeToggleButton';
import { colors } from '../theme/tokens';
import { usePageTitle } from '../hooks/usePageTitle';
import { useAppConfig } from '../hooks/useAppConfig';
import { useTecnicoGpsTracking } from '../hooks/useTecnicoGpsTracking';
import { prepararNotificacoesPush, sincronizarEstadoPush, PUSH_ATUALIZADO_EVENT } from '../utils/pushNotifications';
import { iniciarServiceWorkerPwa } from '../pwa/registerServiceWorker';
import { MOBILE_PAGE_COLUMN, MOBILE_SCROLL_AREA, MOBILE_VIEWPORT, MOBILE_WATERMARK_LOGO, mobileTabBarOffsetCss, safeAreaBottomCalc, safeAreaRightCalc, safeAreaTopPadding, safeAreaX } from '../theme/safeArea';
import MobileTabBar from '../components/MobileTabBar';
import {
  ChamadosMobileLojaProvider,
  useChamadosMobileLoja,
} from '../context/ChamadosMobileLojaContext';
import {
  ChecklistMobileUiProvider,
  useChecklistMobileUi,
} from '../context/ChecklistMobileUiContext';
import ChecklistIonicRoot from '../components/checklist/ChecklistIonicRoot';

const ORANGE = '#E8520A';
const TAB_NAV_H = 52;
const ABAS_COM_SUBPAGINA = [
  '/checklist/mobile',
  '/chamados/mobile',
  '/frota/mobile',
  '/visitas/mobile',
  '/nc/mobile',
  '/energia/mobile',
  '/estoque/mobile',
];

function abaMobileAtiva(
  to: string,
  path: string,
  flags: {
    isChecklist: boolean;
    isFrota: boolean;
    isVisitas: boolean;
    isRelatorio: boolean;
    isNc: boolean;
    isEnergia: boolean;
    isEstoque: boolean;
    isEstoqueBreak: boolean;
    isFreelancersAprovacao: boolean;
  },
) {
  if (to === '/checklist/mobile') return flags.isChecklist;
  if (to === '/chamados/mobile') return path === '/chamados/mobile' || path.startsWith('/chamados/mobile/');
  if (to === '/frota/mobile') return flags.isFrota;
  if (to === '/frota/mobile/abastecimento') return path.startsWith('/frota/mobile/abastecimento');
  if (to === '/frota/mobile/manutencao') return path.startsWith('/frota/mobile/manutencao');
  if (to === '/visitas/mobile') return flags.isVisitas || flags.isRelatorio;
  if (to === '/nc/mobile') return flags.isNc;
  if (to === '/energia/mobile') return flags.isEnergia;
  if (to === '/estoque/mobile') return flags.isEstoque && !flags.isEstoqueBreak;
  if (to === '/estoque/mobile/break') return flags.isEstoqueBreak;
  if (to === '/freelancers/aprovacao/mobile') return flags.isFreelancersAprovacao;
  if (to === '/escalas/visitas/mobile') return path.startsWith('/escalas/visitas/mobile');
  if (to === '/mapa/mobile') return path === '/mapa/mobile' || path.startsWith('/mapa/mobile/');
  return path === to || path.startsWith(`${to}/`);
}

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
      <Typography variant="caption" sx={{ color: colors.textPrimary, fontWeight: 600 }}>
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
          bgcolor: multiplas && expandido ? colors.navyMuted : 'transparent',
          '&:hover': multiplas ? { bgcolor: colors.navyMuted } : undefined,
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
              color: colors.textPrimary,
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
            border: `1px solid ${colors.navyBorder}`,
            bgcolor: colors.surface,
            maxHeight: 'min(50dvh, 320px)',
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            WebkitOverflowScrolling: 'touch',
            boxShadow: '0 8px 24px rgba(27, 42, 107, 0.18)',
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(27, 42, 107, 0.35) transparent',
            '&::-webkit-scrollbar': {
              width: 6,
              display: 'block',
            },
            '&::-webkit-scrollbar-thumb': {
              background: 'rgba(27, 42, 107, 0.35)',
              borderRadius: 8,
            },
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
                  borderBottom: `1px solid ${colors.border}`,
                  '&:last-child': { borderBottom: 'none' },
                  '&:hover': { bgcolor: ativa ? 'rgba(232, 82, 10, 0.12)' : colors.navyMuted },
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
                    color: ativa ? colors.textPrimary : colors.textSecondary,
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
  const { mode } = useAppTheme();
  const escuro = mode === 'dark';
  const acento = escuro ? ORANGE : '#1B2A6B';
  const navigate = useNavigate();
  const location = useLocation();
  const appConfig = useAppConfig();
  useTecnicoGpsTracking(appConfig ?? undefined);
  const path = toAppPath(location.pathname);
  const user = getUsuario();
  const { idLoja } = useChamadosMobileLoja();
  const isNovo = Boolean(useMatch('/chamados/mobile/novo')) || path === '/chamados/mobile/novo';
  const isDetalhe =
    (Boolean(useMatch('/chamados/mobile/:idChamado')) || /^\/chamados\/mobile\/\d+$/.test(path)) &&
    !isNovo;
  const paginaCabecalhoFixo = mobilePaginaCabecalhoFixo(path);
  const isChamadosSubPage = isNovo || isDetalhe;
  const isChecklist = path === '/checklist/mobile' || path.startsWith('/checklist/mobile/');
  const isChecklistConcluido = path.startsWith('/checklist/mobile/concluido/');
  const isFrota = path === '/frota/mobile' || path.startsWith('/frota/mobile/');
  const isMapa = path === '/mapa/mobile';
  const modoRestrito = !!(user && modoAppTecnicoFrotaRestrito(user));
  const deliveryOnly = !!(user && ehEscalaDeliveryOnly(user));
  const frotaAbaPrincipalRestrito =
    modoRestrito &&
    (path.startsWith('/frota/mobile/abastecimento') || path.startsWith('/frota/mobile/manutencao'));
  const isFrotaSub = isFrota && path !== '/frota/mobile' && !frotaAbaPrincipalRestrito;
  /** Frota inteira: chrome próprio (stage + sheet), sem header/título MUI. */
  const isFrotaImmersive = isFrota;
  const isVisitas = path === '/visitas/mobile';
  const isEscalaVisitas = path === '/escalas/visitas/mobile';
  const isNc = path === '/nc/mobile' || path.startsWith('/nc/mobile/');
  const isNcResolver = Boolean(useMatch('/nc/mobile/:idNc'));
  /** NCs: chrome próprio (lista + resolver). */
  const isNcImmersive = isNc;
  const isEnergiaNovo = Boolean(useMatch('/energia/mobile/novo')) || path === '/energia/mobile/novo';
  const isEnergiaDetalhe =
    (Boolean(useMatch('/energia/mobile/:idChamado')) || /^\/energia\/mobile\/\d+$/.test(path)) &&
    !isEnergiaNovo;
  const isEnergia = path === '/energia/mobile' || path.startsWith('/energia/mobile/');
  const isEnergiaImmersive = isEnergia;
  const isEstoqueBreak = path === '/estoque/mobile/break';
  const isEstoqueSaldo = path === '/estoque/mobile/saldo';
  const isEstoqueNfe = path === '/estoque/mobile/nfes' || path.startsWith('/estoque/mobile/nfes/');
  const isEstoque = path === '/estoque/mobile' || path.startsWith('/estoque/mobile/');
  /** `:idContagem` também casa com break / saldo / nfes — excluir. */
  const isEstoqueDetalhe =
    Boolean(useMatch('/estoque/mobile/:idContagem')) &&
    !isEstoqueBreak &&
    !isEstoqueSaldo &&
    !isEstoqueNfe;
  /** Estoque: chrome próprio (lista + conferência + break). */
  const isEstoqueImmersive = isEstoque;
  const isFreelancersAprovacao = path === '/freelancers/aprovacao/mobile';
  const isPortais = path === '/portais/mobile' || path.startsWith('/portais/mobile/');
  /** Freelas: chrome próprio (stage + sheet), sem header/título MUI. */
  const isFreelancersImmersive = isFreelancersAprovacao;
  /** Lista, novo e detalhe: chrome immersive. */
  const isChamadosLista = path === '/chamados/mobile';
  const isChamadosImmersive = isChamadosLista || isNovo || isDetalhe;
  const isRelatorio = path.startsWith('/relatorio/mobile/visita/');
  const { fase: checklistFaseUi, dispararVoltar: dispararVoltarChecklist } = useChecklistMobileUi();
  const isChecklistEmAndamento =
    isChecklist && (checklistFaseUi === 'iniciada' || checklistFaseUi === 'perguntas');
  /** Setup: sem header MUI; tabs ainda aparecem. */
  const isChecklistStart =
    isChecklist && !isChecklistConcluido && (checklistFaseUi === 'setup' || checklistFaseUi == null);
  /** Fluxo checklist inteiro (setup → perguntas): chrome próprio, sem header MUI. */
  const isChecklistImmersive = isChecklist && !isChecklistConcluido;
  const temBotaoVoltar =
    isDetalhe ||
    isNovo ||
    isFrotaSub ||
    isRelatorio ||
    isNcResolver ||
    isEnergiaNovo ||
    isEnergiaDetalhe ||
    isEstoqueDetalhe ||
    isChecklistConcluido;
  const isSubPage = isChamadosSubPage || isFrotaSub || isRelatorio || isNcResolver || isEnergiaNovo || isEnergiaDetalhe || isEstoqueDetalhe;
  const podeAbrir = user && !modoRestrito && temPermissao('chamados.abrir', user);
  const podeChecklist = user && !modoRestrito && podeUsarChecklist(user);
  const podeChamados =
    user && !modoRestrito && (temPermissao('chamados.ver', user) || temPermissao('chamados.abrir', user));
  const veSinoChamados = !!podeChamados || (user != null && !modoRestrito && podeReceberPainelDiretorChamados(user));
  const podeFrota = user && podeUsarFrota(user);
  const podeMapa = user && podeVerMapaTecnicosMobile(user);
  const podeVisitas = user && !modoRestrito && podeVerVisitasMobile(user);
  const podeEscalaVisitas = user && !modoRestrito && podeVerEscalaVisitas(user);
  const podeNc = user && !modoRestrito && podeVerNcMobile(user);
  const podeEnergia = user && !modoRestrito && podeVerEnergia(user);
  const podeAbrirEnergiaMobile = user && !modoRestrito && podeAbrirEnergia(user);
  const podeEstoque = user && !modoRestrito && podeConferenciaEstoque(user);
  const podeBreak = user && !modoRestrito && podeBreakEstoque(user);
  const podeFreelancers = user && !modoRestrito && podeAprovarFreelancers(user);
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

  const mobileTabs = (
    modoRestrito
      ? [
          {
            to: '/mapa/mobile',
            label: 'Mapa',
            icon: <MapOutlinedIcon fontSize="small" />,
            show: true,
          },
          {
            to: '/frota/mobile/abastecimento',
            label: 'Combustível',
            icon: <LocalGasStationIcon fontSize="small" />,
            show: !!podeFrota,
          },
          {
            to: '/frota/mobile/manutencao',
            label: 'Manutenção',
            icon: <BuildIcon fontSize="small" />,
            show: !!podeFrota,
          },
          {
            to: '/portais/mobile',
            label: 'Portais',
            icon: <LanguageIcon fontSize="small" />,
            show: true,
          },
        ]
      : [
          {
            to: '/escalas/visitas/mobile',
            label: 'Escala',
            icon: <CalendarMonthIcon fontSize="small" />,
            show: !!podeEscalaVisitas && deliveryOnly,
          },
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
            show: !!podeChamados && !deliveryOnly,
          },
          {
            to: '/frota/mobile',
            label: 'Frota',
            icon: <DirectionsCarIcon fontSize="small" />,
            show: !!podeFrota,
          },
          {
            to: '/escalas/visitas/mobile',
            label: 'Escala',
            icon: <CalendarMonthIcon fontSize="small" />,
            show: !!podeEscalaVisitas && !deliveryOnly,
          },
          {
            to: '/nc/mobile',
            label: 'NCs',
            icon: <WarningAmberIcon fontSize="small" />,
            show: !!podeNc,
          },
          {
            to: '/estoque/mobile',
            label: 'Estoque',
            icon: <Inventory2Icon fontSize="small" />,
            show: !!podeEstoque,
          },
          {
            to: '/energia/mobile',
            label: 'Energia',
            icon: <BoltIcon fontSize="small" />,
            show: !!podeEnergia,
          },
          {
            to: '/estoque/mobile/break',
            label: 'Break',
            icon: <FreeBreakfastOutlinedIcon fontSize="small" />,
            show: !!podeBreak,
          },
          {
            to: '/freelancers/aprovacao/mobile',
            label: 'Freelas',
            icon: <BadgeOutlinedIcon fontSize="small" />,
            show: !!podeFreelancers,
          },
          {
            to: '/mapa/mobile',
            label: 'Mapa',
            icon: <MapOutlinedIcon fontSize="small" />,
            show: !!podeMapa,
          },
          {
            to: '/portais/mobile',
            label: 'Portais',
            icon: <LanguageIcon fontSize="small" />,
            show: true,
          },
        ]
  ).filter((t) => t.show);

  const mostrarTabs =
    mobileTabs.length >= 1 && !isSubPage && !isChecklistConcluido && !isChecklistEmAndamento;
  const rodapeTotalH = mostrarTabs ? TAB_NAV_H : 0;
  /** Reserva espaço da tab bar fixed (iPhone / Android / PWA). */
  const tabBarOffsetCss = mostrarTabs ? mobileTabBarOffsetCss() : '0px';

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
          : isEscalaVisitas
            ? 'Escala de visitas'
          : isNcResolver
            ? 'Resolver NC'
          : isEnergiaNovo
            ? 'Novo protocolo'
          : isEnergiaDetalhe
            ? 'Ocorrência de energia'
          : isEstoqueBreak
            ? 'Break'
          : isEstoqueSaldo
            ? 'Saldo'
          : isEstoqueDetalhe
            ? 'Conferência'
          : isEstoque
            ? 'Estoque'
          : isNc
            ? 'Não conformidades'
          : isEnergia
            ? 'Energia'
          : isFreelancersAprovacao
            ? 'Aprovar freelancers'
          : isMapa
            ? 'Mapa da Frota'
          : isPortais
            ? 'Portais'
          : isRelatorio
            ? 'Relatório da visita'
          : isFrotaSub || frotaAbaPrincipalRestrito
            ? path.includes('abastecimento')
              ? 'Combustível'
              : path.includes('termo')
                ? 'Termo de ferramentas'
                : path.includes('manutencao')
                  ? 'Manutenção'
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
            : isEscalaVisitas
              ? 'Escala de visitas'
            : isNcResolver
              ? 'Resolver NC'
            : isEnergiaNovo
              ? 'Novo protocolo'
            : isEnergiaDetalhe
              ? 'Ocorrência de energia'
            : isEstoqueBreak
              ? 'Break'
            : isEstoqueSaldo
              ? 'Saldo'
            : isEstoqueDetalhe
              ? 'Conferência'
            : isEstoque
              ? 'Estoque'
            : isNc
              ? 'Não conformidades'
            : isEnergia
              ? 'Energia'
            : isMapa
              ? 'Mapa da Frota'
            : isPortais
              ? 'Portais'
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

  useEffect(() => {
    if (!modoRestrito) return;
    const permitido =
      path.startsWith('/mapa/mobile') ||
      path === '/frota/mobile' ||
      path.startsWith('/frota/mobile/abastecimento') ||
      path.startsWith('/frota/mobile/manutencao') ||
      path.startsWith('/portais/mobile');
    if (!permitido) {
      navigate('/mapa/mobile', { replace: true });
    }
  }, [modoRestrito, path, navigate]);

  useEffect(() => {
    if (!deliveryOnly) return;
    if (path === '/chamados/mobile' || path.startsWith('/chamados/mobile/')) {
      navigate('/escalas/visitas/mobile', { replace: true });
    }
  }, [deliveryOnly, path, navigate]);

  useEffect(() => {
    if (!user || podeMapa) return;
    if (path.startsWith('/mapa/mobile')) {
      navigate(primeiraRotaMobileApp(user), { replace: true });
    }
  }, [user, podeMapa, path, navigate]);

  const welcomeShown = useRef(false);

  useEffect(() => {
    const nome = (location.state as { welcome?: string } | null)?.welcome;
    if (!nome || welcomeShown.current) return;
    welcomeShown.current = true;
    showWelcomeToast(nome);
    navigate(location.pathname + location.search + location.hash, { replace: true, state: {} });
  }, [location.state, location.pathname, location.search, location.hash, navigate]);

  function rotaVoltarMobile() {
    if (isNcResolver) return '/nc/mobile';
    if (isEnergiaNovo || isEnergiaDetalhe) return '/energia/mobile';
    if (isEstoqueDetalhe) return '/estoque/mobile';
    if (isFrotaSub) return '/frota/mobile';
    if (isRelatorio) return '/visitas/mobile';
    if (isChecklistConcluido || isChecklistEmAndamento) return '/checklist/mobile';
    if (isNovo || isDetalhe) return '/chamados/mobile';
    return '/chamados/mobile';
  }

  return (
    <Box
      className="mobile-app-shell"
      sx={{
        ...MOBILE_VIEWPORT,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        bgcolor: colors.canvas,
        /* Tab bar é position:fixed — reserva a faixa no fluxo p/ o CTA não ficar por baixo */
        pb: isChecklistStart && mostrarTabs ? tabBarOffsetCss : 0,
        ['--app-tabbar-offset' as string]: tabBarOffsetCss,
      }}
    >
      <PwaInstallDialog />
      <PwaUpdateBanner />
      {!isChecklistImmersive && !isVisitas && !isRelatorio && !isFrotaImmersive && !isEscalaVisitas && !isNcImmersive && !isEnergiaImmersive && !isEstoqueImmersive && !isFreelancersImmersive && !isChamadosImmersive && !isMapa && !isPortais && (
      <Box
        component="header"
        className="mobile-app-header"
        sx={{
          position: 'relative',
          zIndex: 30,
          flexShrink: 0,
          bgcolor: colors.canvas,
          borderBottom: `1px solid ${colors.border}`,
          ...safeAreaX(16),
          pt: safeAreaTopPadding(8),
          pb: 0.5,
          boxShadow: 'none',
          overflow: 'visible',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 0.75 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0, flex: 1 }}>
            {temBotaoVoltar && (
              <IconButton
                type="button"
                size="small"
                onClick={() => {
                  if (isChecklistEmAndamento && dispararVoltarChecklist()) return;
                  navigate(rotaVoltarMobile(), { replace: true });
                }}
                aria-label="Voltar"
                sx={{ color: acento, ml: -0.5, flexShrink: 0 }}
              >
                <ArrowBackIcon fontSize="small" />
              </IconButton>
            )}
            <BrandLogo
              variante="icone"
              maxWidth={temBotaoVoltar ? 60 : 68}
              sx={{ flexShrink: 0 }}
            />
            {/* Toggle de tema ao lado da logo */}
            <ThemeToggleButton
              size="small"
              color={escuro ? '#f59e0b' : colors.textPrimary}
            />
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, flexShrink: 0 }}>
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
              bgcolor: escuro ? 'rgba(232, 82, 10, 0.08)' : 'rgba(27, 42, 107, 0.04)',
              border: `1px solid ${colors.navyBorder}`,
            }}
          >
            <SeletorLocalizacao user={user} />
          </Box>
        )}
      </Box>
      )}

      {isChecklist ? (
        <div
          className={`mobile-checklist-host${
            isChecklistImmersive ? ' mobile-checklist-host--solo' : ''
          }${isChecklistEmAndamento ? ' mobile-checklist-host--fluxo' : ''}`}
        >
          <ChecklistIonicRoot>
            <Outlet />
          </ChecklistIonicRoot>
        </div>
      ) : (
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
        {!isVisitas && !isRelatorio && !isFrotaImmersive && !isEscalaVisitas && !isNcImmersive && !isEnergiaImmersive && !isEstoqueImmersive && !isFreelancersImmersive && !isChamadosImmersive && !isMapa && !isPortais && (
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
              compacto={false}
            />
          </Box>
        </Box>
        )}
        <Box
          sx={{
            position: 'relative',
            zIndex: 1,
            ...(paginaCabecalhoFixo ||
            isVisitas ||
            isRelatorio ||
            isFrotaImmersive ||
            isEscalaVisitas ||
            isNcImmersive ||
            isEnergiaImmersive ||
            isEstoqueImmersive ||
            isFreelancersImmersive ||
            isChamadosImmersive ||
            isMapa ||
            isPortais
              ? MOBILE_PAGE_COLUMN
              : MOBILE_SCROLL_AREA),
            ...(isVisitas ||
            isRelatorio ||
            isFrotaImmersive ||
            isEscalaVisitas ||
            isNcImmersive ||
            isEnergiaImmersive ||
            isEstoqueImmersive ||
            isFreelancersImmersive ||
            isChamadosImmersive ||
            isMapa ||
            isPortais
              ? { px: 0 }
              : safeAreaX(16)),
            pb:
              isVisitas ||
              isRelatorio ||
              isFrotaImmersive ||
              isEscalaVisitas ||
              isNcImmersive ||
              isEnergiaImmersive ||
              isEstoqueImmersive ||
              isFreelancersImmersive ||
              isChamadosImmersive ||
              isMapa ||
              isPortais
                ? 0
                : safeAreaBottomCalc(rodapeTotalH + 16),
          }}
        >
          {isMapa ? (
            <MapaTecnicosMobileProvider>
              <div className="ck-mapa">
                <MapaTecnicosListaLojas />
                <div className="ck-mapa__map">
                  <Outlet />
                </div>
              </div>
            </MapaTecnicosMobileProvider>
          ) : (
            <Outlet />
          )}
        </Box>
      </Box>
      )}

      {podeAbrir && !isSubPage && !isChecklist && !isFrota && !isVisitas && !isEscalaVisitas && !isRelatorio && !isMapa && !isFreelancersAprovacao && !isEstoque && !isNc && !isEnergia && !isPortais && (
        <Fab
          aria-label="Abrir novo chamado"
          onClick={() => navigate('/chamados/mobile/novo')}
          sx={{
            position: 'fixed',
            right: safeAreaRightCalc(20),
            bottom: safeAreaBottomCalc(rodapeTotalH + 16),
            zIndex: 40,
            bgcolor: escuro ? '#FF7A3D' : '#1B2A6B',
            color: '#fff',
            boxShadow: escuro ? '0 6px 20px rgba(255, 122, 61, 0.42)' : '0 6px 20px rgba(27, 42, 107, 0.35)',
            '&:hover': { bgcolor: escuro ? '#d14a09' : '#152255' },
          }}
        >
          <AddIcon />
        </Fab>
      )}

      {podeAbrirEnergiaMobile && isEnergia && !isEnergiaNovo && !isEnergiaDetalhe && (
        <Fab
          aria-label="Registrar ocorrência de energia"
          onClick={() => navigate('/energia/mobile/novo')}
          sx={{
            position: 'fixed',
            right: safeAreaRightCalc(20),
            bottom: safeAreaBottomCalc(rodapeTotalH + 16),
            zIndex: 40,
            bgcolor: escuro ? '#FF7A3D' : '#1B2A6B',
            color: '#fff',
            boxShadow: escuro ? '0 6px 20px rgba(255, 122, 61, 0.42)' : '0 6px 20px rgba(27, 42, 107, 0.35)',
            '&:hover': { bgcolor: escuro ? '#d14a09' : '#152255' },
          }}
        >
          <AddIcon />
        </Fab>
      )}

      {mostrarTabs && (
        <MobileTabBar
          items={mobileTabs.map((item) => ({
            ...item,
            end: !ABAS_COM_SUBPAGINA.includes(item.to),
            isActive: (pathname: string) =>
              abaMobileAtiva(item.to, pathname, {
                isChecklist,
                isFrota,
                isVisitas,
                isRelatorio,
                isNc,
                isEnergia,
                isEstoque,
                isEstoqueBreak,
                isFreelancersAprovacao,
              }),
          }))}
          pinnedTos={
            modoRestrito
              ? []
              : deliveryOnly
                ? ['/escalas/visitas/mobile', '/checklist/mobile', '/visitas/mobile']
                : ['/checklist/mobile', '/chamados/mobile', '/frota/mobile']
          }
          accent={acento}
          tabHeight={TAB_NAV_H}
          fontSize={modoRestrito ? '0.7rem' : '0.625rem'}
          iconSize={modoRestrito ? 24 : 22}
        />
      )}
    </Box>
  );
}

export default function ChamadosMobileLayout() {
  return (
    <ChamadosMobileLojaProvider>
      <ChecklistMobileUiProvider>
        <ChamadosMobileLayoutInner />
      </ChecklistMobileUiProvider>
    </ChamadosMobileLojaProvider>
  );
}
