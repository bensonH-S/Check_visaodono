import { useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import CloseIcon from '@mui/icons-material/Close';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { api } from '../../../api/client';
import type {
  FrotaMapaPosicoes,
  FrotaVeiculoPosicao,
  FrotaVeiculoProximaVisita,
  FrotaVeiculoRotaDiaRelatorio,
  FrotaVeiculoVelocidadeRelatorio,
} from '../../../api/client';
import { useAppTheme } from '../../../context/ThemeContext';
import { shadows } from '../../../theme/tokens';
import FrotaLocalizacaoMap from '../../frota/FrotaLocalizacaoMap';
import { FROTA_MAPA_ESCURO_FUNDO } from '../../frota/frotaMapaBasemap';
import {
  formatarNomeModeloVeiculo,
  nomeOcupanteVeiculo,
  rotuloStatusVeiculoMapa,
  statusVeiculoMapa,
} from '../../frota/frotaMapaVeiculo';
import { dataHojeBrasilia, formatarDuracaoMs, formatDataHoraBrasilia } from '../../../utils/dateBr';
import { ajustarRotaAsRuas, type LatLngPar } from '../../../utils/osrmMapMatch';
import { LIMITE_VELOCIDADE_KMH } from './ccFormat';
import { CC_RADIUS, CcEmpty } from './CcPanel';

/** coords_rua “de verdade” é bem mais densa que o GPS; cópia do GPS = match falhou. */
function coordsRuaPareceSnap(coordsRua: LatLngPar[] | undefined, gps: LatLngPar[]): boolean {
  if (!coordsRua || coordsRua.length < 2) return false;
  if (gps.length < 2) return coordsRua.length >= 2;
  return coordsRua.length >= Math.max(gps.length + 5, Math.ceil(gps.length * 1.4));
}

async function garantirRotaNasRuas(
  relatorio: FrotaVeiculoRotaDiaRelatorio,
): Promise<FrotaVeiculoRotaDiaRelatorio> {
  const rotas = await Promise.all(
    (relatorio.rotas ?? []).map(async (rota) => {
      const gps = (rota.pontos ?? [])
        .map((p) => {
          const lat = Number(p.latitude);
          const lng = Number(p.longitude);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
          return [lat, lng] as LatLngPar;
        })
        .filter((c): c is LatLngPar => c != null);
      const existente = (rota.coords_rua ?? [])
        .map(([lat, lng]) => [Number(lat), Number(lng)] as LatLngPar)
        .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
      if (coordsRuaPareceSnap(existente, gps)) return { ...rota, coords_rua: existente };
      if (gps.length < 2) return rota;
      const coords_rua = await ajustarRotaAsRuas(gps);
      return { ...rota, coords_rua };
    }),
  );
  return { ...relatorio, rotas };
}

function emExcesso(v: FrotaVeiculoPosicao) {
  const vel = Number(v.velocidade);
  return Number.isFinite(vel) && vel > LIMITE_VELOCIDADE_KMH;
}

function statusVeiculo(v: FrotaVeiculoPosicao) {
  if (emExcesso(v)) return { label: 'Excesso', cor: '#EF4444' };
  const st = statusVeiculoMapa(v, true);
  if (st === 'em_rota') return { label: 'Em rota', cor: '#22C55E' };
  if (st === 'parado') return { label: 'Parado', cor: '#94A3B8' };
  if (st === 'disponivel') return { label: 'Disponível', cor: '#22C55E' };
  return { label: rotuloStatusVeiculoMapa(st), cor: '#94A3B8' };
}

function formatUltimaPosicao(iso: string | null | undefined) {
  if (!iso) return '—';
  const txt = formatDataHoraBrasilia(iso);
  return txt.replace(',', ' •').replace(/\s+/g, ' ').trim();
}

function PainelVeiculo({
  veiculo,
  rota,
  velocidade,
  proximaVisita,
  carregandoRota,
  escuro,
  onFechar,
}: {
  veiculo: FrotaVeiculoPosicao;
  rota: FrotaVeiculoRotaDiaRelatorio | null;
  velocidade: FrotaVeiculoVelocidadeRelatorio | null;
  proximaVisita: FrotaVeiculoProximaVisita | null;
  carregandoRota?: boolean;
  escuro: boolean;
  onFechar: () => void;
}) {
  const navigate = useNavigate();
  const st = statusVeiculo(veiculo);
  const motorista = nomeOcupanteVeiculo(veiculo) || '—';
  const modelo = formatarNomeModeloVeiculo(veiculo);
  const vel = Number(veiculo.velocidade);
  const kmHoje = rota?.km_odometro ?? rota?.km_gps;
  const velMax = velocidade?.velocidade_maxima ?? null;
  const tempoParado = rota?.tempo_parado_ms ?? velocidade?.tempo_parado_ms;
  const rotuloVisita = proximaVisita?.proxima_visita?.rotulo;
  const eta = proximaVisita?.eta_horario;

  const linhas = [
    { label: 'Motorista', value: motorista },
    { label: 'Última posição', value: formatUltimaPosicao(veiculo.atualizado_em) },
    {
      label: 'KM hoje',
      value:
        kmHoje != null && Number.isFinite(Number(kmHoje))
          ? `${Number(kmHoje).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`
          : carregandoRota
            ? '…'
            : '—',
    },
    {
      label: 'Velocidade atual',
      value: Number.isFinite(vel) ? `${Math.round(vel)} km/h` : '—',
    },
    {
      label: 'Vel. máxima hoje',
      value:
        velMax != null && velMax > 0
          ? `${Math.round(Number(velMax))} km/h`
          : carregandoRota
            ? '…'
            : '—',
    },
    {
      label: 'Tempo parado',
      value: tempoParado != null ? formatarDuracaoMs(tempoParado) : carregandoRota ? '…' : '—',
    },
    {
      label: 'Próxima visita',
      value: carregandoRota ? '…' : rotuloVisita || '—',
    },
    {
      label: 'Chegada estimada',
      value: carregandoRota ? '…' : eta || '—',
    },
  ];

  return (
    <Box
      sx={{
        position: 'absolute',
        top: 12,
        right: 12,
        bottom: 52,
        zIndex: 800,
        width: { xs: 'min(260px, calc(100% - 24px))', sm: 268 },
        display: 'flex',
        flexDirection: 'column',
        bgcolor: escuro ? 'rgba(17, 24, 39, 0.94)' : 'rgba(255, 255, 255, 0.96)',
        border: escuro ? '1px solid rgba(148, 163, 184, 0.22)' : '1px solid var(--ga-border)',
        borderRadius: `${CC_RADIUS}px`,
        p: 2,
        minHeight: 0,
        overflow: 'auto',
        backdropFilter: 'blur(10px)',
        boxShadow: escuro ? '0 12px 32px rgba(0,0,0,0.45)' : shadows.card,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, mb: 0.35 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
          <LocalShippingOutlinedIcon sx={{ fontSize: 18, color: escuro ? '#94A3B8' : 'var(--ga-text-muted)' }} />
          <Typography
            sx={{
              fontSize: '1.1rem',
              fontWeight: 750,
              color: escuro ? '#fff' : 'var(--ga-text-primary)',
              letterSpacing: '-0.02em',
            }}
          >
            {veiculo.placa}
          </Typography>
        </Box>
        <IconButton size="small" onClick={onFechar} sx={{ color: escuro ? '#64748B' : 'var(--ga-text-muted)', p: 0.35 }}>
          <CloseIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>

      <Typography sx={{ fontSize: '0.8rem', color: escuro ? '#94A3B8' : 'var(--ga-text-secondary)', mb: 0.85 }}>
        {modelo}
      </Typography>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 2 }}>
        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: st.cor, boxShadow: `0 0 8px ${st.cor}` }} />
        <Typography sx={{ fontSize: '0.8rem', fontWeight: 650, color: st.cor }}>{st.label}</Typography>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2, flex: 1 }}>
        {linhas.map((l) => (
          <Box key={l.label} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1.5 }}>
            <Typography sx={{ fontSize: '0.75rem', color: escuro ? '#94A3B8' : 'var(--ga-text-secondary)' }}>
              {l.label}
            </Typography>
            <Typography
              sx={{
                fontSize: '0.75rem',
                color: escuro ? '#F8FAFC' : 'var(--ga-text-primary)',
                fontWeight: 600,
                textAlign: 'right',
              }}
            >
              {l.value}
            </Typography>
          </Box>
        ))}
      </Box>

      <Button
        fullWidth
        variant="outlined"
        size="small"
        onClick={() => navigate(`/frota?veiculo=${veiculo.id_veiculo}`)}
        sx={{
          mt: 2,
          borderRadius: `${CC_RADIUS}px`,
          borderColor: escuro ? 'rgba(59, 130, 246, 0.4)' : 'var(--ga-border)',
          color: escuro ? '#E2E8F0' : 'var(--ga-text-primary)',
          textTransform: 'none',
          fontWeight: 650,
          bgcolor: escuro ? 'rgba(15, 23, 42, 0.6)' : 'var(--ga-canvas-alt)',
          '&:hover': {
            borderColor: '#3B82F6',
            bgcolor: escuro ? 'rgba(59, 130, 246, 0.12)' : 'var(--ga-canvas)',
          },
        }}
      >
        Ver detalhes
      </Button>
    </Box>
  );
}

function Legenda({ escuro }: { escuro: boolean }) {
  const texto = escuro ? '#F1F5F9' : 'var(--ga-text-primary)';
  const linha = (cor: string, label: string) => (
    <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 0.85, flexShrink: 0 }}>
      <Box sx={{ width: 22, height: 3.5, borderRadius: 2, bgcolor: cor }} />
      <Typography sx={{ fontSize: '0.75rem', fontWeight: 500, color: texto, whiteSpace: 'nowrap' }}>
        {label}
      </Typography>
    </Box>
  );

  return (
    <Box
      sx={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 500,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        flexWrap: 'nowrap',
        gap: { xs: 1.5, sm: 2.25 },
        px: { xs: 1.5, sm: 2.25 },
        py: 1.15,
        bgcolor: escuro ? 'rgba(11, 18, 32, 0.94)' : 'rgba(255, 255, 255, 0.96)',
        borderTop: escuro ? '1px solid rgba(148, 163, 184, 0.18)' : '1px solid var(--ga-border)',
        overflowX: 'auto',
        pointerEvents: 'none',
        scrollbarWidth: 'none',
        '&::-webkit-scrollbar': { display: 'none' },
      }}
    >
      {linha('#3B82F6', 'Em rota')}
      {linha('#94A3B8', 'Parado')}
      {linha('#EF4444', 'Excesso')}

      <Box
        sx={{
          width: '1px',
          height: 18,
          bgcolor: escuro ? 'rgba(148, 163, 184, 0.4)' : 'var(--ga-border)',
          flexShrink: 0,
        }}
      />

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.85, flexShrink: 0 }}>
        <Box
          sx={{
            width: 18,
            height: 18,
            borderRadius: '50%',
            bgcolor: '#22C55E',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 11,
            fontWeight: 800,
            lineHeight: 1,
            boxShadow: '0 0 0 2px rgba(34,197,94,0.25)',
          }}
        >
          ✓
        </Box>
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 500, color: texto, whiteSpace: 'nowrap' }}>
          Visita realizada
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.85, flexShrink: 0 }}>
        <Box
          sx={{
            width: 18,
            height: 18,
            borderRadius: '50%',
            bgcolor: '#3B82F6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 11,
            lineHeight: 1,
            boxShadow: '0 0 0 2px rgba(59,130,246,0.25)',
          }}
        >
          ★
        </Box>
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 500, color: texto, whiteSpace: 'nowrap' }}>
          Próxima visita
        </Typography>
      </Box>
    </Box>
  );
}

export default function CcFrota({
  loading,
  data,
  erro,
  onRefresh,
  dataRef,
}: {
  loading?: boolean;
  data: FrotaMapaPosicoes | null;
  erro?: string | null;
  onRefresh: () => void;
  dataRef?: string;
}) {
  const { mode } = useAppTheme();
  const mapaEscuro = mode === 'dark';
  const mapaFundo = mapaEscuro ? FROTA_MAPA_ESCURO_FUNDO : '#F8FAFC';

  const [selecionadoId, setSelecionadoId] = useState<number | null>(null);
  const [rota, setRota] = useState<FrotaVeiculoRotaDiaRelatorio | null>(null);
  const [velocidade, setVelocidade] = useState<FrotaVeiculoVelocidadeRelatorio | null>(null);
  const [proximaVisita, setProximaVisita] = useState<FrotaVeiculoProximaVisita | null>(null);
  const [carregandoRota, setCarregandoRota] = useState(false);

  const veiculos = data?.veiculos ?? [];
  const lojas = data?.lojas ?? [];

  const veiculoPainel = useMemo(() => {
    if (selecionadoId == null) return null;
    return veiculos.find((v) => v.id_veiculo === selecionadoId) || null;
  }, [selecionadoId, veiculos]);

  useEffect(() => {
    if (selecionadoId == null) {
      setRota(null);
      setVelocidade(null);
      setProximaVisita(null);
      return;
    }
    let cancelado = false;
    setCarregandoRota(true);
    const dia = dataRef || dataHojeBrasilia();
    Promise.all([
      api
        .frotaVeiculoRotaDia(selecionadoId, dia)
        .then((r) => garantirRotaNasRuas(r))
        .catch(() => null),
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
  }, [selecionadoId, dataRef]);

  const temPosicao =
    veiculos.some((v) => Number.isFinite(Number(v.latitude)) && Number.isFinite(Number(v.longitude))) ||
    lojas.some((l) => Number.isFinite(Number(l.latitude)) && Number.isFinite(Number(l.longitude)));

  return (
    <Box
      sx={{
        bgcolor: 'var(--ga-surface)',
        borderRadius: `${CC_RADIUS}px`,
        border: '1px solid var(--ga-border)',
        boxShadow: shadows.sm,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        minHeight: 420,
      }}
    >
      <Box sx={{ px: 2.25, pt: 2.25, pb: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
        <Box>
          <Typography sx={{ fontWeight: 650, fontSize: '0.9375rem', color: 'var(--ga-text-primary)' }}>
            Frota em tempo real
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.35 }}>
            <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#22C55E', boxShadow: '0 0 6px #22C55E' }} />
            <Typography sx={{ fontSize: '0.75rem', color: 'var(--ga-text-secondary)' }}>Atualizado agora</Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography
            component={RouterLink}
            to="/frota"
            sx={{
              fontSize: '0.75rem',
              fontWeight: 600,
              color: '#3B82F6',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              '&:hover': { textDecoration: 'underline' },
            }}
          >
            Ver frota completa
          </Typography>
          <IconButton
            component={RouterLink}
            to="/frota"
            size="small"
            sx={{ color: '#3B82F6', p: 0.4 }}
            aria-label="Abrir frota"
          >
            <OpenInFullIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
      </Box>

      <Box
        sx={{
          position: 'relative',
          flex: 1,
          minHeight: 340,
          mx: 1.25,
          mb: 1.25,
          borderRadius: `${CC_RADIUS}px`,
          overflow: 'hidden',
          border: '1px solid var(--ga-border)',
          bgcolor: mapaFundo,
          '& .MuiPaper-root': {
            borderRadius: `${CC_RADIUS}px !important`,
            border: 'none !important',
            height: '100% !important',
            minHeight: '340px !important',
            bgcolor: `${mapaFundo} !important`,
          },
          '& .leaflet-container': {
            borderRadius: `${CC_RADIUS}px`,
            background: `${mapaFundo} !important`,
          },
          ...(mapaEscuro
            ? {
                '& .marker-veiculo-pin.is-em_rota .marker-veiculo-corpo': {
                  background: '#3B82F6 !important',
                },
                '& .marker-veiculo-pin.is-em_rota .marker-veiculo-ponta': {
                  borderTopColor: '#3B82F6 !important',
                },
              }
            : null),
          '& .leaflet-control-zoom': {
            display: 'none !important',
          },
          '& .leaflet-control-attribution': {
            display: 'none',
          },
        }}
      >
        {erro && !loading ? (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              zIndex: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              p: 2,
              bgcolor: mapaFundo,
            }}
          >
            <Box sx={{ textAlign: 'center' }}>
              <CcEmpty>{erro}</CcEmpty>
              <Typography
                component="button"
                type="button"
                onClick={onRefresh}
                sx={{
                  mt: 1,
                  border: 0,
                  bgcolor: 'transparent',
                  color: 'var(--ga-orange)',
                  fontWeight: 650,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                }}
              >
                Tentar novamente
              </Typography>
            </Box>
          </Box>
        ) : (
          <FrotaLocalizacaoMap
            key={mapaEscuro ? 'mapa-escuro' : 'mapa-claro'}
            posicoes={[]}
            lojas={lojas}
            veiculos={veiculos}
            carregando={loading || carregandoRota}
            rastreamentoAtivo={data?.rastreamento_ativo !== false}
            onAtualizar={onRefresh}
            preencherAltura
            visivel
            modo="gestao"
            mostrarBotaoAtualizar={false}
            mostrarAlternarTipoMapa={false}
            esconderAvisos
            ocultarPlaceholder
            temaEscuro={mapaEscuro}
            basemapClaroVector={!mapaEscuro}
            tilesGoogle={false}
            ocultarZoom
            veiculoDestaqueId={veiculoPainel?.id_veiculo ?? null}
            onVeiculoClick={(v) => setSelecionadoId(v.id_veiculo)}
            onMapaClick={() => setSelecionadoId(null)}
            rotaDiaVeiculo={rota}
            trajetoDiaAtual
            veiculoAoVivoTrajeto={veiculoPainel}
            autoRefreshIntervalMs={60_000}
          />
        )}

        {loading && !data && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              zIndex: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: mapaEscuro ? 'rgba(11,18,32,0.55)' : 'rgba(255,255,255,0.55)',
            }}
          >
            <CircularProgress size={28} sx={{ color: 'var(--ga-orange)' }} />
          </Box>
        )}

        {!loading && !erro && !temPosicao && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              zIndex: 400,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              bgcolor: mapaEscuro ? 'rgba(11,18,32,0.25)' : 'rgba(255,255,255,0.25)',
            }}
          >
            <CcEmpty>Nenhum veículo ou loja com posição no mapa.</CcEmpty>
          </Box>
        )}

        {!erro && <Legenda escuro={mapaEscuro} />}

        {veiculoPainel && (
          <PainelVeiculo
            veiculo={veiculoPainel}
            rota={rota}
            velocidade={velocidade}
            proximaVisita={proximaVisita}
            carregandoRota={carregandoRota}
            escuro={mapaEscuro}
            onFechar={() => setSelecionadoId(null)}
          />
        )}
      </Box>
    </Box>
  );
}
