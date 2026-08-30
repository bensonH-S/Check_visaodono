import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import { api, type EstoquePilotoAuditoriaItem } from '../../api/client';
import { showToast } from '../../utils/toast';
import { tableContainerSx, tablePaperSx, tableSx } from '../../utils/tablePageLayout';
import { colors } from '../../theme/tokens';

const CODIGOS_FOCO = new Set(['35619', '021403', '21403', '35622', '21317', '28582']);

function fmtNum(v: number | null | undefined, d = 4) {
  if (v == null || Number.isNaN(Number(v))) return '—';
  return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: d });
}

function corStatus(status: string) {
  if (status === 'MOVIMENTO_GERADO') return { bg: 'rgba(18, 120, 70, 0.12)', fg: '#127846' };
  if (status === 'FORA_DO_PILOTO') return { bg: 'rgba(100, 116, 139, 0.12)', fg: '#475569' };
  return { bg: 'rgba(180, 35, 24, 0.1)', fg: '#B42318' };
}

export default function EstoquePilotoAuditoriaPanel({
  idLoja,
  onSetHeaderActions,
}: {
  idLoja: number;
  onSetHeaderActions?: (node: ReactNode) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [baixando, setBaixando] = useState(false);
  const [itens, setItens] = useState<EstoquePilotoAuditoriaItem[]>([]);
  const [filtro, setFiltro] = useState<'todos' | 'foco' | 'movimento' | 'pendente'>('foco');

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.estoquePilotoAuditoria(idLoja, { limit: 400 });
      setItens(r.itens || []);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao carregar auditoria', 'error');
    } finally {
      setLoading(false);
    }
  }, [idLoja]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const baixar = useCallback(async () => {
    setBaixando(true);
    try {
      await api.estoqueBaixarPilotoAuditoria(idLoja);
      showToast('Planilha baixada', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao baixar Excel', 'error');
    } finally {
      setBaixando(false);
    }
  }, [idLoja]);

  useEffect(() => {
    onSetHeaderActions?.(
      <Box sx={{ display: 'flex', gap: 0.5 }}>
        <IconButton size="small" aria-label="Atualizar auditoria" onClick={() => void carregar()}>
          <RefreshIcon sx={{ fontSize: 18 }} />
        </IconButton>
        <IconButton
          size="small"
          aria-label="Baixar Excel"
          disabled={baixando}
          onClick={() => void baixar()}
        >
          <FileDownloadOutlinedIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>,
    );
    return () => onSetHeaderActions?.(null);
  }, [carregar, baixar, baixando, onSetHeaderActions]);

  const visiveis = useMemo(() => {
    if (filtro === 'movimento') return itens.filter((i) => i.status === 'MOVIMENTO_GERADO');
    if (filtro === 'pendente') return itens.filter((i) => i.status === 'CONVERSAO_NAO_VALIDADA');
    if (filtro === 'foco') {
      return itens.filter((i) => CODIGOS_FOCO.has(String(i.codigo_insumo || i.codigo_ficha || '')));
    }
    return itens;
  }, [itens, filtro]);

  const resumo = useMemo(() => {
    const n = (s: string) => itens.filter((i) => i.status === s).length;
    return {
      mov: n('MOVIMENTO_GERADO'),
      fora: n('FORA_DO_PILOTO'),
      conv: n('CONVERSAO_NAO_VALIDADA'),
    };
  }, [itens]);

  if (loading && !itens.length) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, flex: 1, minHeight: 0 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        <Typography sx={{ fontSize: '0.8rem', color: colors.textSecondary, maxWidth: 640 }}>
          Auditoria temporária do piloto de baixa. Valide cheddar 35619, carne Whopper 021403 e bacon
          nas primeiras vendas. Depois expandimos para as demais lojas.
        </Typography>
        <Button
          size="small"
          variant="contained"
          startIcon={<FileDownloadOutlinedIcon />}
          disabled={baixando}
          onClick={() => void baixar()}
          sx={{ textTransform: 'none', fontWeight: 700 }}
        >
          {baixando ? 'Gerando…' : 'Baixar Excel'}
        </Button>
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
        <Chip
          size="small"
          label={`${resumo.mov} movimento`}
          sx={{ height: 22, fontSize: '0.7rem', fontWeight: 700, bgcolor: corStatus('MOVIMENTO_GERADO').bg, color: corStatus('MOVIMENTO_GERADO').fg }}
        />
        <Chip
          size="small"
          label={`${resumo.conv} conversão pendente`}
          sx={{ height: 22, fontSize: '0.7rem', fontWeight: 700, bgcolor: corStatus('CONVERSAO_NAO_VALIDADA').bg, color: corStatus('CONVERSAO_NAO_VALIDADA').fg }}
        />
        <Chip
          size="small"
          label={`${resumo.fora} fora do piloto`}
          sx={{ height: 22, fontSize: '0.7rem', fontWeight: 700, bgcolor: corStatus('FORA_DO_PILOTO').bg, color: corStatus('FORA_DO_PILOTO').fg }}
        />
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
        {(
          [
            ['foco', 'Cheddar / carne / bacon'],
            ['movimento', 'Só movimentos'],
            ['pendente', 'Conversão pendente'],
            ['todos', 'Todos os componentes'],
          ] as const
        ).map(([id, label]) => (
          <Chip
            key={id}
            size="small"
            label={label}
            onClick={() => setFiltro(id)}
            variant={filtro === id ? 'filled' : 'outlined'}
            sx={{ height: 24, fontSize: '0.72rem', fontWeight: filtro === id ? 700 : 500 }}
          />
        ))}
      </Box>
      {!visiveis.length ? (
        <Typography sx={{ color: colors.textMuted, fontSize: '0.85rem', py: 3 }}>
          Ainda não há linhas de auditoria. Elas aparecem na próxima sincronização de vendas desta loja.
        </Typography>
      ) : (
        <TableContainer sx={{ ...tableContainerSx, ...tablePaperSx, flex: 1 }}>
          <Table stickyHeader size="small" sx={tableSx}>
            <TableHead>
              <TableRow>
                {[
                  'Status',
                  'Venda',
                  'Produto',
                  'Qtde vendida',
                  'Insumo',
                  'Receita',
                  'Estoque',
                  'Fator',
                  'Consumo un.',
                  'Delta',
                  'Saldo antes',
                  'Saldo depois',
                ].map((h) => (
                  <TableCell key={h} sx={{ fontWeight: 700, fontSize: '0.68rem', color: colors.textSecondary }}>
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {visiveis.map((r) => {
                const st = corStatus(r.status);
                return (
                  <TableRow key={r.id_auditoria} hover>
                    <TableCell>
                      <Chip
                        size="small"
                        label={r.status}
                        sx={{ height: 20, fontSize: '0.62rem', fontWeight: 700, bgcolor: st.bg, color: st.fg }}
                      />
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                      {r.data_venda || '—'}
                      {r.id_venda ? ` #${r.id_venda}` : ''}
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.75rem' }}>
                      {r.codigo_produto} {r.descricao_produto || ''}
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.75rem' }}>{fmtNum(r.quantidade_vendida, 2)}</TableCell>
                    <TableCell sx={{ fontSize: '0.75rem' }}>
                      {r.codigo_insumo || r.codigo_ficha} {r.descricao_insumo || ''}
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                      {fmtNum(r.quantidade_receita, 4)} {r.unidade_receita || ''}
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.75rem' }}>{r.unidade_estoque || '—'}</TableCell>
                    <TableCell sx={{ fontSize: '0.75rem' }}>{fmtNum(r.fator_aplicado, 6)}</TableCell>
                    <TableCell sx={{ fontSize: '0.75rem' }}>{fmtNum(r.consumo_unitario, 6)}</TableCell>
                    <TableCell sx={{ fontSize: '0.75rem', fontWeight: 700 }}>{fmtNum(r.delta, 6)}</TableCell>
                    <TableCell sx={{ fontSize: '0.75rem' }}>{fmtNum(r.saldo_antes, 4)}</TableCell>
                    <TableCell sx={{ fontSize: '0.75rem' }}>{fmtNum(r.saldo_depois, 4)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
