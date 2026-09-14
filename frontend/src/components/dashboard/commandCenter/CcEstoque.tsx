import { useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router-dom';
import { api, type EstoqueContagemRedeItem } from '../../../api/client';
import { useCommandCenterFilters } from '../../../context/CommandCenterFiltersContext';
import { fmtInt, lojaLabel } from './ccFormat';
import { CC_BORDER, CC_CRITICO, CC_MUTED, CC_OK, CC_ORANGE, CC_RADIUS, CC_SURFACE, CC_TEXT, CC_WARN } from './ccTheme';
import { CcEmpty, CcSkeleton } from './CcPanel';

type FiltroStatus = EstoqueContagemRedeItem['status'] | 'todas';

function lojaCurta(name: string) {
  return lojaLabel(name).replace(/^BURGER KING\s*[-–]\s*/i, '').trim() || name;
}

function statusCor(s: EstoqueContagemRedeItem['status']) {
  if (s === 'faltou') return CC_CRITICO;
  if (s === 'aberta') return CC_WARN;
  return CC_OK;
}

function statusTag(s: EstoqueContagemRedeItem['status']) {
  if (s === 'faltou') return 'FALTOU';
  if (s === 'aberta') return 'ABERTA';
  return 'FECHOU';
}

function statusPeso(s: EstoqueContagemRedeItem['status']) {
  if (s === 'faltou') return 0;
  if (s === 'aberta') return 1;
  return 2;
}

function rotuloFiltro(f: FiltroStatus) {
  if (f === 'faltou') return 'quem faltou';
  if (f === 'aberta') return 'quem está aberta';
  if (f === 'contou') return 'quem já fechou';
  return 'todas as lojas';
}

export default function CcEstoque() {
  const { data: dataFiltro } = useCommandCenterFilters();
  const [lojas, setLojas] = useState<EstoqueContagemRedeItem[]>([]);
  const [filtro, setFiltro] = useState<FiltroStatus>('todas');
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
        setErr(e?.message || 'Sem acesso às contagens da rede.');
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

  const lista = useMemo(() => {
    const base = filtro === 'todas' ? lojas : lojas.filter((l) => l.status === filtro);
    return [...base].sort(
      (a, b) =>
        statusPeso(a.status) - statusPeso(b.status) ||
        lojaCurta(a.name).localeCompare(lojaCurta(b.name), 'pt-BR'),
    );
  }, [lojas, filtro]);

  const escolher = (proximo: FiltroStatus) => {
    setFiltro((atual) => (atual === proximo ? 'todas' : proximo));
  };

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
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, mb: 0.85 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: '0.72rem', fontWeight: 750, letterSpacing: '0.06em', color: CC_TEXT }}>
            CONTAGEM
          </Typography>
          <Typography sx={{ fontSize: '0.6875rem', color: 'var(--ga-text-secondary)', mt: 0.15 }}>
            Diária de hoje · {rotuloFiltro(filtro)}
          </Typography>
        </Box>
        <Typography
          component={RouterLink}
          to="/estoque"
          sx={{
            fontSize: '0.6875rem',
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
        <CcSkeleton height={120} />
      ) : err ? (
        <Typography sx={{ fontSize: '0.75rem', color: 'var(--ga-text-secondary)', py: 1.5 }}>{err}</Typography>
      ) : !lojas.length ? (
        <CcEmpty>Nenhuma loja no escopo da diária.</CcEmpty>
      ) : (
        <>
          <Box sx={{ display: 'flex', gap: 1.25, mb: 0.85, flexShrink: 0 }}>
            {(
              [
                { id: 'faltou' as const, n: resumo.faltou, label: 'faltou', cor: CC_CRITICO },
                { id: 'aberta' as const, n: resumo.aberta, label: 'aberta', cor: CC_WARN },
                { id: 'contou' as const, n: resumo.contou, label: `fechou · ${fmtInt(resumo.total)}`, cor: CC_OK },
              ] as const
            ).map((k, i) => (
              <Box key={k.id} sx={{ display: 'flex', gap: 1.25, minWidth: 0 }}>
                {i > 0 ? <Box sx={{ width: '1px', bgcolor: CC_BORDER, my: 0.15, flexShrink: 0 }} /> : null}
                <Box
                  component="button"
                  type="button"
                  onClick={() => escolher(k.id)}
                  sx={{
                    all: 'unset',
                    cursor: 'pointer',
                    minWidth: 0,
                    pb: 0.15,
                    borderBottom: filtro === k.id ? `1.5px solid ${k.cor}` : '1.5px solid transparent',
                    '&:hover .cc-contagem-n': { opacity: 0.85 },
                  }}
                >
                  <Typography
                    className="cc-contagem-n"
                    sx={{ fontSize: '1.05rem', fontWeight: 800, color: k.n ? k.cor : CC_TEXT, lineHeight: 1 }}
                  >
                    {fmtInt(k.n)}
                  </Typography>
                  <Typography sx={{ fontSize: '0.55rem', color: CC_MUTED, fontWeight: 600, mt: 0.2 }}>
                    {k.label}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
          {!lista.length ? (
            <CcEmpty>Nenhuma loja nesse status.</CcEmpty>
          ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, minHeight: 0, overflow: 'auto' }}>
            {lista.map((l) => (
              <Box key={l.id_loja} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
                <Box
                  sx={{
                    px: 0.5,
                    height: 16,
                    borderRadius: 0.5,
                    bgcolor: `${statusCor(l.status)}22`,
                    color: statusCor(l.status),
                    fontSize: '0.52rem',
                    fontWeight: 800,
                    letterSpacing: '0.04em',
                    display: 'inline-flex',
                    alignItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  {statusTag(l.status)}
                </Box>
                <Typography
                  sx={{
                    fontSize: '0.7rem',
                    fontWeight: 650,
                    color: CC_TEXT,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {lojaCurta(l.name)}
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
