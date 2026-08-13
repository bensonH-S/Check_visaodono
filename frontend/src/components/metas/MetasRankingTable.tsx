import { useCallback, useEffect, useMemo, useState } from 'react';
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
  linhaRevDemanda,
  OPCOES_CRITICO,
  OPCOES_REV_CLASSE,
  OPCOES_REV_FAIXA,
  ordenarLinhasPorCriticoAsc,
  mesmosValoresPercentuais,
  parsePontosRanking,
  parseValorPercentual,
  rankingColunaRevRec,
  rankingDecimaisValor,
  rankingValorPercentual,
} from './metasRankingUtils';

const inputSx = {
  minWidth: 72,
  '& .MuiInputBase-input': { py: 0.65, px: 0.75, fontSize: '0.8rem', textAlign: 'right' },
} as const;

const rowDemandaSx = {
  bgcolor: 'rgba(220, 38, 38, 0.1)',
  '& td': { color: '#991b1b', borderColor: 'rgba(220, 38, 38, 0.2)' },
} as const;

type RankingPatch = {
  valor_numero?: number | null;
  valor_texto?: string | null;
  pontos?: number | null;
  classe?: string | null;
  destaque?: string | null;
  critico?: number | null;
};

function RankingLinhaValor({
  linha,
  codigo,
  podeEditar,
  demanda,
  onSalvar,
}: {
  linha: MetasRankingLinha;
  codigo: string;
  podeEditar: boolean;
  demanda: boolean;
  onSalvar: (patch: Pick<RankingPatch, 'valor_numero' | 'valor_texto'>) => void;
}) {
  const percentual = rankingValorPercentual(codigo);
  const decimais = rankingDecimaisValor(codigo);
  const [local, setLocal] = useState(() => formatValorPercentualExibicao(linha.valor_numero, linha.valor_texto, decimais));

  useEffect(() => {
    setLocal(formatValorPercentualExibicao(linha.valor_numero, linha.valor_texto, decimais));
  }, [linha.valor_numero, linha.valor_texto, decimais]);

  if (demanda) {
    return (
      <Typography component="span" variant="body2" sx={{ fontSize: '0.8rem', fontWeight: 700, color: '#991b1b' }}>
        DEMANDA
      </Typography>
    );
  }

  if (!podeEditar) {
    return (
      <Typography component="span" variant="body2" sx={{ fontSize: '0.8rem' }}>
        {percentual
          ? formatValorPercentualLeitura(linha.valor_numero, linha.valor_texto, codigo)
          : linha.valor_texto ?? (linha.valor_numero != null ? linha.valor_numero : '—')}
      </Typography>
    );
  }

  const commit = () => {
    if (percentual) {
      const parsed = parseValorPercentual(local, decimais);
      const mudouNumero = !mesmosValoresPercentuais(parsed.valor_numero, linha.valor_numero);
      const mudouTexto = (parsed.valor_texto ?? null) !== (linha.valor_texto ?? null);
      if (mudouNumero || mudouTexto) {
        onSalvar(parsed);
      }
      // Normaliza na hora (ex.: 86,00 → 86.0000 no R.E.V.), mesmo se não precisou POST.
      setLocal(formatValorPercentualExibicao(parsed.valor_numero, parsed.valor_texto, decimais));
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
          ? { endAdornment: <InputAdornment position="end" sx={{ '& p': { fontSize: '0.75rem' } }}>%</InputAdornment> }
          : undefined,
      }}
    />
  );
}

function RankingLinhaPontos({
  linha,
  podeEditar,
  demanda,
  onSalvar,
}: {
  linha: MetasRankingLinha;
  podeEditar: boolean;
  demanda: boolean;
  onSalvar: (pontos: number | null) => void;
}) {
  const [local, setLocal] = useState(linha.pontos != null ? String(linha.pontos) : '');

  useEffect(() => {
    setLocal(linha.pontos != null ? String(linha.pontos) : '');
  }, [linha.pontos]);

  if (demanda) {
    return <Typography component="span" sx={{ fontWeight: 700, color: '#991b1b' }}>—</Typography>;
  }

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

function RankingSelectColuna({
  valor,
  opcoes,
  podeEditar,
  minWidth,
  onSalvar,
}: {
  valor: string | number | null;
  opcoes: ReadonlyArray<{ value: string; label: string }>;
  podeEditar: boolean;
  minWidth?: number;
  onSalvar: (v: string | null) => void;
}) {
  const str = valor == null || valor === '' ? '' : String(valor);
  const valoresValidos = new Set(opcoes.map((op) => op.value));
  // Evita warning do MUI quando o banco tem valor fora das opções (ex.: classe com "3").
  const valorSelect = str === '' || valoresValidos.has(str) ? str : '';
  if (!podeEditar) {
    if (!str) return <>—</>;
    const label = opcoes.find((op) => op.value === str)?.label ?? str;
    return <>{label}</>;
  }
  return (
    <Select
      size="small"
      value={valorSelect}
      displayEmpty
      onChange={(e) => {
        const v = String(e.target.value);
        onSalvar(v === '' ? null : v);
      }}
      sx={{ minWidth: minWidth ?? 72, fontSize: '0.8rem', '& .MuiSelect-select': { py: 0.65 } }}
    >
      {opcoes.map((op) => (
        <MenuItem key={op.value || 'vazio'} value={op.value} sx={{ fontSize: '0.82rem' }}>
          {op.label}
        </MenuItem>
      ))}
    </Select>
  );
}

function RankingLinhaClasseTexto({
  linha,
  podeEditar,
  onSalvar,
}: {
  linha: MetasRankingLinha;
  podeEditar: boolean;
  onSalvar: (classe: string | null) => void;
}) {
  const [local, setLocal] = useState(linha.classe ?? '');

  useEffect(() => {
    setLocal(linha.classe ?? '');
  }, [linha.classe]);

  if (!podeEditar) return <>{linha.classe || '—'}</>;

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
  onSalvarLinha: (idRanking: number, patch: RankingPatch) => Promise<void>;
}) {
  const valorPercentual = rankingValorPercentual(grupo.codigo);
  const isRev = rankingColunaRevRec(grupo.codigo);
  const colunas = isRev ? 8 : 6;

  const linhasExibidas = useMemo(
    () => (isRev ? ordenarLinhasPorCriticoAsc(grupo.linhas) : grupo.linhas),
    [grupo.linhas, isRev],
  );

  const salvar = useCallback(
    (idRanking: number, patch: RankingPatch) => {
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
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            Meta mínima: {formatValorPercentualLeitura(grupo.meta_minima, null, grupo.codigo)}
          </Typography>
        )}
        {podeEditar && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
            As alterações são salvas automaticamente: ao sair do campo (Tab/clique fora), ao pressionar
            Enter ou ao escolher um valor na lista.
            {isRev && ' Loja com DEMANDA fica reprovada no R.E.V. e não contabiliza no Resumo.'}
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
                {valorPercentual
                  ? `Valor (${rankingDecimaisValor(grupo.codigo)} dec. %)`
                  : 'Valor'}
              </TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Pts</TableCell>
              {isRev ? (
                <>
                  <TableCell align="center" sx={{ fontWeight: 700 }}>Crítico</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700 }}>Faixa</TableCell>
                </>
              ) : null}
              <TableCell sx={{ fontWeight: 700 }}>{isRev ? 'REV / REC' : 'Classe'}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {linhasExibidas.map((linha) => {
              const demanda = isRev && linhaRevDemanda(linha);
              return (
                <TableRow key={linha.id_ranking} hover sx={demanda ? rowDemandaSx : undefined}>
                  <TableCell>{linha.posicao ?? '—'}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{linha.nome_loja || linha.valor_texto || '—'}</TableCell>
                  <TableCell>{linha.bk_number || '—'}</TableCell>
                  <TableCell align="right">
                    <RankingLinhaValor
                      linha={linha}
                      codigo={grupo.codigo}
                      podeEditar={podeEditar}
                      demanda={demanda}
                      onSalvar={(patch) => salvar(linha.id_ranking, patch)}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <RankingLinhaPontos
                      linha={linha}
                      podeEditar={podeEditar}
                      demanda={demanda}
                      onSalvar={(pontos) => salvar(linha.id_ranking, { pontos })}
                    />
                  </TableCell>
                  {isRev ? (
                    <>
                      <TableCell align="center">
                        <RankingSelectColuna
                          valor={linha.critico}
                          opcoes={OPCOES_CRITICO}
                          podeEditar={podeEditar}
                          minWidth={64}
                          onSalvar={(v) =>
                            salvar(linha.id_ranking, {
                              critico: v == null || v === '' ? null : Number(v),
                            })
                          }
                        />
                      </TableCell>
                      <TableCell align="center">
                        <RankingSelectColuna
                          valor={linha.destaque}
                          opcoes={OPCOES_REV_FAIXA}
                          podeEditar={podeEditar}
                          minWidth={96}
                          onSalvar={(v) =>
                            salvar(linha.id_ranking, {
                              destaque: v,
                              pontos: v?.toUpperCase() === 'DEMANDA' ? null : undefined,
                            })
                          }
                        />
                      </TableCell>
                    </>
                  ) : null}
                  <TableCell>
                    {isRev ? (
                      <RankingSelectColuna
                        valor={linha.classe}
                        opcoes={OPCOES_REV_CLASSE}
                        podeEditar={podeEditar}
                        onSalvar={(v) => salvar(linha.id_ranking, { classe: v })}
                      />
                    ) : (
                      <RankingLinhaClasseTexto
                        linha={linha}
                        podeEditar={podeEditar}
                        onSalvar={(classe) => salvar(linha.id_ranking, { classe })}
                      />
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
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
