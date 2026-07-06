import { useCallback, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type { MetasRankingGrupo, MetasRankingLinha } from '../../api/client';
import { tableContainerSx, tablePaperSx, tableSx } from '../../utils/tablePageLayout';
import { colors } from '../../theme/tokens';
import {
  formatValorPercentualExibicao,
  formatValorPercentualLeitura,
  OPCOES_REV_CLASSE,
  parsePontosRanking,
  parseValorPercentual,
  rankingColunaRevRec,
  rankingValorPercentual,
} from './metasRankingUtils';

const inputSx = {
  minWidth: 72,
  '& .MuiInputBase-input': { py: 0.65, px: 0.75, fontSize: '0.8rem', textAlign: 'right' },
} as const;

function RankingLinhaValor({
  linha,
  codigo,
  podeEditar,
  onSalvar,
}: {
  linha: MetasRankingLinha;
  codigo: string;
  podeEditar: boolean;
  onSalvar: (patch: Partial<Pick<MetasRankingLinha, 'valor_numero' | 'valor_texto'>>) => void;
}) {
  const percentual = rankingValorPercentual(codigo);
  const [local, setLocal] = useState(() => formatValorPercentualExibicao(linha.valor_numero, linha.valor_texto));

  useEffect(() => {
    setLocal(formatValorPercentualExibicao(linha.valor_numero, linha.valor_texto));
  }, [linha.valor_numero, linha.valor_texto]);

  if (!podeEditar) {
    return (
      <Typography component="span" variant="body2" sx={{ fontSize: '0.8rem' }}>
        {percentual
          ? formatValorPercentualLeitura(linha.valor_numero, linha.valor_texto)
          : linha.valor_texto ?? (linha.valor_numero != null ? linha.valor_numero : '—')}
      </Typography>
    );
  }

  const commit = () => {
    if (percentual || linha.valor_texto === 'DEMANDA') {
      const parsed = parseValorPercentual(local);
      if (
        parsed.valor_numero !== linha.valor_numero ||
        parsed.valor_texto !== linha.valor_texto
      ) {
        onSalvar(parsed);
      }
      return;
    }
    const n = Number(local.replace(',', '.'));
    onSalvar({
      valor_numero: Number.isNaN(n) ? null : n,
      valor_texto: Number.isNaN(n) ? local || null : null,
    });
  };

  return (
    <TextField
      size="small"
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      sx={inputSx}
      slotProps={{
        input: percentual
          ? {
              endAdornment: linha.valor_texto !== 'DEMANDA' ? (
                <InputAdornment position="end" sx={{ '& p': { fontSize: '0.75rem' } }}>
                  %
                </InputAdornment>
              ) : undefined,
            }
          : undefined,
      }}
    />
  );
}

function RankingLinhaPontos({
  linha,
  podeEditar,
  onSalvar,
}: {
  linha: MetasRankingLinha;
  podeEditar: boolean;
  onSalvar: (pontos: number | null) => void;
}) {
  const [local, setLocal] = useState(linha.pontos != null ? String(linha.pontos) : '');

  useEffect(() => {
    setLocal(linha.pontos != null ? String(linha.pontos) : '');
  }, [linha.pontos]);

  if (!podeEditar) {
    return <>{linha.pontos ?? '—'}</>;
  }

  return (
    <TextField
      size="small"
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        const n = parsePontosRanking(local);
        if (n !== linha.pontos) onSalvar(n);
      }}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      sx={{ ...inputSx, '& .MuiInputBase-input': { ...inputSx['& .MuiInputBase-input'], textAlign: 'center' } }}
      slotProps={{ input: { inputMode: 'numeric' } }}
    />
  );
}

function RankingLinhaClasse({
  linha,
  codigo,
  podeEditar,
  onSalvar,
}: {
  linha: MetasRankingLinha;
  codigo: string;
  podeEditar: boolean;
  onSalvar: (classe: string | null) => void;
}) {
  const revRec = rankingColunaRevRec(codigo);
  const [local, setLocal] = useState(linha.classe ?? '');

  useEffect(() => {
    setLocal(linha.classe ?? '');
  }, [linha.classe]);

  if (!podeEditar) {
    return <>{linha.classe || '—'}</>;
  }

  if (revRec) {
    return (
      <Select
        size="small"
        value={local}
        displayEmpty
        onChange={(e) => {
          const v = String(e.target.value);
          setLocal(v);
          const classe = v || null;
          if (classe !== linha.classe) onSalvar(classe);
        }}
        sx={{ minWidth: 88, fontSize: '0.8rem', '& .MuiSelect-select': { py: 0.65 } }}
      >
        {OPCOES_REV_CLASSE.map((op) => (
          <MenuItem key={op.value || 'vazio'} value={op.value} sx={{ fontSize: '0.82rem' }}>
            {op.label}
          </MenuItem>
        ))}
      </Select>
    );
  }

  return (
    <TextField
      size="small"
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        const classe = local.trim() || null;
        if (classe !== linha.classe) onSalvar(classe);
      }}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      sx={{ ...inputSx, minWidth: 96, '& .MuiInputBase-input': { ...inputSx['& .MuiInputBase-input'], textAlign: 'left' } }}
    />
  );
}

export default function MetasRankingTable({
  grupo,
  podeEditar,
  onSalvarLinha,
}: {
  grupo: MetasRankingGrupo;
  podeEditar: boolean;
  onSalvarLinha: (
    idRanking: number,
    patch: {
      valor_numero?: number | null;
      valor_texto?: string | null;
      pontos?: number | null;
      classe?: string | null;
    },
  ) => Promise<void>;
}) {
  const valorPercentual = rankingValorPercentual(grupo.codigo);
  const colRevRec = rankingColunaRevRec(grupo.codigo);
  const colunas = 6;

  const salvar = useCallback(
    (idRanking: number, patch: Parameters<typeof onSalvarLinha>[1]) => {
      void onSalvarLinha(idRanking, patch);
    },
    [onSalvarLinha],
  );

  return (
    <Paper sx={{ ...tablePaperSx, mb: 2 }}>
      <Box sx={{ px: 2, py: 1.5, borderBottom: `1px solid ${colors.border}` }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          {grupo.nome}
        </Typography>
        {grupo.meta_minima != null && (
          <Typography variant="caption" color="text.secondary">
            Meta mínima: {formatValorPercentualLeitura(grupo.meta_minima, null)}
          </Typography>
        )}
      </Box>
      <TableContainer sx={tableContainerSx}>
        <Table size="small" sx={tableSx}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, width: 48 }}>Pos</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Loja</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>BKN</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>
                {valorPercentual ? 'Valor (%)' : 'Valor'}
              </TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Pts</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>{colRevRec ? 'REV / REC_' : 'Classe'}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {grupo.linhas.map((linha) => (
              <TableRow key={linha.id_ranking} hover>
                <TableCell>{linha.posicao ?? '—'}</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{linha.nome_loja || linha.valor_texto || '—'}</TableCell>
                <TableCell>{linha.bk_number || '—'}</TableCell>
                <TableCell align="right">
                  <RankingLinhaValor
                    linha={linha}
                    codigo={grupo.codigo}
                    podeEditar={podeEditar}
                    onSalvar={(patch) => salvar(linha.id_ranking, patch)}
                  />
                </TableCell>
                <TableCell align="center">
                  <RankingLinhaPontos
                    linha={linha}
                    podeEditar={podeEditar}
                    onSalvar={(pontos) => salvar(linha.id_ranking, { pontos })}
                  />
                </TableCell>
                <TableCell>
                  <RankingLinhaClasse
                    linha={linha}
                    codigo={grupo.codigo}
                    podeEditar={podeEditar}
                    onSalvar={(classe) => salvar(linha.id_ranking, { classe })}
                  />
                </TableCell>
              </TableRow>
            ))}
            {!grupo.linhas.length && (
              <TableRow>
                <TableCell colSpan={colunas} align="center" sx={{ py: 3 }}>
                  <Typography color="text.secondary">Sem dados neste ranking.</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
