import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import FilterListIcon from '@mui/icons-material/FilterList';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import { api, type EscalaVisitasDia, type EscalaVisitasGrade, type EscalaVisitasLinha } from '../../api/client';
import { getUsuario, podeGerenciarEscalaVisitas, podeVerEscalaVisitas } from '../../lib/auth';
import { showToast } from '../../utils/toast';
import { colors, shadows } from '../../theme/tokens';
import { MOBILE_PAGE_COLUMN, MOBILE_SCROLL_AREA } from '../../theme/safeArea';
import {
  DIAS_ABREV,
  DIAS_LONGO,
  addDaysIso,
  diaIndexNaSemana,
  fmtDataCurta,
  primeiroNome,
  segundaFeiraAtual,
} from './escalaVisitasUtils';
import { atribuicoesDoDia, diaTemRegional } from './escalaVisitasModel';

const NAVY = '#1B2A6B';
const ORANGE = '#E8520A';
const PAGE_BG = '#f5f5f3';

type ModoVisualizacao = 'minhas' | 'dia' | 'lojas';

const MODOS: Array<{ id: ModoVisualizacao; label: string }> = [
  { id: 'minhas', label: 'Minhas' },
  { id: 'dia', label: 'Por dia' },
  { id: 'lojas', label: 'Por loja' },
];

function LojaVisitaCard({
  nome,
  bk,
  regional,
  regionais,
  cor,
  ocultarRegional = false,
}: {
  nome: string;
  bk?: string | null;
  regional?: string | null;
  regionais?: Array<{ nome: string; cor?: string | null }>;
  cor?: string | null;
  ocultarRegional?: boolean;
}) {
  const lista = regionais?.length
    ? regionais
    : regional
      ? [{ nome: regional, cor }]
      : [];
  const accent = lista[0]?.cor || cor || colors.navy;
  return (
    <Paper
      elevation={0}
      sx={{
        display: 'flex',
        overflow: 'hidden',
        borderRadius: 2,
        border: '1px solid rgba(27, 42, 107, 0.08)',
        bgcolor: '#fff',
      }}
    >
      <Box aria-hidden sx={{ width: 3, flexShrink: 0, bgcolor: accent }} />
      <Box sx={{ flex: 1, minWidth: 0, py: 1, px: 1.25 }}>
        <Typography
          variant="body2"
          sx={{ fontWeight: 700, color: colors.navy, lineHeight: 1.3, wordBreak: 'break-word' }}
        >
          {bk ? `${bk} · ` : ''}
          {nome}
        </Typography>
        {!ocultarRegional && lista.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.35 }}>
            {lista.map((r) => (
              <Chip
                key={r.nome}
                size="small"
                label={primeiroNome(r.nome)}
                sx={{
                  height: 20,
                  fontWeight: 600,
                  fontSize: '0.68rem',
                  bgcolor: `${r.cor || accent}14`,
                  color: colors.navy,
                  border: `1px solid ${r.cor || accent}44`,
                }}
              />
            ))}
          </Box>
        )}
      </Box>
    </Paper>
  );
}

function MetricaCard({
  valor,
  rotulo,
  fundoIcone,
  bordaIcone,
  icone,
  loading,
}: {
  valor: number;
  rotulo: string;
  fundoIcone: string;
  bordaIcone: string;
  icone: ReactNode;
  loading?: boolean;
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        flex: 1,
        minWidth: 0,
        px: 1.35,
        py: 1.65,
        borderRadius: 3,
        bgcolor: '#fff',
        boxShadow: '0 4px 18px rgba(27, 42, 107, 0.07)',
        display: 'flex',
        alignItems: 'center',
        gap: 1.1,
      }}
    >
      <Box
        sx={{
          width: 42,
          height: 42,
          borderRadius: 1.75,
          bgcolor: fundoIcone,
          border: `2px solid ${bordaIcone}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {icone}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography
          sx={{
            fontWeight: 800,
            fontSize: '2rem',
            lineHeight: 1,
            color: NAVY,
            letterSpacing: '-0.04em',
          }}
        >
          {loading ? '—' : valor}
        </Typography>
        <Typography
          sx={{
            mt: 0.4,
            fontSize: '0.74rem',
            fontWeight: 500,
            color: NAVY,
            opacity: 0.72,
            lineHeight: 1.25,
          }}
        >
          {rotulo}
        </Typography>
      </Box>
    </Paper>
  );
}

function CardResumoSemana({
  totalVisitas,
  visitasHojeMinhas,
  loading,
}: {
  totalVisitas: number;
  visitasHojeMinhas: number;
  loading: boolean;
}) {
  return (
    <Box sx={{ display: 'flex', gap: 1.1, mb: 1 }}>
      <MetricaCard
        valor={visitasHojeMinhas}
        rotulo="Suas visitas hoje"
        fundoIcone="rgba(232, 82, 10, 0.14)"
        bordaIcone={ORANGE}
        icone={<EventAvailableOutlinedIcon sx={{ color: ORANGE, fontSize: 21 }} />}
        loading={loading}
      />
      <MetricaCard
        valor={totalVisitas}
        rotulo="Visitas em lojas na semana"
        fundoIcone="rgba(27, 42, 107, 0.12)"
        bordaIcone={NAVY}
        icone={<StorefrontOutlinedIcon sx={{ color: NAVY, fontSize: 21 }} />}
        loading={loading}
      />
    </Box>
  );
}

function FaixaSemanaLoja({ dias }: { dias: EscalaVisitasDia[] }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 0.5, mt: 1.25 }}>
      {dias.map((d, i) => {
        const attrs = atribuicoesDoDia(d);
        const temVisita = attrs.length > 0;
        const cor = attrs[0]?.cor || colors.border;
        const rotulo =
          attrs.length > 1
            ? String(attrs.length)
            : attrs[0]?.nome_regional
              ? primeiroNome(attrs[0].nome_regional).slice(0, 3)
              : '—';
        const titulo = attrs.map((a) => a.nome_regional).filter(Boolean).join(', ') || 'Sem visita';
        return (
          <Box key={d.dia} sx={{ textAlign: 'center', minWidth: 0 }}>
            <Typography variant="caption" sx={{ fontSize: '0.62rem', color: colors.textMuted, fontWeight: 600 }}>
              {DIAS_ABREV[i]}
            </Typography>
            <Box
              title={titulo}
              sx={{
                mt: 0.35,
                py: 0.65,
                px: 0.25,
                borderRadius: 1,
                fontSize: '0.62rem',
                fontWeight: 700,
                lineHeight: 1.1,
                bgcolor: temVisita ? `${cor}20` : colors.canvasAlt,
                border: temVisita ? `1px solid ${cor}` : `1px dashed ${colors.border}`,
                color: temVisita ? colors.navy : colors.textMuted,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {temVisita ? rotulo : '—'}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

function CardLojaSemana({ linha }: { linha: EscalaVisitasLinha }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 1.5,
        borderRadius: 2.5,
        border: '1px solid rgba(27, 42, 107, 0.08)',
        bgcolor: '#fff',
        boxShadow: shadows.sm,
      }}
    >
      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: colors.navy, lineHeight: 1.3 }}>
        {linha.bk_number ? `${linha.bk_number} · ` : ''}
        {linha.nome}
      </Typography>
      <FaixaSemanaLoja dias={linha.dias} />
    </Paper>
  );
}

export default function EscalaVisitasMobileView() {
  const user = getUsuario();
  const idEu = user?.id_usuario;
  const podeVer = podeVerEscalaVisitas(user);
  const ehDiretor = podeGerenciarEscalaVisitas(user);

  const [semanaInicio, setSemanaInicio] = useState(segundaFeiraAtual());
  const [idRegiao, setIdRegiao] = useState<number | ''>('');
  const [modo, setModo] = useState<ModoVisualizacao>(ehDiretor ? 'dia' : 'minhas');
  const [diaSelecionado, setDiaSelecionado] = useState(() => diaIndexNaSemana(segundaFeiraAtual()) ?? 0);
  const [grade, setGrade] = useState<EscalaVisitasGrade | null>(null);
  const [loading, setLoading] = useState(true);
  const [filtroRegiaoAberto, setFiltroRegiaoAberto] = useState(false);

  const carregar = useCallback(async () => {
    if (!podeVer) return;
    setLoading(true);
    try {
      const q = new URLSearchParams({ semana_inicio: semanaInicio });
      if (idRegiao !== '') q.set('id_regiao', String(idRegiao));
      const data = await api.escalaVisitasSemana(q.toString());
      setGrade(data);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao carregar escala', 'error');
    } finally {
      setLoading(false);
    }
  }, [podeVer, semanaInicio, idRegiao]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    const hoje = diaIndexNaSemana(semanaInicio);
    setDiaSelecionado(hoje ?? 0);
  }, [semanaInicio]);

  const mapNome = useMemo(() => {
    const m = new Map<number, string>();
    for (const r of grade?.regionais ?? []) m.set(r.id_usuario, r.nome);
    for (const linha of grade?.linhas ?? []) {
      for (const d of linha.dias) {
        for (const a of atribuicoesDoDia(d)) {
          if (a.id_regional != null && a.nome_regional) m.set(a.id_regional, a.nome_regional);
        }
      }
    }
    return m;
  }, [grade]);

  const visitasPorDia = useMemo(() => {
    if (!grade) return [];
    return DIAS_LONGO.map((label, dia) => {
      const itens: Array<{
        id_loja: number;
        nome: string;
        bk?: string | null;
        regionais: Array<{ nome: string; cor?: string | null }>;
        cor?: string | null;
      }> = [];
      for (const linha of grade.linhas) {
        const c = linha.dias[dia];
        const attrs = atribuicoesDoDia(c);
        if (!attrs.length) continue;
        itens.push({
          id_loja: linha.id_loja,
          nome: linha.nome,
          bk: linha.bk_number,
          regionais: attrs.map((a) => ({
            nome: a.nome_regional ?? mapNome.get(a.id_regional!) ?? '—',
            cor: a.cor ?? undefined,
          })),
          cor: attrs[0]?.cor ?? undefined,
        });
      }
      return {
        dia,
        label,
        data: fmtDataCurta(addDaysIso(grade.semana_inicio, dia)),
        itens,
      };
    });
  }, [grade, mapNome]);

  const minhasVisitas = useMemo(() => {
    if (!idEu) return [];
    return visitasPorDia
      .map((d) => ({
        ...d,
        itens: d.itens.filter((i) => {
          const linha = grade?.linhas.find((l) => l.id_loja === i.id_loja);
          const c = linha?.dias[d.dia];
          return c != null && diaTemRegional(c, idEu);
        }),
      }))
      .filter((d) => d.itens.length > 0);
  }, [visitasPorDia, idEu, grade]);

  const totalVisitas = useMemo(() => {
    if (!grade) return 0;
    let n = 0;
    for (const linha of grade.linhas) {
      for (const d of linha.dias) n += atribuicoesDoDia(d).length;
    }
    return n;
  }, [grade]);
  const hojeIndex = diaIndexNaSemana(semanaInicio);
  const visitasHojeMinhas = useMemo(() => {
    if (hojeIndex == null || !idEu) return 0;
    return minhasVisitas.find((d) => d.dia === hojeIndex)?.itens.length ?? 0;
  }, [minhasVisitas, hojeIndex, idEu]);

  const diaAtual = visitasPorDia[diaSelecionado];
  const semanaEhAtual = semanaInicio === segundaFeiraAtual();

  if (!podeVer) return null;

  const labelSemanaCurta = grade
    ? `${fmtDataCurta(grade.semana_inicio)} – ${fmtDataCurta(grade.semana_fim)}`
    : '…';

  const temFiltroRegiao = grade != null && grade.regioes.length > 1;
  const regiaoAtiva = grade?.regioes.find((r) => r.id_regiao === idRegiao);

  const barraModos = (
    <Box sx={{ display: 'flex', alignItems: 'stretch', gap: 0.75, mb: 1.25 }}>
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          bgcolor: '#fff',
          borderRadius: 999,
          p: 0.3,
          boxShadow: '0 1px 8px rgba(27, 42, 107, 0.08)',
        }}
      >
        {MODOS.map(({ id, label }) => {
          const ativa = modo === id;
          return (
            <Button
              key={id}
              fullWidth
              onClick={() => setModo(id)}
              sx={{
                minHeight: 0,
                py: 0.65,
                px: 0.75,
                borderRadius: 999,
                textTransform: 'none',
                fontWeight: 700,
                fontSize: '0.76rem',
                color: ativa ? '#fff' : 'rgba(27, 42, 107, 0.55)',
                bgcolor: ativa ? ORANGE : 'transparent',
                boxShadow: ativa ? '0 2px 8px rgba(232, 82, 10, 0.28)' : 'none',
                '&:hover': { bgcolor: ativa ? ORANGE : 'rgba(27, 42, 107, 0.04)' },
              }}
            >
              {label}
            </Button>
          );
        })}
      </Box>
      {temFiltroRegiao && (
        <>
          <IconButton
            aria-label="Filtrar região"
            onClick={() => setFiltroRegiaoAberto(true)}
            sx={{
              flexShrink: 0,
              alignSelf: 'stretch',
              aspectRatio: '1',
              width: 'auto',
              minWidth: 40,
              borderRadius: 2.5,
              bgcolor: '#fff',
              boxShadow: '0 2px 12px rgba(27, 42, 107, 0.08)',
              border: idRegiao !== '' ? '2px solid rgba(232, 82, 10, 0.35)' : '1px solid rgba(27, 42, 107, 0.08)',
            }}
          >
            <FilterListIcon sx={{ color: NAVY, fontSize: 21 }} />
          </IconButton>
          <Dialog open={filtroRegiaoAberto} onClose={() => setFiltroRegiaoAberto(false)} fullWidth maxWidth="xs">
            <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem', color: NAVY, pb: 1 }}>
              Filtrar por região
            </DialogTitle>
            <List sx={{ pt: 0, pb: 1 }}>
              <ListItemButton
                selected={idRegiao === ''}
                onClick={() => {
                  setIdRegiao('');
                  setFiltroRegiaoAberto(false);
                }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <LocationOnOutlinedIcon sx={{ fontSize: 20, color: idRegiao === '' ? ORANGE : 'text.disabled' }} />
                </ListItemIcon>
                <ListItemText
                  primary="Todas as regiões"
                  slotProps={{ primary: { sx: { fontWeight: idRegiao === '' ? 700 : 600, fontSize: '0.9rem' } } }}
                />
              </ListItemButton>
              {grade?.regioes.map((r) => {
                const ativa = idRegiao === r.id_regiao;
                return (
                  <ListItemButton
                    key={r.id_regiao}
                    selected={ativa}
                    onClick={() => {
                      setIdRegiao(r.id_regiao);
                      setFiltroRegiaoAberto(false);
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <LocationOnOutlinedIcon sx={{ fontSize: 20, color: ativa ? ORANGE : 'text.disabled' }} />
                    </ListItemIcon>
                    <ListItemText
                      primary={r.nome}
                      slotProps={{ primary: { sx: { fontWeight: ativa ? 700 : 600, fontSize: '0.9rem' } } }}
                    />
                  </ListItemButton>
                );
              })}
            </List>
          </Dialog>
        </>
      )}
    </Box>
  );

  const conteudoScroll = (
    <>
      {barraModos}
      {regiaoAtiva && (
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            mb: 1,
            px: 0.5,
            color: 'text.secondary',
            fontWeight: 600,
          }}
        >
          Exibindo: {regiaoAtiva.nome}
        </Typography>
      )}

      {loading ? (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
      <CircularProgress size={28} sx={{ color: NAVY }} />
    </Box>
  ) : modo === 'minhas' ? (
    minhasVisitas.length === 0 ? (
      <Paper
        elevation={0}
        sx={{
          p: 3.5,
          textAlign: 'center',
          borderRadius: 2.5,
          border: '1.5px dashed rgba(27, 42, 107, 0.25)',
          bgcolor: 'rgba(27, 42, 107, 0.03)',
        }}
      >
        <CalendarMonthOutlinedIcon sx={{ fontSize: 40, color: NAVY, mb: 1, opacity: 0.5 }} />
        <Typography sx={{ fontWeight: 700, color: NAVY, mb: 0.5 }}>
          Nenhuma visita sua
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {ehDiretor
            ? 'Use “Por dia” ou “Por loja” para ver o planejamento do time.'
            : 'Nenhuma visita planejada para você nesta semana.'}
        </Typography>
      </Paper>
    ) : (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {minhasVisitas.map((d) => (
          <Box key={d.dia}>
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                color: colors.navy,
                display: 'block',
                mb: 0.5,
                px: 0.25,
              }}
            >
              {d.label} · {d.data}
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.65 }}>
              {d.itens.map((item) => (
                <LojaVisitaCard
                  key={`${d.dia}-${item.id_loja}`}
                  nome={item.nome}
                  bk={item.bk}
                  regionais={item.regionais}
                  cor={item.cor}
                  ocultarRegional
                />
              ))}
            </Box>
          </Box>
        ))}
      </Box>
    )
  ) : modo === 'dia' ? (
    <>
      <Box
        sx={{
          display: 'flex',
          gap: 0.75,
          overflowX: 'auto',
          pb: 1.25,
          mx: -0.25,
          px: 0.25,
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
          '&::-webkit-scrollbar': { display: 'none' },
        }}
      >
        {visitasPorDia.map((d) => {
          const selected = d.dia === diaSelecionado;
          const isToday = hojeIndex === d.dia;
          return (
            <Paper
              key={d.dia}
              component="button"
              type="button"
              onClick={() => setDiaSelecionado(d.dia)}
              elevation={0}
              sx={{
                flexShrink: 0,
                scrollSnapAlign: 'start',
                minWidth: 64,
                p: 1,
                borderRadius: 2.5,
                textAlign: 'center',
                cursor: 'pointer',
                border: selected
                  ? `2px solid ${ORANGE}`
                  : isToday
                    ? `1px solid ${ORANGE}`
                    : '1px solid rgba(27, 42, 107, 0.1)',
                bgcolor: selected ? 'rgba(232, 82, 10, 0.08)' : '#fff',
                boxShadow: selected ? '0 2px 10px rgba(232, 82, 10, 0.18)' : '0 2px 14px rgba(27, 42, 107, 0.07)',
                font: 'inherit',
              }}
            >
              <Typography variant="caption" sx={{ fontWeight: 700, color: NAVY, display: 'block' }}>
                {DIAS_ABREV[d.dia]}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.68rem' }}>
                {d.data}
              </Typography>
              {d.itens.length > 0 && (
                <Box
                  sx={{
                    mt: 0.5,
                    mx: 'auto',
                    minWidth: 18,
                    height: 18,
                    px: 0.5,
                    borderRadius: 99,
                    bgcolor: selected ? ORANGE : NAVY,
                    color: '#fff',
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {d.itens.length}
                </Box>
              )}
            </Paper>
          );
        })}
      </Box>

      {diaAtual && diaAtual.itens.length === 0 ? (
        <Paper
          elevation={0}
          sx={{
            p: 3,
            textAlign: 'center',
            borderRadius: 2.5,
            border: '1.5px dashed rgba(27, 42, 107, 0.25)',
            bgcolor: 'rgba(27, 42, 107, 0.03)',
          }}
        >
          <Typography variant="body2" color="text.secondary">
            Nenhuma visita em {diaAtual.label.toLowerCase()}, {diaAtual.data}.
          </Typography>
        </Paper>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.65 }}>
          {diaAtual?.itens.map((item) => (
            <LojaVisitaCard
              key={item.id_loja}
              nome={item.nome}
              bk={item.bk}
              regionais={item.regionais}
              cor={item.cor}
            />
          ))}
        </Box>
      )}
    </>
  ) : (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      {grade?.linhas.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
          Nenhuma loja neste filtro.
        </Typography>
      ) : (
        grade?.linhas.map((linha) => <CardLojaSemana key={linha.id_loja} linha={linha} />)
      )}
    </Box>
      )}
    </>
  );

  return (
    <Box sx={{ ...MOBILE_PAGE_COLUMN, maxWidth: 480, mx: 'auto', width: '100%', bgcolor: PAGE_BG }}>
      <Box sx={{ flexShrink: 0, pb: 1 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.25,
            mb: 1,
            px: 0.25,
          }}
        >
          <IconButton
            size="small"
            aria-label="Semana anterior"
            onClick={() => setSemanaInicio(addDaysIso(semanaInicio, -7))}
            sx={{ color: NAVY, p: 0.5 }}
          >
            <ChevronLeftIcon fontSize="small" />
          </IconButton>
          <Typography
            sx={{
              flex: 1,
              textAlign: 'center',
              fontWeight: 700,
              fontSize: '0.84rem',
              color: NAVY,
              lineHeight: 1.2,
            }}
          >
            {labelSemanaCurta}
          </Typography>
          {!semanaEhAtual ? (
            <Button
              size="small"
              onClick={() => setSemanaInicio(segundaFeiraAtual())}
              sx={{
                minWidth: 0,
                minHeight: 0,
                py: 0.35,
                px: 0.85,
                fontSize: '0.68rem',
                fontWeight: 700,
                color: ORANGE,
                textTransform: 'none',
                flexShrink: 0,
              }}
            >
              Hoje
            </Button>
          ) : (
            <Box sx={{ width: 28, flexShrink: 0 }} />
          )}
          <IconButton
            size="small"
            aria-label="Próxima semana"
            onClick={() => setSemanaInicio(addDaysIso(semanaInicio, 7))}
            sx={{ color: NAVY, p: 0.5 }}
          >
            <ChevronRightIcon fontSize="small" />
          </IconButton>
        </Box>

        <CardResumoSemana
          totalVisitas={totalVisitas}
          visitasHojeMinhas={visitasHojeMinhas}
          loading={loading}
        />
      </Box>

      <Box sx={{ ...MOBILE_SCROLL_AREA, pb: 1 }}>{conteudoScroll}</Box>
    </Box>
  );
}
