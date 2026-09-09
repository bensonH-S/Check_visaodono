import { useEffect, useMemo, useRef, useState } from 'react';
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
import { corVeiculoId } from './ccVeiculoCor';
import { CC_RADIUS, CcEmpty } from './CcPanel';
import { CC_BORDER, CC_CRITICO, CC_OK, CC_ORANGE, CC_PARADO, CC_SURFACE } from './ccTheme';

const VEICULOS_VAZIOS: FrotaVeiculoPosicao[] = [];

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
  if (emExcesso(v)) return { label: 'Excesso', cor: CC_CRITICO };
  const st = statusVeiculoMapa(v, true);
  if (st === 'em_rota') return { label: 'Em rota', cor: CC_OK };
  if (st === 'parado') return { label: 'Parado', cor: CC_PARADO };
  if (st === 'disponivel') return { label: 'Disponível', cor: CC_OK };
  return { label: rotuloStatusVeiculoMapa(st), cor: CC_PARADO };
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
  cor,
  onFechar,
}: {
  veiculo: FrotaVeiculoPosicao;
  rota: FrotaVeiculoRotaDiaRelatorio | null;
  velocidade: FrotaVeiculoVelocidadeRelatorio | null;
  proximaVisita: FrotaVeiculoProximaVisita | null;
  carregandoRota?: boolean;
  escuro: boolean;
  cor: string;
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
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      sx={{
        position: 'absolute',
        top: 10,
        right: 10,
        zIndex: 800,
        width: { xs: 'min(200px, calc(100% - 20px))', sm: 208 },
        maxHeight: 'calc(100% - 56px)',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: escuro ? 'rgba(8, 8, 8, 0.94)' : 'rgba(255, 255, 255, 0.96)',
        border: escuro ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid var(--ga-border)',
        borderRadius: `${CC_RADIUS}px`,
        p: 1.25,
        overflow: 'auto',
        pointerEvents: 'auto',
        backdropFilter: 'blur(10px)',
        boxShadow: escuro ? '0 8px 24px rgba(0,0,0,0.4)' : shadows.card,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, mb: 0.35 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
          <Box sx={{ width: 10, height: 10, borderRadius: '3px', bgcolor: cor, flexShrink: 0 }} />
          <LocalShippingOutlinedIcon sx={{ fontSize: 16, color: cor }} />
          <Typography
            sx={{
              fontSize: '0.9375rem',
              fontWeight: 750,
              color: escuro ? '#F4F1EC' : 'var(--ga-text-primary)',
              letterSpacing: '-0.02em',
            }}
          >
            {veiculo.placa}
          </Typography>
        </Box>
        <IconButton size="small" onClick={onFechar} sx={{ color: escuro ? CC_PARADO : 'var(--ga-text-muted)', p: 0.35 }}>
          <CloseIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>

      <Typography sx={{ fontSize: '0.72rem', color: escuro ? CC_PARADO : 'var(--ga-text-secondary)', mb: 0.55 }}>
        {modelo}
      </Typography>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.65, mb: 1.15 }}>
        <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: st.cor, boxShadow: `0 0 8px ${st.cor}` }} />
        <Typography sx={{ fontSize: '0.72rem', fontWeight: 650, color: st.cor }}>{st.label}</Typography>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.7 }}>
        {linhas.map((l) => (
          <Box key={l.label} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
            <Typography sx={{ fontSize: '0.6875rem', color: escuro ? CC_PARADO : 'var(--ga-text-secondary)' }}>
              {l.label}
            </Typography>
            <Typography
              sx={{
                fontSize: '0.6875rem',
                color: escuro ? '#F4F1EC' : 'var(--ga-text-primary)',
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
        onClick={() => navigate(`/frota/operacao/cadastro?veiculo=${veiculo.id_veiculo}`)}
        sx={{
          mt: 1.15,
          borderRadius: `${CC_RADIUS}px`,
          borderColor: escuro ? 'rgba(232, 82, 10, 0.45)' : 'var(--ga-border)',
          color: escuro ? '#F4F1EC' : 'var(--ga-text-primary)',
          textTransform: 'none',
          fontWeight: 650,
          bgcolor: escuro ? 'rgba(24, 24, 27, 0.7)' : 'var(--ga-canvas-alt)',
          '&:hover': {
            borderColor: 'var(--ga-orange)',
            bgcolor: escuro ? 'rgba(232, 82, 10, 0.12)' : 'var(--ga-canvas)',
          },
        }}
      >
        Mais detalhes
      </Button>
    </Box>
  );
}

function Legenda({
  escuro,
  veiculos,
}: {
  escuro: boolean;
  veiculos: FrotaVeiculoPosicao[];
}) {
  const texto = escuro ? '#F4F1EC' : 'var(--ga-text-primary)';

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
        gap: { xs: 1.15, sm: 1.75 },
        px: { xs: 1.25, sm: 1.75 },
        py: 0.7,
        bgcolor: escuro ? 'rgba(8, 8, 8, 0.94)' : 'rgba(255, 255, 255, 0.96)',
        borderTop: escuro ? '1px solid rgba(148, 163, 184, 0.18)' : '1px solid var(--ga-border)',
        overflowX: 'auto',
        pointerEvents: 'none',
        scrollbarWidth: 'none',
        '&::-webkit-scrollbar': { display: 'none' },
      }}
    >
      {veiculos.slice(0, 8).map((v) => (
        <Box key={v.id_veiculo} sx={{ display: 'flex', alignItems: 'center', gap: 0.6, flexShrink: 0 }}>
          <Box sx={{ width: 16, height: 3.5, borderRadius: 2, bgcolor: corVeiculoId(v.id_veiculo) }} />
          <Typography sx={{ fontSize: '0.7rem', fontWeight: 650, color: texto, whiteSpace: 'nowrap' }}>
            {v.placa}
          </Typography>
        </Box>
      ))}
      {veiculos.length > 8 && (
        <Typography sx={{ fontSize: '0.7rem', color: texto, opacity: 0.7, flexShrink: 0 }}>
          +{veiculos.length - 8}
        </Typography>
      )}

      <Box
        sx={{
          width: '1px',
          height: 16,
          bgcolor: escuro ? 'rgba(148, 163, 184, 0.4)' : 'var(--ga-border)',
          flexShrink: 0,
        }}
      />

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.85, flexShrink: 0 }}>
        <Box
          sx={{
            width: 16,
            height: 16,
            borderRadius: '50%',
            bgcolor: CC_OK,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 10,
            fontWeight: 800,
            lineHeight: 1,
          }}
        >
          ✓
        </Box>
        <Typography sx={{ fontSize: '0.7rem', fontWeight: 500, color: texto, whiteSpace: 'nowrap' }}>
          Visita realizada
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.85, flexShrink: 0 }}>
        <Box
          sx={{
            width: 16,
            height: 16,
            borderRadius: '50%',
            bgcolor: CC_ORANGE,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 10,
            lineHeight: 1,
          }}
        >
          ★
        </Box>
        <Typography sx={{ fontSize: '0.7rem', fontWeight: 500, color: texto, whiteSpace: 'nowrap' }}>
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
  const ignorarFecharMapa = useRef(false);
  const [rota, setRota] = useState<FrotaVeiculoRotaDiaRelatorio | null>(null);
  const [velocidade, setVelocidade] = useState<FrotaVeiculoVelocidadeRelatorio | null>(null);
  const [proximaVisita, setProximaVisita] = useState<FrotaVeiculoProximaVisita | null>(null);
  const [carregandoRota, setCarregandoRota] = useState(false);

  const veiculos = data?.veiculos ?? VEICULOS_VAZIOS;
  const lojas = data?.lojas ?? [];

  const coresPorId = useMemo(() => {
    const o: Record<number, string> = {};
    for (const v of veiculos) o[v.id_veiculo] = corVeiculoId(v.id_veiculo);
    return o;
  }, [veiculos]);

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
        bgcolor: CC_SURFACE,
        borderRadius: `${CC_RADIUS}px`,
        border: `1px solid ${CC_BORDER}`,
        boxShadow: 'none',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        minHeight: 0,
      }}
    >
      <Box sx={{ px: 1.5, pt: 1.15, pb: 0.6, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
        <Box>
          <Typography sx={{ fontWeight: 650, fontSize: '0.875rem', color: 'var(--ga-text-primary)' }}>
            Frota em tempo real
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.35 }}>
            <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: CC_OK }} />
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
              color: 'var(--ga-orange)',
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
            sx={{ color: 'var(--ga-orange)', p: 0.4 }}
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
          height: '100%',
          minHeight: 0,
          mx: 1,
          mb: 1,
          borderRadius: `${CC_RADIUS}px`,
          overflow: 'hidden',
          border: '1px solid var(--ga-border)',
          bgcolor: mapaFundo,
          '& .MuiPaper-root': {
            borderRadius: `${CC_RADIUS}px !important`,
            border: 'none !important',
            height: '100% !important',
            minHeight: '0 !important',
            bgcolor: `${mapaFundo} !important`,
          },
          '& .leaflet-container': {
            borderRadius: `${CC_RADIUS}px`,
            background: `${mapaFundo} !important`,
          },
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
            carregando={loading}
            mostrarPopupVeiculo={false}
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
            onVeiculoClick={(v) => {
              ignorarFecharMapa.current = true;
              setSelecionadoId(v.id_veiculo);
              window.setTimeout(() => {
                ignorarFecharMapa.current = false;
              }, 400);
            }}
            onMapaClick={() => {
              if (ignorarFecharMapa.current) return;
              setSelecionadoId(null);
            }}
            rotaDiaVeiculo={rota}
            corRotaSelecionada={selecionadoId != null ? corVeiculoId(selecionadoId) : undefined}
            corVeiculoPorId={coresPorId}
            trajetoDiaAtual
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
              bgcolor: mapaEscuro ? 'rgba(5,5,5,0.55)' : 'rgba(255,255,255,0.55)',
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
              bgcolor: mapaEscuro ? 'rgba(5,5,5,0.25)' : 'rgba(255,255,255,0.25)',
            }}
          >
            <CcEmpty>Nenhum veículo ou loja com posição no mapa.</CcEmpty>
          </Box>
        )}

        {!erro && <Legenda escuro={mapaEscuro} veiculos={veiculos} />}

        {veiculoPainel && (
          <PainelVeiculo
            veiculo={veiculoPainel}
            rota={rota}
            velocidade={velocidade}
            proximaVisita={proximaVisita}
            carregandoRota={carregandoRota}
            escuro={mapaEscuro}
            cor={corVeiculoId(veiculoPainel.id_veiculo)}
            onFechar={() => setSelecionadoId(null)}
          />
        )}
      </Box>
    </Box>
  );
}
