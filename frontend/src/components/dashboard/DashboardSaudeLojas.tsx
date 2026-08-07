import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
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
          fontSize: '0.65rem',
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
          fontSize: '0.95rem',
          color: alert ? '#DC2626' : colors.navy,
          lineHeight: 1.2,
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}

function LojaCard({
  loja,
  selecionada,
  onSelect,
}: {
  loja: SaudeLoja;
  selecionada: boolean;
  onSelect: () => void;
}) {
  const cfg = NIVEL_CFG[loja.nivel];
  const nota = loja.nota_atual;
  const cmvAlert =
    loja.cmv_confiavel &&
    loja.cmv_teorico_pct != null &&
    loja.cmv_teorico_pct > loja.cmv_meta_pct;

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
            {[loja.bk_number ? `BK ${loja.bk_number}` : null, loja.neighborhood || loja.city]
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
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: 1,
          mt: 1.5,
        }}
      >
        <MetricMini
          label="Nota"
          value={nota != null ? fmtNota(nota) : '—'}
          alert={nota != null && nota < 75}
        />
        <MetricMini
          label="NCs"
          value={String(loja.ncs_abertas)}
          alert={loja.ncs_criticas > 0 || loja.ncs_abertas > 0}
        />
        <MetricMini
          label="Chamados"
          value={String(loja.chamados_abertos)}
          alert={loja.chamados_abertos > 0}
        />
        <MetricMini label="CMV" value={fmtCmv(loja)} alert={Boolean(cmvAlert)} />
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
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1,
            mt: 1.75,
            pt: 1.5,
            borderTop: '1px solid',
            borderColor: colors.border,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            component={Link}
            to="/nao-conformidades"
            size="small"
            variant="outlined"
            sx={{ textTransform: 'none', borderRadius: `${radius.md}px` }}
          >
            Ver NCs
          </Button>
          <Button
            component={Link}
            to="/chamados"
            size="small"
            variant="outlined"
            sx={{ textTransform: 'none', borderRadius: `${radius.md}px` }}
          >
            Ver chamados
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
            Ver estoque
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
  const [filtro, setFiltro] = useState<'todas' | SaudeLojaNivel>('todas');
  const [selecionada, setSelecionada] = useState<number | null>(idLojaFoco ?? null);

  useEffect(() => {
    if (idLojaFoco != null) setSelecionada(idLojaFoco);
  }, [idLojaFoco]);

  const lojas = useMemo(() => {
    if (filtro === 'todas') return data.lojas;
    return data.lojas.filter((l) => l.nivel === filtro);
  }, [data.lojas, filtro]);

  const { resumo } = data;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1.5,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <StorefrontIcon sx={{ color: colors.orange, fontSize: 22 }} />
          <Box>
            <Typography sx={{ fontWeight: 700, color: colors.navy, fontSize: '1rem' }}>
              Onde agir agora
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Nota + NCs + chamados + CMV do mês · {data.periodo.de} a {data.periodo.ate}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
          {(
            [
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
            />
          ))}
        </Box>
      )}
    </Box>
  );
}
