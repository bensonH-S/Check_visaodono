import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import { api, fmtNota, fmtData, fetchMediaAutenticada } from '../api/client';
import type { VisitaDetalhe } from '../api/client';
import { gerarPdfVisita } from '../utils/gerarPdfVisita';
import { showToast } from '../utils/toast';
import { formatarHoraVisita, formatarLocalVisita } from '../utils/visitaFormat';

function MetaLinha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <Typography
      variant="body2"
      sx={{ fontSize: '0.8125rem', lineHeight: 1.5, py: 0.15 }}
    >
      <Box component="span" sx={{ color: 'text.secondary' }}>
        {rotulo}:{' '}
      </Box>
      <Box component="span" sx={{ fontWeight: 500 }}>
        {valor}
      </Box>
    </Typography>
  );
}

function MetaParLinha({
  esq,
  dir,
}: {
  esq: { rotulo: string; valor: string };
  dir: { rotulo: string; valor: string };
}) {
  return (
    <Box sx={{ display: 'flex', gap: { xs: 1.5, sm: 2 } }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <MetaLinha rotulo={esq.rotulo} valor={esq.valor} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <MetaLinha rotulo={dir.rotulo} valor={dir.valor} />
      </Box>
    </Box>
  );
}

function formatarResposta(r: VisitaDetalhe['respostas'][0]): string {
  if (r.nota_estrelas != null) return `${r.nota_estrelas} estrela(s)`;
  if (r.resposta) return r.resposta;
  return '—';
}

export default function RelatorioPage() {
  const { id } = useParams();
  const [data, setData] = useState<VisitaDetalhe | null>(null);
  const [err, setErr] = useState('');
  const [exportandoPdf, setExportandoPdf] = useState(false);

  const exportarPdf = useCallback(async () => {
    if (!data) return;
    setExportandoPdf(true);
    try {
      await gerarPdfVisita(data);
      showToast('PDF baixado com sucesso', 'success');
    } catch (e) {
      showToast((e as Error).message || 'Não foi possível gerar o PDF', 'error');
    } finally {
      setExportandoPdf(false);
    }
  }, [data]);

  useEffect(() => {
    if (!id) return;
    api
      .visita(Number(id))
      .then(setData)
      .catch((e) => setErr(e.message));
  }, [id]);

  if (err) return <Typography color="error">{err}</Typography>;
  if (!data) return <LinearProgress />;

  const v = data.visita;
  const nota = Number(v.nota_final);
  const anterior = data.historico_notas[1];
  const diff = anterior ? nota - Number(anterior.nota) : null;
  const hora = formatarHoraVisita(v.hora_inicio);
  const dataTxt = hora ? `${fmtData(v.data_visita)} às ${hora}` : fmtData(v.data_visita);

  const porCategoria = new Map<string, VisitaDetalhe['respostas']>();
  for (const r of data.respostas) {
    const cat = r.categoria || 'Outros';
    if (!porCategoria.has(cat)) porCategoria.set(cat, []);
    porCategoria.get(cat)!.push(r);
  }

  return (
    <Box>
      <Paper sx={{ p: 1.75, mb: 2.5, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start' }}>
          <Box
            sx={{
              width: 68,
              height: 68,
              borderRadius: '50%',
              border: '3px solid',
              borderColor: 'primary.main',
              bgcolor: '#FFF0E8',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Typography variant="h6" color="primary" sx={{ fontWeight: 700, lineHeight: 1 }}>
              {fmtNota(v.nota_final)}
            </Typography>
            <Typography variant="caption" color="primary" sx={{ fontSize: '0.6rem' }}>
              nota
            </Typography>
          </Box>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 0.5,
                mb: 0.5,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75, flex: 1, minWidth: 0 }}>
                <LocationOnOutlinedIcon
                  sx={{ fontSize: 20, color: 'primary.main', mt: 0.1, flexShrink: 0 }}
                />
                <Typography
                  variant="h6"
                  sx={{ fontWeight: 700, fontSize: '1rem', lineHeight: 1.3, pr: 0.5 }}
                >
                  {v.name}
                </Typography>
              </Box>
              <Tooltip title="Baixar relatório em PDF">
                <span>
                  <IconButton
                    aria-label="Baixar PDF da visita"
                    disabled={exportandoPdf}
                    onClick={() => void exportarPdf()}
                    sx={{
                      color: '#D32F2F',
                      mt: -0.5,
                      mr: -0.75,
                      p: 0.5,
                      flexShrink: 0,
                      '&:hover': { bgcolor: 'rgba(211, 47, 47, 0.08)' },
                    }}
                  >
                    {exportandoPdf ? (
                      <CircularProgress size={26} sx={{ color: '#D32F2F' }} />
                    ) : (
                      <PictureAsPdfIcon sx={{ fontSize: 28 }} />
                    )}
                  </IconButton>
                </span>
              </Tooltip>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              <MetaParLinha
                esq={{ rotulo: 'BKN', valor: v.bk_number || '—' }}
                dir={{ rotulo: 'Data', valor: dataTxt }}
              />
              <MetaParLinha
                esq={{ rotulo: 'Local', valor: formatarLocalVisita(v) }}
                dir={{ rotulo: 'Auditor', valor: v.nome_usuario }}
              />
              <MetaParLinha
                esq={{ rotulo: 'Status', valor: v.status }}
                dir={{ rotulo: 'Visita', valor: `#${v.id_visita}` }}
              />
            </Box>

            {(anterior || diff != null) && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1.5 }}>
                {anterior && (
                  <Chip
                    size="small"
                    label={`Anterior: ${fmtNota(anterior.nota)} (${fmtData(anterior.data_registro)})`}
                    variant="outlined"
                    color="secondary"
                  />
                )}
                {diff != null && (
                  <Chip
                    size="small"
                    label={`${diff >= 0 ? '+' : ''}${diff.toFixed(0)}p`}
                    color={diff >= 0 ? 'success' : 'error'}
                  />
                )}
              </Box>
            )}
          </Box>
        </Box>
      </Paper>

      <Paper className="p-4 mb-4">
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
          Desempenho por categoria
        </Typography>
        {data.desempenho_categorias.map((c) => (
          <Box key={c.categoria} className="flex items-center gap-3 mb-2">
            <Typography variant="caption" className="w-36 text-right shrink-0">
              {c.categoria}
            </Typography>
            <Box className="flex-1 h-5 bg-gray-100 rounded overflow-hidden">
              <Box
                className="h-full rounded flex items-center justify-end pr-2 text-xs text-white font-medium"
                sx={{
                  width: `${c.percentual}%`,
                  bgcolor: Number(c.percentual) >= 80 ? '#639922' : Number(c.percentual) >= 60 ? '#E8520A' : '#1B2A6B',
                  minWidth: c.percentual ? '40px' : 0,
                }}
              >
                {c.percentual}%
              </Box>
            </Box>
          </Box>
        ))}
        {!data.desempenho_categorias.length && (
          <Typography color="text.secondary">Sem respostas registradas.</Typography>
        )}
      </Paper>

      <Paper className="p-4 mb-4">
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
          Respostas do checklist
        </Typography>
        {[...porCategoria.entries()].map(([categoria, items]) => (
          <Box key={categoria} sx={{ mb: 3 }}>
            <Typography
              variant="subtitle2"
              sx={{ fontWeight: 700, color: 'primary.main', mb: 1.5 }}
            >
              {categoria}
            </Typography>
            {items.map((r) => (
              <RespostaRelatorio key={r.id_pergunta} resposta={r} />
            ))}
          </Box>
        ))}
        {!data.respostas.length && (
          <Typography color="text.secondary">Nenhuma resposta registrada.</Typography>
        )}
      </Paper>

      {data.nao_conformidades.length > 0 && (
        <Paper className="p-4">
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
            Não conformidades vinculadas
          </Typography>
          {data.nao_conformidades.map((nc, i) => (
            <Typography key={i} variant="body2" sx={{ py: 0.5 }}>
              [{nc.gravidade}] {nc.area}: {nc.descricao}
            </Typography>
          ))}
        </Paper>
      )}
    </Box>
  );
}

function RespostaRelatorio({ resposta: r }: { resposta: VisitaDetalhe['respostas'][0] }) {
  const [urls, setUrls] = useState<string[]>([]);

  useEffect(() => {
    let cancelado = false;
    const objectUrls: string[] = [];
    const carregar = async () => {
      const paths = r.midia_urls || [];
      const carregadas: string[] = [];
      for (const p of paths) {
        try {
          const url = await fetchMediaAutenticada(p);
          objectUrls.push(url);
          if (!cancelado) carregadas.push(url);
        } catch {
          /* ignora mídia que falhou */
        }
      }
      if (!cancelado) setUrls(carregadas);
    };
    void carregar();
    return () => {
      cancelado = true;
      objectUrls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [r.midia_urls]);

  return (
    <Box sx={{ mb: 2, pb: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {r.codigo ? `[${r.codigo}] ` : ''}
        {r.texto}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
        {formatarResposta(r)}
      </Typography>
      {r.observacao?.trim() && (
        <Typography variant="body2" sx={{ mt: 0.5, fontStyle: 'italic' }}>
          {r.observacao.trim()}
        </Typography>
      )}
      {urls.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
          {urls.map((src, i) => (
            <Box
              key={i}
              component="img"
              src={src}
              alt={`Evidência ${i + 1}`}
              sx={{
                width: 88,
                height: 88,
                objectFit: 'cover',
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
              }}
            />
          ))}
        </Box>
      )}
      {!urls.length && (r.midia_urls?.length ?? 0) > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
          {(r.midia_urls?.length ?? 0)} anexo(s) — incluídos no PDF
        </Typography>
      )}
    </Box>
  );
}
