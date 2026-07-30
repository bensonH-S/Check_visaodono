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
import { api, fmtNota, fmtData, fetchMediaAutenticada } from '../api/client';
import type { VisitaDetalhe } from '../api/client';
import { gerarPdfVisita } from '../utils/gerarPdfVisita';
import { showToast } from '../utils/toast';
import { formatarHoraVisita, formatarLocalVisita } from '../utils/visitaFormat';
import { isMobileAppPath } from '../config/mobileRoutes';
import { assetUrl, FAVICON_ICON } from '../config/paths';
import { podeReabrirVisitas } from '../lib/auth';
import DialogTitleWithIcon from '../components/DialogTitleWithIcon';
import RelatorioMobileScreen from '../components/visitas/RelatorioMobileScreen';
import '../components/visitas/visitas-mobile.css';

const NAVY = '#0F1A45';
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

function corResposta(
  resposta: string | null | undefined,
  pergunta?: { texto?: string; sim_indica_problema?: boolean },
): { color: string; bg: string } {
  const invertida = pergunta
    ? pergunta.sim_indica_problema === true ||
      (pergunta.sim_indica_problema !== false && /possui alguma obstru/i.test(pergunta.texto || ''))
    : false;
  if (invertida) {
    if (resposta === 'Não') return { color: OK, bg: '#ECFDF5' };
    if (resposta === 'Sim') return { color: FAIL, bg: '#FEF2F2' };
  }
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
  const navigate = useNavigate();
  const mobileApp = isMobileAppPath(location.pathname);
  const [data, setData] = useState<VisitaDetalhe | null>(null);
  const [err, setErr] = useState('');
  const [exportandoPdf, setExportandoPdf] = useState(false);
  const [reabrindo, setReabrindo] = useState(false);
  const [dlgReabrir, setDlgReabrir] = useState(false);
  const podeReabrir = podeReabrirVisitas();

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
    if (!data) return <LinearProgress />;
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

  const cabecalhoRelatorio = (
    <Box sx={{ mb: 2.5 }}>
      <Box
        sx={{
          bgcolor: NAVY,
          borderRadius: '12px 12px 0 0',
          px: 2,
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1.5,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0, flex: 1 }}>
          <MarcaGrupoAlvim size={28} />
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="caption"
              sx={{ color: SLATE_LIGHT, letterSpacing: 1, fontSize: '0.62rem', display: 'block' }}
            >
              RELATÓRIO DE VISITA
            </Typography>
            <Typography
              sx={{
                fontWeight: 800,
                color: '#fff',
                fontSize: '1.05rem',
                lineHeight: 1.2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {titulo}
            </Typography>
            <Typography variant="caption" sx={{ color: '#B4C3DC', fontSize: '0.72rem' }}>
              {v.name}
              {v.bk_number ? ` · BKN ${v.bk_number}` : ''}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
          {podeReabrir && v.status === 'Finalizada' && (
            <Tooltip title="Reabrir">
              <span>
                <IconButton
                  size="small"
                  aria-label="Reabrir visita"
                  disabled={reabrindo}
                  onClick={() => setDlgReabrir(true)}
                  sx={{
                    color: '#fff',
                    bgcolor: 'rgba(255,255,255,0.12)',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.22)' },
                  }}
                >
                  {reabrindo ? (
                    <CircularProgress size={18} sx={{ color: '#fff' }} />
                  ) : (
                    <LockOpenIcon fontSize="small" />
                  )}
                </IconButton>
              </span>
            </Tooltip>
          )}
          <Tooltip title={exportandoPdf ? 'Gerando…' : 'Baixar PDF'}>
            <span>
              <IconButton
                size="small"
                aria-label="Baixar PDF"
                disabled={exportandoPdf}
                onClick={() => void exportarPdf()}
                sx={{
                  color: '#fff',
                  bgcolor: FAIL,
                  '&:hover': { bgcolor: '#991B1B' },
                  '&.Mui-disabled': { color: 'rgba(255,255,255,0.5)', bgcolor: 'rgba(185,28,28,0.5)' },
                }}
              >
                {exportandoPdf ? (
                  <CircularProgress size={18} sx={{ color: '#fff' }} />
                ) : (
                  <PictureAsPdfIcon fontSize="small" />
                )}
              </IconButton>
            </span>
          </Tooltip>
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
            gap: 0.75,
            alignItems: 'center',
          }}
        >
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
      </Paper>
    </Box>
  );

  const corpoRelatorio = (
    <>
      <Paper elevation={0} sx={{ p: 2, mb: 2, borderRadius: 2, border: `1px solid ${LINE}` }}>
        <SecaoTitulo>Desempenho por categoria</SecaoTitulo>
        {data.desempenho_categorias.map((c, i) => {
          const pctRaw = c.percentual;
          const temNota = pctRaw != null && pctRaw !== '' && Number.isFinite(Number(pctRaw));
          const pct = temNota ? Number(pctRaw) : 0;
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
                  width: 130,
                  flexShrink: 0,
                  fontWeight: 600,
                  color: NAVY,
                  lineHeight: 1.25,
                }}
              >
                {c.categoria}
              </Typography>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(100, Math.max(0, pct))}
                  sx={{
                    height: 8,
                    borderRadius: 4,
                    bgcolor: '#E2E8F0',
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
              <RespostaRelatorio key={r.id_pergunta} resposta={r} idx={idx} mobileApp={false} />
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

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      {cabecalhoRelatorio}
      {corpoRelatorio}
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
  const st = corResposta(r.resposta, r);

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
