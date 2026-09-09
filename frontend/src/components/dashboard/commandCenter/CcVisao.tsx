import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Dialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CloseIcon from '@mui/icons-material/Close';
import VideocamOutlinedIcon from '@mui/icons-material/VideocamOutlined';
import { assetUrl, VIDEO_VISAO_PILOTO } from '../../../config/paths';
import {
  CC_BORDER,
  CC_CRITICO,
  CC_MUTED,
  CC_ORANGE,
  CC_RADIUS,
  CC_SURFACE,
  CC_SURFACE_2,
  CC_TEXT,
} from './ccTheme';

type Prioridade = 'critica' | 'alta' | 'media';

type EventoVisao = {
  id: string;
  titulo: string;
  camera: string;
  horario: string;
  duracao: string;
  confianca: number;
  prioridade: Prioridade;
  caminho: string;
  resumo: string;
  cadeia: string[];
  detectores: string[];
};

const VIDEO_DEMO = assetUrl(VIDEO_VISAO_PILOTO);

const PILOTO = {
  loja: '408 Sul',
  camerasAtivas: 11,
  camerasTotal: 12,
  eventosHoje: 7,
  revisao: 2,
};

const EVENTOS: EventoVisao[] = [
  {
    id: 'desvio-01',
    titulo: 'Possível desvio · revisão necessária',
    camera: 'Estoque 02',
    horario: '22:37:14',
    duracao: '00:28',
    confianca: 84,
    prioridade: 'critica',
    caminho: 'Estoque → mochila → fundos',
    resumo:
      'Pessoa #31 entrou no estoque, interagiu com mercadoria, possível armazenamento em bolsa e acessou a porta dos fundos.',
    cadeia: ['Estoque', 'Mochila', 'Fundos'],
    detectores: ['01', '02', '03', '04'],
  },
  {
    id: 'saida-01',
    titulo: 'Saída com mercadoria',
    camera: 'Porta dos fundos',
    horario: '21:14:06',
    duracao: '00:16',
    confianca: 91,
    prioridade: 'alta',
    caminho: 'Interno → porta fundos → exterior',
    resumo: 'Pessoa #18 cruzou a linha de saída carregando caixa. Objeto permaneceu associado até o exterior.',
    cadeia: ['Interno', 'Porta fundos', 'Exterior'],
    detectores: ['02'],
  },
  {
    id: 'porta-01',
    titulo: 'Câmara fria aberta 1m08s',
    camera: 'Câmara fria 01',
    horario: '19:52:41',
    duracao: '01:08',
    confianca: 96,
    prioridade: 'alta',
    caminho: 'Porta crítica → fria',
    resumo: 'Porta da câmara fria permaneceu aberta além de 45s. Sem pessoa na zona nos últimos 22s do evento.',
    cadeia: ['Porta crítica', 'Fria'],
    detectores: ['03'],
  },
  {
    id: 'caixa-01',
    titulo: 'Acesso prolongado ao caixa',
    camera: 'Caixa 01',
    horario: '18:41:22',
    duracao: '00:47',
    confianca: 78,
    prioridade: 'media',
    caminho: 'Salão → caixa',
    resumo: 'Pessoa #12 permaneceu na zona do caixa fora do fluxo padrão por mais de 40s.',
    cadeia: ['Salão', 'Caixa'],
    detectores: ['05'],
  },
  {
    id: 'estoque-02',
    titulo: 'Movimentação fora de horário',
    camera: 'Estoque 01',
    horario: '17:05:09',
    duracao: '00:33',
    confianca: 88,
    prioridade: 'alta',
    caminho: 'Corredor → estoque',
    resumo: 'Entrada no estoque fora da janela operacional cadastrada. Objeto removido da prateleira 3.',
    cadeia: ['Corredor', 'Estoque'],
    detectores: ['01', '04'],
  },
  {
    id: 'drive-01',
    titulo: 'Permanência anormal no drive',
    camera: 'Drive-thru',
    horario: '15:22:51',
    duracao: '01:14',
    confianca: 73,
    prioridade: 'media',
    caminho: 'Fila → janela',
    resumo: 'Veículo ficou parado na janela além do tempo médio sem interação de entrega.',
    cadeia: ['Fila', 'Janela'],
    detectores: ['06'],
  },
  {
    id: 'fundos-02',
    titulo: 'Porta dos fundos sem badge',
    camera: 'Porta dos fundos',
    horario: '13:08:37',
    duracao: '00:12',
    confianca: 92,
    prioridade: 'critica',
    caminho: 'Interno → fundos',
    resumo: 'Abertura da porta dos fundos sem identificação de crachá no intervalo registrado.',
    cadeia: ['Interno', 'Fundos'],
    detectores: ['02', '07'],
  },
];

function corPrioridade(p: Prioridade) {
  if (p === 'critica') return CC_CRITICO;
  if (p === 'alta') return CC_ORANGE;
  return CC_MUTED;
}

function rotuloPrioridade(p: Prioridade) {
  if (p === 'critica') return 'CRÍTICA';
  if (p === 'alta') return 'ALTA';
  return 'MÉDIA';
}

function BadgePrioridade({ prioridade }: { prioridade: Prioridade }) {
  const cor = corPrioridade(prioridade);
  return (
    <Box
      sx={{
        px: 0.65,
        height: 18,
        borderRadius: 999,
        border: `1px solid ${cor}66`,
        bgcolor: `${cor}1A`,
        color: cor,
        fontSize: '0.56rem',
        fontWeight: 800,
        letterSpacing: '0.04em',
        display: 'inline-flex',
        alignItems: 'center',
        flexShrink: 0,
      }}
    >
      {rotuloPrioridade(prioridade)}
    </Box>
  );
}

function ThumbCamera({ duracao }: { duracao: string }) {
  return (
    <Box
      sx={{
        position: 'relative',
        width: 84,
        height: 52,
        flexShrink: 0,
        borderRadius: 1.25,
        overflow: 'hidden',
        bgcolor: CC_SURFACE_2,
        border: `1px solid ${CC_BORDER}`,
      }}
    >
      <Box
        component="video"
        src={VIDEO_DEMO}
        muted
        playsInline
        preload="metadata"
        sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.45) 100%)',
        }}
      >
        <Box
          sx={{
            width: 20,
            height: 20,
            borderRadius: '50%',
            bgcolor: 'rgba(0,0,0,0.55)',
            border: '1px solid rgba(255,255,255,0.22)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <PlayArrowIcon sx={{ fontSize: 13, color: '#F5F5F5', ml: 0.15 }} />
        </Box>
      </Box>
      <Typography
        sx={{
          position: 'absolute',
          right: 4,
          bottom: 3,
          fontSize: '0.52rem',
          fontWeight: 700,
          color: '#F5F5F5',
          bgcolor: 'rgba(0,0,0,0.62)',
          px: 0.4,
          borderRadius: 0.5,
          lineHeight: 1.4,
        }}
      >
        {duracao}
      </Typography>
    </Box>
  );
}

export default function CcVisao() {
  const [aberto, setAberto] = useState<EventoVisao | null>(null);

  return (
    <Box
      sx={{
        bgcolor: CC_SURFACE,
        borderRadius: `${CC_RADIUS}px`,
        border: `1px solid ${CC_BORDER}`,
        p: 1.5,
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, mb: 1 }}>
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Typography sx={{ fontSize: '0.72rem', fontWeight: 750, letterSpacing: '0.06em', color: CC_TEXT }}>
              VISÃO
            </Typography>
            <Box
              sx={{
                px: 0.65,
                height: 16,
                borderRadius: 999,
                bgcolor: 'rgba(27, 42, 107, 0.12)',
                color: CC_ORANGE,
                fontSize: '0.58rem',
                fontWeight: 750,
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              PILOTO {PILOTO.loja}
            </Box>
          </Box>
          <Typography sx={{ fontSize: '0.6875rem', color: 'var(--ga-text-secondary)', mt: 0.2 }}>
            {PILOTO.revisao} para revisão · {PILOTO.camerasAtivas}/{PILOTO.camerasTotal} câmeras
          </Typography>
        </Box>
      </Box>

      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 0.7,
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          pr: 0.25,
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {EVENTOS.map((ev) => {
          const cor = corPrioridade(ev.prioridade);
          return (
            <Box
              key={ev.id}
              onClick={() => setAberto(ev)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                minWidth: 0,
                pl: 0.85,
                pr: 0.85,
                py: 0.65,
                borderRadius: `${CC_RADIUS - 2}px`,
                bgcolor: CC_SURFACE_2,
                borderLeft: `3px solid ${cor}`,
                cursor: 'pointer',
                flexShrink: 0,
                '&:hover': { bgcolor: 'var(--ga-border)' },
              }}
            >
              <ThumbCamera duracao={ev.duracao} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  sx={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: CC_TEXT,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {ev.titulo}
                </Typography>
                <Typography
                  sx={{
                    fontSize: '0.62rem',
                    color: CC_MUTED,
                    mt: 0.15,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {ev.camera} · {ev.horario} · {ev.caminho}
                </Typography>
              </Box>
              <Typography sx={{ fontSize: '0.8rem', fontWeight: 800, color: cor, flexShrink: 0 }}>{ev.confianca}%</Typography>
            </Box>
          );
        })}
      </Box>

      <Dialog
        open={Boolean(aberto)}
        onClose={() => setAberto(null)}
        maxWidth="sm"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              bgcolor: CC_SURFACE,
              color: CC_TEXT,
              border: `1px solid ${CC_BORDER}`,
              borderRadius: `${CC_RADIUS}px`,
              backgroundImage: 'none',
            },
          },
        }}
      >
        {aberto && (
          <Box sx={{ p: 1.75 }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, mb: 1.25 }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em', color: CC_ORANGE }}>
                  MERIDIAN VISION · {PILOTO.loja}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.35, flexWrap: 'wrap' }}>
                  <Typography sx={{ fontSize: '1rem', fontWeight: 750 }}>{aberto.titulo}</Typography>
                  <BadgePrioridade prioridade={aberto.prioridade} />
                </Box>
              </Box>
              <IconButton size="small" onClick={() => setAberto(null)} sx={{ color: CC_MUTED }}>
                <CloseIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Box>

            <Box
              sx={{
                position: 'relative',
                borderRadius: `${CC_RADIUS - 2}px`,
                overflow: 'hidden',
                border: `1px solid ${CC_BORDER}`,
                bgcolor: CC_SURFACE_2,
              }}
            >
              <Box
                component="video"
                key={aberto.id}
                src={VIDEO_DEMO}
                controls
                autoPlay
                playsInline
                sx={{ width: '100%', display: 'block', maxHeight: 360, background: 'var(--ga-canvas-alt)' }}
              />
              <Box
                sx={{
                  position: 'absolute',
                  left: 10,
                  top: 10,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.55,
                  px: 0.7,
                  py: 0.25,
                  borderRadius: 999,
                  bgcolor: 'rgba(0,0,0,0.62)',
                  pointerEvents: 'none',
                }}
              >
                <VideocamOutlinedIcon sx={{ fontSize: 14, color: '#A1A1AA' }} />
                <Typography sx={{ fontSize: '0.65rem', color: '#E4E4E7' }}>
                  {aberto.camera} · {aberto.horario}
                </Typography>
              </Box>
            </Box>

            <Typography sx={{ fontSize: '0.8rem', color: 'var(--ga-text-secondary)', lineHeight: 1.5, mb: 1.1 }}>
              {aberto.resumo}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.55, mb: 1 }}>
              {aberto.cadeia.map((passo, i) => (
                <Box key={passo} sx={{ display: 'flex', alignItems: 'center', gap: 0.55 }}>
                  {i > 0 && <Typography sx={{ fontSize: '0.62rem', color: CC_MUTED }}>→</Typography>}
                  <Box
                    sx={{
                      px: 0.75,
                      py: 0.3,
                      borderRadius: 999,
                      bgcolor: CC_SURFACE_2,
                      border: `1px solid ${CC_BORDER}`,
                      fontSize: '0.62rem',
                      fontWeight: 650,
                    }}
                  >
                    {passo}
                  </Box>
                </Box>
              ))}
            </Box>
            <Typography sx={{ fontSize: '0.68rem', color: CC_MUTED }}>
              {aberto.confianca}% confiança · detectores {aberto.detectores.join(' + ')} · a câmera não sentencia furto
            </Typography>
          </Box>
        )}
      </Dialog>
    </Box>
  );
}
