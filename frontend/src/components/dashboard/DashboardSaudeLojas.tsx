import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import InputAdornment from '@mui/material/InputAdornment';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import SearchIcon from '@mui/icons-material/Search';
import StorefrontIcon from '@mui/icons-material/Storefront';
import type { DashboardSaudeLojasData, SaudeLoja, SaudeLojaNivel } from '../../api/client';
import { fmtNota } from '../../api/client';
import { colors, portalPanelSx, radius } from '../../theme/tokens';
import { notaBarColor } from './dashboardCharts';

const NIVEL_CFG: Record<
  SaudeLojaNivel,
  { label: string; color: string; bg: string; border: string }
> = {
  critica: {
    label: 'Crítica',
    color: '#B91C1C',
    bg: 'rgba(220, 38, 38, 0.08)',
    border: 'rgba(220, 38, 38, 0.35)',
  },
  atencao: {
    label: 'Atenção',
    color: '#C2410C',
    bg: 'rgba(232, 82, 10, 0.08)',
    border: 'rgba(232, 82, 10, 0.35)',
  },
  ok: {
    label: 'Ok',
    color: '#15803D',
    bg: 'rgba(22, 163, 74, 0.08)',
    border: 'rgba(22, 163, 74, 0.3)',
  },
};

function fmtCmv(loja: SaudeLoja) {
  if (!loja.cmv_confiavel || loja.cmv_teorico_pct == null) return '—';
  return `${loja.cmv_teorico_pct.toFixed(1)}%`;
}

function fmtMetas(loja: SaudeLoja) {
  const m = loja.metas;
  if (!m?.tem_dados) return '—';
  if (m.pct_atingido != null) return `${m.pct_atingido}%`;
  return `${m.ok}/${m.ok + m.falhou}`;
}

function MetricMini({
  label,
  value,
  alert,
}: {
  label: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography
        sx={{
          fontSize: '0.62rem',
          fontWeight: 600,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: colors.textMuted,
          mb: 0.25,
        }}
      >
        {label}
      </Typography>
      <Typography
        sx={{
          fontWeight: 700,
          fontSize: { xs: '0.88rem', sm: '0.95rem' },
          color: alert ? '#DC2626' : colors.navy,
          lineHeight: 1.2,
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}

function ResumoPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'danger' | 'warn' | 'ok' | 'neutral';
}) {
  const map = {
    danger: { color: '#B91C1C', bg: 'rgba(220,38,38,0.08)' },
    warn: { color: '#C2410C', bg: 'rgba(232,82,10,0.08)' },
    ok: { color: '#15803D', bg: 'rgba(22,163,74,0.08)' },
    neutral: { color: colors.navy, bg: colors.canvasAlt },
  } as const;
  const t = map[tone || 'neutral'];
  return (
    <Box
      sx={{
        px: 1.25,
        py: 0.75,
        borderRadius: `${radius.md}px`,
        bgcolor: t.bg,
        minWidth: 72,
      }}
    >
      <Typography sx={{ fontSize: '0.62rem', fontWeight: 600, color: colors.textMuted, textTransform: 'uppercase' }}>
        {label}
      </Typography>
      <Typography sx={{ fontWeight: 800, fontSize: '1.1rem', color: t.color, lineHeight: 1.1 }}>
        {value}
      </Typography>
    </Box>
  );
}

function LojaCard({
  loja,
  selecionada,
  onSelect,
  metasTitulo,
}: {
  loja: SaudeLoja;
  selecionada: boolean;
  onSelect: () => void;
  metasTitulo?: string | null;
}) {
  const cfg = NIVEL_CFG[loja.nivel];
  const nota = loja.nota_atual;
  const cmvAlert =
    loja.cmv_confiavel &&
    loja.cmv_teorico_pct != null &&
    loja.cmv_teorico_pct > loja.cmv_meta_pct;
  const metasAlert = (loja.metas?.falhou || 0) > 0;
  const chamadoAlert = loja.chamados_sla_estourado > 0 || loja.chamados_urgentes > 0 || loja.chamados_abertos > 0;

  return (
    <Paper
      elevation={0}
      onClick={onSelect}
      sx={{
        ...portalPanelSx,
        p: { xs: 1.5, sm: 2 },
        cursor: 'pointer',
        borderColor: selecionada ? cfg.border : colors.border,
        bgcolor: selecionada ? cfg.bg : colors.surface,
        transition: 'border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease',
        '&:hover': {
          borderColor: cfg.border,
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            sx={{
              fontWeight: 700,
              fontSize: { xs: '0.9rem', sm: '0.95rem' },
              color: colors.navy,
              lineHeight: 1.3,
            }}
          >
            {loja.name}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
            {[
              loja.bk_number ? `BK ${loja.bk_number}` : null,
              loja.regiao,
              loja.neighborhood || loja.city,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Typography>
        </Box>
        <Chip
          size="small"
          label={cfg.label}
          sx={{
            fontWeight: 700,
            fontSize: '0.7rem',
            height: 24,
            bgcolor: cfg.bg,
            color: cfg.color,
            border: `1px solid ${cfg.border}`,
            flexShrink: 0,
          }}
        />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
          gap: 0.75,
          mt: 1.5,
        }}
      >
        <MetricMini label="Nota" value={nota != null ? fmtNota(nota) : '—'} alert={nota != null && nota < 75} />
        <MetricMini
          label="NCs"
          value={String(loja.ncs_abertas)}
          alert={loja.ncs_criticas > 0 || loja.ncs_abertas > 0}
        />
        <MetricMini label="Chamados" value={String(loja.chamados_abertos)} alert={chamadoAlert} />
        <MetricMini label="CMV" value={fmtCmv(loja)} alert={Boolean(cmvAlert)} />
        <MetricMini label="Metas" value={fmtMetas(loja)} alert={metasAlert} />
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1.5 }}>
        {loja.motivos.map((m) => (
          <Chip
            key={m}
            size="small"
            label={m}
            sx={{
              height: 22,
              fontSize: '0.68rem',
              bgcolor: colors.canvasAlt,
              color: colors.textSecondary,
            }}
          />
        ))}
      </Box>

      {selecionada && (
        <Box
          sx={{
            mt: 1.75,
            pt: 1.5,
            borderTop: '1px solid',
            borderColor: colors.border,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)' },
              gap: 1,
              mb: 1.5,
            }}
          >
            <Typography variant="caption" color="text.secondary">
              Última visita:{' '}
              <Box component="span" sx={{ fontWeight: 600, color: colors.textPrimary }}>
                {loja.ultima_visita
                  ? `${loja.ultima_visita.slice(0, 10)}${
                      loja.dias_sem_visita != null ? ` (${loja.dias_sem_visita}d)` : ''
                    }`
                  : '—'}
              </Box>
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Visitas no mês:{' '}
              <Box component="span" sx={{ fontWeight: 600, color: colors.textPrimary }}>
                {loja.visitas_mes}
              </Box>
            </Typography>
            <Typography variant="caption" color="text.secondary">
              NCs críticas:{' '}
              <Box
                component="span"
                sx={{ fontWeight: 600, color: loja.ncs_criticas ? '#DC2626' : colors.textPrimary }}
              >
                {loja.ncs_criticas}
              </Box>
            </Typography>
            <Typography variant="caption" color="text.secondary">
              SLA estourado:{' '}
              <Box
                component="span"
                sx={{
                  fontWeight: 600,
                  color: loja.chamados_sla_estourado ? '#DC2626' : colors.textPrimary,
                }}
              >
                {loja.chamados_sla_estourado}
              </Box>
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Urgentes:{' '}
              <Box
                component="span"
                sx={{
                  fontWeight: 600,
                  color: loja.chamados_urgentes ? '#C2410C' : colors.textPrimary,
                }}
              >
                {loja.chamados_urgentes}
              </Box>
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Metas ({metasTitulo || 'período'}):{' '}
              <Box component="span" sx={{ fontWeight: 600, color: colors.textPrimary }}>
                {loja.metas?.tem_dados
                  ? `${loja.metas.ok} OK · ${loja.metas.falhou} X · ${loja.metas.pendentes} pend.`
                  : 'sem lançamento'}
              </Box>
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            <Button
              component={Link}
              to="/nao-conformidades"
              size="small"
              variant="outlined"
              sx={{ textTransform: 'none', borderRadius: `${radius.md}px` }}
            >
              NCs
            </Button>
            <Button
              component={Link}
              to="/chamados"
              size="small"
              variant="outlined"
              sx={{ textTransform: 'none', borderRadius: `${radius.md}px` }}
            >
              Chamados
            </Button>
            <Button
              component={Link}
              to="/estoque"
              size="small"
              variant="outlined"
              onClick={() => {
                try {
                  localStorage.setItem('estoque.id_loja', String(loja.id_loja));
                } catch {
                  /* ignore */
                }
              }}
              sx={{ textTransform: 'none', borderRadius: `${radius.md}px` }}
            >
              Estoque
            </Button>
            <Button
              component={Link}
              to="/metas"
              size="small"
              variant="outlined"
              sx={{ textTransform: 'none', borderRadius: `${radius.md}px` }}
            >
              Metas
            </Button>
            <Button
              component={Link}
              to="/visitas"
              size="small"
              variant="outlined"
              sx={{ textTransform: 'none', borderRadius: `${radius.md}px` }}
            >
              Visitas
            </Button>
            {nota != null && (
              <Typography
                variant="caption"
                sx={{ alignSelf: 'center', color: colors.textMuted, ml: 'auto' }}
              >
                Nota{' '}
                <Box component="span" sx={{ color: notaBarColor(nota), fontWeight: 700 }}>
                  {fmtNota(nota)}
                </Box>
              </Typography>
            )}
          </Box>
        </Box>
      )}
    </Paper>
  );
}

export default function DashboardSaudeLojas({
  data,
  idLojaFoco,
}: {
  data: DashboardSaudeLojasData;
  idLojaFoco?: number | null;
}) {
  const [filtro, setFiltro] = useState<'todas' | 'agir' | SaudeLojaNivel>('agir');
  const [busca, setBusca] = useState('');
  const [selecionada, setSelecionada] = useState<number | null>(idLojaFoco ?? null);

  useEffect(() => {
    if (idLojaFoco != null) {
      setSelecionada(idLojaFoco);
      setFiltro('todas');
    }
  }, [idLojaFoco]);

  const lojas = useMemo(() => {
    let list = data.lojas;
    if (filtro === 'agir') list = list.filter((l) => l.nivel !== 'ok');
    else if (filtro !== 'todas') list = list.filter((l) => l.nivel === filtro);

    const q = busca.trim().toLowerCase();
    if (q) {
      list = list.filter((l) => {
        const blob = [l.name, l.bk_number, l.city, l.neighborhood, l.regiao]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return blob.includes(q);
      });
    }
    return list;
  }, [data.lojas, filtro, busca]);

  const { resumo } = data;
  const metasLabel = data.metas_periodo
    ? data.metas_periodo.titulo || `${data.metas_periodo.mes}/${data.metas_periodo.ano}`
    : null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 1.5,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <StorefrontIcon sx={{ color: colors.orange, fontSize: 22 }} />
          <Box>
            <Typography sx={{ fontWeight: 700, color: colors.navy, fontSize: '1rem' }}>
              Ficha da loja — onde agir
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Nota · NCs · chamados · CMV · metas
              {metasLabel ? ` · ${metasLabel}` : ''} · {data.periodo.de} a {data.periodo.ate}
            </Typography>
          </Box>
        </Box>

        <TextField
          size="small"
          placeholder="Buscar loja..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 18, color: colors.textMuted }} />
                </InputAdornment>
              ),
            },
          }}
          sx={{
            minWidth: { xs: '100%', sm: 220 },
            '& .MuiOutlinedInput-root': { bgcolor: colors.surface, borderRadius: `${radius.md}px` },
          }}
        />
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        <ResumoPill label="Críticas" value={resumo.criticas} tone="danger" />
        <ResumoPill label="Atenção" value={resumo.atencao} tone="warn" />
        <ResumoPill label="Ok" value={resumo.ok} tone="ok" />
        <ResumoPill label="Com NC" value={resumo.com_nc ?? 0} tone="warn" />
        <ResumoPill label="Chamado" value={resumo.com_chamado ?? 0} tone="warn" />
        <ResumoPill label="CMV alto" value={resumo.cmv_alto ?? 0} tone="danger" />
        <ResumoPill label="Meta X" value={resumo.metas_atrasadas ?? 0} tone="warn" />
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
        {(
          [
            ['agir', `Precisa agir (${resumo.criticas + resumo.atencao})`],
            ['todas', `Todas (${resumo.total})`],
            ['critica', `Críticas (${resumo.criticas})`],
            ['atencao', `Atenção (${resumo.atencao})`],
            ['ok', `Ok (${resumo.ok})`],
          ] as const
        ).map(([key, label]) => {
          const ativo = filtro === key;
          return (
            <Chip
              key={key}
              label={label}
              size="small"
              onClick={() => setFiltro(key)}
              sx={{
                fontWeight: 600,
                cursor: 'pointer',
                bgcolor: ativo ? colors.navy : colors.canvasAlt,
                color: ativo ? '#fff' : colors.textSecondary,
                '&:hover': { opacity: 0.9 },
              }}
            />
          );
        })}
      </Box>

      {!lojas.length ? (
        <Paper elevation={0} sx={{ ...portalPanelSx, py: 5, textAlign: 'center' }}>
          <Typography color="text.secondary">Nenhuma loja neste filtro.</Typography>
        </Paper>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              md: 'repeat(2, minmax(0, 1fr))',
            },
            gap: 1.5,
          }}
        >
          {lojas.map((loja) => (
            <LojaCard
              key={loja.id_loja}
              loja={loja}
              selecionada={selecionada === loja.id_loja}
              onSelect={() =>
                setSelecionada((prev) => (prev === loja.id_loja ? null : loja.id_loja))
              }
              metasTitulo={metasLabel}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}
