import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router-dom';
import { api } from '../../../api/client';
import { fmtBrl, lojaLabel } from './ccFormat';
import { CC_BORDER, CC_MUTED, CC_ORANGE, CC_RADIUS, CC_SURFACE, CC_TEXT, CC_WARN } from './ccTheme';
import { CcEmpty, CcSkeleton } from './CcPanel';

type Linha = { loja: string; freelancer: number; treinamento: number; total: number };

function lojaCurta(name: string) {
  return lojaLabel(name).replace(/^BURGER KING\s*[-–]\s*/i, '').trim() || name;
}

export default function CcFreecontrolGastos() {
  const [top, setTop] = useState<Linha[]>([]);
  const [temValor, setTemValor] = useState(true);
  const [totais, setTotais] = useState({ freelancer: 0, treinamento: 0 });
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    api
      .freelancersGastosMes()
      .then((r) => {
        if (cancel) return;
        setErr(r.aviso || '');
        setTemValor(Boolean(r.tem_valor));
        setTotais({
          freelancer: r.totais?.freelancer ?? 0,
          treinamento: r.totais?.treinamento ?? 0,
        });
        setTop(r.top ?? []);
        setLoading(false);
      })
      .catch((e) => {
        if (cancel) return;
        setErr(e?.message || 'Sem acesso ao FreeControl.');
        setTop([]);
        setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, []);

  const fmt = (n: number) => (temValor ? fmtBrl(n) : `${Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h`);
  const maxBar = Math.max(1, ...top.map((l) => l.total));

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
            FREECONTROL
          </Typography>
          <Typography sx={{ fontSize: '0.6875rem', color: 'var(--ga-text-secondary)', mt: 0.15 }}>
            Realizado no mês até hoje
          </Typography>
        </Box>
        <Typography
          component={RouterLink}
          to="/freelancers/aprovacao/mobile"
          sx={{
            fontSize: '0.6875rem',
            fontWeight: 600,
            color: CC_ORANGE,
            textDecoration: 'none',
            whiteSpace: 'nowrap',
            '&:hover': { textDecoration: 'underline' },
          }}
        >
          Ver turnos
        </Typography>
      </Box>

      {loading ? (
        <CcSkeleton height={120} />
      ) : err && !top.length ? (
        <Typography sx={{ fontSize: '0.75rem', color: 'var(--ga-text-secondary)', py: 1.5 }}>{err}</Typography>
      ) : !top.length ? (
        <CcEmpty>Nenhum turno no mês.</CcEmpty>
      ) : (
        <>
          <Box sx={{ display: 'flex', gap: 1.25, mb: 0.85, flexShrink: 0, alignItems: 'flex-end' }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: '1.05rem', fontWeight: 800, color: CC_ORANGE, lineHeight: 1 }}>
                {fmt(totais.freelancer + totais.treinamento)}
              </Typography>
              <Typography sx={{ fontSize: '0.55rem', color: CC_MUTED, fontWeight: 600, mt: 0.2 }}>
                realizado até hoje
              </Typography>
            </Box>
            <Box sx={{ width: '1px', bgcolor: CC_BORDER, my: 0.15, alignSelf: 'stretch' }} />
            <Box>
              <Typography sx={{ fontSize: '0.8rem', fontWeight: 750, color: CC_TEXT, lineHeight: 1 }}>
                {fmt(totais.freelancer)}
              </Typography>
              <Typography sx={{ fontSize: '0.55rem', color: CC_MUTED, fontWeight: 600, mt: 0.2 }}>freelancer</Typography>
            </Box>
            <Box>
              <Typography sx={{ fontSize: '0.8rem', fontWeight: 750, color: CC_WARN, lineHeight: 1 }}>
                {fmt(totais.treinamento)}
              </Typography>
              <Typography sx={{ fontSize: '0.55rem', color: CC_MUTED, fontWeight: 600, mt: 0.2 }}>treinamento</Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.55, minHeight: 0, overflow: 'auto' }}>
            {top.map((l) => (
              <Box key={l.loja} sx={{ minWidth: 0 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mb: 0.2 }}>
                  <Typography
                    sx={{
                      fontSize: '0.68rem',
                      color: CC_TEXT,
                      fontWeight: 650,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {lojaCurta(l.loja)}
                  </Typography>
                  <Typography sx={{ fontSize: '0.68rem', fontWeight: 750, color: CC_TEXT, flexShrink: 0 }}>
                    {fmt(l.total)}
                  </Typography>
                </Box>
                <Box sx={{ height: 4, borderRadius: 4, bgcolor: 'rgba(255,255,255,0.06)', overflow: 'hidden', display: 'flex' }}>
                  <Box sx={{ width: `${(l.freelancer / maxBar) * 100}%`, height: '100%', bgcolor: CC_ORANGE }} />
                  <Box sx={{ width: `${(l.treinamento / maxBar) * 100}%`, height: '100%', bgcolor: CC_WARN }} />
                </Box>
              </Box>
            ))}
          </Box>
        </>
      )}
    </Box>
  );
}
