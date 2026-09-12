import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import IconButton from '@mui/material/IconButton';
import Badge from '@mui/material/Badge';
import Popover from '@mui/material/Popover';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Button from '@mui/material/Button';
import ClickAwayListener from '@mui/material/ClickAwayListener';
import { showToast } from '../utils/toast';
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined';
import { api, type ContextoNotificacoesManut, type EscalaVisitasNotificacao, type ManutNotificacao } from '../api/client';
import { formatDataHoraBrasilia } from '../utils/dateBr';
import { NOTIFICACOES_REFRESH } from '../utils/notificacoesEvent';
import { tituloNotificacaoChamado } from '../utils/notificacoesTexto';
import { tituloNotificacaoEscala } from './escalas/escalaVisitasUtils';
import NotificacaoBadge from './NotificacaoBadge';
import { colors } from '../theme/tokens';
import {
  filtrarNotificacoesVisiveisChamados,
  tipoAlertaChamadoOps,
} from '../constants/notificacoesChamados';
import { podeReceberPainelDiretorChamados, podeVerEscalaVisitas } from '../lib/auth';

const ESCALA_ID_BASE = 1_000_000;

function mapaEscalaParaSino(n: EscalaVisitasNotificacao): ManutNotificacao {
  return {
    id_notificacao: ESCALA_ID_BASE + n.id_notificacao,
    id_chamado: 0,
    id_loja: n.id_regiao ?? 0,
    numero: 0,
    tipo: `escala_${n.tipo}`,
    mensagem: tituloNotificacaoEscala(n),
    loja: n.nome_regiao ?? undefined,
    lida: n.lida,
    created_at: n.created_at,
  };
}

function ehNotificacaoEscala(n: ManutNotificacao) {
  return String(n.tipo || '').startsWith('escala_');
}

const POLL_MS = 3000;

function contextoChamados(contexto: ContextoNotificacoesManut): boolean {
  return contexto === 'chamados' || contexto === 'chamados-mobile';
}

function filtrarListaContexto(notifs: ManutNotificacao[], contexto: ContextoNotificacoesManut) {
  if (!contextoChamados(contexto)) return notifs;
  return filtrarNotificacoesVisiveisChamados(notifs, {
    painelDiretor: podeReceberPainelDiretorChamados(),
  });
}

function tipoPermiteToast(n: ManutNotificacao, contexto: ContextoNotificacoesManut): boolean {
  if (ehNotificacaoEscala(n)) return true;
  if (contexto === 'aprovacoes') return true;
  if (contextoChamados(contexto)) {
    if (podeReceberPainelDiretorChamados()) return true;
    return tipoAlertaChamadoOps(n.tipo);
  }
  return true;
}

type Props = {
  variante: 'mobile' | 'portal';
  contexto: ContextoNotificacoesManut;
  idLoja?: number | null;
  /** Painel mais largo (ex.: detalhe desktop do chamado) */
  menuLargo?: boolean;
};

function filtrarPorLoja(notifs: ManutNotificacao[], idLoja?: number | null) {
  if (idLoja == null) return notifs;
  return notifs.filter((n) => n.id_loja === idLoja);
}

type PainelProps = {
  tituloMenu: string;
  naoLidas: number;
  contexto: ContextoNotificacoesManut;
  lista: ManutNotificacao[];
  painelLargo: boolean;
  menuMobile: boolean;
  onMarcarTodas: () => void;
  renderItem: (n: ManutNotificacao, conteudo: ReactNode) => ReactNode;
};

function PainelNotificacoes({
  tituloMenu,
  naoLidas,
  contexto,
  lista,
  painelLargo,
  menuMobile,
  onMarcarTodas,
  renderItem,
}: PainelProps) {
  const itens = lista.filter((n) => tituloNotificacaoChamado(n, { contexto }).length > 0);

  const conteudoItem = (n: ManutNotificacao) => (
    <>
      {!n.lida && (
        <Box
          sx={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            bgcolor: '#DC2626',
            mt: 0.75,
            flexShrink: 0,
          }}
        />
      )}
      <Box sx={{ flex: 1, minWidth: menuMobile ? 'auto' : 0, pl: n.lida ? 1.75 : 0, overflow: 'visible' }}>
        <Typography
          variant="body2"
          sx={{
            fontWeight: n.lida ? 400 : 700,
            lineHeight: 1.45,
            fontSize: painelLargo ? '0.9rem' : undefined,
            whiteSpace: 'normal',
            wordBreak: 'break-word',
            overflow: 'visible',
          }}
        >
          {tituloNotificacaoChamado(n, { contexto })}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {formatDataHoraBrasilia(n.created_at)}
        </Typography>
      </Box>
    </>
  );

  return (
    <>
      <Box sx={{ px: 2, py: 1.25, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: colors.textPrimary }}>
            {tituloMenu}
          </Typography>
          <NotificacaoBadge count={naoLidas} />
        </Box>
        {naoLidas > 0 && (
          <Button size="small" onClick={onMarcarTodas} sx={{ fontWeight: 600 }}>
            Marcar lidas
          </Button>
        )}
      </Box>
      <Divider />
      <Box sx={{ maxHeight: menuMobile ? 'min(60vh, 440px)' : 320, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {!itens.length && (
          <Box sx={{ px: 2, py: 2 }}>
            <Typography variant="body2" color="text.secondary">
              {contexto === 'aprovacoes'
                ? 'Nenhuma aprovação pendente'
                : 'Nenhuma notificação de chamados'}
            </Typography>
          </Box>
        )}
        {itens.map((n) =>
          renderItem(
            n,
            <Box
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1,
                width: '100%',
              }}
            >
              {conteudoItem(n)}
            </Box>,
          ),
        )}
      </Box>
    </>
  );
}

const ARROW_HALF = 7;

export default function NotificacoesSino({ variante, contexto, idLoja, menuLargo }: Props) {
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const [lista, setLista] = useState<ManutNotificacao[]>([]);
  const [naoLidas, setNaoLidas] = useState(0);
  const [arrowRight, setArrowRight] = useState(14);
  const ultimoTsVisto = useRef(0);
  const baselineOk = useRef(false);
  const balloonRef = useRef<HTMLDivElement>(null);

  const tituloMenu =
    contexto === 'aprovacoes' ? 'Aprovações pendentes' : 'Notificações';
  const painelLargo =
    menuLargo || contexto === 'aprovacoes' || (variante === 'portal' && contexto === 'chamados');
  const larguraMenu = painelLargo ? 460 : 360;
  const menuMobile = variante === 'mobile';

  const alinharSetaBalao = useCallback(() => {
    if (!anchor || !balloonRef.current) return;
    const anchorRect = anchor.getBoundingClientRect();
    const balloonRect = balloonRef.current.getBoundingClientRect();
    const sinoCentroX = anchorRect.left + anchorRect.width / 2;
    const fromRight = balloonRect.right - sinoCentroX - ARROW_HALF;
    const maxRight = balloonRect.width - 20;
    setArrowRight(Math.max(20, Math.min(fromRight, maxRight)));
  }, [anchor]);

  useLayoutEffect(() => {
    if (!anchor || !menuMobile) return;
    alinharSetaBalao();
    window.addEventListener('resize', alinharSetaBalao);
    return () => window.removeEventListener('resize', alinharSetaBalao);
  }, [anchor, menuMobile, alinharSetaBalao, lista.length]);

  const carregar = useCallback(() => {
    const incluirEscala = contexto !== 'aprovacoes' && podeVerEscalaVisitas();
    Promise.all([
      api.manutNotificacoes(contexto).catch(() => [] as ManutNotificacao[]),
      api.manutNotificacoesNaoLidas({ idLoja, contexto }).catch(() => ({ total: 0 })),
      incluirEscala
        ? api.escalaVisitasNotificacoes().catch(() => [] as EscalaVisitasNotificacao[])
        : Promise.resolve([] as EscalaVisitasNotificacao[]),
    ])
      .then(([notifs, contagem, escala]) => {
        const chamados = filtrarListaContexto(filtrarPorLoja(notifs, idLoja), contexto);
        const escalaSino = escala.map(mapaEscalaParaSino);
        const filtradas = [...chamados, ...escalaSino].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
        setLista(filtradas);
        const naoLidasEscala = escalaSino.filter((n) => !n.lida).length;
        const total = contextoChamados(contexto)
          ? chamados.filter((n) => !n.lida).length + naoLidasEscala
          : Number(contagem.total || 0) + naoLidasEscala;
        const maxTsNaoLida = filtradas
          .filter((n) => !n.lida)
          .reduce((max, n) => Math.max(max, new Date(n.created_at).getTime() || 0), 0);

        if (!baselineOk.current) {
          ultimoTsVisto.current = maxTsNaoLida;
          baselineOk.current = true;
        } else if (maxTsNaoLida > ultimoTsVisto.current) {
          const nova = filtradas.find(
            (n) => !n.lida && (new Date(n.created_at).getTime() || 0) === maxTsNaoLida,
          );
          if (nova && tipoPermiteToast(nova, contexto)) {
            const titulo = tituloNotificacaoChamado(nova, { contexto });
            showToast(titulo, 'info', { toastId: `notif:${nova.tipo}:${nova.id_notificacao}` });
          }
          ultimoTsVisto.current = maxTsNaoLida;
        }

        setNaoLidas(total);
      })
      .catch(() => {});
  }, [idLoja, contexto]);

  useEffect(() => {
    baselineOk.current = false;
  }, [idLoja, contexto]);

  useEffect(() => {
    carregar();
    const t = setInterval(carregar, POLL_MS);

    function onRefresh() {
      carregar();
    }
    function onFocus() {
      carregar();
    }
    function onVisible() {
      if (document.visibilityState === 'visible') carregar();
    }

    window.addEventListener(NOTIFICACOES_REFRESH, onRefresh);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(t);
      window.removeEventListener(NOTIFICACOES_REFRESH, onRefresh);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [carregar]);

  function fecharPainel() {
    setAnchor(null);
  }

  function togglePainel(e: React.MouseEvent<HTMLElement>) {
    if (anchor) {
      setAnchor(null);
      return;
    }
    setAnchor(e.currentTarget);
    carregar();
  }

  function irDestino(idChamado: number) {
    if (contexto === 'aprovacoes') {
      navigate(`/chamados/aprovacoes/${idChamado}`);
    } else if (variante === 'mobile') {
      navigate(`/chamados/mobile/${idChamado}`);
    } else {
      navigate(`/chamados/${idChamado}`);
    }
    fecharPainel();
  }

  async function abrirNotificacao(n: ManutNotificacao) {
    if (ehNotificacaoEscala(n)) {
      const id = n.id_notificacao - ESCALA_ID_BASE;
      if (!n.lida) {
        await api.escalaVisitasNotificacoesLidas({ id_notificacao: id }).catch(() => {});
        setNaoLidas((v) => Math.max(0, v - 1));
      }
      navigate(variante === 'mobile' ? '/escalas/visitas/mobile' : '/escalas/visitas');
      fecharPainel();
      return;
    }
    if (!n.lida) {
      await api.manutNotificacaoMarcarLida(n.id_notificacao).catch(() => {});
      setNaoLidas((v) => Math.max(0, v - 1));
    }
    irDestino(n.id_chamado);
  }

  async function marcarTodas() {
    await Promise.all([
      api.manutNotificacoesMarcarTodasLidas({ idLoja, contexto }).catch(() => {}),
      podeVerEscalaVisitas() && contexto !== 'aprovacoes'
        ? api.escalaVisitasNotificacoesLidas().catch(() => {})
        : Promise.resolve(),
    ]);
    setNaoLidas(0);
    setLista((prev) => prev.map((n) => ({ ...n, lida: true })));
  }

  const painelProps: PainelProps = {
    tituloMenu,
    naoLidas,
    contexto,
    lista,
    painelLargo,
    menuMobile,
    onMarcarTodas: marcarTodas,
    renderItem: () => null,
  };

  return menuMobile ? (
    <>
      <IconButton
        size="medium"
        aria-label={tituloMenu}
        aria-expanded={!!anchor}
        onClick={togglePainel}
        sx={{
          color: colors.textSecondary,
          position: 'relative',
          p: 1,
        }}
      >
        <Badge
          badgeContent={naoLidas > 0 ? naoLidas : null}
          color="error"
          max={99}
          overlap="circular"
          sx={{
            '& .MuiBadge-badge': {
              backgroundColor: '#DC2626',
              color: '#fff',
              fontWeight: 700,
              fontSize: '0.7rem',
              minWidth: 20,
              height: 20,
              border: '2px solid #f5f5f3',
            },
          }}
        >
          <NotificationsNoneOutlinedIcon sx={{ fontSize: 28 }} />
        </Badge>
      </IconButton>

      <Popover
        open={!!anchor}
        anchorEl={anchor}
        onClose={fecharPainel}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        disableScrollLock
        marginThreshold={8}
        slotProps={{
          transition: { onEntered: alinharSetaBalao },
          paper: {
            sx: {
              mt: 1,
              bgcolor: 'transparent',
              boxShadow: 'none',
              overflow: 'visible',
              width: 'calc(100vw - 24px)',
              maxWidth: 380,
            },
          },
        }}
      >
        <Box ref={balloonRef} sx={{ position: 'relative', width: '100%' }}>
          <Box
            aria-hidden
            sx={{
              position: 'absolute',
              top: -6,
              right: arrowRight,
              width: ARROW_HALF * 2,
              height: ARROW_HALF * 2,
              bgcolor: '#fff',
              transform: 'rotate(45deg)',
              borderLeft: '1px solid rgba(27, 42, 107, 0.1)',
              borderTop: '1px solid rgba(27, 42, 107, 0.1)',
              zIndex: 2,
              transition: 'right 0.05s ease-out',
            }}
          />
          <Paper
            elevation={0}
            sx={{
              borderRadius: 3,
              border: '1px solid rgba(27, 42, 107, 0.1)',
              boxShadow: '0 14px 40px rgba(27, 42, 107, 0.16)',
              overflow: 'hidden',
              bgcolor: '#fff',
            }}
          >
            <PainelNotificacoes
              {...painelProps}
              renderItem={(n, conteudo) => (
                <Box
                  key={n.id_notificacao}
                  component="button"
                  type="button"
                  onClick={() => abrirNotificacao(n)}
                  sx={{
                    display: 'flex',
                    width: '100%',
                    border: 'none',
                    borderBottom: '1px solid rgba(27, 42, 107, 0.06)',
                    bgcolor: n.lida ? 'transparent' : 'rgba(27, 42, 107, 0.05)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    py: 1.35,
                    px: 1.5,
                    font: 'inherit',
                    color: 'inherit',
                    '&:last-child': { borderBottom: 'none' },
                  }}
                >
                  {conteudo}
                </Box>
              )}
            />
          </Paper>
        </Box>
      </Popover>
    </>
  ) : (
    <ClickAwayListener onClickAway={fecharPainel}>
      <Box sx={{ position: 'relative', zIndex: anchor ? 10000 : 'auto' }}>
        <IconButton
          size="small"
          aria-label={tituloMenu}
          aria-expanded={!!anchor}
          onClick={togglePainel}
          sx={{
            color: colors.textSecondary,
            position: 'relative',
          }}
        >
          <Badge
            badgeContent={naoLidas > 0 ? naoLidas : null}
            color="error"
            max={99}
            overlap="circular"
            sx={{
              '& .MuiBadge-badge': {
                backgroundColor: '#DC2626',
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.65rem',
                minWidth: 18,
                height: 18,
                border: '2px solid #f5f5f3',
              },
            }}
          >
            <NotificationsNoneOutlinedIcon sx={{ fontSize: 20 }} />
          </Badge>
        </IconButton>

        {anchor ? (
          <Paper
            elevation={0}
            sx={{
              position: 'absolute',
              top: '100%',
              right: 0,
              mt: 0.75,
              zIndex: 10000,
              width: larguraMenu,
              maxWidth: 'min(95vw, 460px)',
              maxHeight: 400,
              overflow: 'auto',
              borderRadius: '14px',
              border: `1px solid ${colors.border}`,
              bgcolor: colors.surface,
              backgroundImage: 'none',
              boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
            }}
          >
            <PainelNotificacoes
              {...painelProps}
              renderItem={(n, conteudo) => (
                <Box
                  key={n.id_notificacao}
                  component="button"
                  type="button"
                  onClick={() => abrirNotificacao(n)}
                  sx={{
                    display: 'flex',
                    width: '100%',
                    alignItems: 'flex-start',
                    flexDirection: 'row',
                    gap: 1,
                    border: 'none',
                    borderBottom: `1px solid ${colors.border}`,
                    bgcolor: n.lida ? 'transparent' : 'rgba(232, 82, 10, 0.08)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    py: painelLargo ? 1.5 : 1.25,
                    px: painelLargo ? 1.5 : 1,
                    font: 'inherit',
                    color: 'inherit',
                    whiteSpace: 'normal',
                    '&:last-child': { borderBottom: 'none' },
                    '&:hover': { bgcolor: colors.canvasAlt },
                  }}
                >
                  {conteudo}
                </Box>
              )}
            />
          </Paper>
        ) : null}
      </Box>
    </ClickAwayListener>
  );
}
