import { Fragment, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
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
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import type { EstoqueContagemDetalhe, EstoqueItem, Loja } from '../../api/client';
import { rotuloTipoContagem } from '../../components/estoque/estoqueContagemTipo';
import { rankSecaoPlanilha } from '../../components/estoque/estoqueOrdemPlanilha';
import {
  fracionadaInteira,
  qtdPreviewSeguro,
  rotuloCampoFracionado,
  sanitizarEntradaFracionada,
  sanitizarEntradaNaoNegativa,
  temEntradaTerraco,
  unidadeFracionadaItem,
} from '../../components/estoque/estoqueContagemCampo';
import { colors } from '../../theme/tokens';
import { tableContainerSx, tablePaperSx, tableSx } from '../../utils/tablePageLayout';

type RascunhoLinha = { caixa: string; pc: string; kg: string };
type CampoContagem = keyof RascunhoLinha;

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

/** VL.CAIXA da planilha; se só houver unitário, reconstrói com und_convertida. */
function vlCaixaItem(i: EstoqueItem) {
  const caixa = Number(i.preco_caixa);
  if (Number.isFinite(caixa) && caixa > 0) return caixa;
  const unit = Number(i.valor_unidade);
  const und = Number(i.und_convertida);
  if (Number.isFinite(unit) && unit > 0 && Number.isFinite(und) && und > 0) {
    return Math.round(unit * und * 100) / 100;
  }
  return null;
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

function nomeSecao(i: EstoqueItem) {
  return String(i.secao_contagem || '').trim() || 'OUTROS';
}

function rankSecaoChip(nome: string) {
  if (nome === 'OUTROS') return 100;
  return rankSecaoPlanilha(nome);
}

function itemPreenchido(
  i: EstoqueItem,
  raw: RascunhoLinha | undefined,
  editavel: boolean,
): boolean {
  if (!editavel) return i.estoque_contado != null && Number.isFinite(Number(i.estoque_contado));
  if (temEntradaTerraco(raw)) return true;
  return false;
}

function focarColuna(campo: CampoContagem, from: HTMLInputElement, dir: 1 | -1) {
  const inputs = Array.from(
    document.querySelectorAll<HTMLInputElement>(`input[data-estoque-campo="${campo}"]`),
  );
  const pos = inputs.indexOf(from);
  const proximo = pos >= 0 ? inputs[pos + dir] : null;
  if (!proximo) return;
  proximo.focus();
  proximo.select();
  proximo.scrollIntoView({ block: 'nearest' });
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
  py: 0.7,
  boxShadow: `inset 0 -1px 0 ${colors.border}`,
};

const inputSx = {
  width: 72,
  mx: 'auto',
  '& .MuiOutlinedInput-root': {
    bgcolor: colors.canvas,
    borderRadius: 1,
    minHeight: 32,
    height: 32,
  },
  '& .MuiOutlinedInput-input': {
    py: 0,
    px: 0.75,
    textAlign: 'center',
    fontWeight: 700,
    fontSize: '0.85rem',
  },
};

const chipBase = {
  flexShrink: 0,
  fontWeight: 700,
  fontSize: '0.7rem',
  height: 28,
};

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
  onBaixarRelatorio,
  baixandoRelatorio = false,
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
  onBaixarRelatorio?: () => void;
  baixandoRelatorio?: boolean;
}) {
  const [busca, setBusca] = useState('');
  const [secaoManual, setSecaoManual] = useState<string | 'todas' | null>(null);
  const [soPendentes, setSoPendentes] = useState(false);

  const secoes = useMemo(() => {
    const mapa = new Map<string, { total: number; preenchidos: number }>();
    const ordem: string[] = [];
    for (const i of itens) {
      const s = nomeSecao(i);
      if (!mapa.has(s)) {
        mapa.set(s, { total: 0, preenchidos: 0 });
        ordem.push(s);
      }
      const st = mapa.get(s)!;
      st.total += 1;
      if (itemPreenchido(i, rascunho[i.id_item], editavel)) st.preenchidos += 1;
    }
    ordem.sort((a, b) => {
      const d = rankSecaoChip(a) - rankSecaoChip(b);
      return d !== 0 ? d : a.localeCompare(b, 'pt-BR');
    });
    return ordem.map((nome) => ({ nome, ...mapa.get(nome)! }));
  }, [itens, rascunho, editavel]);

  const secaoFiltro = secaoManual ?? secoes[0]?.nome ?? 'todas';
  const buscando = busca.trim().length > 0;

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return itens.filter((i) => {
      if (q) {
        const hit =
          i.codigo.toLowerCase().includes(q) ||
          i.descricao.toLowerCase().includes(q) ||
          nomeSecao(i).toLowerCase().includes(q);
        if (!hit) return false;
      } else if (secaoFiltro !== 'todas' && nomeSecao(i) !== secaoFiltro) {
        return false;
      }
      if (soPendentes && itemPreenchido(i, rascunho[i.id_item], editavel)) return false;
      return true;
    });
  }, [itens, busca, secaoFiltro, soPendentes, rascunho, editavel]);

  const mostrarFaixa = buscando || secaoFiltro === 'todas';
  const secaoAtiva = secoes.find((s) => s.nome === secaoFiltro);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0, minWidth: 0 }}>
        <IconButton onClick={onVoltar} aria-label="Voltar à lista" size="small">
          <ArrowBackIcon />
        </IconButton>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, minWidth: 0, flexWrap: 'wrap' }}>
            <Typography
              sx={{
                fontWeight: 600,
                fontSize: '1.05rem',
                letterSpacing: '-0.02em',
                color: colors.textPrimary,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {contagem.titulo || 'Conferência'}
              {contagem.criado_por_nome ? ` · ${contagem.criado_por_nome}` : ''}
            </Typography>
            <Typography sx={{ fontSize: '0.8rem', color: colors.textMuted, whiteSpace: 'nowrap' }}>
              {resumo ? `${resumo.preenchidos}/${resumo.totalItens}` : '—'}
              {resumo ? ` · ${fmtBrl(resumo.total_valor)}` : ''}
              {secaoAtiva && secaoFiltro !== 'todas' && !buscando
                ? ` · ${secaoAtiva.preenchidos}/${secaoAtiva.total} nesta faixa`
                : ''}
            </Typography>
          </Box>
          <Typography sx={{ fontSize: '0.72rem', color: colors.textMuted }}>
            {lojaAtual ? `${lojaAtual.bk_number || ''} · ${lojaAtual.name}` : ''}
            {contagem.criado_em ? ` · ${fmtDataHora(contagem.criado_em)}` : ''}
            {` · ${rotuloTipoContagem(contagem.tipo)}`}
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
        {onBaixarRelatorio && (
          <Tooltip title="Baixar relatório">
            <span>
              <IconButton
                size="small"
                onClick={onBaixarRelatorio}
                disabled={baixandoRelatorio}
                aria-label="Baixar relatório"
                sx={{ color: colors.navy }}
              >
                {baixandoRelatorio ? (
                  <CircularProgress size={18} />
                ) : (
                  <FileDownloadOutlinedIcon fontSize="small" />
                )}
              </IconButton>
            </span>
          </Tooltip>
        )}
        <IconButton onClick={onAtualizar} aria-label="Atualizar" size="small">
          <RefreshIcon />
        </IconButton>
        {podeExcluir && (
          <IconButton
            color="error"
            onClick={onExcluir}
            aria-label="Excluir conferência"
            disabled={excluindo || salvando}
            size="small"
          >
            <DeleteOutlineIcon />
          </IconButton>
        )}
        {editavel ? (
          <>
            <Button
              size="small"
              variant="contained"
              disabled={salvando}
              onClick={onSalvar}
              sx={{ bgcolor: colors.orange, '&:hover': { bgcolor: colors.orangeHover }, fontWeight: 700, flexShrink: 0 }}
            >
              Salvar
            </Button>
            <Button
              size="small"
              variant="contained"
              disabled={salvando}
              onClick={onFinalizar}
              sx={{ bgcolor: colors.navy, '&:hover': { bgcolor: colors.navyDark }, fontWeight: 700, flexShrink: 0 }}
            >
              Finalizar
            </Button>
          </>
        ) : (
          podeReabrir &&
          contagem.status === 'finalizada' && (
            <Button
              size="small"
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

      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'nowrap', flexShrink: 0, minWidth: 0 }}>
        <TextField
          size="small"
          placeholder="Buscar item ou código…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          sx={{
            width: { xs: 160, sm: 220 },
            flexShrink: 0,
            '& .MuiOutlinedInput-root': { bgcolor: colors.surface, borderRadius: 1.5, height: 36 },
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
        <Chip
          label="Pendentes"
          size="small"
          clickable
          onClick={() => setSoPendentes((v) => !v)}
          sx={{
            ...chipBase,
            bgcolor: soPendentes ? colors.orangeLight : colors.canvasAlt,
            color: soPendentes ? colors.orange : colors.textSecondary,
            border: `1px solid ${soPendentes ? colors.orange : colors.border}`,
          }}
        />
        <Box sx={{ display: 'flex', gap: 0.6, overflowX: 'auto', minWidth: 0, flex: 1, pb: 0.15 }}>
          <Chip
            label="Todas"
            size="small"
            clickable
            onClick={() => setSecaoManual('todas')}
            sx={{
              ...chipBase,
              bgcolor: secaoFiltro === 'todas' ? colors.navy : colors.canvasAlt,
              color: secaoFiltro === 'todas' ? '#fff' : colors.textSecondary,
              border: `1px solid ${secaoFiltro === 'todas' ? colors.navy : colors.border}`,
            }}
          />
          {secoes.map((s) => {
            const ativa = !buscando && secaoFiltro === s.nome;
            return (
              <Chip
                key={s.nome}
                label={`${s.nome} ${s.preenchidos}/${s.total}`}
                size="small"
                clickable
                onClick={() => {
                  setBusca('');
                  setSecaoManual(s.nome);
                }}
                sx={{
                  ...chipBase,
                  bgcolor: ativa ? colors.navy : s.preenchidos === s.total ? '#DCFCE7' : colors.canvasAlt,
                  color: ativa ? '#fff' : s.preenchidos === s.total ? '#166534' : colors.textSecondary,
                  border: `1px solid ${ativa ? colors.navy : colors.border}`,
                }}
              />
            );
          })}
        </Box>
      </Box>

      <Box sx={{ ...tablePaperSx, flex: 1 }}>
        <TableContainer sx={tableContainerSx}>
          <Table stickyHeader size="small" sx={{ ...tableSx, tableLayout: 'fixed' }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ ...thSx, width: '26%' }}>Item</TableCell>
                <TableCell sx={{ ...thSx, textAlign: 'right', width: 88 }}>Vl. unit.</TableCell>
                <TableCell sx={{ ...thSx, textAlign: 'right', width: 88 }}>Vl. caixa</TableCell>
                <TableCell sx={{ ...thSx, textAlign: 'center', width: 64 }}>Sist.</TableCell>
                <TableCell sx={{ ...thSx, textAlign: 'center', width: 76 }}>Caixa</TableCell>
                <TableCell sx={{ ...thSx, textAlign: 'center', width: 76 }}>Pc/fd</TableCell>
                <TableCell sx={{ ...thSx, textAlign: 'center', width: 84 }}>UND/KG</TableCell>
                <TableCell sx={{ ...thSx, textAlign: 'center', width: 64 }}>Qtd</TableCell>
                <TableCell sx={{ ...thSx, textAlign: 'right', width: 92 }}>Valor</TableCell>
                <TableCell sx={{ ...thSx, textAlign: 'center', width: 72, color: '#991b1b' }}>Dif.</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visiveis.map((i, idx) => {
                const raw = rascunho[i.id_item] ?? { caixa: '', pc: '', kg: '' };
                const permiteCx = i.permite_contagem_caixa !== false;
                const permitePc = i.permite_contagem_pc_fd !== false;
                const permiteKg = i.permite_contagem_kg_und !== false;
                const rotuloFrac = rotuloCampoFracionado(unidadeFracionadaItem(i));
                const inteiroFrac = fracionadaInteira(unidadeFracionadaItem(i));
                const contado = editavel ? qtdPreviewSeguro(i, raw) : i.estoque_contado;
                const preenchido = editavel ? temEntradaTerraco(raw) : contado != null && Number.isFinite(Number(contado));
                const valorLinha =
                  contado == null ? null : Math.round(contado * (Number(i.valor_unidade) || 0) * 100) / 100;
                const vlUnit = Number(i.valor_unidade) > 0 ? Number(i.valor_unidade) : null;
                const vlCaixa = vlCaixaItem(i);
                const dif = contado == null ? null : contado - i.estoque_sistema;
                const secao = nomeSecao(i);
                const secaoAnt = idx > 0 ? nomeSecao(visiveis[idx - 1]) : '';
                const setCampo = (campo: CampoContagem, valor: string) => {
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
                  key: CampoContagem,
                  liberado: boolean,
                  lido: number | null | undefined,
                  opts?: { rotulo?: string; inteiro?: boolean },
                ) => {
                  if (!liberado) {
                    return <Box sx={{ color: colors.textMuted, fontSize: '0.8rem' }}>—</Box>;
                  }
                  if (!editavel) return fmtNum(lido ?? null, 3);
                  return (
                    <TextField
                      size="small"
                      value={raw[key]}
                      onChange={(e) => {
                        const v =
                          key === 'kg'
                            ? sanitizarEntradaFracionada(e.target.value, Boolean(opts?.inteiro))
                            : sanitizarEntradaNaoNegativa(e.target.value);
                        setCampo(key, v);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === 'ArrowDown') {
                          e.preventDefault();
                          focarColuna(key, e.target as HTMLInputElement, 1);
                          return;
                        }
                        if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          focarColuna(key, e.target as HTMLInputElement, -1);
                        }
                      }}
                      placeholder="—"
                      slotProps={{
                        htmlInput: {
                          inputMode: opts?.inteiro ? 'numeric' : 'decimal',
                          'data-estoque-campo': key,
                        },
                        input: opts?.rotulo
                          ? {
                              endAdornment: (
                                <InputAdornment position="end">
                                  <Typography sx={{ fontSize: '0.58rem', fontWeight: 700, color: colors.textMuted }}>
                                    {opts.rotulo}
                                  </Typography>
                                </InputAdornment>
                              ),
                            }
                          : undefined,
                      }}
                      sx={opts?.rotulo ? { ...inputSx, width: 92 } : inputSx}
                    />
                  );
                };
                return (
                  <Fragment key={i.id_item}>
                    {mostrarFaixa && secao !== secaoAnt && (
                      <TableRow>
                        <TableCell
                          colSpan={10}
                          sx={{
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            letterSpacing: '0.12em',
                            textTransform: 'uppercase',
                            bgcolor: colors.canvasAlt,
                            color: colors.textSecondary,
                            py: 0.55,
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
                        ...(dif != null && dif !== 0 ? { bgcolor: 'rgba(220, 38, 38, 0.05)' } : null),
                      }}
                    >
                      <TableCell sx={{ py: 0.55, pr: 1.25, verticalAlign: 'middle' }}>
                        <Typography
                          sx={{
                            fontWeight: 600,
                            fontSize: '0.8rem',
                            color: colors.textPrimary,
                            lineHeight: 1.25,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={i.descricao}
                        >
                          {i.descricao}
                        </Typography>
                        <Typography sx={{ fontSize: '0.68rem', color: colors.textMuted }}>
                          {i.codigo}
                          {i.unidade_contagem ? ` · ${String(i.unidade_contagem).toUpperCase()}` : ''}
                        </Typography>
                      </TableCell>
                      <TableCell
                        sx={{
                          textAlign: 'right',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          py: 0.55,
                          pr: 1.25,
                          color: vlUnit == null ? colors.textMuted : colors.textPrimary,
                          fontVariantNumeric: 'tabular-nums',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {vlUnit == null ? '—' : fmtBrl(vlUnit)}
                      </TableCell>
                      <TableCell
                        sx={{
                          textAlign: 'right',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          py: 0.55,
                          pr: 1.25,
                          color: vlCaixa == null ? colors.textMuted : colors.textPrimary,
                          fontVariantNumeric: 'tabular-nums',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {vlCaixa == null ? '—' : fmtBrl(vlCaixa)}
                      </TableCell>
                      <TableCell sx={{ textAlign: 'center', color: colors.textSecondary, fontSize: '0.8rem', py: 0.55 }}>
                        {fmtNum(i.estoque_sistema, 3)}
                      </TableCell>
                      <TableCell sx={{ textAlign: 'center', py: 0.55 }}>
                        {campo('caixa', permiteCx, i.contagem_caixa)}
                      </TableCell>
                      <TableCell sx={{ textAlign: 'center', py: 0.55 }}>
                        {campo('pc', permitePc, i.contagem_pc_fd)}
                      </TableCell>
                      <TableCell sx={{ textAlign: 'center', py: 0.55 }}>
                        {campo('kg', permiteKg, i.contagem_kg_und, {
                          rotulo: rotuloFrac,
                          inteiro: inteiroFrac,
                        })}
                      </TableCell>
                      <TableCell sx={{ textAlign: 'center', fontWeight: 700, color: colors.textPrimary, py: 0.55 }}>
                        {contado == null ? '—' : fmtNum(contado, 3)}
                      </TableCell>
                      <TableCell
                        sx={{
                          textAlign: 'right',
                          fontWeight: 700,
                          fontSize: '0.8rem',
                          py: 0.55,
                          pr: 1.5,
                          color: preenchido ? colors.textPrimary : colors.textMuted,
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {valorLinha == null ? '—' : fmtBrl(valorLinha)}
                      </TableCell>
                      <TableCell
                        sx={{
                          textAlign: 'center',
                          fontWeight: 700,
                          py: 0.55,
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
                    <TableCell colSpan={10} align="center" sx={{ py: 5, color: colors.textMuted }}>
                    Nenhum item nesta faixa
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </Box>
  );
}
