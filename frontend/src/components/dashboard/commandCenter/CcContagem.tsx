import { useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router-dom';
import { api, type EstoqueContagemRedeItem } from '../../../api/client';
import { useCommandCenterFilters } from '../../../context/CommandCenterFiltersContext';
import { fmtInt, lojaLabel } from './ccFormat';
import { CC_BORDER, CC_MUTED, CC_ORANGE, CC_RADIUS, CC_SURFACE, CC_TEXT } from './ccTheme';
import { CcEmpty, CcSkeleton } from './CcPanel';

function lojaCurta(name: string) {
  return lojaLabel(name).replace(/^BURGER KING\s*[-–]\s*/i, '').trim() || name;
}

/** Contagem diária — pendências da rede. */
export default function CcContagem() {
  const { data: dataFiltro } = useCommandCenterFilters();
  const [lojas, setLojas] = useState<EstoqueContagemRedeItem[]>([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    api
      .estoqueContagensRede({ tipo: 'diaria', data: dataFiltro })
      .then((r) => {
        if (cancel) return;
        setErr('');
        setLojas(r.lojas ?? []);
        setLoading(false);
      })
      .catch((e) => {
        if (cancel) return;
        setErr(e?.message || 'Sem acesso às contagens.');
        setLojas([]);
        setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [dataFiltro]);

  const resumo = useMemo(() => {
    const contou = lojas.filter((l) => l.status === 'contou').length;
    const aberta = lojas.filter((l) => l.status === 'aberta').length;
    const faltou = lojas.filter((l) => l.status === 'faltou').length;
    return { contou, aberta, faltou, total: lojas.length };
  }, [lojas]);

  const pendentes = useMemo(
    () =>
      lojas
        .filter((l) => l.status === 'faltou' || l.status === 'aberta')
        .sort(
          (a, b) =>
            (a.status === 'faltou' ? 0 : 1) - (b.status === 'faltou' ? 0 : 1) ||
            lojaCurta(a.name).localeCompare(lojaCurta(b.name), 'pt-BR'),
        ),
    [lojas],
  );

  const pct = resumo.total > 0 ? Math.round((resumo.contou / resumo.total) * 100) : 0;

  return (
    <Box
      sx={{
        bgcolor: CC_SURFACE,
        borderRadius: `${CC_RADIUS}px`,
        border: `1px solid ${CC_BORDER}`,
        p: 1.15,
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, mb: 0.75 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: '0.72rem', fontWeight: 750, letterSpacing: '0.06em', color: CC_TEXT }}>
            CONTAGEM
          </Typography>
          <Typography sx={{ fontSize: '0.625rem', color: 'var(--ga-text-secondary)', mt: 0.1 }}>
            Diária · {fmtInt(resumo.contou)}/{fmtInt(resumo.total)} · {pct}%
          </Typography>
        </Box>
        <Typography
          component={RouterLink}
          to="/estoque"
          sx={{
            fontSize: '0.625rem',
            fontWeight: 600,
            color: CC_ORANGE,
            textDecoration: 'none',
            whiteSpace: 'nowrap',
            '&:hover': { textDecoration: 'underline' },
          }}
        >
          Ver estoque
        </Typography>
      </Box>

      {loading ? (
        <CcSkeleton height={140} />
      ) : err ? (
        <CcEmpty>{err}</CcEmpty>
      ) : !lojas.length ? (
        <CcEmpty>Nenhuma loja no escopo.</CcEmpty>
      ) : (
        <>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0.5, mb: 0.75, flexShrink: 0 }}>
            {[
              { label: 'Faltou', n: resumo.faltou, alerta: true },
              { label: 'Aberta', n: resumo.aberta, alerta: true },
              { label: 'Fechou', n: resumo.contou, alerta: false },
            ].map((m) => (
              <Box
                key={m.label}
                sx={{
                  px: 0.7,
                  py: 0.55,
                  borderRadius: `${CC_RADIUS}px`,
                  border: `1px solid ${CC_BORDER}`,
                  bgcolor: 'var(--ga-canvas-alt)',
                }}
              >
                <Typography
                  sx={{
                    fontSize: '0.48rem',
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: CC_MUTED,
                    mb: 0.15,
                  }}
                >
                  {m.label}
                </Typography>
                <Typography
                  sx={{
                    fontSize: '0.95rem',
                    fontWeight: 750,
                    color: m.alerta && m.n > 0 ? CC_ORANGE : CC_TEXT,
                    lineHeight: 1,
                  }}
                >
                  {fmtInt(m.n)}
                </Typography>
              </Box>
            ))}
          </Box>

          <Box
            sx={{
              height: 4,
              borderRadius: 4,
              bgcolor: CC_BORDER,
              overflow: 'hidden',
              mb: 0.75,
              flexShrink: 0,
            }}
          >
            <Box sx={{ width: `${pct}%`, height: '100%', bgcolor: CC_ORANGE, opacity: 0.85, borderRadius: 4 }} />
          </Box>

          <Typography
            sx={{
              fontSize: '0.5rem',
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: CC_MUTED,
              mb: 0.4,
              flexShrink: 0,
            }}
          >
            Pendências
          </Typography>

          {!pendentes.length ? (
            <CcEmpty>Todas as lojas fecharam a diária.</CcEmpty>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3, minHeight: 0, overflow: 'auto', flex: 1 }}>
              {pendentes.map((l) => (
                <Box key={l.id_loja} sx={{ display: 'flex', alignItems: 'center', gap: 0.6, minWidth: 0, py: 0.25 }}>
                  <Box
                    sx={{
                      width: 2.5,
                      height: 12,
                      borderRadius: 1,
                      bgcolor: l.status === 'faltou' ? CC_ORANGE : CC_MUTED,
                      flexShrink: 0,
                      opacity: 0.85,
                    }}
                  />
                  <Typography
                    sx={{
                      flex: 1,
                      fontSize: '0.68rem',
                      fontWeight: 600,
                      color: CC_TEXT,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {lojaCurta(l.name)}
                  </Typography>
                  <Typography sx={{ fontSize: '0.55rem', fontWeight: 600, color: CC_MUTED, flexShrink: 0 }}>
                    {l.status === 'faltou' ? 'faltou' : 'aberta'}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </>
      )}
    </Box>
  );
}
