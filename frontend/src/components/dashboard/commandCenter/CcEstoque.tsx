import { useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router-dom';
import { api } from '../../../api/client';
import { fmtBrl, fmtInt, lojaLabel } from './ccFormat';
import { CC_BORDER, CC_CRITICO, CC_MUTED, CC_ORANGE, CC_RADIUS, CC_SURFACE, CC_TEXT, CC_WARN } from './ccTheme';
import { CcEmpty, CcSkeleton } from './CcPanel';

type ItemZerado = {
  id_loja: number;
  loja: string;
  codigo: string;
};

function lojaCurta(name: string) {
  return lojaLabel(name).replace(/^BURGER KING\s*[-–]\s*/i, '').trim() || name;
}

/** Estoque — zerados / baixa por loja. */
export default function CcEstoque() {
  const [zerados, setZerados] = useState<ItemZerado[]>([]);
  const [problemas, setProblemas] = useState(0);
  const [valorAtual, setValorAtual] = useState<number | null>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    Promise.all([
      api.estoqueSaldosRedeBaixo().catch(() => null),
      api.estoqueSaudeBaixa({ escopo: 'rede' }).catch(() => null),
      api.estoqueSaldosRedeValor().catch(() => null),
    ]).then(([baixo, saude, valor]) => {
      if (cancel) return;
      if (!baixo && !saude && !valor) {
        setErr('Sem acesso ao estoque da rede.');
        setZerados([]);
        setProblemas(0);
        setValorAtual(null);
        setLoading(false);
        return;
      }
      setErr('');
      setZerados((baixo?.itens ?? []) as ItemZerado[]);
      setProblemas(saude?.problemas?.length ?? 0);
      setValorAtual(valor?.valor_atual ?? null);
      setLoading(false);
    });
    return () => {
      cancel = true;
    };
  }, []);

  const porLoja = useMemo(() => {
    const map = new Map<number, { loja: string; n: number }>();
    for (const z of zerados) {
      const cur = map.get(z.id_loja) || { loja: lojaCurta(z.loja), n: 0 };
      cur.n += 1;
      map.set(z.id_loja, cur);
    }
    return [...map.values()].sort((a, b) => b.n - a.n).slice(0, 6);
  }, [zerados]);

  const maxZerados = Math.max(1, ...porLoja.map((l) => l.n));

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
            ESTOQUE
          </Typography>
          <Typography sx={{ fontSize: '0.625rem', color: 'var(--ga-text-secondary)', mt: 0.1 }}>
            {fmtBrl(valorAtual)} na rede
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
        <CcSkeleton height={100} />
      ) : err ? (
        <CcEmpty>{err}</CcEmpty>
      ) : (
        <>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.5, mb: 0.75, flexShrink: 0 }}>
            <Box
              sx={{
                px: 0.85,
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
                Zerados
              </Typography>
              <Typography
                sx={{
                  fontSize: '0.95rem',
                  fontWeight: 750,
                  color: zerados.length > 0 ? CC_CRITICO : CC_TEXT,
                  lineHeight: 1,
                }}
              >
                {fmtInt(zerados.length)}
              </Typography>
            </Box>
            <Box
              sx={{
                px: 0.85,
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
                Baixa
              </Typography>
              <Typography
                sx={{
                  fontSize: '0.95rem',
                  fontWeight: 750,
                  color: problemas > 0 ? CC_WARN : CC_TEXT,
                  lineHeight: 1,
                }}
              >
                {fmtInt(problemas)}
              </Typography>
            </Box>
          </Box>

          {!porLoja.length ? (
            <CcEmpty>
              {problemas > 0 ? `${fmtInt(problemas)} em baixa, sem SKU zerado.` : 'Nenhum SKU zerado agora.'}
            </CcEmpty>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.4, minHeight: 0, overflow: 'auto', flex: 1 }}>
              {porLoja.map((l) => (
                <Box key={l.loja} sx={{ display: 'flex', alignItems: 'center', gap: 0.65, minWidth: 0 }}>
                  <Typography
                    sx={{
                      width: 70,
                      flexShrink: 0,
                      fontSize: '0.6rem',
                      fontWeight: 600,
                      color: CC_TEXT,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {l.loja}
                  </Typography>
                  <Box
                    sx={{
                      flex: 1,
                      height: 4,
                      borderRadius: 4,
                      bgcolor: 'var(--ga-canvas-alt)',
                      overflow: 'hidden',
                      minWidth: 0,
                    }}
                  >
                    <Box
                      sx={{
                        width: `${(l.n / maxZerados) * 100}%`,
                        height: '100%',
                        borderRadius: 4,
                        bgcolor: CC_ORANGE,
                        opacity: 0.55 + (l.n / maxZerados) * 0.45,
                      }}
                    />
                  </Box>
                  <Typography
                    sx={{
                      fontSize: '0.6rem',
                      fontWeight: 700,
                      color: CC_TEXT,
                      width: 20,
                      textAlign: 'right',
                      flexShrink: 0,
                    }}
                  >
                    {fmtInt(l.n)}
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
