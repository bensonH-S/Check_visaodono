import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import PhotoCameraOutlinedIcon from '@mui/icons-material/PhotoCameraOutlined';
import ModeCommentOutlinedIcon from '@mui/icons-material/ModeCommentOutlined';
import EngineeringOutlinedIcon from '@mui/icons-material/EngineeringOutlined';
import ReplayIcon from '@mui/icons-material/Replay';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import type { ManutChamadoDetalhe } from '../../api/client';
import { fetchMediaAutenticada } from '../../api/client';
import { getUsuario, type UsuarioSessao } from '../../lib/auth';
import { formatDataHoraBrasilia, parseDataApi } from '../../utils/dateBr';
import {
  atualizacaoDuplicaAprovacao,
  corpoEventoAprovacaoExibicao,
  deveOcultarEventoAprovacaoNoHistorico,
  podeVerDetalhesAprovacaoChamado,
  textosEventosAprovacao,
  TIPOS_EVENTO_APROVACAO_INTERNO_MOBILE,
} from '../../utils/timelineAprovacao';
import { useEffect, useState } from 'react';

const NAVY = '#1B2A6B';
const ORANGE = '#E8520A';

type TimelineItem = {
  id: string;
  tipo:
    | 'abertura'
    | 'anexo'
    | 'atualizacao'
    | 'atribuido'
    | 'fechamento'
    | 'reabertura'
    | 'envio_aprovacao'
    | 'aprovacao';
  quando: string;
  titulo: string;
  subtitulo?: string;
  corpo?: string;
  meta?: string[];
  anexos?: ManutChamadoDetalhe['anexos'];
  statusFechamento?: 'concluido' | 'cancelado';
};

function MidiaAnexo({ mediaUrl, mime }: { mediaUrl: string; mime: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let url: string | null = null;
    let ativo = true;
    fetchMediaAutenticada(mediaUrl)
      .then((u) => {
        if (ativo) {
          url = u;
          setSrc(u);
        }
      })
      .catch(() => ativo && setErro(true));
    return () => {
      ativo = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [mediaUrl]);

  if (erro) {
    return (
      <Typography variant="caption" color="error">
        Erro ao carregar
      </Typography>
    );
  }
  if (!src) return <CircularProgress size={20} />;

  if (mime.startsWith('video/')) {
    return (
      <Box
        component="video"
        src={src}
        controls
        sx={{ width: '100%', borderRadius: 1, maxHeight: 160, bgcolor: '#000' }}
      />
    );
  }
  if (mime === 'application/pdf') {
    return (
      <Button
        component="a"
        href={src}
        target="_blank"
        rel="noopener noreferrer"
        variant="outlined"
        size="small"
        sx={{ alignSelf: 'flex-start' }}
      >
        Abrir PDF
      </Button>
    );
  }
  return (
    <Box
      component="img"
      src={src}
      alt="Anexo"
      sx={{ width: '100%', borderRadius: 1, maxHeight: 160, objectFit: 'cover' }}
    />
  );
}

function iconeTipo(item: TimelineItem) {
  if (item.tipo === 'fechamento') {
    return item.statusFechamento === 'cancelado' ? (
      <CancelIcon sx={{ fontSize: 18, color: '#991B1B' }} />
    ) : (
      <CheckCircleIcon sx={{ fontSize: 18, color: '#166534' }} />
    );
  }
  if (item.tipo === 'anexo') return <PhotoCameraOutlinedIcon sx={{ fontSize: 18, color: ORANGE }} />;
  if (item.tipo === 'atualizacao') return <ModeCommentOutlinedIcon sx={{ fontSize: 18, color: NAVY }} />;
  if (item.tipo === 'atribuido') return <EngineeringOutlinedIcon sx={{ fontSize: 18, color: '#1E40AF' }} />;
  if (item.tipo === 'reabertura') return <ReplayIcon sx={{ fontSize: 18, color: '#1E40AF' }} />;
  return <FiberManualRecordIcon sx={{ fontSize: 14, color: ORANGE }} />;
}

function isTextoReaberturaLegado(texto: string) {
  return /^Chamado reaberto por /i.test(texto.trim());
}

type BuildTimelineOpts = {
  variante?: 'mobile' | 'desktop';
  sessao?: UsuarioSessao | null;
};

export function buildTimelineItems(
  detalhe: ManutChamadoDetalhe,
  opts: BuildTimelineOpts = {},
): TimelineItem[] {
  const sessao = opts.sessao ?? getUsuario();
  const verDetalhesAprovacao = podeVerDetalhesAprovacaoChamado(sessao, detalhe);
  const ocultarFluxoAprovacao = opts.variante === 'mobile' && !verDetalhesAprovacao;
  const textosAprovacao = textosEventosAprovacao(detalhe);

  const items: TimelineItem[] = [
    {
      id: 'abertura',
      tipo: 'abertura',
      quando: detalhe.aberto_em || detalhe.prazo_sla,
      titulo: 'Chamado aberto',
      subtitulo: detalhe.solicitante,
      corpo: detalhe.descricao,
      meta: [
        `${detalhe.categoria} · ${detalhe.loja}`,
        detalhe.local_detalhe ? `Local: ${detalhe.local_detalhe}` : '',
        `Prazo SLA: ${formatDataHoraBrasilia(detalhe.prazo_sla)}`,
      ].filter(Boolean),
    },
  ];

  if (detalhe.anexos.length) {
    items.push({
      id: 'anexos',
      tipo: 'anexo',
      quando: detalhe.anexos[0].created_at || detalhe.aberto_em || detalhe.prazo_sla,
      titulo: `Anexos enviados (${detalhe.anexos.length})`,
      anexos: detalhe.anexos,
    });
  }

  if (detalhe.assumido_em && detalhe.tecnico) {
    items.push({
      id: 'atribuido',
      tipo: 'atribuido',
      quando: detalhe.assumido_em,
      titulo: 'Chamado atribuído',
      subtitulo: detalhe.tecnico,
    });
  }

  const vistosId = new Set<number>();
  const vistosConteudo = new Set<string>();
  const ordenadas = [...detalhe.atualizacoes].sort(
    (a, b) => parseDataApi(a.created_at).getTime() - parseDataApi(b.created_at).getTime(),
  );
  for (const a of ordenadas) {
    if (a.id_atualizacao && vistosId.has(a.id_atualizacao)) continue;
    const chaveConteudo = `${a.autor ?? ''}|${a.texto}`;
    if (vistosConteudo.has(chaveConteudo)) continue;
    if (a.id_atualizacao) vistosId.add(a.id_atualizacao);
    vistosConteudo.add(chaveConteudo);

    if (atualizacaoDuplicaAprovacao(a.texto, textosAprovacao)) continue;

    if (isTextoReaberturaLegado(a.texto)) {
      items.push({
        id: `reabertura-legado-${a.id_atualizacao ?? a.created_at}`,
        tipo: 'reabertura',
        quando: a.created_at,
        titulo: 'Chamado reaberto',
        subtitulo: a.autor,
      });
      continue;
    }

    items.push({
      id: `atualizacao-${a.id_atualizacao ?? `${a.created_at}-${a.texto.slice(0, 20)}`}`,
      tipo: 'atualizacao',
      quando: a.created_at,
      titulo: 'Mensagem',
      subtitulo: a.autor,
      corpo: a.texto,
    });
  }

  for (const ev of detalhe.eventos ?? []) {
    if (deveOcultarEventoAprovacaoNoHistorico(ev.tipo)) continue;
    if (ocultarFluxoAprovacao && TIPOS_EVENTO_APROVACAO_INTERNO_MOBILE.has(ev.tipo)) continue;

    if (ev.tipo === 'fechamento') {
      const cancelado = ev.status_ref === 'cancelado';
      items.push({
        id: `evento-fechamento-${ev.id_evento}`,
        tipo: 'fechamento',
        quando: ev.created_at,
        titulo: cancelado ? 'Chamado cancelado' : 'Chamado concluído',
        subtitulo: ev.autor ?? undefined,
        corpo: ev.texto ?? undefined,
        statusFechamento: cancelado ? 'cancelado' : 'concluido',
      });
      continue;
    }
    if (ev.tipo === 'reabertura') {
      items.push({
        id: `evento-reabertura-${ev.id_evento}`,
        tipo: 'reabertura',
        quando: ev.created_at,
        titulo: 'Chamado reaberto',
        subtitulo: ev.autor ?? undefined,
        corpo: ev.texto ?? undefined,
      });
      continue;
    }
    if (ev.tipo === 'envio_aprovacao') {
      items.push({
        id: `evento-envio-aprovacao-${ev.id_evento}`,
        tipo: 'envio_aprovacao',
        quando: ev.created_at,
        titulo: 'Enviado para aprovação',
        subtitulo: ev.autor ?? undefined,
        corpo: corpoEventoAprovacaoExibicao(ev.texto, false),
      });
      continue;
    }
    if (ev.tipo === 'recusa_aprovacao') {
      items.push({
        id: `evento-recusa-aprovacao-${ev.id_evento}`,
        tipo: 'atualizacao',
        quando: ev.created_at,
        titulo: 'Orçamento não aprovado',
        subtitulo: ev.autor ?? undefined,
        corpo: corpoEventoAprovacaoExibicao(ev.texto, false),
      });
      continue;
    }
    if (ev.tipo === 'aprovacao_diretor') {
      items.push({
        id: `evento-aprovacao-diretor-${ev.id_evento}`,
        tipo: 'aprovacao',
        quando: ev.created_at,
        titulo: 'Aprovado pelo Diretor',
        subtitulo: ev.autor ?? undefined,
        corpo: corpoEventoAprovacaoExibicao(ev.texto, false),
      });
      continue;
    }
    if (ev.tipo === 'aprovacao') {
      items.push({
        id: `evento-aprovacao-${ev.id_evento}`,
        tipo: 'aprovacao',
        quando: ev.created_at,
        titulo: 'Orçamento aprovado',
        subtitulo: ev.autor ?? undefined,
        corpo: corpoEventoAprovacaoExibicao(ev.texto, ocultarFluxoAprovacao),
      });
    }
  }

  const temEventoFechamento = (detalhe.eventos ?? []).some((e) => e.tipo === 'fechamento');
  if (
    !temEventoFechamento &&
    detalhe.fechado_em &&
    (detalhe.status === 'concluido' || detalhe.status === 'cancelado')
  ) {
    items.push({
      id: 'fechamento-atual',
      tipo: 'fechamento',
      quando: detalhe.fechado_em,
      titulo: detalhe.status === 'concluido' ? 'Chamado concluído' : 'Chamado cancelado',
      statusFechamento: detalhe.status,
    });
  }

  return items.sort(
    (a, b) => parseDataApi(a.quando).getTime() - parseDataApi(b.quando).getTime(),
  );
}

export default function ChamadoTimeline({
  detalhe,
  variante = 'desktop',
}: {
  detalhe: ManutChamadoDetalhe;
  variante?: 'mobile' | 'desktop';
}) {
  const items = buildTimelineItems(detalhe, { variante });

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2, color: NAVY }}>
        Histórico do ticket
      </Typography>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          maxHeight: { xs: 280, sm: 320, md: 360 },
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          pr: 0.5,
        }}
      >
        {items.map((item, index) => {
          const ultimo = index === items.length - 1;
          return (
            <Box key={item.id} sx={{ display: 'flex', gap: 1.5, pb: ultimo ? 0 : 2 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 28, flexShrink: 0 }}>
                <Box
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    bgcolor: 'rgba(27, 42, 107, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {iconeTipo(item)}
                </Box>
                {!ultimo && (
                  <Box
                    sx={{
                      flex: 1,
                      width: 2,
                      bgcolor: 'rgba(27, 42, 107, 0.12)',
                      mt: 0.5,
                      minHeight: 24,
                    }}
                  />
                )}
              </Box>

              <Box sx={{ flex: 1, minWidth: 0, pt: 0.25 }}>
                <Typography variant="body2" sx={{ fontWeight: 700, color: NAVY, lineHeight: 1.3 }}>
                  {item.titulo}
                </Typography>
                <Typography
                  component="p"
                  variant="caption"
                  color="text.secondary"
                  sx={{ m: 0, mt: 0.25, display: 'block', lineHeight: 1.4 }}
                >
                  {formatDataHoraBrasilia(item.quando)}
                  {item.subtitulo ? ` · ${item.subtitulo}` : ''}
                </Typography>

                {item.meta?.map((linha) => (
                  <Typography
                    key={linha}
                    component="p"
                    variant="caption"
                    color="text.secondary"
                    sx={{ m: 0, mt: 0.5, display: 'block', lineHeight: 1.45 }}
                  >
                    {linha}
                  </Typography>
                ))}

                {item.corpo && (
                  <Typography
                    component="p"
                    variant="body2"
                    sx={{
                      m: 0,
                      mt: 0.75,
                      whiteSpace: 'pre-wrap',
                      lineHeight: 1.5,
                      color: 'text.primary',
                    }}
                  >
                    {item.corpo}
                  </Typography>
                )}

                {item.anexos && item.anexos.length > 0 && (
                  <Box
                    sx={{
                      mt: 1,
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: 1,
                    }}
                  >
                    {item.anexos.map((a) => (
                      <Box key={a.id_anexo}>
                        <MidiaAnexo mediaUrl={a.media_url} mime={a.tipo_mime} />
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>
    </Paper>
  );
}
