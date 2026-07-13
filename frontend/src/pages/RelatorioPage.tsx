import { useCallback, useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import { api, fmtNota, fmtData, fetchMediaAutenticada } from '../api/client';
import type { VisitaDetalhe } from '../api/client';
import { gerarPdfVisita } from '../utils/gerarPdfVisita';
import { showToast } from '../utils/toast';
import { formatarHoraVisita, formatarLocalVisita } from '../utils/visitaFormat';
import { isMobileAppPath } from '../config/mobileRoutes';
import { MOBILE_PAGE_COLUMN, MOBILE_SCROLL_AREA } from '../theme/safeArea';
import { assetUrl, FAVICON_ICON } from '../config/paths';

const NAVY = '#0B1A3B';
const NAVY_MID = '#1B2A6B';
const ACCENT = '#E8520A';
const OK = '#15803D';
const FAIL = '#B91C1C';
const LINE = '#E2E8F0';
const ROW_ALT = '#F8FAFC';
const SLATE = '#475569';
const SLATE_LIGHT = '#94A3B8';

function tituloChecklist(v: VisitaDetalhe['visita']): string {
  if (v.tipo_checklist_codigo === 'time_de_campo') return 'Time de Campo';
  if (v.tipo_checklist_nome) return v.tipo_checklist_nome;
  return 'Auditoria Operacional';
}

function formatarResposta(r: VisitaDetalhe['respostas'][0]): string {
  if (r.nota_estrelas != null) return `${r.nota_estrelas} de 5 estrelas`;
  if (r.resposta) return r.resposta;
  return '—';
}

function corResposta(resposta: string | null | undefined): { color: string; bg: string } {
  if (resposta === 'Sim') return { color: OK, bg: '#ECFDF5' };
  if (resposta === 'Não') return { color: FAIL, bg: '#FEF2F2' };
  if (resposta === 'N/A') return { color: SLATE, bg: ROW_ALT };
  return { color: SLATE, bg: ROW_ALT };
}

function corNota(nota: number): string {
  if (nota >= 85) return OK;
  if (nota >= 75) return ACCENT;
  return FAIL;
}

function MarcaGrupoAlvim({ size = 28 }: { size?: number }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Box
        component="img"
        src={assetUrl(FAVICON_ICON)}
        alt=""
        sx={{ width: size, height: size, borderRadius: 1 }}
      />
      <Typography sx={{ fontWeight: 800, fontSize: size * 0.5, lineHeight: 1 }}>
        <Box component="span" sx={{ color: '#A0B0C8' }}>
          grupo
        </Box>
        <Box component="span" sx={{ color: ACCENT }}>
          alvim
        </Box>
      </Typography>
    </Box>
  );
}

function CardMetrica({
  label,
  value,
  hint,
  destaque,
  corValor,
  compact,
}: {
  label: string;
  value: string;
  hint?: string;
  destaque?: boolean;
  corValor?: string;
  compact?: boolean;
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        flex: compact ? '1 1 0' : 1,
        minWidth: compact ? 0 : 0,
        p: compact ? 0.75 : 1.5,
        borderRadius: compact ? 1 : 1.5,
        bgcolor: destaque ? NAVY : '#fff',
        border: destaque ? 'none' : `1px solid ${LINE}`,
        borderLeft: `3px solid ${destaque ? corValor ?? ACCENT : NAVY}`,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Typography
        variant="caption"
        sx={{
          fontWeight: 700,
          letterSpacing: compact ? 0.3 : 0.5,
          color: SLATE_LIGHT,
          fontSize: compact ? '0.55rem' : '0.62rem',
          display: 'block',
          mb: compact ? 0.15 : 0.5,
        }}
      >
        {label}
      </Typography>
      <Typography
        sx={{
          fontWeight: 800,
          fontSize: compact ? (destaque ? '1.1rem' : '0.95rem') : destaque ? '1.5rem' : '1.15rem',
          lineHeight: 1.1,
          color: destaque ? '#fff' : NAVY,
        }}
      >
        {value}
      </Typography>
      {hint && !compact && (
        <Typography
          variant="caption"
          sx={{ color: destaque ? SLATE_LIGHT : SLATE, fontSize: '0.65rem', mt: 0.25, display: 'block' }}
        >
          {hint}
        </Typography>
      )}
    </Paper>
  );
}

function SecaoTitulo({ children }: { children: string }) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        bgcolor: NAVY,
        borderRadius: 1,
        overflow: 'hidden',
        mb: 2,
      }}
    >
      <Box sx={{ width: 4, alignSelf: 'stretch', bgcolor: ACCENT, flexShrink: 0 }} />
      <Typography
        sx={{
          fontWeight: 800,
          fontSize: '0.85rem',
          color: '#fff',
          letterSpacing: 0.5,
          py: 1,
          px: 1.5,
        }}
      >
        {children}
      </Typography>
    </Box>
  );
}

export default function RelatorioPage() {
  const { id } = useParams();
  const location = useLocation();
  const mobileApp = isMobileAppPath(location.pathname);
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
  const titulo = tituloChecklist(v);
  const catsOk = data.desempenho_categorias.filter((c) => Number(c.percentual) >= 80).length;

  const porCategoria = new Map<string, VisitaDetalhe['respostas']>();
  for (const r of data.respostas) {
    const cat = r.categoria || 'Outros';
    if (!porCategoria.has(cat)) porCategoria.set(cat, []);
    porCategoria.get(cat)!.push(r);
  }

  const cabecalhoRelatorio = mobileApp ? (
    <Box sx={{ mb: 1.5 }}>
      <Box
        sx={{
          bgcolor: NAVY,
          borderRadius: '10px 10px 0 0',
          px: 1.25,
          py: 0.85,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 0.75,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0, flex: 1 }}>
          <Box
            component="img"
            src={assetUrl(FAVICON_ICON)}
            alt=""
            sx={{ width: 22, height: 22, borderRadius: 0.75, flexShrink: 0 }}
          />
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 800, color: '#fff', fontSize: '0.82rem', lineHeight: 1.2 }}>
              {titulo}
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: '#B4C3DC', fontSize: '0.65rem', display: 'block', lineHeight: 1.2 }}
              noWrap
            >
              {v.name}
              {v.bk_number ? ` · BKN ${v.bk_number}` : ''}
            </Typography>
          </Box>
        </Box>
        <IconButton
          aria-label="Baixar PDF"
          disabled={exportandoPdf}
          onClick={() => void exportarPdf()}
          size="small"
          sx={{ color: '#fff', bgcolor: 'rgba(255,255,255,0.12)', flexShrink: 0 }}
        >
          {exportandoPdf ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : <PictureAsPdfIcon fontSize="small" />}
        </IconButton>
      </Box>

      <Box sx={{ height: 2, bgcolor: ACCENT }} />

      <Paper
        elevation={0}
        sx={{
          borderRadius: '0 0 10px 10px',
          border: `1px solid ${LINE}`,
          borderTop: 'none',
          overflow: 'hidden',
          px: 1.25,
          py: 1,
        }}
      >
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
          <Box
            sx={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              border: `2.5px solid ${corNota(nota)}`,
              bgcolor: '#fff',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Typography sx={{ fontWeight: 800, fontSize: '1.1rem', lineHeight: 1, color: corNota(nota) }}>
              {fmtNota(v.nota_final)}
            </Typography>
            <Typography variant="caption" sx={{ fontSize: '0.5rem', color: SLATE_LIGHT, lineHeight: 1 }}>
              nota
            </Typography>
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="caption" sx={{ color: SLATE, fontSize: '0.7rem', display: 'block', lineHeight: 1.35 }}>
              {v.nome_usuario}
            </Typography>
            <Typography variant="caption" sx={{ color: SLATE_LIGHT, fontSize: '0.65rem', display: 'block' }}>
              {dataTxt}
            </Typography>
            <Chip
              size="small"
              label={v.status}
              sx={{
                mt: 0.4,
                height: 18,
                fontSize: '0.62rem',
                fontWeight: 700,
                bgcolor: v.status === 'Finalizada' ? '#ECFDF5' : '#FFF7ED',
                color: v.status === 'Finalizada' ? OK : ACCENT,
              }}
            />
          </Box>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0.6 }}>
          <CardMetrica compact label="CAT." value={String(data.desempenho_categorias.length)} />
          <CardMetrica compact label="RESP." value={String(data.respostas.length)} />
          <CardMetrica compact label="NCs" value={String(data.nao_conformidades.length)} />
          <CardMetrica
            compact
            label="TEMPO"
            value={v.duracao_minutos != null ? `${v.duracao_minutos}m` : '—'}
          />
        </Box>
      </Paper>
    </Box>
  ) : (
    <Box sx={{ mb: 2.5 }}>
      <Box
        sx={{
          bgcolor: NAVY,
          borderRadius: '12px 12px 0 0',
          px: 2,
          py: 1.75,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 1,
        }}
      >
        <MarcaGrupoAlvim size={28} />
        <Box sx={{ textAlign: 'right', minWidth: 0 }}>
          <Typography
            variant="caption"
            sx={{ color: SLATE_LIGHT, letterSpacing: 1, fontSize: '0.62rem', display: 'block' }}
          >
            RELATÓRIO DE VISITA
          </Typography>
          <Typography sx={{ fontWeight: 800, color: '#fff', fontSize: '1.15rem', lineHeight: 1.2 }}>
            {titulo}
          </Typography>
          <Typography variant="caption" sx={{ color: '#B4C3DC', fontSize: '0.72rem' }}>
            {v.name}
            {v.bk_number ? ` · BKN ${v.bk_number}` : ''}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ height: 3, bgcolor: ACCENT }} />

      <Paper
        elevation={0}
        sx={{
          borderRadius: '0 0 12px 12px',
          border: `1px solid ${LINE}`,
          borderTop: 'none',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 0,
            bgcolor: ROW_ALT,
            borderBottom: `1px solid ${LINE}`,
            px: 2,
            py: 1.25,
          }}
        >
          <Box>
            <Typography variant="caption" sx={{ color: SLATE_LIGHT, fontWeight: 700, fontSize: '0.62rem' }}>
              LOJA
            </Typography>
            <Typography sx={{ fontWeight: 700, color: NAVY, fontSize: '0.9rem' }}>{v.name}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: SLATE_LIGHT, fontWeight: 700, fontSize: '0.62rem' }}>
              AUDITOR
            </Typography>
            <Typography sx={{ color: SLATE, fontSize: '0.85rem' }}>{v.nome_usuario}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: SLATE_LIGHT, fontWeight: 700, fontSize: '0.62rem' }}>
              DATA
            </Typography>
            <Typography sx={{ color: SLATE, fontSize: '0.85rem' }}>{dataTxt}</Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, p: 1.5 }}>
          <CardMetrica
            label="NOTA FINAL"
            value={fmtNota(v.nota_final)}
            hint={
              nota >= 85
                ? 'excelente desempenho'
                : nota >= 75
                  ? 'dentro da meta'
                  : 'abaixo da meta'
            }
            destaque
            corValor={corNota(nota)}
          />
          <CardMetrica
            label="CATEGORIAS"
            value={String(data.desempenho_categorias.length)}
            hint={catsOk ? `${catsOk} acima de 80%` : 'avaliadas'}
          />
          <CardMetrica
            label="RESPOSTAS"
            value={String(data.respostas.length)}
            hint="itens registrados"
          />
          <CardMetrica
            label="NCs"
            value={String(data.nao_conformidades.length)}
            hint={data.nao_conformidades.length ? 'não conformidades' : 'nenhuma'}
          />
          <CardMetrica
            label="DURAÇÃO"
            value={v.duracao_minutos != null ? `${v.duracao_minutos} min` : '—'}
            hint={diff != null ? `${diff >= 0 ? '+' : ''}${diff.toFixed(0)}p vs anterior` : 'tempo em loja'}
          />
        </Box>

        <Box
          sx={{
            px: 2,
            pb: 1.5,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1,
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            <Chip
              size="small"
              label={v.status}
              sx={{
                fontWeight: 700,
                bgcolor: v.status === 'Finalizada' ? '#ECFDF5' : '#FFF7ED',
                color: v.status === 'Finalizada' ? OK : ACCENT,
              }}
            />
            <Chip size="small" variant="outlined" label={formatarLocalVisita(v)} />
            {v.meta_visita?.gerente && (
              <Chip size="small" variant="outlined" label={`Gerente: ${v.meta_visita.gerente}`} />
            )}
            {anterior && (
              <Chip
                size="small"
                variant="outlined"
                label={`Anterior: ${fmtNota(anterior.nota)} (${fmtData(anterior.data_registro)})`}
              />
            )}
          </Box>
          <Button
            variant="contained"
            size="small"
            startIcon={exportandoPdf ? <CircularProgress size={16} color="inherit" /> : <PictureAsPdfIcon />}
            disabled={exportandoPdf}
            onClick={() => void exportarPdf()}
            sx={{
              bgcolor: FAIL,
              fontWeight: 700,
              '&:hover': { bgcolor: '#991B1B' },
              flexShrink: 0,
            }}
          >
            {exportandoPdf ? 'Gerando…' : 'Baixar PDF'}
          </Button>
        </Box>
      </Paper>
    </Box>
  );

  const corpoRelatorio = (
    <>
      <Paper elevation={0} sx={{ p: 2, mb: 2, borderRadius: 2, border: `1px solid ${LINE}` }}>
        <SecaoTitulo>Desempenho por categoria</SecaoTitulo>
        {data.desempenho_categorias.map((c, i) => {
          const pct = Number(c.percentual);
          const barColor = pct >= 80 ? OK : pct >= 60 ? ACCENT : NAVY_MID;
          return (
            <Box
              key={c.categoria}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                mb: 1.25,
                py: 0.5,
                px: 0.5,
                borderRadius: 1,
                bgcolor: i % 2 === 1 ? ROW_ALT : 'transparent',
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  width: mobileApp ? 90 : 130,
                  textAlign: 'right',
                  flexShrink: 0,
                  fontWeight: 500,
                  color: SLATE,
                  fontSize: '0.78rem',
                }}
              >
                {c.categoria}
              </Typography>
              <Box sx={{ flex: 1, height: 10, bgcolor: LINE, borderRadius: 5, overflow: 'hidden' }}>
                <Box
                  sx={{
                    height: '100%',
                    width: `${pct}%`,
                    minWidth: pct > 0 ? 24 : 0,
                    bgcolor: barColor,
                    borderRadius: 5,
                    transition: 'width 0.4s ease',
                  }}
                />
              </Box>
              <Typography
                variant="caption"
                sx={{ fontWeight: 800, color: barColor, width: 36, flexShrink: 0, fontSize: '0.8rem' }}
              >
                {c.percentual}%
              </Typography>
            </Box>
          );
        })}
        {!data.desempenho_categorias.length && (
          <Typography color="text.secondary">Sem respostas registradas.</Typography>
        )}
      </Paper>

      <Paper elevation={0} sx={{ p: 2, mb: 2, borderRadius: 2, border: `1px solid ${LINE}` }}>
        <SecaoTitulo>Respostas do checklist</SecaoTitulo>
        {[...porCategoria.entries()].map(([categoria, items]) => (
          <Box key={categoria} sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <Typography sx={{ fontWeight: 800, color: NAVY_MID, fontSize: '0.9rem' }}>
                {categoria}
              </Typography>
              <Box sx={{ flex: 1, height: 2, bgcolor: LINE, position: 'relative' }}>
                <Box sx={{ position: 'absolute', left: 0, top: 0, width: 48, height: 2, bgcolor: ACCENT }} />
              </Box>
            </Box>
            {items.map((r, idx) => (
              <RespostaRelatorio key={r.id_pergunta} resposta={r} idx={idx} mobileApp={mobileApp} />
            ))}
          </Box>
        ))}
        {!data.respostas.length && (
          <Typography color="text.secondary">Nenhuma resposta registrada.</Typography>
        )}
      </Paper>

      {data.nao_conformidades.length > 0 && (
        <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: `1px solid #FECACA` }}>
          <SecaoTitulo>Não conformidades</SecaoTitulo>
          {data.nao_conformidades.map((nc, i) => (
            <Box
              key={i}
              sx={{
                display: 'flex',
                gap: 1,
                py: 1,
                px: 1.25,
                mb: 1,
                bgcolor: '#FEF2F2',
                borderRadius: 1,
                borderLeft: `3px solid ${FAIL}`,
              }}
            >
              <Typography variant="body2" sx={{ color: FAIL, fontWeight: 600 }}>
                [{nc.gravidade}]
              </Typography>
              <Typography variant="body2" sx={{ color: SLATE }}>
                <strong>{nc.area}:</strong> {nc.descricao}
              </Typography>
            </Box>
          ))}
        </Paper>
      )}
    </>
  );

  if (mobileApp) {
    return (
      <Box sx={{ ...MOBILE_PAGE_COLUMN, maxWidth: 480, mx: 'auto', width: '100%' }}>
        <Box sx={{ flexShrink: 0, mb: 2 }}>{cabecalhoRelatorio}</Box>
        <Box sx={MOBILE_SCROLL_AREA}>{corpoRelatorio}</Box>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      {cabecalhoRelatorio}
      {corpoRelatorio}
    </Box>
  );
}

function RespostaRelatorio({
  resposta: r,
  idx,
  mobileApp,
}: {
  resposta: VisitaDetalhe['respostas'][0];
  idx: number;
  mobileApp: boolean;
}) {
  const [urls, setUrls] = useState<string[]>([]);
  const st = corResposta(r.resposta);

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

  const cols = urls.length === 1 ? 1 : 2;
  const imgH = urls.length === 1 ? (mobileApp ? 200 : 280) : mobileApp ? 140 : 180;

  return (
    <Box
      sx={{
        mb: 1.5,
        p: 1.5,
        borderRadius: 1.5,
        bgcolor: idx % 2 === 0 ? '#fff' : ROW_ALT,
        border: `1px solid ${LINE}`,
      }}
    >
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mb: 0.75 }}>
        {r.codigo && (
          <Box
            sx={{
              bgcolor: ACCENT,
              color: '#fff',
              fontWeight: 800,
              fontSize: '0.72rem',
              px: 0.75,
              py: 0.25,
              borderRadius: 0.75,
              flexShrink: 0,
              minWidth: 28,
              textAlign: 'center',
            }}
          >
            {r.codigo}
          </Box>
        )}
        <Typography variant="body2" sx={{ fontWeight: 700, color: NAVY, lineHeight: 1.4, flex: 1 }}>
          {r.texto}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: r.observacao?.trim() || urls.length ? 1 : 0 }}>
        <Typography variant="caption" sx={{ color: SLATE_LIGHT, fontWeight: 700, fontSize: '0.62rem' }}>
          RESPOSTA
        </Typography>
        <Box
          sx={{
            px: 1,
            py: 0.25,
            borderRadius: 0.75,
            bgcolor: st.bg,
            color: st.color,
            fontWeight: 700,
            fontSize: '0.8rem',
          }}
        >
          {formatarResposta(r)}
        </Box>
      </Box>

      {r.observacao?.trim() && (
        <Box sx={{ mb: urls.length ? 1.25 : 0 }}>
          <Typography variant="caption" sx={{ color: SLATE_LIGHT, fontWeight: 700, fontSize: '0.62rem' }}>
            OBSERVAÇÃO
          </Typography>
          <Typography variant="body2" sx={{ color: SLATE, fontStyle: 'italic', mt: 0.25 }}>
            {r.observacao.trim()}
          </Typography>
        </Box>
      )}

      {urls.length > 0 && (
        <Box>
          <Typography
            variant="caption"
            sx={{ color: SLATE_LIGHT, fontWeight: 700, fontSize: '0.62rem', display: 'block', mb: 0.75 }}
          >
            EVIDÊNCIAS FOTOGRÁFICAS
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: cols === 1 ? '1fr' : '1fr 1fr',
              gap: 1,
            }}
          >
            {urls.map((src, i) => (
              <Box
                key={i}
                sx={{
                  position: 'relative',
                  borderRadius: 1.5,
                  overflow: 'hidden',
                  border: `1px solid ${LINE}`,
                  bgcolor: ROW_ALT,
                }}
              >
                <Box
                  component="img"
                  src={src}
                  alt={`Evidência ${i + 1}`}
                  sx={{
                    width: '100%',
                    height: imgH,
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: 8,
                    left: 8,
                    bgcolor: NAVY,
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '0.65rem',
                    px: 1,
                    py: 0.25,
                    borderRadius: 0.75,
                  }}
                >
                  Foto {i + 1}
                </Box>
              </Box>
            ))}
          </Box>
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
