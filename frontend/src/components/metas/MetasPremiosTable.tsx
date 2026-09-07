import { useEffect, useMemo, useState } from 'react';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type { MetasPremio } from '../../api/client';
import { tableContainerSx, tablePaperSx, tableSx } from '../../utils/tablePageLayout';
import { colors } from '../../theme/tokens';

function fmtBrl(valor: number | null | undefined) {
  if (valor == null) return '—';
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function PremiosContagemInput({
  valor,
  podeEditar,
  onSalvar,
}: {
  valor: number | null;
  podeEditar: boolean;
  onSalvar: (n: number) => void;
}) {
  const [local, setLocal] = useState(valor != null ? String(valor) : '0');

  useEffect(() => {
    setLocal(valor != null ? String(valor) : '0');
  }, [valor]);

  if (!podeEditar) return <>{valor ?? 0}</>;

  return (
    <TextField
      size="small"
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        const n = Number(String(local).replace(',', '.'));
        const limpo = Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
        setLocal(String(limpo));
        if (limpo !== (valor ?? 0)) onSalvar(limpo);
      }}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      sx={{
        width: 72,
        '& .MuiInputBase-input': { py: 0.65, px: 0.75, fontSize: '0.85rem', textAlign: 'center' },
      }}
      slotProps={{ input: { inputMode: 'numeric' } }}
    />
  );
}

export default function MetasPremiosTable({
  premios,
  podeEditar,
  onSalvar,
}: {
  premios: MetasPremio[];
  podeEditar: boolean;
  onSalvar: (idPremio: number, patch: { premio_saude?: number; premio_rev?: number }) => Promise<void>;
}) {
  const totalGeral = useMemo(
    () => premios.reduce((acc, p) => acc + (Number(p.total) || 0), 0),
    [premios],
  );
  const subtotalGeral = useMemo(
    () => premios.reduce((acc, p) => acc + (Number(p.subtotal) || 0), 0),
    [premios],
  );

  return (
    <Paper sx={{ ...tablePaperSx }}>
      {podeEditar && (
        <Typography variant="body2" sx={{ color: colors.textSecondary, px: 2, pt: 1.5 }}>
          O valor unitário é fixo por colaborador. Informe quantas metas de Saúde e R.E.V. foram batidas.
          Subtotal (Saúde × Valor) e Total ((Saúde + R.E.V.) × Valor) calculam automaticamente e salvam ao
          sair do campo.
        </Typography>
      )}
      <TableContainer sx={tableContainerSx}>
        <Table size="small" sx={tableSx}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Colaborador</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Saúde</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>R.E.V.</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>Valor</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>Subtotal</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>Total</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {premios.map((p) => (
              <TableRow key={p.id_premio} hover>
                <TableCell sx={{ fontWeight: 600 }}>{p.nome}</TableCell>
                <TableCell align="center">
                  <PremiosContagemInput
                    valor={p.premio_saude}
                    podeEditar={podeEditar}
                    onSalvar={(n) => void onSalvar(p.id_premio, { premio_saude: n })}
                  />
                </TableCell>
                <TableCell align="center">
                  <PremiosContagemInput
                    valor={p.premio_rev}
                    podeEditar={podeEditar}
                    onSalvar={(n) => void onSalvar(p.id_premio, { premio_rev: n })}
                  />
                </TableCell>
                <TableCell align="right">{fmtBrl(p.valor_unitario)}</TableCell>
                <TableCell align="right">{fmtBrl(p.subtotal)}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>
                  {fmtBrl(p.total)}
                </TableCell>
              </TableRow>
            ))}
            {premios.length > 0 && (
              <TableRow
                sx={{
                  bgcolor: 'rgba(22, 163, 74, 0.06)',
                  '& td': { fontWeight: 700, borderTop: `2px solid ${colors.border}` },
                }}
              >
                <TableCell colSpan={4}>Total geral</TableCell>
                <TableCell align="right">{fmtBrl(subtotalGeral)}</TableCell>
                <TableCell align="right">{fmtBrl(totalGeral)}</TableCell>
              </TableRow>
            )}
            {!premios.length && (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                  <Typography color="text.secondary">Nenhum prêmio cadastrado neste período.</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
