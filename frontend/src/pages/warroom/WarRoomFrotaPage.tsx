import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  api,
  type FrotaMapaPosicoes,
  type FrotaVeiculoPosicao,
  type FrotaVeiculoProximaVisita,
  type FrotaVeiculoRotaDiaRelatorio,
  type FrotaVeiculoVelocidadeRelatorio,
} from '../../api/client';
import FrotaLocalizacaoMap from '../../components/frota/FrotaLocalizacaoMap';
import { FROTA_MAPA_ESCURO_FUNDO } from '../../components/frota/frotaMapaBasemap';
import {
  formatarNomeModeloVeiculo,
  nomeOcupanteVeiculo,
  rotuloStatusVeiculoMapa,
  statusVeiculoMapa,
} from '../../components/frota/frotaMapaVeiculo';
import { LIMITE_VELOCIDADE_KMH } from '../../components/dashboard/commandCenter/ccFormat';
import { assetUrl } from '../../config/paths';
import { primeiraRotaPermitida } from '../../config/navPermissions';
import { getUsuario, podeVerMapaTecnicosMobile, temPermissao } from '../../lib/auth';
import { podeAcessarModuloFrota } from '../frota/frotaNav';
import { dataHojeBrasilia, formatarDuracaoMs, formatDataHoraBrasilia } from '../../utils/dateBr';
import { garantirRotaNasRuas } from '../../utils/osrmMapMatch';

const INTERVALO_MS = 20_000;

const WR = {
  bg: '#070605',
  surface: '#120f0c',
  surface2: '#1b1612',
  border: 'rgba(255, 138, 46, 0.38)',
  borderSoft: 'rgba(255, 255, 255, 0.08)',
  orange: '#FF7A1A',
  gold: '#F0B429',
  text: '#F6F3EE',
  muted: '#A39890',
  red: '#FF4D4D',
  green: '#3DDC6A',
  gray: '#8B939E',
} as const;

type StatusPainel = 'excesso' | 'em_rota' | 'parado' | 'desligado' | 'sem_sinal';

function podeAbrirWarRoom() {
  const user = getUsuario();
  return podeVerMapaTecnicosMobile(user) || podeAcessarModuloFrota(user);
}

function emExcesso(v: FrotaVeiculoPosicao) {
  const vel = Number(v.velocidade);
  return Number.isFinite(vel) && vel > LIMITE_VELOCIDADE_KMH;
}

function classificar(v: FrotaVeiculoPosicao): StatusPainel {
  if (emExcesso(v)) return 'excesso';
  const st = statusVeiculoMapa(v, true);
  if (st === 'em_rota') return 'em_rota';
  if (st === 'disponivel') return 'parado';
  if (st === 'parado') return 'desligado';
  return 'sem_sinal';
}

function rotuloStatus(st: StatusPainel) {
  if (st === 'excesso') return 'Excesso';
  if (st === 'em_rota') return 'Em rota';
  if (st === 'parado') return 'Parado';
  if (st === 'desligado') return 'Desligado';
  return rotuloStatusVeiculoMapa('sem_sinal');
}

function corStatus(st: StatusPainel) {
  if (st === 'excesso' || st === 'parado') return WR.red;
  if (st === 'em_rota') return WR.green;
  if (st === 'desligado') return WR.gray;
  return '#94A3B8';
}

function ordemStatus(st: StatusPainel) {
  if (st === 'excesso') return 0;
  if (st === 'em_rota') return 1;
  if (st === 'parado') return 2;
  if (st === 'desligado') return 3;
  return 4;
}

function formatRelogio(data: Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(data);
}

function formatContagem(ms: number) {
  const seg = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatUltimaPosicao(iso: string | null | undefined) {
  if (!iso) return '—';
  return formatDataHoraBrasilia(iso).replace(',', ' ·').replace(/\s+/g, ' ').trim();
}

function Kpi({
  label,
  valor,
  cor,
  grande,
}: {
  label: string;
  valor: number;
  cor: string;
  grande?: boolean;
}) {
  return (
    <Box
      sx={{
        flex: grande ? 1.35 : 1,
        minWidth: 0,
        px: { xs: 1.25, md: 1.75 },
        py: { xs: 0.9, md: 1.05 },
        borderRadius: '10px',
        bgcolor: WR.surface,
        border: `1px solid ${WR.border}`,
        boxShadow: 'inset 0 1px 0 rgba(255, 180, 90, 0.06)',
      }}
    >
      <Typography
        sx={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: WR.muted,
          lineHeight: 1.2,
        }}
      >
        {label}
      </Typography>
      <Typography
        sx={{
          mt: 0.35,
          fontSize: grande ? { xs: 28, md: 34 } : { xs: 22, md: 28 },
          fontWeight: 750,
          letterSpacing: '-0.03em',
          lineHeight: 1,
          color: cor,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {valor}
      </Typography>
    </Box>
  );
}

function PainelVeiculo({
  veiculo,
  rota,
  velocidade,
  proximaVisita,
  carregando,
  onFechar,
}: {
  veiculo: FrotaVeiculoPosicao;
  rota: FrotaVeiculoRotaDiaRelatorio | null;
  velocidade: FrotaVeiculoVelocidadeRelatorio | null;
  proximaVisita: FrotaVeiculoProximaVisita | null;
  carregando: boolean;
  onFechar: () => void;
}) {
  const st = classificar(veiculo);
  const cor = corStatus(st);
  const vel = Number(veiculo.velocidade);
  const kmHoje = rota?.km_odometro ?? rota?.km_gps;
  const velMax = velocidade?.velocidade_maxima ?? null;
  const tempoParado = rota?.tempo_parado_ms ?? velocidade?.tempo_parado_ms;
  const linhas = [
    { label: 'Motorista', value: nomeOcupanteVeiculo(veiculo) || '—' },
    { label: 'Última posição', value: formatUltimaPosicao(veiculo.atualizado_em) },
    {
      label: 'KM hoje',
      value:
        kmHoje != null && Number.isFinite(Number(kmHoje))
          ? `${Number(kmHoje).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`
          : carregando
            ? '…'
            : '—',
    },
    {
      label: 'Vel. máxima',
      value:
        velMax != null && velMax > 0
          ? `${Math.round(Number(velMax))} km/h`
          : carregando
            ? '…'
            : '—',
    },
    {
      label: 'Tempo parado',
      value: tempoParado != null ? formatarDuracaoMs(tempoParado) : carregando ? '…' : '—',
    },
    {
      label: 'Próxima visita',
      value: carregando ? '…' : proximaVisita?.proxima_visita?.rotulo || '—',
    },
  ];

  return (
    <Box
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      sx={{
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 800,
        width: { xs: 'min(280px, calc(100% - 24px))', md: 280 },
        maxHeight: 'calc(100% - 56px)',
        overflow: 'auto',
        p: 1.4,
        borderRadius: '10px',
        bgcolor: 'rgba(12, 10, 8, 0.94)',
        border: `1px solid ${WR.border}`,
        backdropFilter: 'blur(8px)',
        boxShadow: '0 16px 40px rgba(0,0,0,0.45)',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 18, fontWeight: 750, color: WR.gold, letterSpacing: '0.04em' }}>
            {veiculo.placa}
          </Typography>
          <Typography sx={{ fontSize: 12, color: WR.muted, mt: 0.15 }}>
            {formatarNomeModeloVeiculo(veiculo)}
          </Typography>
        </Box>
        <IconButton size="small" onClick={onFechar} sx={{ color: WR.muted, p: 0.3 }} aria-label="Fechar">
          <CloseIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mt: 1 }}>
        <Typography sx={{ fontSize: 26, fontWeight: 750, color: cor, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
          {Number.isFinite(vel) ? Math.round(vel) : '—'}
        </Typography>
        <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: cor }}>
          KM/H · {rotuloStatus(st).toUpperCase()}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.7, mt: 1.4 }}>
        {linhas.map((l) => (
          <Box key={l.label} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1.2 }}>
            <Typography sx={{ fontSize: 11, color: WR.muted }}>{l.label}</Typography>
            <Typography sx={{ fontSize: 11, fontWeight: 650, color: WR.text, textAlign: 'right' }}>{l.value}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

export default function WarRoomFrotaPage() {
  const navigate = useNavigate();
  const permitido = podeAbrirWarRoom();
  const [data, setData] = useState<FrotaMapaPosicoes | null>(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [agora, setAgora] = useState(() => new Date());
  const [restaMs, setRestaMs] = useState(INTERVALO_MS);
  const [telaCheia, setTelaCheia] = useState(false);
  const [selecionadoId, setSelecionadoId] = useState<number | null>(null);
  const [rota, setRota] = useState<FrotaVeiculoRotaDiaRelatorio | null>(null);
  const [velocidade, setVelocidade] = useState<FrotaVeiculoVelocidadeRelatorio | null>(null);
  const [proximaVisita, setProximaVisita] = useState<FrotaVeiculoProximaVisita | null>(null);
  const [carregandoRota, setCarregandoRota] = useState(false);
  const ultimoFetch = useRef(Date.now());
  const ignorarFecharMapa = useRef(false);
  const jaCarregou = useRef(false);

  const carregar = useCallback(async () => {
    try {
      const posicoes = await api.frotaMapaPosicoes();
      setData(posicoes);
      setErro('');
      jaCarregou.current = true;
    } catch (e) {
      if (!jaCarregou.current) {
        setErro(e instanceof Error ? e.message : 'Não foi possível carregar a frota');
      }
    } finally {
      setCarregando(false);
      ultimoFetch.current = Date.now();
      setRestaMs(INTERVALO_MS);
    }
  }, []);

  useEffect(() => {
    document.title = 'War Room · Frota ao vivo';
    if (!permitido) return;
    void carregar();
    const id = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      void carregar();
    }, INTERVALO_MS);
    return () => window.clearInterval(id);
  }, [carregar, permitido]);

  useEffect(() => {
    const relogio = window.setInterval(() => setAgora(new Date()), 1000);
    const conta = window.setInterval(() => {
      setRestaMs(Math.max(0, INTERVALO_MS - (Date.now() - ultimoFetch.current)));
    }, 250);
    const onFs = () => setTelaCheia(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFs);
    return () => {
      window.clearInterval(relogio);
      window.clearInterval(conta);
      document.removeEventListener('fullscreenchange', onFs);
    };
  }, []);

  useEffect(() => {
    if (selecionadoId == null) {
      setRota(null);
      setVelocidade(null);
      setProximaVisita(null);
      return;
    }
    let cancelado = false;
    const dia = dataHojeBrasilia();
    setCarregandoRota(true);
    Promise.all([
      api.frotaVeiculoRotaDia(selecionadoId, dia).then((r) => garantirRotaNasRuas(r)).catch(() => null),
      api.frotaVeiculoVelocidade(selecionadoId, dia, dia).catch(() => null),
      api.frotaVeiculoProximaVisita(selecionadoId, { data: dia }).catch(() => null),
    ])
      .then(([r, v, p]) => {
        if (cancelado) return;
        setRota(r);
        setVelocidade(v);
        setProximaVisita(p);
      })
      .finally(() => {
        if (!cancelado) setCarregandoRota(false);
      });
    return () => {
      cancelado = true;
    };
  }, [selecionadoId]);

  const veiculos = data?.veiculos ?? [];
  const lojas = data?.lojas ?? [];
  const ordenados = useMemo(() => {
    return [...veiculos].sort((a, b) => {
      const sa = classificar(a);
      const sb = classificar(b);
      const ordem = ordemStatus(sa) - ordemStatus(sb);
      if (ordem !== 0) return ordem;
      return Number(b.velocidade || 0) - Number(a.velocidade || 0);
    });
  }, [veiculos]);

  const contagem = useMemo(() => {
    const base = { em_rota: 0, parado: 0, desligado: 0, excesso: 0, sem_sinal: 0 };
    for (const v of veiculos) base[classificar(v)] += 1;
    return base;
  }, [veiculos]);

  const selecionado = ordenados.find((v) => v.id_veiculo === selecionadoId) || null;

  function escolher(id: number) {
    ignorarFecharMapa.current = true;
    setSelecionadoId(id);
    window.setTimeout(() => {
      ignorarFecharMapa.current = false;
    }, 400);
  }

  async function alternarTelaCheia() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      /* o navegador recusou a tela cheia */
    }
  }

  if (!permitido) {
    return <Navigate to={primeiraRotaPermitida(getUsuario())} replace />;
  }

  const destinoVolta = temPermissao('portal.dashboard.ver') ? '/dashboard' : '/frota';

  return (
    <Box
      sx={{
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        color: WR.text,
        bgcolor: WR.bg,
        backgroundImage:
          'radial-gradient(ellipse 70% 42% at 50% -8%, rgba(255, 122, 26, 0.22), transparent 58%)',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          px: { xs: 1.5, md: 2.25 },
          pt: 1.25,
          pb: 1,
          flexShrink: 0,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.25, md: 1.75 }, minWidth: 0 }}>
          <Box
            component="img"
            src={assetUrl('Logo_CentralGA.png')}
            alt="CentralGA"
            sx={{ height: { xs: 34, md: 42 }, width: 'auto', objectFit: 'contain', flexShrink: 0 }}
          />
          <Box sx={{ width: '1px', height: 36, bgcolor: 'rgba(255,255,255,0.14)', flexShrink: 0 }} />
          <Box sx={{ minWidth: 0 }}>
            <Typography
              sx={{
                fontSize: { xs: 11, md: 12 },
                fontWeight: 750,
                letterSpacing: '0.22em',
                color: WR.muted,
                lineHeight: 1.1,
              }}
            >
              WAR ROOM
            </Typography>
            <Typography
              sx={{
                fontSize: { xs: 16, md: 20 },
                fontWeight: 750,
                letterSpacing: '0.08em',
                color: WR.text,
                lineHeight: 1.15,
              }}
            >
              FROTA AO VIVO
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.25, md: 2 } }}>
          <Box sx={{ textAlign: 'right' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.7 }}>
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: WR.green,
                  boxShadow: '0 0 8px rgba(61, 220, 106, 0.8)',
                  animation: 'wr-live 1.4s ease-in-out infinite',
                  '@keyframes wr-live': {
                    '0%, 100%': { opacity: 1 },
                    '50%': { opacity: 0.35 },
                  },
                }}
              />
              <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.16em', color: WR.green }}>
                LIVE
              </Typography>
              <Typography sx={{ fontSize: { xs: 16, md: 20 }, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: WR.text }}>
                {formatRelogio(agora)}
              </Typography>
            </Box>
            <Typography sx={{ fontSize: 10, letterSpacing: '0.08em', color: WR.muted, textTransform: 'uppercase' }}>
              Próxima atualização{' '}
              <Box component="span" sx={{ color: WR.gold, fontWeight: 750, fontVariantNumeric: 'tabular-nums' }}>
                {formatContagem(restaMs)}
              </Box>
            </Typography>
          </Box>
          <IconButton onClick={alternarTelaCheia} aria-label="Tela cheia" sx={{ color: WR.muted, '&:hover': { color: WR.orange } }}>
            {telaCheia ? <FullscreenExitIcon /> : <FullscreenIcon />}
          </IconButton>
          <Typography
            component="button"
            type="button"
            onClick={() => navigate(destinoVolta)}
            sx={{
              border: 0,
              bgcolor: 'transparent',
              color: WR.muted,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.12em',
              cursor: 'pointer',
              textTransform: 'uppercase',
              '&:hover': { color: WR.orange },
            }}
          >
            Sair
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 1, px: { xs: 1.5, md: 2.25 }, pb: 1.15, flexShrink: 0, overflowX: 'auto' }}>
        <Kpi label="Em rota" valor={contagem.em_rota} cor={WR.green} grande />
        <Kpi label="Parados" valor={contagem.parado} cor={WR.red} />
        <Kpi label="Excesso" valor={contagem.excesso} cor={contagem.excesso > 0 ? WR.red : WR.gold} />
        <Kpi label="Desligados" valor={contagem.desligado} cor={WR.gold} />
        <Kpi label="Sem sinal" valor={contagem.sem_sinal} cor={WR.muted} />
      </Box>

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          gap: 1,
          px: { xs: 1.5, md: 2.25 },
          pb: 1.25,
        }}
      >
        <Box
          sx={{
            position: 'relative',
            flex: 1,
            minHeight: { xs: 320, md: 0 },
            borderRadius: '12px',
            overflow: 'hidden',
            border: `1px solid ${WR.border}`,
            bgcolor: FROTA_MAPA_ESCURO_FUNDO,
            '& .MuiPaper-root': {
              border: 'none !important',
              height: '100% !important',
              minHeight: '0 !important',
              bgcolor: `${FROTA_MAPA_ESCURO_FUNDO} !important`,
            },
            '& .leaflet-container': { background: `${FROTA_MAPA_ESCURO_FUNDO} !important` },
            '& .leaflet-control-zoom, & .leaflet-control-attribution': { display: 'none !important' },
          }}
        >
          {erro && !data ? (
            <Box sx={{ height: '100%', display: 'grid', placeItems: 'center', p: 3, textAlign: 'center' }}>
              <Box>
                <Typography sx={{ color: WR.text, fontWeight: 650 }}>{erro}</Typography>
                <Typography
                  component="button"
                  type="button"
                  onClick={() => {
                    setCarregando(true);
                    void carregar();
                  }}
                  sx={{
                    mt: 1.2,
                    border: 0,
                    bgcolor: 'transparent',
                    color: WR.orange,
                    fontWeight: 750,
                    cursor: 'pointer',
                  }}
                >
                  Tentar novamente
                </Typography>
              </Box>
            </Box>
          ) : (
            <FrotaLocalizacaoMap
              posicoes={[]}
              lojas={lojas}
              veiculos={veiculos}
              carregando={carregando && !data}
              mostrarPopupVeiculo={false}
              rastreamentoAtivo={data?.rastreamento_ativo !== false}
              onAtualizar={carregar}
              preencherAltura
              visivel
              modo="gestao"
              mostrarBotaoAtualizar={false}
              mostrarAlternarTipoMapa={false}
              esconderAvisos
              ocultarPlaceholder
              seguirTemaApp={false}
              temaEscuro
              tilesGoogle={false}
              ocultarZoom
              veiculoDestaqueId={selecionadoId}
              onVeiculoClick={(v) => escolher(v.id_veiculo)}
              onMapaClick={() => {
                if (ignorarFecharMapa.current) return;
                setSelecionadoId(null);
              }}
              rotaDiaVeiculo={rota}
              corRotaSelecionada={selecionado ? corStatus(classificar(selecionado)) : undefined}
              trajetoDiaAtual
            />
          )}

          {carregando && !data && !erro && (
            <Box sx={{ position: 'absolute', inset: 0, zIndex: 700, display: 'grid', placeItems: 'center', bgcolor: 'rgba(7,6,5,0.55)' }}>
              <CircularProgress size={32} sx={{ color: WR.orange }} />
            </Box>
          )}

          {selecionado && (
            <PainelVeiculo
              veiculo={selecionado}
              rota={rota}
              velocidade={velocidade}
              proximaVisita={proximaVisita}
              carregando={carregandoRota}
              onFechar={() => setSelecionadoId(null)}
            />
          )}

          <Box
            sx={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 500,
              display: 'flex',
              gap: 1.6,
              px: 1.5,
              py: 0.7,
              bgcolor: 'rgba(7, 6, 5, 0.88)',
              borderTop: `1px solid ${WR.borderSoft}`,
              pointerEvents: 'none',
            }}
          >
            {([
              ['Em rota', WR.green],
              ['Parado', WR.red],
              ['Desligado', WR.gray],
              ['Sem sinal', '#94A3B8'],
            ] as const).map(([label, cor]) => (
              <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                <Box sx={{ width: 10, height: 10, borderRadius: '3px', bgcolor: cor }} />
                <Typography sx={{ fontSize: 11, fontWeight: 650, color: WR.text }}>{label}</Typography>
              </Box>
            ))}
          </Box>
        </Box>

        <Box
          sx={{
            width: { xs: '100%', md: 380 },
            height: { xs: 360, md: 'auto' },
            alignSelf: 'stretch',
            flexShrink: 0,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            borderRadius: '12px',
            overflow: 'hidden',
            bgcolor: WR.surface,
            border: `1px solid ${WR.border}`,
          }}
        >
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: '28px 1fr 78px 64px',
              gap: 0.75,
              px: 1.25,
              py: 0.85,
              borderBottom: `1px solid ${WR.borderSoft}`,
            }}
          >
            {['#', 'Veículo', 'Status', 'Km/h'].map((col) => (
              <Typography
                key={col}
                sx={{ fontSize: 10, fontWeight: 750, letterSpacing: '0.12em', textTransform: 'uppercase', color: WR.muted }}
              >
                {col}
              </Typography>
            ))}
          </Box>
          <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            {ordenados.length === 0 && !carregando ? (
              <Typography sx={{ p: 2, fontSize: 13, color: WR.muted }}>Nenhum veículo no mapa.</Typography>
            ) : (
              ordenados.map((v, i) => {
                const st = classificar(v);
                const cor = corStatus(st);
                const ativo = v.id_veiculo === selecionadoId;
                const vel = Number(v.velocidade);
                const motorista = nomeOcupanteVeiculo(v);
                return (
                  <Box
                    key={v.id_veiculo}
                    component="button"
                    type="button"
                    onClick={() => escolher(v.id_veiculo)}
                    sx={{
                      width: '100%',
                      display: 'grid',
                      gridTemplateColumns: '28px 1fr 78px 64px',
                      gap: 0.75,
                      alignItems: 'center',
                      px: 1.25,
                      py: 0.85,
                      border: 0,
                      borderLeft: `3px solid ${ativo ? WR.orange : 'transparent'}`,
                      borderBottom: `1px solid ${WR.borderSoft}`,
                      bgcolor: ativo ? 'rgba(255, 122, 26, 0.1)' : 'transparent',
                      color: 'inherit',
                      textAlign: 'left',
                      cursor: 'pointer',
                      '&:hover': { bgcolor: ativo ? 'rgba(255, 122, 26, 0.14)' : WR.surface2 },
                    }}
                  >
                    <Typography sx={{ fontSize: 12, fontWeight: 700, color: WR.muted, fontVariantNumeric: 'tabular-nums' }}>
                      {i + 1}
                    </Typography>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontSize: 13, fontWeight: 750, color: WR.text, letterSpacing: '0.03em' }} noWrap>
                        {v.placa}
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: WR.muted }} noWrap>
                        {motorista || formatarNomeModeloVeiculo(v)}
                      </Typography>
                    </Box>
                    <Typography sx={{ fontSize: 11, fontWeight: 750, color: cor }} noWrap>
                      {rotuloStatus(st)}
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: 15,
                        fontWeight: 750,
                        textAlign: 'right',
                        color: st === 'excesso' ? WR.red : st === 'em_rota' ? WR.gold : WR.muted,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {Number.isFinite(vel) ? Math.round(vel) : '—'}
                    </Typography>
                  </Box>
                );
              })
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
