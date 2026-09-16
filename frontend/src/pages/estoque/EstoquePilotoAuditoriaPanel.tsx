import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import { api, type EstoqueSaudeBaixa } from '../../api/client';
import { showToast } from '../../utils/toast';
import { tableContainerSx, tablePaperSx, tableSx } from '../../utils/tablePageLayout';
import { colors } from '../../theme/tokens';

type ListaAbaixo = 'insumos' | 'vendas' | 'desperdicio';

const MOTIVO: Record<string, string> = {
  INSUMO_NAO_CADASTRADO: 'Não está no cadastro da loja',
  CONVERSAO_NAO_VALIDADA: 'Unidade da receita não bate com o estoque',
  CONVERSAO_BLOQUEADA: 'Conversão bloqueada',
  QUANTIDADE_INVALIDA: 'Quantidade estranha na receita',
  FORA_PILOTO: 'Item ainda fora do teste',
};

const thSx = {
  color: colors.textSecondary,
  bgcolor: `${colors.canvasAlt} !important`,
  borderBottom: `1px solid ${colors.border}`,
  fontWeight: 700,
  fontSize: '0.8rem',
  letterSpacing: '0.04em',
  textTransform: 'uppercase' as const,
  py: 1.15,
} as const;

function tituloItemBaixa(raw?: string | null) {
  const s = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  return s
    .toLowerCase()
    .replace(/\b([a-z0-9][a-z0-9']*)/g, (word) => word.charAt(0).toUpperCase() + word.slice(1));
}

function fmtPeriodo(v: string | null | undefined) {
  if (!v) return '—';
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
    }).format(new Date(v));
  } catch {
    return String(v);
  }
}

function fmtDia(v: string | null | undefined) {
  const iso = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}`;
  return fmtPeriodo(v);
}

function fraseErroVenda(texto: string | null | undefined) {
  const t = String(texto || '').toLowerCase();
  if (t.includes('ficha')) return 'Produto vendido sem receita';
  if (t.includes('convers')) return 'Unidade da receita não bate com o estoque';
  if (t.includes('cadastr')) return 'Insumo sem cadastro na loja';
  return texto || 'Não conseguiu baixar o estoque';
}

function rotuloBreak(tipo: string | null | undefined) {
  const t = String(tipo || '');
  if (t.includes('desperdicio_completo')) return 'Desperdício completo';
  if (t.includes('desperdicio')) return 'Desperdício incompleto';
  if (t.includes('emprestimo')) return 'Empréstimo';
  if (t.includes('refeicao') || t.includes('break')) return 'Break';
  return t || 'Lançamento';
}

export default function EstoquePilotoAuditoriaPanel({
  idLoja,
  onSetHeaderActions,
  onIrFichas,
}: {
  idLoja: number;
  onSetHeaderActions?: (node: ReactNode) => void;
  onIrFichas?: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [baixando, setBaixando] = useState(false);
  const [escopo, setEscopo] = useState<'loja' | 'rede'>('loja');
  const [lista, setLista] = useState<ListaAbaixo>('insumos');
  const [data, setData] = useState<EstoqueSaudeBaixa | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.estoqueSaudeBaixa({
        idLoja: escopo === 'loja' ? idLoja : undefined,
        escopo,
      });
      setData(r);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao carregar a baixa', 'error');
    } finally {
      setLoading(false);
    }
  }, [idLoja, escopo]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const baixar = useCallback(async () => {
    setBaixando(true);
    try {
      await api.estoqueBaixarSaudeBaixa({
        idLoja: escopo === 'loja' ? idLoja : undefined,
        escopo,
      });
      showToast('Planilha baixada', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao baixar Excel', 'error');
    } finally {
      setBaixando(false);
    }
  }, [idLoja, escopo]);

  useEffect(() => {
    onSetHeaderActions?.(
      <Box sx={{ display: 'flex', gap: 0.5 }}>
        <IconButton size="small" aria-label="Atualizar" onClick={() => void carregar()}>
          <RefreshIcon sx={{ fontSize: 18 }} />
        </IconButton>
        <IconButton size="small" aria-label="Baixar Excel" disabled={baixando} onClick={() => void baixar()}>
          <FileDownloadOutlinedIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>,
    );
    return () => onSetHeaderActions?.(null);
  }, [carregar, baixar, baixando, onSetHeaderActions]);

  const r = data?.resumo;
  const problemas = data?.problemas ?? [];
  const vendasRuim = data?.vendas_com_problema ?? [];
  const breaksAviso = data?.breaks_com_aviso ?? [];
  const taxa = r?.taxa_processada_pct;
  const processada = r?.processada ?? 0;
  const totalVendas = processada + (r?.parcial ?? 0) + (r?.erro ?? 0) + (r?.pendente ?? 0);

  useEffect(() => {
    if (lista === 'vendas' && !vendasRuim.length) setLista('insumos');
    if (lista === 'desperdicio' && !breaksAviso.length) setLista('insumos');
  }, [lista, vendasRuim.length, breaksAviso.length]);

  if (loading && !data) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  const filtros: Array<{ id: ListaAbaixo; label: string; qtd: number; hide?: boolean }> = [
    { id: 'insumos', label: 'Corrigir', qtd: problemas.length },
    { id: 'vendas', label: 'Vendas', qtd: vendasRuim.length, hide: !vendasRuim.length },
    { id: 'desperdicio', label: 'Desperdício', qtd: breaksAviso.length, hide: !breaksAviso.length },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, gap: 1.25 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          flexWrap: 'wrap',
          flexShrink: 0,
          pb: 0.25,
          borderBottom: `1px solid ${colors.border}`,
        }}
      >
        {(
          [
            { id: 'loja' as const, label: 'Esta loja' },
            { id: 'rede' as const, label: 'Rede' },
          ] as const
        ).map((f) => {
          const ativo = escopo === f.id;
          return (
            <Button
              key={f.id}
              disableRipple
              onClick={() => setEscopo(f.id)}
              sx={{
                textTransform: 'none',
                minWidth: 0,
                px: 1.1,
                py: 0.85,
                borderRadius: 0,
                fontWeight: ativo ? 700 : 600,
                fontSize: '0.8125rem',
                color: ativo ? colors.textPrimary : colors.textSecondary,
                borderBottom: ativo ? `2px solid ${colors.orange}` : '2px solid transparent',
                bgcolor: 'transparent',
                '&:hover': { bgcolor: 'transparent', color: colors.textPrimary },
              }}
            >
              {f.label}
            </Button>
          );
        })}
        <Typography sx={{ fontSize: '0.78rem', color: colors.textSecondary, ml: { sm: 0.5 } }}>
          {taxa != null && totalVendas
            ? `${taxa}% das vendas baixaram o estoque`
            : 'Sem venda nesta janela'}
          {data?.janela?.desde ? ` · ${fmtPeriodo(data.janela.desde)}` : ''}
          {data?.janela?.previsto_fim ? ` a ${fmtPeriodo(data.janela.previsto_fim)}` : ''}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, ml: { sm: 'auto' } }}>
          {filtros
            .filter((f) => !f.hide)
            .map((f) => {
              const ativo = lista === f.id;
              return (
                <Button
                  key={f.id}
                  disableRipple
                  onClick={() => setLista(f.id)}
                  sx={{
                    textTransform: 'none',
                    minWidth: 0,
                    px: 1.1,
                    py: 0.85,
                    borderRadius: 0,
                    fontWeight: ativo ? 700 : 600,
                    fontSize: '0.8125rem',
                    color: ativo ? colors.textPrimary : colors.textSecondary,
                    borderBottom: ativo ? `2px solid ${colors.orange}` : '2px solid transparent',
                    bgcolor: 'transparent',
                    '&:hover': { bgcolor: 'transparent', color: colors.textPrimary },
                  }}
                >
                  {f.label}
                  <Box
                    component="span"
                    sx={{
                      ml: 0.85,
                      px: 0.65,
                      minWidth: 20,
                      height: 18,
                      borderRadius: '9px',
                      bgcolor: colors.canvasAlt,
                      color: colors.textMuted,
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {f.qtd}
                  </Box>
                </Button>
              );
            })}
        </Box>
      </Box>

      <Paper sx={{ ...tablePaperSx, flex: 1, minHeight: 0 }}>
        <TableContainer sx={tableContainerSx}>
          <Table stickyHeader sx={{ ...tableSx, '& .MuiTableCell-root': { fontSize: '0.95rem', py: 1.2 } }}>
            <TableHead>
              <TableRow>
                {lista === 'insumos' ? (
                  <>
                    <TableCell sx={{ ...thSx, pl: 2.5 }}>Item</TableCell>
                    <TableCell sx={thSx}>Problema</TableCell>
                    <TableCell sx={{ ...thSx, textAlign: 'right', pr: 2.5 }} width={90}>
                      Vezes
                    </TableCell>
                  </>
                ) : (
                  <>
                    <TableCell sx={{ ...thSx, pl: 2.5 }}>{lista === 'vendas' ? 'Venda' : 'Lançamento'}</TableCell>
                    <TableCell sx={thSx}>Problema</TableCell>
                    <TableCell sx={{ ...thSx, pr: 2.5 }} width={100}>
                      Data
                    </TableCell>
                  </>
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {lista === 'insumos' && !problemas.length ? (
                <TableRow>
                  <TableCell colSpan={3} sx={{ py: 5, color: colors.textMuted, borderBottom: 0 }}>
                    Nada travando a baixa nesta janela.
                  </TableCell>
                </TableRow>
              ) : null}

              {lista === 'insumos'
                ? problemas.map((p) => (
                    <TableRow
                      key={`${p.codigo}-${p.motivo}`}
                      hover
                      onClick={onIrFichas}
                      sx={{ cursor: onIrFichas ? 'pointer' : 'default' }}
                    >
                      <TableCell sx={{ pl: 2.5, fontWeight: 600, fontSize: '0.875rem' }}>
                        {tituloItemBaixa(p.nome) || p.nome}
                      </TableCell>
                      <TableCell sx={{ color: colors.textSecondary, fontSize: '0.8125rem' }}>
                        {MOTIVO[p.motivo] || p.problema}
                      </TableCell>
                      <TableCell sx={{ textAlign: 'right', pr: 2.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                        {p.vezes}
                        {escopo === 'rede' ? (
                          <Typography component="span" sx={{ display: 'block', fontSize: '0.68rem', color: colors.textMuted, fontWeight: 600 }}>
                            {p.lojas} lojas
                          </Typography>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))
                : null}

              {lista === 'vendas'
                ? vendasRuim.map((v) => (
                    <TableRow key={`${v.id_loja}-${v.id_venda}`} hover>
                      <TableCell sx={{ pl: 2.5, fontWeight: 600 }}>
                        {escopo === 'rede' ? `Loja ${v.id_loja}` : 'Venda do dia'}
                      </TableCell>
                      <TableCell sx={{ color: colors.textSecondary }}>{fraseErroVenda(v.erros)}</TableCell>
                      <TableCell sx={{ pr: 2.5, color: colors.textSecondary }}>{fmtDia(v.data_venda)}</TableCell>
                    </TableRow>
                  ))
                : null}

              {lista === 'desperdicio'
                ? breaksAviso.map((b) => (
                    <TableRow key={b.id_break} hover>
                      <TableCell sx={{ pl: 2.5, fontWeight: 600 }}>
                        {rotuloBreak(b.tipo)}
                        {escopo === 'rede' ? ` · loja ${b.id_loja}` : ''}
                      </TableCell>
                      <TableCell sx={{ color: colors.textSecondary }}>
                        {fraseErroVenda((b.avisos && b.avisos[0]) || b.avisos_texto)}
                      </TableCell>
                      <TableCell sx={{ color: colors.textSecondary }}>{fmtDia(b.data_break)}</TableCell>
                    </TableRow>
                  ))
                : null}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}
