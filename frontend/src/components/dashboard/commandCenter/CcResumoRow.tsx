import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router-dom';
import type { ResumoFinanceiro } from '../../../financeiro/api';
import { fmtBrl, fmtInt } from './ccFormat';

function Resumo({
  rotulo,
  valor,
  detalhe,
  alerta = false,
  to,
}: {
  rotulo: string;
  valor: string;
  detalhe: string;
  alerta?: boolean;
  to?: string;
}) {
  return (
    <Paper
      variant="outlined"
      component={to ? RouterLink : 'div'}
      {...(to ? { to } : {})}
      sx={{
        px: 1.25,
        py: 0.7,
        minWidth: 120,
        flex: 1,
        display: 'block',
        textDecoration: 'none',
        color: 'inherit',
        ...(to ? { '&:hover': { borderColor: 'primary.main' } } : {}),
        ...(alerta ? { borderColor: '#EF4444', bgcolor: 'rgba(239,68,68,0.06)' } : {}),
      }}
    >
      <Typography sx={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: alerta ? 'error.main' : 'text.secondary' }}>
        {rotulo}
      </Typography>
      <Typography sx={{ fontSize: 15, fontWeight: 650, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', lineHeight: 1.15, color: alerta ? 'error.main' : 'inherit' }}>
        {valor}
      </Typography>
      <Typography sx={{ fontSize: 11, color: alerta ? 'error.main' : 'text.secondary' }}>{detalhe}</Typography>
    </Paper>
  );
}

/** Linha de resumo: mesmos tiles de Contas a pagar, mais o estoque. */
export default function CcResumoRow({
  fin,
  valorEstoque,
  loading,
  podeFinanceiro,
}: {
  fin: ResumoFinanceiro | null;
  valorEstoque: number | null;
  loading: boolean;
  podeFinanceiro: boolean;
}) {
  if (loading) {
    return (
      <Stack direction="row" spacing={1}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={54} sx={{ flex: 1 }} />
        ))}
      </Stack>
    );
  }

  const ok = podeFinanceiro && fin;
  const semAcesso = podeFinanceiro ? 'financeiro indisponível' : 'sem acesso ao financeiro';

  return (
    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
      <Resumo rotulo="A pagar" valor={ok ? fmtBrl(fin.a_pagar) : '—'} detalhe={ok ? `${fmtInt(fin.qtd_abertas)} em aberto` : semAcesso} to="/financeiro" />
      <Resumo rotulo="Para autorizar" valor={ok ? fmtBrl(fin.para_autorizar) : '—'} detalhe={ok ? `${fmtInt(fin.qtd_autorizar)} aguardando o Felipe` : semAcesso} to="/financeiro" />
      <Resumo rotulo="Vencida" valor={ok ? fmtBrl(fin.vencida) : '—'} detalhe={ok ? `${fmtInt(fin.qtd_vencidas)} sem pagar` : semAcesso} alerta={!!ok && fin.vencida > 0} to="/financeiro" />
      <Resumo rotulo="Pago" valor={ok ? fmtBrl(fin.pago) : '—'} detalhe={ok ? 'já baixadas' : semAcesso} />
      <Resumo rotulo="Estoque da rede" valor={fmtBrl(valorEstoque)} detalhe="valor atual" to="/estoque" />
    </Stack>
  );
}
