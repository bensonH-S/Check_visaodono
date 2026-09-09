import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router-dom';
import { api } from '../../../api/client';
import { fmtBrl, lojaLabel } from './ccFormat';
import { CC_BORDER, CC_MUTED, CC_ORANGE, CC_RADIUS, CC_SURFACE, CC_TEXT, CC_WARN } from './ccTheme';
import { CcEmpty, CcSkeleton } from './CcPanel';

type Linha = { loja: string; freelancer: number; treinamento: number; total: number };

/** Dados de demonstração quando a API FreeControl está offline. */
const DEMO_TOP: Linha[] = [
  { loja: 'BURGER KING - 408 Sul', freelancer: 4820, treinamento: 960, total: 5780 },
  { loja: 'BURGER KING - Terraço', freelancer: 3910, treinamento: 720, total: 4630 },
  { loja: 'BURGER KING - ParkShopping', freelancer: 3450, treinamento: 540, total: 3990 },
  { loja: 'BURGER KING - Águas Claras', freelancer: 2880, treinamento: 410, total: 3290 },
  { loja: 'BURGER KING - Sudoeste', freelancer: 2510, treinamento: 380, total: 2890 },
];

const DEMO_TOTAIS = {
  freelancer: DEMO_TOP.reduce((s, l) => s + l.freelancer, 0),
  treinamento: DEMO_TOP.reduce((s, l) => s + l.treinamento, 0),
};

function lojaCurta(name: string) {
  return lojaLabel(name).replace(/^BURGER KING\s*[-–]\s*/i, '').trim() || name;
}

export default function CcFreecontrolGastos() {
  const [top, setTop] = useState<Linha[]>([]);
  const [temValor, setTemValor] = useState(true);
  const [totais, setTotais] = useState({ freelancer: 0, treinamento: 0 });
  const [aviso, setAviso] = useState('');
  const [usandoDemo, setUsandoDemo] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    api
      .freelancersGastosMes()
      .then((r) => {
        if (cancel) return;
        const lista = r.top ?? [];
        const indisponivel = Boolean(r.aviso) && !lista.length;
        if (indisponivel) {
          setUsandoDemo(true);
          setAviso(r.aviso || 'FreeControl indisponível — exibindo demonstração.');
          setTemValor(true);
          setTotais(DEMO_TOTAIS);
          setTop(DEMO_TOP);
        } else {
          setUsandoDemo(false);
          setAviso(r.aviso || '');
          setTemValor(Boolean(r.tem_valor));
          setTotais({
            freelancer: r.totais?.freelancer ?? 0,
            treinamento: r.totais?.treinamento ?? 0,
          });
          setTop(lista);
        }
        setLoading(false);
      })
      .catch((e) => {
        if (cancel) return;
        setUsandoDemo(true);
        setAviso(e?.message || 'FreeControl indisponível — exibindo demonstração.');
        setTemValor(true);
        setTotais(DEMO_TOTAIS);
        setTop(DEMO_TOP);
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Typography sx={{ fontSize: '0.72rem', fontWeight: 750, letterSpacing: '0.06em', color: CC_TEXT }}>
              FREECONTROL
            </Typography>
            {usandoDemo && (
              <Box
                sx={{
                  px: 0.65,
                  height: 16,
                  borderRadius: 999,
                  bgcolor: 'rgba(27, 42, 107, 0.12)',
                  color: CC_ORANGE,
                  fontSize: '0.55rem',
                  fontWeight: 750,
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
              >
                DEMO
              </Box>
            )}
          </Box>
          <Typography sx={{ fontSize: '0.6875rem', color: 'var(--ga-text-secondary)', mt: 0.15 }}>
            {usandoDemo ? 'Demonstração · integração offline' : 'Realizado no mês até hoje'}
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
      ) : !top.length ? (
        <CcEmpty>{aviso || 'Nenhum turno no mês.'}</CcEmpty>
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
                <Box
                  sx={{
                    height: 4,
                    borderRadius: 4,
                    bgcolor: 'var(--ga-canvas-alt)',
                    overflow: 'hidden',
                    display: 'flex',
                  }}
                >
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
