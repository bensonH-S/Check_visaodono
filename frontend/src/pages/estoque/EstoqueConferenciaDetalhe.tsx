import { Fragment, useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import type { EstoqueContagemDetalhe, EstoqueItem, Loja } from '../../api/client';
import { rotuloTipoContagem } from '../../components/estoque/estoqueContagemTipo';
import { colors, portalPanelSx } from '../../theme/tokens';
import { tableContainerSx, tablePaperSx, tableSx } from '../../utils/tablePageLayout';

type RascunhoLinha = { caixa: string; pc: string; kg: string };

type ResumoLive = {
  total_valor: number;
  preenchidos: number;
  pendentes: number;
  divergencias: number;
  totalItens: number;
};

function fmtBrl(v: number | null | undefined) {
  if (v == null || Number.isNaN(Number(v))) return '—';
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtNum(v: number | null | undefined, digitos = 2) {
  if (v == null || Number.isNaN(Number(v))) return '—';
  return Number(v).toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digitos,
  });
}

function fmtDataHora(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function parseNumCampo(raw: string): number | null {
  if (raw === undefined || raw === null || String(raw).trim() === '') return null;
  const n = Number(String(raw).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function calcQtdTerraco(
  linha: RascunhoLinha | undefined,
  undConvertida: number,
  undParcial: number,
): number | null {
  if (!linha) return null;
  const tem =
    String(linha.caixa).trim() !== '' ||
    String(linha.pc).trim() !== '' ||
    String(linha.kg).trim() !== '';
  if (!tem) return null;
  const caixa = parseNumCampo(linha.caixa) ?? 0;
  const pc = parseNumCampo(linha.pc) ?? 0;
  const kg = parseNumCampo(linha.kg) ?? 0;
  const base = undConvertida > 0 ? undConvertida : 1;
  const parcial = undParcial > 0 ? undParcial : 1;
  return Math.round((caixa * base + pc * parcial + kg) * 10000) / 10000;
}

const thSx = {
  fontSize: '0.68rem',
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
  color: colors.textMuted,
  bgcolor: `${colors.surface} !important`,
  backgroundImage: 'none !important',
  zIndex: 4,
  py: 1,
  boxShadow: `inset 0 -1px 0 ${colors.border}`,
};

const inputSx = {
  width: 76,
  mx: 'auto',
  '& .MuiOutlinedInput-root': {
    bgcolor: colors.canvas,
    borderRadius: 1,
    minHeight: 36,
    height: 36,
  },
  '& .MuiOutlinedInput-input': {
    py: 0,
    px: 1,
    textAlign: 'center',
    fontWeight: 600,
    fontSize: '0.85rem',
  },
};

function secaoId(nome: string) {
  return `conf-secao-${nome.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}`;
}

function irParaSecao(nome: string) {
  const el = document.getElementById(secaoId(nome));
  el?.scrollIntoView({ block: 'start', behavior: 'smooth' });
}

export default function EstoqueConferenciaDetalhe({
  contagem,
  lojaAtual,
  itens,
  rascunho,
  setRascunho,
  editavel,
  resumo,
  salvando,
  excluindo,
  reabrindo,
  podeExcluir,
  podeReabrir,
  onVoltar,
  onAtualizar,
  onSalvar,
  onFinalizar,
  onExcluir,
  onReabrir,
}: {
  contagem: EstoqueContagemDetalhe;
  lojaAtual: Loja | null;
  itens: EstoqueItem[];
  rascunho: Record<number, RascunhoLinha>;
  setRascunho: Dispatch<SetStateAction<Record<number, RascunhoLinha>>>;
  editavel: boolean;
  resumo: ResumoLive | null;
  salvando: boolean;
  excluindo: boolean;
  reabrindo: boolean;
  podeExcluir: boolean;
  podeReabrir: boolean;
  onVoltar: () => void;
  onAtualizar: () => void;
  onSalvar: () => void;
  onFinalizar: () => void;
  onExcluir: () => void;
  onReabrir: () => void;
}) {
  const [busca, setBusca] = useState('');

  const secoes = useMemo(() => {
    const out: string[] = [];
    for (const i of itens) {
      const s = String(i.secao_contagem || '').trim() || 'OUTROS';
      if (!out.includes(s)) out.push(s);
    }
    return out;
  }, [itens]);

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return itens;
    return itens.filter(
      (i) =>
        i.codigo.toLowerCase().includes(q) ||
        i.descricao.toLowerCase().includes(q) ||
        String(i.secao_contagem || '').toLowerCase().includes(q),
    );
  }, [itens, busca]);

  const kpis = [
    {
      label: 'Valor',
      value: fmtBrl(resumo?.total_valor),
      sub: contagem.data_inicial_mes
        ? `início ${String(contagem.data_inicial_mes).slice(8, 10)}/${String(contagem.data_inicial_mes).slice(5, 7)}`
        : 'nesta conferência',
      color: colors.textPrimary,
    },
    {
      label: 'Contados',
      value: resumo ? `${resumo.preenchidos}/${resumo.totalItens}` : '—',
      sub: rotuloTipoContagem(contagem.tipo),
      color: colors.textPrimary,
    },
    {
      label: 'Pendentes',
      value: String(resumo?.pendentes ?? '—'),
      sub:
        (resumo?.divergencias || 0) > 0
          ? `${resumo?.divergencias} divergência(s)`
          : 'sem divergência',
      color: (resumo?.pendentes || 0) > 0 ? colors.orange : colors.textPrimary,
    },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
        <IconButton onClick={onVoltar} aria-label="Voltar à lista" size="small">
          <ArrowBackIcon />
        </IconButton>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontWeight: 600, fontSize: '1.05rem', letterSpacing: '-0.02em', color: colors.textPrimary }}>
            {contagem.titulo || 'Conferência'}
            {contagem.criado_por_nome ? ` · ${contagem.criado_por_nome}` : ''}
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', color: colors.textMuted }}>
            {lojaAtual ? `${lojaAtual.bk_number || ''} · ${lojaAtual.name}` : ''}
            {contagem.criado_em ? ` · ${fmtDataHora(contagem.criado_em)}` : ''}
          </Typography>
        </Box>
        <Chip
          size="small"
          label={contagem.status === 'finalizada' ? 'Finalizada' : 'Aberta'}
          sx={
            contagem.status === 'finalizada'
              ? { bgcolor: '#DCFCE7', color: '#166534', fontWeight: 700 }
              : { bgcolor: '#FEF08A', color: '#854D0E', fontWeight: 700 }
          }
        />
        {podeReabrir && contagem.status === 'finalizada' && (
          <Tooltip title="Reabrir">
            <span>
              <IconButton size="small" disabled={reabrindo} onClick={onReabrir} sx={{ color: colors.navy }}>
                {reabrindo ? <CircularProgress size={18} /> : <LockOpenIcon fontSize="small" />}
              </IconButton>
            </span>
          </Tooltip>
        )}
        <IconButton onClick={onAtualizar} aria-label="Atualizar" size="small">
          <RefreshIcon />
        </IconButton>
      </Box>

      <Box sx={{ ...portalPanelSx, p: { xs: 1.5, md: 2 }, flexShrink: 0 }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
            gap: { xs: 1.25, md: 0 },
          }}
        >
          {kpis.map((k, i) => (
            <Box
              key={k.label}
              sx={{
                minWidth: 0,
                px: { md: 2 },
                pl: { md: i === 0 ? 0 : 2 },
                pr: { md: i === 2 ? 0 : 2 },
                borderLeft: { md: i === 0 ? 'none' : `1px solid ${colors.border}` },
              }}
            >
              <Typography
                sx={{
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: colors.textMuted,
                }}
              >
                {k.label}
              </Typography>
              <Typography
                sx={{
                  fontWeight: 600,
                  fontSize: { xs: '1.35rem', md: '1.65rem' },
                  letterSpacing: '-0.035em',
                  lineHeight: 1.15,
                  color: k.color,
                  mt: 0.45,
                }}
              >
                {k.value}
              </Typography>
              <Typography sx={{ mt: 0.35, fontSize: '0.75rem', color: colors.textMuted }}>{k.sub}</Typography>
            </Box>
          ))}
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
        <TextField
          size="small"
          placeholder="Buscar item, código ou faixa…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          sx={{
            minWidth: { xs: '100%', sm: 260 },
            flex: { sm: '0 1 280px' },
            '& .MuiOutlinedInput-root': { bgcolor: colors.surface, borderRadius: 1.5 },
          }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 18, color: colors.textMuted }} />
                </InputAdornment>
              ),
            },
          }}
        />
        <Box sx={{ display: 'flex', gap: 0.75, overflowX: 'auto', minWidth: 0, flex: 1, pb: 0.25 }}>
          {secoes.map((s) => (
            <Chip
              key={s}
              label={s}
              size="small"
              clickable
              onClick={() => irParaSecao(s)}
              sx={{
                flexShrink: 0,
                fontWeight: 600,
                fontSize: '0.7rem',
                bgcolor: colors.canvasAlt,
                border: `1px solid ${colors.border}`,
              }}
            />
          ))}
        </Box>
      </Box>

      <Box sx={{ ...tablePaperSx, flex: 1 }}>
        <TableContainer sx={tableContainerSx}>
          <Table stickyHeader size="small" sx={{ ...tableSx, tableLayout: 'fixed' }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ ...thSx, width: '34%' }}>Item</TableCell>
                <TableCell sx={{ ...thSx, textAlign: 'center', width: 72 }}>Sist.</TableCell>
                <TableCell sx={{ ...thSx, textAlign: 'center', width: 92 }}>Caixa</TableCell>
                <TableCell sx={{ ...thSx, textAlign: 'center', width: 92 }}>Pc/fd</TableCell>
                <TableCell sx={{ ...thSx, textAlign: 'center', width: 92 }}>Kg/und</TableCell>
                <TableCell sx={{ ...thSx, textAlign: 'center', width: 80 }}>Qtd</TableCell>
                <TableCell sx={{ ...thSx, textAlign: 'center', width: 88, color: '#991b1b' }}>Dif.</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visiveis.map((i, idx) => {
                const raw = rascunho[i.id_item] ?? { caixa: '', pc: '', kg: '' };
                const undCx = Number(i.und_convertida) > 0 ? Number(i.und_convertida) : 1;
                const undPc = Number(i.und_parcial) > 0 ? Number(i.und_parcial) : 1;
                const permiteCx = i.permite_contagem_caixa !== false;
                const permitePc = i.permite_contagem_pc_fd !== false;
                const permiteKg = i.permite_contagem_kg_und !== false;
                const contado = editavel ? calcQtdTerraco(raw, undCx, undPc) : i.estoque_contado;
                const preenchido = contado != null && Number.isFinite(contado);
                const dif = !preenchido ? null : contado - i.estoque_sistema;
                const secao = String(i.secao_contagem || '').trim() || 'OUTROS';
                const secaoAnt =
                  idx > 0 ? String(visiveis[idx - 1].secao_contagem || '').trim() || 'OUTROS' : '';
                const setCampo = (campo: keyof RascunhoLinha, valor: string) => {
                  setRascunho((prev) => ({
                    ...prev,
                    [i.id_item]: {
                      caixa: prev[i.id_item]?.caixa ?? '',
                      pc: prev[i.id_item]?.pc ?? '',
                      kg: prev[i.id_item]?.kg ?? '',
                      [campo]: valor,
                    },
                  }));
                };
                const campo = (
                  key: keyof RascunhoLinha,
                  attr: string,
                  liberado: boolean,
                  lido: number | null | undefined,
                ) => {
                  if (!liberado) {
                    return (
                      <Box sx={{ color: colors.textMuted, fontWeight: 600, fontSize: '0.85rem' }}>—</Box>
                    );
                  }
                  if (!editavel) return fmtNum(lido ?? null, 3);
                  return (
                    <TextField
                      size="small"
                      value={raw[key]}
                      onChange={(e) => setCampo(key, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key !== 'Enter') return;
                        e.preventDefault();
                        const inputs = Array.from(
                          document.querySelectorAll<HTMLInputElement>('input[data-estoque-campo]'),
                        );
                        const pos = inputs.indexOf(e.target as HTMLInputElement);
                        const proximo = pos >= 0 ? inputs[pos + 1] : null;
                        if (proximo) {
                          proximo.focus();
                          proximo.select();
                          proximo.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                        }
                      }}
                      placeholder="—"
                      slotProps={{
                        htmlInput: {
                          inputMode: 'decimal',
                          'data-estoque-campo': attr,
                        },
                      }}
                      sx={inputSx}
                    />
                  );
                };
                return (
                  <Fragment key={i.id_item}>
                    {secao !== secaoAnt && (
                      <TableRow>
                        <TableCell
                          id={secaoId(secao)}
                          colSpan={7}
                          sx={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            letterSpacing: '0.12em',
                            textTransform: 'uppercase',
                            bgcolor: colors.canvasAlt,
                            color: colors.textSecondary,
                            py: 0.85,
                            borderBottom: `1px solid ${colors.border}`,
                          }}
                        >
                          {secao}
                        </TableCell>
                      </TableRow>
                    )}
                    <TableRow
                      hover
                      sx={{
                        bgcolor: preenchido ? 'rgba(22, 163, 74, 0.04)' : undefined,
                        ...(dif != null && dif !== 0
                          ? { bgcolor: 'rgba(220, 38, 38, 0.05)' }
                          : null),
                      }}
                    >
                      <TableCell sx={{ py: 1, pr: 1.5, verticalAlign: 'middle' }}>
                        <Typography sx={{ fontWeight: 600, fontSize: '0.8125rem', color: colors.textPrimary, lineHeight: 1.3 }}>
                          {i.descricao}
                        </Typography>
                        <Typography sx={{ mt: 0.2, fontSize: '0.7rem', color: colors.textMuted }}>
                          {i.codigo}
                          {i.unidade_contagem ? ` · ${String(i.unidade_contagem).toUpperCase()}` : ''}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ textAlign: 'center', color: colors.textSecondary, fontSize: '0.8rem' }}>
                        {fmtNum(i.estoque_sistema, 3)}
                      </TableCell>
                      <TableCell sx={{ textAlign: 'center' }}>
                        {campo('caixa', 'caixa', permiteCx, i.contagem_caixa)}
                      </TableCell>
                      <TableCell sx={{ textAlign: 'center' }}>
                        {campo('pc', 'pc', permitePc, i.contagem_pc_fd)}
                      </TableCell>
                      <TableCell sx={{ textAlign: 'center' }}>
                        {campo('kg', 'kg', permiteKg, i.contagem_kg_und)}
                      </TableCell>
                      <TableCell sx={{ textAlign: 'center', fontWeight: 700, color: colors.textPrimary }}>
                        {preenchido ? fmtNum(contado, 3) : '—'}
                      </TableCell>
                      <TableCell
                        sx={{
                          textAlign: 'center',
                          fontWeight: 700,
                          color: dif == null || dif === 0 ? colors.textMuted : dif > 0 ? '#166534' : '#991b1b',
                        }}
                      >
                        {dif == null ? '—' : fmtNum(dif, 3)}
                      </TableCell>
                    </TableRow>
                  </Fragment>
                );
              })}
              {!visiveis.length && (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 5, color: colors.textMuted }}>
                    Nenhum item nesta busca
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      <Box
        sx={{
          display: 'flex',
          gap: 1,
          justifyContent: 'flex-end',
          alignItems: 'center',
          flexShrink: 0,
          pt: 0.25,
        }}
      >
        {podeExcluir && (
          <IconButton
            color="error"
            onClick={onExcluir}
            aria-label="Excluir conferência"
            disabled={excluindo || salvando}
          >
            <DeleteOutlineIcon />
          </IconButton>
        )}
        {editavel ? (
          <>
            <Button
              variant="contained"
              disabled={salvando}
              onClick={onSalvar}
              sx={{ bgcolor: colors.orange, '&:hover': { bgcolor: colors.orangeHover }, fontWeight: 700 }}
            >
              Salvar rascunho
            </Button>
            <Button
              variant="contained"
              disabled={salvando}
              onClick={onFinalizar}
              sx={{ bgcolor: colors.navy, '&:hover': { bgcolor: colors.navyDark }, fontWeight: 700 }}
            >
              Finalizar
            </Button>
          </>
        ) : (
          podeReabrir &&
          contagem.status === 'finalizada' && (
            <Button
              variant="outlined"
              startIcon={reabrindo ? <CircularProgress size={16} /> : <LockOpenIcon />}
              disabled={reabrindo}
              onClick={onReabrir}
              sx={{ fontWeight: 700 }}
            >
              Reabrir
            </Button>
          )
        )}
      </Box>
    </Box>
  );
}
