import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { api, fmtNota, fmtData, fetchMediaAutenticada, scoreChipSx } from '../api/client';
import type { VisitaDetalhe } from '../api/client';
import { gerarPdfVisita } from '../utils/gerarPdfVisita';
import { showToast } from '../utils/toast';
import { formatarHoraVisita, formatarLocalVisita } from '../utils/visitaFormat';
import { isMobileAppPath } from '../config/mobileRoutes';
import { podeReabrirVisitas } from '../lib/auth';
import DialogTitleWithIcon from '../components/DialogTitleWithIcon';
import RelatorioMobileScreen from '../components/visitas/RelatorioMobileScreen';
import PageLoading from '../components/PageLoading';
import ImageLightbox from '../components/ImageLightbox';
import { useAppTheme } from '../context/ThemeContext';
import { colors } from '../theme/tokens';
import { pageFillLayoutSx } from '../utils/pageFillLayout';
import '../components/visitas/visitas-mobile.css';

const ORANGE = '#E8520A';

function acentoTema(escuro: boolean) {
  return escuro ? ORANGE : colors.navy;
}

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

function corResposta(
  resposta: string | null | undefined,
  pergunta: { texto?: string; sim_indica_problema?: boolean } | undefined,
  escuro: boolean,
): { color: string; bg: string } {
  const invertida = pergunta
    ? pergunta.sim_indica_problema === true ||
      (pergunta.sim_indica_problema !== false && /possui alguma obstru/i.test(pergunta.texto || ''))
    : false;
  const ok = escuro
    ? { color: '#4ADE80', bg: 'rgba(74, 222, 128, 0.16)' }
    : { color: '#15803D', bg: '#ECFDF5' };
  const fail = escuro
    ? { color: '#F87171', bg: 'rgba(248, 113, 113, 0.16)' }
    : { color: '#B91C1C', bg: '#FEF2F2' };
  const neutro = escuro
    ? { color: colors.textSecondary, bg: 'rgba(148, 163, 184, 0.12)' }
    : { color: '#475569', bg: colors.canvasAlt };

  if (invertida) {
    if (resposta === 'Não') return ok;
    if (resposta === 'Sim') return fail;
  }
  if (resposta === 'Sim') return ok;
  if (resposta === 'Não') return fail;
  return neutro;
}

function barraCategoria(pct: number, escuro: boolean) {
  if (pct >= 80) return escuro ? '#4ADE80' : '#15803D';
  if (pct >= 60) return acentoTema(escuro);
  return escuro ? '#94A3B8' : '#1B2A6B';
}

function CardMetrica({
  label,
  value,
  hint,
  destaque,
  corValor,
  escuro,
}: {
  label: string;
  value: string;
  hint?: string;
  destaque?: boolean;
  corValor?: string;
  escuro: boolean;
}) {
  const bordaEsq = destaque ? corValor ?? acentoTema(escuro) : acentoTema(escuro);
  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 1.25, sm: 1.5 },
        borderRadius: 1.5,
        bgcolor: destaque
          ? escuro
            ? 'rgba(232, 82, 10, 0.14)'
            : colors.navy
          : colors.surface,
        border: '1px solid',
        borderColor: destaque
          ? escuro
            ? 'rgba(232, 82, 10, 0.45)'
            : 'transparent'
          : colors.border,
        borderLeft: `3px solid ${bordaEsq}`,
        minWidth: 0,
        height: '100%',
      }}
    >
      <Typography
        variant="caption"
        sx={{
          fontWeight: 700,
          letterSpacing: 0.4,
          color: destaque
            ? escuro
              ? colors.textSecondary
              : 'rgba(255,255,255,0.65)'
            : colors.textMuted,
          fontSize: '0.65rem',
          display: 'block',
          mb: 0.35,
        }}
      >
        {label}
      </Typography>
      <Typography
        sx={{
          fontWeight: 800,
          fontSize: { xs: '1.15rem', sm: destaque ? '1.5rem' : '1.15rem' },
          lineHeight: 1.15,
          color: destaque ? (escuro ? corValor ?? acentoTema(escuro) : '#fff') : colors.textPrimary,
        }}
      >
        {value}
      </Typography>
      {hint && (
        <Typography
          variant="caption"
          sx={{
            color: destaque
              ? escuro
                ? colors.textSecondary
                : 'rgba(255,255,255,0.7)'
              : colors.textSecondary,
            fontSize: '0.68rem',
            mt: 0.35,
            display: 'block',
          }}
        >
          {hint}
        </Typography>
      )}
    </Paper>
  );
}

function SecaoTitulo({ children, acento }: { children: string; acento: string }) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        bgcolor: (tema) => (tema.palette.mode === 'dark' ? 'rgba(30, 41, 59, 0.95)' : colors.navy),
        border: '1px solid',
        borderColor: colors.border,
        borderRadius: 1,
        overflow: 'hidden',
        mb: 2,
      }}
    >
      <Box sx={{ width: 4, alignSelf: 'stretch', bgcolor: acento, flexShrink: 0 }} />
      <Typography
        sx={{
          fontWeight: 800,
          fontSize: '0.85rem',
          letterSpacing: 0.4,
          py: 1,
          px: 1.5,
          color: (tema) => (tema.palette.mode === 'dark' ? colors.textPrimary : '#fff'),
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
  const navigate = useNavigate();
  const { mode } = useAppTheme();
  const escuro = mode === 'dark';
  const acento = acentoTema(escuro);
  const acentoHover = escuro ? '#c94508' : colors.navyDark;
  const mobileApp = isMobileAppPath(location.pathname);
  const [data, setData] = useState<VisitaDetalhe | null>(null);
  const [err, setErr] = useState('');
  const [exportandoPdf, setExportandoPdf] = useState(false);
  const [reabrindo, setReabrindo] = useState(false);
  const [dlgReabrir, setDlgReabrir] = useState(false);
  const [fotoAberta, setFotoAberta] = useState<{ src: string; pergunta: string } | null>(null);
  const podeReabrir = podeReabrirVisitas();

  const exportarPdf = useCallback(async () => {
    if (!data) return;
    setExportandoPdf(true);
    try {
      await gerarPdfVisita(data, { asShare: mobileApp });
      if (!mobileApp) {
        showToast('PDF baixado com sucesso', 'success');
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      showToast((e as Error).message || 'Não foi possível gerar o PDF', 'error');
    } finally {
      setExportandoPdf(false);
    }
  }, [data, mobileApp]);

  const confirmarReabrir = useCallback(async () => {
    if (!id) return;
    setReabrindo(true);
    try {
      await api.reabrirVisita(Number(id));
      showToast('Visita reaberta para edição', 'success');
      setDlgReabrir(false);
      const base = mobileApp ? '/checklist/mobile' : '/checklist';
      navigate(`${base}?visita=${id}`, { replace: true });
    } catch (e) {
      showToast((e as Error).message || 'Não foi possível reabrir a visita', 'error');
    } finally {
      setReabrindo(false);
    }
  }, [id, mobileApp, navigate]);

  useEffect(() => {
    if (!id) return;
    api
      .visita(Number(id))
      .then(setData)
      .catch((e) => setErr(e.message));
  }, [id]);

  if (mobileApp) {
    if (err) {
      return (
        <div className="ck-visitas">
          <div className="ck-visitas__sheet" style={{ marginTop: 0, borderRadius: 0, minHeight: '100%' }}>
            <div className="ck-visitas__empty" style={{ color: '#b91c1c' }}>
              {err}
            </div>
          </div>
        </div>
      );
    }
    if (!data) return <PageLoading />;
    return (
      <>
        <RelatorioMobileScreen
          data={data}
          exportandoPdf={exportandoPdf}
          onExportarPdf={() => void exportarPdf()}
          podeReabrir={podeReabrir && data.visita.status === 'Finalizada'}
          reabrindo={reabrindo}
          onReabrir={() => setDlgReabrir(true)}
        />
        <Dialog open={dlgReabrir} onClose={() => !reabrindo && setDlgReabrir(false)} fullWidth maxWidth="xs">
          <DialogTitleWithIcon plainIcon icon={<LockOpenIcon />}>
            Reabrir visita
          </DialogTitleWithIcon>
          <DialogContent>
            <Typography variant="body2" color="text.secondary">
              A visita voltará para rascunho e poderá ser editada. NCs geradas na finalização serão removidas.
              Esta ação será registrada na auditoria.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDlgReabrir(false)} disabled={reabrindo}>
              Cancelar
            </Button>
            <Button variant="contained" disabled={reabrindo} onClick={() => void confirmarReabrir()}>
              {reabrindo ? 'Reabrindo…' : 'Reabrir'}
            </Button>
          </DialogActions>
        </Dialog>
      </>
    );
  }

  if (err) return <Typography color="error">{err}</Typography>;
  if (!data) return <PageLoading />;

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

  const paperSx = {
    p: { xs: 1.5, sm: 2 },
    mb: 2,
    borderRadius: 2,
    border: `1px solid ${colors.border}`,
    bgcolor: colors.surface,
  } as const;

  return (
    <Box sx={{ ...pageFillLayoutSx, gap: 1.5, pb: 0 }}>
      {/* Cabeçalho — fixo (sem rolagem) */}
      <Paper elevation={0} sx={{ ...paperSx, mb: 0, flexShrink: 0, overflow: 'hidden', p: 0 }}>
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 1.5,
            px: { xs: 1.5, sm: 2 },
            py: 1.75,
            borderBottom: `1px solid ${colors.border}`,
            borderTop: `3px solid ${acento}`,
          }}
        >
          <Box sx={{ minWidth: 0, flex: '1 1 220px' }}>
            <Typography
              variant="caption"
              sx={{ color: colors.textMuted, letterSpacing: 0.8, fontWeight: 700, display: 'block' }}
            >
              RELATÓRIO DE VISITA
            </Typography>
            <Typography
              sx={{
                fontWeight: 800,
                color: colors.textPrimary,
                fontSize: { xs: '1.05rem', sm: '1.2rem' },
                lineHeight: 1.25,
                mt: 0.25,
              }}
            >
              {titulo}
            </Typography>
            <Typography variant="body2" sx={{ color: colors.textSecondary, mt: 0.35 }}>
              {v.name}
              {v.bk_number ? ` · BKN ${v.bk_number}` : ''}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0 }}>
            {Number.isFinite(nota) && (
              <Chip label={`Nota ${fmtNota(v.nota_final)}`} size="small" sx={scoreChipSx(nota, escuro)} />
            )}
            {podeReabrir && v.status === 'Finalizada' && (
              <Tooltip title="Reabrir">
                <span>
                  <IconButton
                    size="small"
                    aria-label="Reabrir visita"
                    disabled={reabrindo}
                    onClick={() => setDlgReabrir(true)}
                    sx={{
                      color: colors.textPrimary,
                      border: `1px solid ${colors.border}`,
                      bgcolor: colors.surface,
                      '&:hover': { bgcolor: colors.canvasAlt },
                    }}
                  >
                    {reabrindo ? <CircularProgress size={18} /> : <LockOpenIcon fontSize="small" />}
                  </IconButton>
                </span>
              </Tooltip>
            )}
            <Button
              variant="contained"
              size="small"
              startIcon={
                exportandoPdf ? <CircularProgress size={16} color="inherit" /> : <PictureAsPdfIcon />
              }
              disabled={exportandoPdf}
              onClick={() => void exportarPdf()}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                bgcolor: acento,
                '&:hover': { bgcolor: acentoHover },
                '&.Mui-disabled': {
                  bgcolor: escuro ? 'rgba(232, 82, 10, 0.35)' : 'rgba(27, 42, 107, 0.35)',
                  color: '#fff',
                },
              }}
            >
              {exportandoPdf ? 'Gerando…' : 'PDF'}
            </Button>
          </Box>
        </Box>

        {/* Meta: loja / auditor / data */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' },
            gap: { xs: 1.25, sm: 0 },
            bgcolor: escuro ? 'rgba(148, 163, 184, 0.12)' : colors.canvasAlt,
            borderBottom: `1px solid ${colors.border}`,
            px: { xs: 1.5, sm: 2 },
            py: 1.5,
          }}
        >
          {(
            [
              ['LOJA', v.name],
              ['AUDITOR', v.nome_usuario],
              ['DATA', dataTxt],
            ] as const
          ).map(([label, value], i) => (
            <Box
              key={label}
              sx={{
                px: { sm: i === 0 ? 0 : 1.5 },
                borderLeft: {
                  sm: i > 0 ? `1px solid ${colors.border}` : 'none',
                },
              }}
            >
              <Typography
                variant="caption"
                sx={{ color: colors.textMuted, fontWeight: 700, fontSize: '0.65rem', display: 'block' }}
              >
                {label}
              </Typography>
              <Typography sx={{ fontWeight: label === 'LOJA' ? 700 : 500, color: colors.textPrimary, fontSize: '0.9rem' }}>
                {value}
              </Typography>
            </Box>
          ))}
        </Box>

        {/* Métricas */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'repeat(2, minmax(0, 1fr))',
              sm: 'repeat(3, minmax(0, 1fr))',
              md: 'repeat(5, minmax(0, 1fr))',
            },
            gap: 1.25,
            p: { xs: 1.5, sm: 2 },
          }}
        >
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
            escuro={escuro}
            corValor={nota >= 85 ? (escuro ? '#4ADE80' : '#15803D') : nota >= 75 ? acento : escuro ? '#F87171' : '#B91C1C'}
          />
          <CardMetrica
            label="CATEGORIAS"
            value={String(data.desempenho_categorias.length)}
            hint={catsOk ? `${catsOk} acima de 80%` : 'avaliadas'}
            escuro={escuro}
          />
          <CardMetrica
            label="RESPOSTAS"
            value={String(data.respostas.length)}
            hint="itens registrados"
            escuro={escuro}
          />
          <CardMetrica
            label="NCs"
            value={String(data.nao_conformidades.length)}
            hint={data.nao_conformidades.length ? 'não conformidades' : 'nenhuma'}
            escuro={escuro}
          />
          <CardMetrica
            label="DURAÇÃO"
            value={v.duracao_minutos != null ? `${v.duracao_minutos} min` : '—'}
            hint={diff != null ? `${diff >= 0 ? '+' : ''}${diff.toFixed(0)}p vs anterior` : 'tempo em loja'}
            escuro={escuro}
          />
        </Box>

        <Box
          sx={{
            px: { xs: 1.5, sm: 2 },
            pb: 1.75,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 0.75,
            alignItems: 'center',
          }}
        >
          <Chip
            size="small"
            label={v.status}
            sx={{
              fontWeight: 700,
              bgcolor:
                v.status === 'Finalizada'
                  ? escuro
                    ? 'rgba(74, 222, 128, 0.16)'
                    : '#ECFDF5'
                  : escuro
                    ? 'rgba(232, 82, 10, 0.18)'
                    : 'rgba(27, 42, 107, 0.08)',
              color: v.status === 'Finalizada' ? (escuro ? '#4ADE80' : '#15803D') : acento,
              border: '1px solid',
              borderColor:
                v.status === 'Finalizada'
                  ? escuro
                    ? 'rgba(74, 222, 128, 0.35)'
                    : 'rgba(22, 163, 74, 0.3)'
                  : escuro
                    ? 'rgba(232, 82, 10, 0.4)'
                    : 'rgba(27, 42, 107, 0.3)',
            }}
          />
          <Chip
            size="small"
            variant="outlined"
            label={formatarLocalVisita(v)}
            sx={{ borderColor: colors.border, color: colors.textPrimary }}
          />
          {v.meta_visita?.gerente && (
            <Chip
              size="small"
              variant="outlined"
              label={`Gerente: ${v.meta_visita.gerente}`}
              sx={{ borderColor: colors.border, color: colors.textPrimary }}
            />
          )}
          {anterior && (
            <Chip
              size="small"
              variant="outlined"
              label={`Anterior: ${fmtNota(anterior.nota)} (${fmtData(anterior.data_registro)})`}
              sx={{ borderColor: colors.border, color: colors.textPrimary }}
            />
          )}
        </Box>
      </Paper>

      {/* Conteúdo a partir das categorias — única área com rolagem */}
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', pr: 0.25 }}>
      {/* Desempenho */}
      <Paper elevation={0} sx={{ ...paperSx, mb: 2 }}>
        <SecaoTitulo acento={acento}>Desempenho por categoria</SecaoTitulo>
        {data.desempenho_categorias.map((c, i) => {
          const pctRaw = c.percentual;
          const temNota = pctRaw != null && pctRaw !== '' && Number.isFinite(Number(pctRaw));
          const pct = temNota ? Number(pctRaw) : 0;
          const barColor = barraCategoria(pct, escuro);
          return (
            <Box
              key={c.categoria}
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr auto', sm: 'minmax(120px, 180px) 1fr auto' },
                alignItems: 'center',
                columnGap: 1.5,
                rowGap: 0.5,
                mb: 1.25,
                py: 0.75,
                px: 0.75,
                borderRadius: 1,
                bgcolor: i % 2 === 1 ? (escuro ? 'rgba(148, 163, 184, 0.08)' : colors.canvasAlt) : 'transparent',
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 600,
                  color: colors.textPrimary,
                  lineHeight: 1.3,
                  gridColumn: { xs: '1 / -1', sm: 'auto' },
                }}
              >
                {c.categoria}
              </Typography>
              <Box sx={{ minWidth: 0, gridColumn: { xs: '1', sm: 'auto' } }}>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(100, Math.max(0, pct))}
                  sx={{
                    height: 8,
                    borderRadius: 4,
                    bgcolor: escuro ? 'rgba(203, 213, 225, 0.28)' : '#E2E8F0',
                    '& .MuiLinearProgress-bar': { bgcolor: barColor, borderRadius: 4 },
                  }}
                />
              </Box>
              <Typography
                variant="caption"
                sx={{ width: 44, textAlign: 'right', fontWeight: 700, color: barColor }}
              >
                {pct}%
              </Typography>
            </Box>
          );
        })}
        {!data.desempenho_categorias.length && (
          <Typography sx={{ color: colors.textSecondary }}>Sem respostas registradas.</Typography>
        )}
      </Paper>

      {/* Respostas */}
      <Paper elevation={0} sx={{ ...paperSx, mb: 2 }}>
        <SecaoTitulo acento={acento}>Respostas do checklist</SecaoTitulo>
        {[...porCategoria.entries()].map(([categoria, items]) => (
          <Box key={categoria} sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <Typography sx={{ fontWeight: 800, color: colors.textPrimary, fontSize: '0.9rem' }}>
                {categoria}
              </Typography>
              <Box sx={{ flex: 1, height: 2, bgcolor: colors.border, position: 'relative', minWidth: 24 }}>
                <Box sx={{ position: 'absolute', left: 0, top: 0, width: 48, height: 2, bgcolor: acento }} />
              </Box>
            </Box>
            {items.map((r, idx) => (
              <RespostaRelatorio
                key={r.id_pergunta}
                resposta={r}
                idx={idx}
                escuro={escuro}
                acento={acento}
                onAbrirFoto={(src, pergunta) => setFotoAberta({ src, pergunta })}
              />
            ))}
          </Box>
        ))}
        {!data.respostas.length && (
          <Typography sx={{ color: colors.textSecondary }}>Nenhuma resposta registrada.</Typography>
        )}
      </Paper>

      {/* NCs */}
      {data.nao_conformidades.length > 0 && (
        <Paper
          elevation={0}
          sx={{
            ...paperSx,
            mb: 0,
            borderColor: escuro ? 'rgba(248, 113, 113, 0.35)' : '#FECACA',
          }}
        >
          <SecaoTitulo acento={acento}>Não conformidades</SecaoTitulo>
          {data.nao_conformidades.map((nc, i) => (
            <Box
              key={i}
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 1,
                py: 1,
                px: 1.25,
                mb: 1,
                bgcolor: escuro ? 'rgba(248, 113, 113, 0.12)' : '#FEF2F2',
                borderRadius: 1,
                borderLeft: `3px solid ${escuro ? '#F87171' : '#B91C1C'}`,
              }}
            >
              <Typography
                variant="body2"
                sx={{ color: escuro ? '#F87171' : '#B91C1C', fontWeight: 600 }}
              >
                [{nc.gravidade}]
              </Typography>
              <Typography variant="body2" sx={{ color: colors.textPrimary, flex: '1 1 200px' }}>
                <strong>{nc.area}:</strong> {nc.descricao}
              </Typography>
            </Box>
          ))}
        </Paper>
      )}
      </Box>

      <Dialog open={dlgReabrir} onClose={() => !reabrindo && setDlgReabrir(false)} fullWidth maxWidth="xs">
        <DialogTitleWithIcon plainIcon icon={<LockOpenIcon />}>
          Reabrir visita
        </DialogTitleWithIcon>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            A visita voltará para rascunho e poderá ser editada. NCs geradas na finalização serão removidas.
            Esta ação será registrada na auditoria.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDlgReabrir(false)} disabled={reabrindo}>
            Cancelar
          </Button>
          <Button variant="contained" disabled={reabrindo} onClick={() => void confirmarReabrir()}>
            {reabrindo ? 'Reabrindo…' : 'Reabrir'}
          </Button>
        </DialogActions>
      </Dialog>
      <ImageLightbox
        open={Boolean(fotoAberta)}
        src={fotoAberta?.src ?? null}
        titulo={fotoAberta?.pergunta}
        onClose={() => setFotoAberta(null)}
      />
    </Box>
  );
}

function RespostaRelatorio({
  resposta: r,
  idx,
  escuro,
  acento,
  onAbrirFoto,
}: {
  resposta: VisitaDetalhe['respostas'][0];
  idx: number;
  escuro: boolean;
  acento: string;
  onAbrirFoto: (src: string, pergunta: string) => void;
}) {
  const [urls, setUrls] = useState<string[]>([]);
  const st = corResposta(r.resposta, r, escuro);

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

  const cols = urls.length === 1 ? 1 : urls.length >= 3 ? 3 : 2;
  const imgH = urls.length === 1 ? { xs: 200, sm: 280 } : { xs: 140, sm: 180 };

  return (
    <Box
      sx={{
        mb: 1.5,
        p: { xs: 1.25, sm: 1.5 },
        borderRadius: 1.5,
        bgcolor: idx % 2 === 0 ? colors.surface : escuro ? 'rgba(148, 163, 184, 0.08)' : colors.canvasAlt,
        border: `1px solid ${colors.border}`,
      }}
    >
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mb: 0.75 }}>
        {r.codigo && (
          <Box
            sx={{
              bgcolor: acento,
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
        <Typography
          variant="body2"
          sx={{ fontWeight: 700, color: colors.textPrimary, lineHeight: 1.4, flex: 1 }}
        >
          {r.texto}
        </Typography>
      </Box>

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 1,
          mb: r.observacao?.trim() || urls.length ? 1 : 0,
        }}
      >
        <Typography
          variant="caption"
          sx={{ color: colors.textMuted, fontWeight: 700, fontSize: '0.62rem' }}
        >
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
          <Typography
            variant="caption"
            sx={{ color: colors.textMuted, fontWeight: 700, fontSize: '0.62rem' }}
          >
            OBSERVAÇÃO
          </Typography>
          <Typography
            variant="body2"
            sx={{ color: colors.textSecondary, fontStyle: 'italic', mt: 0.25 }}
          >
            {r.observacao.trim()}
          </Typography>
        </Box>
      )}

      {urls.length > 0 && (
        <Box>
          <Typography
            variant="caption"
            sx={{
              color: colors.textMuted,
              fontWeight: 700,
              fontSize: '0.62rem',
              display: 'block',
              mb: 0.75,
            }}
          >
            EVIDÊNCIAS FOTOGRÁFICAS
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: cols === 1 ? '1fr' : '1fr 1fr',
                md: cols === 1 ? '1fr' : cols === 3 ? 'repeat(3, 1fr)' : '1fr 1fr',
              },
              gap: 1,
            }}
          >
            {urls.map((src, i) => (
              <Box
                key={i}
                component="button"
                type="button"
                onClick={() =>
                  onAbrirFoto(src, `${r.codigo ? `${r.codigo}. ` : ''}${r.texto || ''}`.trim())
                }
                aria-label={`Ampliar evidência ${i + 1}`}
                sx={{
                  position: 'relative',
                  borderRadius: 1.5,
                  overflow: 'hidden',
                  border: `1px solid ${colors.border}`,
                  bgcolor: colors.canvasAlt,
                  p: 0,
                  cursor: 'zoom-in',
                  textAlign: 'left',
                  font: 'inherit',
                  WebkitTapHighlightColor: 'transparent',
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
                    bgcolor: escuro ? 'rgba(15, 23, 42, 0.85)' : colors.navy,
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
        <Typography variant="caption" sx={{ mt: 0.5, display: 'block', color: colors.textSecondary }}>
          {(r.midia_urls?.length ?? 0)} anexo(s) — incluídos no PDF
        </Typography>
      )}
    </Box>
  );
}
