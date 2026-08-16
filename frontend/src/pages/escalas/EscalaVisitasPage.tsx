import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import LinearProgress from '@mui/material/LinearProgress';
import Checkbox from '@mui/material/Checkbox';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import OutlinedInput from '@mui/material/OutlinedInput';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SaveIcon from '@mui/icons-material/Save';
import SendIcon from '@mui/icons-material/Send';
import CheckIcon from '@mui/icons-material/Check';
import UndoIcon from '@mui/icons-material/Undo';
import DeleteIcon from '@mui/icons-material/Delete';
import PlaceIcon from '@mui/icons-material/Place';
import TwoWheelerIcon from '@mui/icons-material/TwoWheeler';
import {
  api,
  type EscalaVisitasGrade,
  type EscalaVisitasLinha,
  type EscalaVisitasRegiaoStatusCodigo,
} from '../../api/client';
import { getUsuario, podeEditarEscalaDelivery, podeEditarEscalaRegiao, podeGerenciarEscalaVisitas } from '../../lib/auth';
import { showToast } from '../../utils/toast';
import { tableContainerSx, tablePaperSx, tableSx } from '../../utils/tablePageLayout';
import { colors } from '../../theme/tokens';
import { atribuicoesDoDia, idsLojasDestinoDoDia, idsRegionaisDoDia, linhaDeliveryDaGrade } from '../../components/escalas/escalaVisitasModel';
import { agruparRegionaisEscala, primeiroNome } from '../../components/escalas/escalaVisitasUtils';

const STATUS_LABEL: Record<EscalaVisitasRegiaoStatusCodigo, string> = {
  rascunho: 'Rascunho',
  pendente_aprovacao: 'Pendente',
  aprovado: 'Aprovado',
};

const STATUS_CHIP_SX: Record<EscalaVisitasRegiaoStatusCodigo, object> = {
  rascunho: { bgcolor: colors.canvasAlt, color: colors.textSecondary },
  pendente_aprovacao: { bgcolor: 'rgba(232, 82, 10, 0.12)', color: '#C2410C', fontWeight: 700 },
  aprovado: { bgcolor: 'rgba(22, 163, 74, 0.12)', color: '#15803D', fontWeight: 700 },
};

const DIAS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'];
/** Roxo da planilha Time de Campo para célula multi (ex.: I/R). */
const COR_ESCALA_MULTI = '#7030A0';
const COL_DIA_MIN_WIDTH = 108;
const COL_LOJA_MIN_WIDTH = 200;
const COL_BKN_WIDTH = 72;
const SELECT_CELULA_SX = {
  width: '100%',
  maxWidth: 132,
  fontSize: '0.72rem',
  '& .MuiSelect-select': { py: 0.75, whiteSpace: 'normal', lineHeight: 1.25 },
} as const;

function addDaysIso(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function segundaFeiraAtual() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function fmtDataCurta(iso: string) {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

type CelulaChave = string;
type PendingCelula =
  | { id_loja: number; dia: number; id_regionais: number[] }
  | { id_loja: number; dia: number; id_lojas_destino: number[] };
type PendingMap = Map<CelulaChave, PendingCelula>;

function chaveCelula(idLoja: number, dia: number) {
  return `${idLoja}-${dia}`;
}

export default function EscalaVisitasPage() {
  const user = getUsuario();
  const idEu = user?.id_usuario;
  const ehDiretor = podeGerenciarEscalaVisitas();
  const ehRegional = !ehDiretor && podeEditarEscalaRegiao();
  const ehDeliveryOnly = !ehDiretor && !ehRegional && podeEditarEscalaDelivery();
  const [semanaInicio, setSemanaInicio] = useState(segundaFeiraAtual());
  const [idRegiao, setIdRegiao] = useState<number | ''>('');
  const [grade, setGrade] = useState<EscalaVisitasGrade | null>(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [pending, setPending] = useState<PendingMap>(new Map());
  const [aba, setAba] = useState<'visitas' | 'delivery'>(ehDeliveryOnly ? 'delivery' : 'visitas');
  const podeEditarGrade = Boolean(grade?.pode_editar || grade?.pode_editar_regiao);
  const podeEditarDelivery = Boolean(grade?.pode_editar_delivery);

  const mapCorRegional = useMemo(() => {
    const m = new Map<number, string>();
    for (const r of grade?.regionais ?? []) m.set(r.id_usuario, r.cor);
    for (const linha of grade?.linhas ?? []) {
      for (const d of linha.dias) {
        for (const a of atribuicoesDoDia(d)) {
          if (a.id_regional != null && a.cor) m.set(a.id_regional, a.cor);
        }
      }
    }
    return m;
  }, [grade?.regionais, grade?.linhas]);

  const mapNomeRegional = useMemo(() => {
    const m = new Map<number, string>();
    for (const r of grade?.regionais ?? []) m.set(r.id_usuario, r.nome);
    for (const linha of grade?.linhas ?? []) {
      for (const d of linha.dias) {
        for (const a of atribuicoesDoDia(d)) {
          if (a.id_regional != null && a.nome_regional) m.set(a.id_regional, a.nome_regional);
        }
      }
    }
    return m;
  }, [grade?.regionais, grade?.linhas]);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ semana_inicio: semanaInicio });
      if (idRegiao !== '') q.set('id_regiao', String(idRegiao));
      const data = await api.escalaVisitasSemana(q.toString());
      setGrade(data);
      setPending(new Map());
      // Regional: força filtro de região (necessário para editar/enviar)
      if (ehRegional && idRegiao === '' && data.regioes.length >= 1) {
        setIdRegiao(data.regioes[0].id_regiao);
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao carregar escala', 'error');
    } finally {
      setLoading(false);
    }
  }, [semanaInicio, idRegiao, ehRegional]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    if (ehDeliveryOnly) setAba('delivery');
  }, [ehDeliveryOnly]);

  function alterarCelulaRegional(idLoja: number, dia: number, idRegionais: number[]) {
    if (!podeEditarGrade) return;
    setPending((prev) => {
      const next = new Map(prev);
      next.set(chaveCelula(idLoja, dia), { id_loja: idLoja, dia, id_regionais: idRegionais });
      return next;
    });
  }

  function toggleCelulaRegionalEquipe(idLoja: number, dia: number, _idRegiao: number | null | undefined, idsAtuais: number[]) {
    if (!idEu) return;
    const meuId = Number(idEu);
    const idsPaleta = new Set((grade?.regionais ?? []).map((r) => Number(r.id_usuario)));
    const paletaNoDia = idsAtuais.filter((id) => idsPaleta.has(Number(id)));
    alterarCelulaRegional(idLoja, dia, paletaNoDia.length ? [] : [meuId]);
  }

  function alterarCelulaDelivery(idLoja: number, dia: number, idLojasDestino: number[]) {
    if (!podeEditarDelivery) return;
    setPending((prev) => {
      const next = new Map(prev);
      next.set(chaveCelula(idLoja, dia), { id_loja: idLoja, dia, id_lojas_destino: idLojasDestino });
      return next;
    });
  }

  function toggleLojaDelivery(dia: number, idLojaDestino: number) {
    const linhaDelivery = linhaDeliveryDaGrade(grade?.linhas);
    if (!linhaDelivery) return;
    const atual = valorCelulaDelivery(linhaDelivery.id_loja, dia, linhaDelivery.dias[dia]);
    const next = atual.includes(idLojaDestino)
      ? atual.filter((id) => id !== idLojaDestino)
      : [...atual, idLojaDestino];
    alterarCelulaDelivery(linhaDelivery.id_loja, dia, next);
  }

  function toggleDiaDeliveryInteiro(dia: number) {
    const linhaDelivery = linhaDeliveryDaGrade(grade?.linhas);
    const lojas = grade?.lojas_destino ?? [];
    if (!linhaDelivery || !lojas.length) return;
    const atual = valorCelulaDelivery(linhaDelivery.id_loja, dia, linhaDelivery.dias[dia]);
    const todasMarcadas = lojas.every((l) => atual.includes(l.id_loja));
    alterarCelulaDelivery(
      linhaDelivery.id_loja,
      dia,
      todasMarcadas ? [] : lojas.map((l) => l.id_loja),
    );
  }

  function valorCelulaRegional(idLoja: number, dia: number, original: EscalaVisitasLinha['dias'][number]) {
    const p = pending.get(chaveCelula(idLoja, dia));
    if (p && 'id_regionais' in p) return p.id_regionais;
    return idsRegionaisDoDia(original);
  }

  function valorCelulaDelivery(idLoja: number, dia: number, original: EscalaVisitasLinha['dias'][number]) {
    const p = pending.get(chaveCelula(idLoja, dia));
    if (p && 'id_lojas_destino' in p) return p.id_lojas_destino;
    return idsLojasDestinoDoDia(original);
  }

  async function salvar() {
    if (!pending.size) {
      showToast('Nada para salvar', 'info');
      return;
    }
    setSalvando(true);
    try {
      const q = new URLSearchParams({ semana_inicio: semanaInicio });
      if (idRegiao !== '') q.set('id_regiao', String(idRegiao));
      const data = await api.escalaVisitasSalvar({
        semana_inicio: semanaInicio,
        id_regiao: idRegiao === '' ? null : idRegiao,
        celulas: [...pending.values()],
      });
      setGrade(data);
      setPending(new Map());
      showToast('Escala salva', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao salvar', 'error');
    } finally {
      setSalvando(false);
    }
  }

  async function copiarSemanaAnterior() {
    const origem = addDaysIso(semanaInicio, -7);
    setSalvando(true);
    try {
      const data = await api.escalaVisitasCopiar({ de: origem, para: semanaInicio });
      setGrade(data);
      setPending(new Map());
      showToast(`Copiado de ${fmtDataCurta(origem)}`, 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao copiar', 'error');
    } finally {
      setSalvando(false);
    }
  }

  function idRegiaoAcao(): number | null {
    if (idRegiao !== '') return Number(idRegiao);
    if (grade?.regioes?.length === 1) return grade.regioes[0].id_regiao;
    return null;
  }

  async function enviarAprovacao() {
    const id = idRegiaoAcao();
    if (!id) {
      showToast('Selecione a região para enviar', 'warning');
      return;
    }
    if (pending.size) {
      showToast('Salve as alterações antes de enviar', 'warning');
      return;
    }
    setSalvando(true);
    try {
      const data = await api.escalaVisitasSubmeter({ semana_inicio: semanaInicio, id_regiao: id });
      setGrade(data);
      showToast('Escala enviada para aprovação', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao enviar', 'error');
    } finally {
      setSalvando(false);
    }
  }

  async function aprovarRegiao(id: number) {
    setSalvando(true);
    try {
      const data = await api.escalaVisitasAprovar({ semana_inicio: semanaInicio, id_regiao: id });
      setGrade(data);
      showToast('Região aprovada', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao aprovar', 'error');
    } finally {
      setSalvando(false);
    }
  }

  async function devolverRegiao(id: number) {
    setSalvando(true);
    try {
      const data = await api.escalaVisitasDevolver({ semana_inicio: semanaInicio, id_regiao: id });
      setGrade(data);
      showToast('Escala devolvida ao regional', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao devolver', 'error');
    } finally {
      setSalvando(false);
    }
  }

  async function enviarDeliveryAprovacao() {
    if (pending.size) {
      showToast('Salve as alterações antes de enviar', 'warning');
      return;
    }
    setSalvando(true);
    try {
      const data = await api.escalaVisitasDeliverySubmeter({ semana_inicio: semanaInicio });
      setGrade(data);
      showToast('Delivery enviado para aprovação', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao enviar', 'error');
    } finally {
      setSalvando(false);
    }
  }

  async function aprovarDelivery() {
    setSalvando(true);
    try {
      const data = await api.escalaVisitasDeliveryAprovar({ semana_inicio: semanaInicio });
      setGrade(data);
      showToast('Delivery aprovado', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao aprovar', 'error');
    } finally {
      setSalvando(false);
    }
  }

  async function devolverDelivery() {
    setSalvando(true);
    try {
      const data = await api.escalaVisitasDeliveryDevolver({ semana_inicio: semanaInicio });
      setGrade(data);
      showToast('Delivery devolvido', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao devolver', 'error');
    } finally {
      setSalvando(false);
    }
  }

  async function excluirEscalaRegiao(id: number, nome: string) {
    if (
      !window.confirm(
        `Excluir a escala de ${nome} desta semana?\n\nApaga todas as visitas montadas e volta para rascunho.`,
      )
    ) {
      return;
    }
    setSalvando(true);
    try {
      const data = await api.escalaVisitasLimpar({ semana_inicio: semanaInicio, id_regiao: id });
      setGrade(data);
      setPending(new Map());
      showToast(`Escala de ${nome} excluída`, 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao excluir', 'error');
    } finally {
      setSalvando(false);
    }
  }

  async function excluirEscalaDelivery() {
    if (
      !window.confirm(
        'Excluir a escala de delivery desta semana?\n\nApaga todos os agendamentos e volta para rascunho.',
      )
    ) {
      return;
    }
    setSalvando(true);
    try {
      const data = await api.escalaVisitasDeliveryLimpar({ semana_inicio: semanaInicio });
      setGrade(data);
      setPending(new Map());
      showToast('Escala de delivery excluída', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao excluir', 'error');
    } finally {
      setSalvando(false);
    }
  }


  const linhasComTotais = useMemo(() => {
    if (!grade) return [];
    return grade.linhas.map((linha: EscalaVisitasLinha) => {
      let total = 0;
      const ehDelivery = linha.tipo === 'delivery';
      const dias = linha.dias.map((d) => {
        const idsEfetivo = ehDelivery
          ? valorCelulaDelivery(linha.id_loja, d.dia, d)
          : valorCelulaRegional(linha.id_loja, d.dia, d);
        total += idsEfetivo.length;
        return ehDelivery
          ? { ...d, ids_loja_destino_efetivo: idsEfetivo }
          : { ...d, ids_regional_efetivo: idsEfetivo };
      });
      return { ...linha, dias, total_visitas_efetivo: total };
    });
  }, [grade, pending]);

  const linhasVisitasComTotais = useMemo(
    () => linhasComTotais.filter((linha) => linha.tipo !== 'delivery'),
    [linhasComTotais],
  );

  const linhaDelivery = useMemo(() => linhaDeliveryDaGrade(grade?.linhas), [grade?.linhas]);

  const lojasDelivery = grade?.lojas_destino ?? [];

  const deliveryLinhas = useMemo(() => {
    if (!linhaDelivery) return [];
    return lojasDelivery.map((loja) => {
      let total = 0;
      const dias = DIAS.map((_, dia) => {
        const marcada = valorCelulaDelivery(linhaDelivery.id_loja, dia, linhaDelivery.dias[dia]).includes(loja.id_loja);
        if (marcada) total += 1;
        return { dia, marcada };
      });
      return { ...loja, dias, total };
    });
  }, [linhaDelivery, lojasDelivery, grade, pending]);

  const regionaisAgrupados = useMemo(
    () => agruparRegionaisEscala(grade?.regionais ?? []),
    [grade?.regionais],
  );

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        minHeight: 0,
        flex: 1,
        height: '100%',
        overflow: 'hidden',
      }}
    >
      <Paper sx={{ px: 1.25, py: 1, borderRadius: 2, border: `1px solid ${colors.border}`, flexShrink: 0 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
            <IconButton size="small" onClick={() => setSemanaInicio(addDaysIso(semanaInicio, -7))} aria-label="Semana anterior">
              <ChevronLeftIcon />
            </IconButton>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.15 }}>
                Semana {grade?.semana_label ?? fmtDataCurta(semanaInicio)}
              </Typography>
            </Box>
            <IconButton size="small" onClick={() => setSemanaInicio(addDaysIso(semanaInicio, 7))} aria-label="Próxima semana">
              <ChevronRightIcon />
            </IconButton>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={aba}
              onChange={(_, v: 'visitas' | 'delivery' | null) => {
                if (v) setAba(v);
              }}
              sx={{
                ml: { sm: 0.5 },
                bgcolor: colors.canvasAlt,
                '& .MuiToggleButton-root': {
                  px: 1.75,
                  py: 0.45,
                  fontWeight: 700,
                  textTransform: 'none',
                  border: 'none',
                  fontSize: '0.82rem',
                },
                '& .Mui-selected': {
                  bgcolor: aba === 'delivery' ? 'rgba(232, 82, 10, 0.14)' : '#fff',
                  color: aba === 'delivery' ? colors.orange : colors.navy,
                  boxShadow: '0 1px 4px rgba(27, 42, 107, 0.12)',
                },
              }}
            >
              {!ehDeliveryOnly && <ToggleButton value="visitas">Visitas</ToggleButton>}
              <ToggleButton value="delivery">Delivery</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
            {grade && grade.regioes.length > 0 && !ehDeliveryOnly && (
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Região</InputLabel>
                <Select
                  label="Região"
                  value={idRegiao === '' ? '' : idRegiao}
                  onChange={(e) => {
                    const v = e.target.value;
                    setIdRegiao(String(v) === '' ? '' : Number(v));
                  }}
                  disabled={ehRegional && grade.regioes.length === 1}
                >
                  {!ehRegional && <MenuItem value="">Todas as lojas</MenuItem>}
                  {grade.regioes.map((r: { id_regiao: number; nome: string }) => (
                    <MenuItem key={r.id_regiao} value={r.id_regiao}>
                      {r.nome}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            {grade?.pode_editar && (
              <Button
                variant="outlined"
                size="small"
                startIcon={<ContentCopyIcon />}
                disabled={salvando}
                onClick={() => void copiarSemanaAnterior()}
              >
                Copiar semana anterior
              </Button>
            )}
            {(podeEditarGrade || podeEditarDelivery) && (
              <Button
                variant="contained"
                size="small"
                startIcon={<SaveIcon />}
                disabled={salvando || pending.size === 0}
                onClick={() => void salvar()}
              >
                Salvar{pending.size > 0 ? ` (${pending.size})` : ''}
              </Button>
            )}
            {grade?.pode_submeter && (
              <Button
                variant="contained"
                size="small"
                startIcon={<SendIcon />}
                disabled={salvando || pending.size > 0}
                onClick={() => void enviarAprovacao()}
                sx={{ bgcolor: colors.orange, '&:hover': { bgcolor: colors.orangeHover } }}
              >
                Enviar para aprovação
              </Button>
            )}
            {grade?.pode_submeter_delivery && (
              <Button
                variant="contained"
                size="small"
                startIcon={<SendIcon />}
                disabled={salvando || pending.size > 0}
                onClick={() => void enviarDeliveryAprovacao()}
                sx={{ bgcolor: colors.orange, '&:hover': { bgcolor: colors.orangeHover } }}
              >
                Enviar para aprovação
              </Button>
            )}
          </Box>
        </Box>

        {(ehDeliveryOnly
          ? Boolean(grade?.status_delivery)
          : aba === 'delivery'
            ? Boolean(grade?.status_delivery)
            : Boolean(grade?.status_por_regiao?.length)) && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mt: 1, minWidth: 0 }}>
            {ehDiretor &&
              ((aba === 'visitas' &&
                (grade?.status_por_regiao ?? []).some((s) => s.status === 'pendente_aprovacao')) ||
                (aba === 'delivery' && grade?.status_delivery?.status === 'pendente_aprovacao')) && (
                <Typography variant="caption" sx={{ fontWeight: 800, color: colors.orange, letterSpacing: 0.04 }}>
                  Escalas aguardando aprovação
                </Typography>
              )}
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 1,
                alignItems: 'stretch',
                pb: 0.5,
                minWidth: 0,
              }}
            >
              {!ehDeliveryOnly &&
                aba === 'visitas' &&
                (grade?.status_por_regiao ?? []).map((st) => {
                  const pendente = st.status === 'pendente_aprovacao';
                  const montadaPor = st.nome_submetido_por
                    ? primeiroNome(st.nome_submetido_por)
                    : null;
                  const revisadaPor = st.nome_revisado_por
                    ? primeiroNome(st.nome_revisado_por)
                    : null;
                  return (
                    <Box
                      key={st.id_regiao}
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 0.35,
                        px: 1,
                        py: 0.65,
                        minWidth: 200,
                        flex: '0 0 auto',
                        borderRadius: 1.5,
                        bgcolor: pendente
                          ? 'rgba(232, 82, 10, 0.08)'
                          : st.status === 'aprovado'
                            ? 'rgba(22, 163, 74, 0.08)'
                            : colors.canvasAlt,
                        border: pendente
                          ? '1px solid rgba(232, 82, 10, 0.28)'
                          : st.status === 'aprovado'
                            ? '1px solid rgba(22, 163, 74, 0.28)'
                            : `1px solid ${colors.border}`,
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                        <Typography
                          component="button"
                          type="button"
                          variant="caption"
                          onClick={() => {
                            setAba('visitas');
                            setIdRegiao(st.id_regiao);
                          }}
                          title="Clique para ver só esta região"
                          sx={{
                            all: 'unset',
                            cursor: 'pointer',
                            fontWeight: 800,
                            color: colors.navy,
                            fontSize: '0.8rem',
                            mr: 0.25,
                          }}
                        >
                          <PlaceIcon fontSize="small" sx={{ mr: 0.5, color: colors.textSecondary }} />
                          {st.nome_regiao}
                        </Typography>
                        {grade?.pode_aprovar && pendente && (
                          <Button
                            size="small"
                            variant="contained"
                            startIcon={<CheckIcon />}
                            disabled={salvando}
                            onClick={() => void aprovarRegiao(st.id_regiao)}
                            sx={{
                              textTransform: 'none',
                              minWidth: 0,
                              py: 0.2,
                              bgcolor: '#15803D',
                              '&:hover': { bgcolor: '#166534' },
                            }}
                          >
                            Aprovar
                          </Button>
                        )}
                        {/* Recusar + Excluir agrupados à direita */}
                        <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.25 }}>
                          {grade?.pode_devolver && (pendente || st.status === 'aprovado') && (
                            <Tooltip title="Recusar" arrow>
                              <span>
                                <IconButton
                                  size="small"
                                  disabled={salvando}
                                  onClick={() => void devolverRegiao(st.id_regiao)}
                                  sx={{
                                    p: 0.5,
                                    color: colors.textSecondary,
                                    '&:hover': { color: 'warning.main', bgcolor: 'rgba(237,108,2,0.10)' },
                                  }}
                                >
                                  <UndoIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                          )}
                          {grade?.pode_excluir && (
                            <Tooltip title="Excluir" arrow>
                              <span>
                                <IconButton
                                  size="small"
                                  disabled={salvando}
                                  onClick={() => void excluirEscalaRegiao(st.id_regiao, st.nome_regiao)}
                                  sx={{
                                    p: 0.5,
                                    color: colors.textSecondary,
                                    '&:hover': { color: 'error.main', bgcolor: 'rgba(220,38,38,0.10)' },
                                  }}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                          )}
                        </Box>
                      </Box>
                      <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.25, px: 0.25 }}>
                        {montadaPor
                          ? `Montada por ${montadaPor}${
                              st.status === 'aprovado' && revisadaPor ? ` · Aprovada por ${revisadaPor}` : ''
                            }${pendente ? ' · aguardando aprovação' : ''}`
                          : st.status === 'rascunho'
                            ? 'Ainda não enviada'
                            : '—'}
                      </Typography>
                      <Typography
                        component="button"
                        type="button"
                        variant="caption"
                        onClick={() => {
                          setAba('visitas');
                          setIdRegiao(st.id_regiao);
                        }}
                        sx={{
                          all: 'unset',
                          cursor: 'pointer',
                          color: colors.navy,
                          fontWeight: 700,
                          px: 0.25,
                          textDecoration: 'underline',
                          fontSize: '0.7rem',
                        }}
                      >
                        Visualizar escala
                      </Typography>
                    </Box>
                  );
                })}
              {grade?.status_delivery && (ehDeliveryOnly || aba === 'delivery') && (() => {
                const st = grade.status_delivery;
                const pendente = st.status === 'pendente_aprovacao';
                const montadaPor = st.nome_submetido_por ? primeiroNome(st.nome_submetido_por) : null;
                const revisadaPor = st.nome_revisado_por ? primeiroNome(st.nome_revisado_por) : null;
                return (
                  <Box
                    key="delivery"
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 0.35,
                      px: 1,
                      py: 0.65,
                      minWidth: 200,
                        flex: '0 0 auto',
                      borderRadius: 1.5,
                      bgcolor: pendente
                        ? 'rgba(232, 82, 10, 0.08)'
                        : st.status === 'aprovado'
                          ? 'rgba(22, 163, 74, 0.08)'
                          : colors.canvasAlt,
                      border: pendente
                        ? '1px solid rgba(232, 82, 10, 0.28)'
                        : st.status === 'aprovado'
                          ? '1px solid rgba(22, 163, 74, 0.28)'
                          : `1px solid ${colors.border}`,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                      <TwoWheelerIcon fontSize="small" sx={{ color: colors.textSecondary }} />
                      <Chip
                        size="small"
                        clickable={!ehDeliveryOnly}
                        onClick={() => setAba('delivery')}
                        label={`Delivery: ${STATUS_LABEL[st.status] || st.status}`}
                        sx={STATUS_CHIP_SX[st.status] || STATUS_CHIP_SX.rascunho}
                        title="Ver escala de delivery"
                      />
                      {grade.pode_aprovar && pendente && (
                        <Button
                          size="small"
                          variant="contained"
                          startIcon={<CheckIcon />}
                          disabled={salvando}
                          onClick={() => void aprovarDelivery()}
                          sx={{
                            textTransform: 'none',
                            minWidth: 0,
                            py: 0.2,
                            bgcolor: '#15803D',
                            '&:hover': { bgcolor: '#166534' },
                          }}
                        >
                          Aprovar
                        </Button>
                      )}
                      {/* Recusar + Excluir agrupados à direita */}
                      <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.25 }}>
                        {grade.pode_devolver && (pendente || st.status === 'aprovado') && (
                          <Tooltip title="Recusar" arrow>
                            <span>
                              <IconButton
                                size="small"
                                disabled={salvando}
                                onClick={() => void devolverDelivery()}
                                sx={{
                                  p: 0.5,
                                  color: colors.textSecondary,
                                  '&:hover': { color: 'warning.main', bgcolor: 'rgba(237,108,2,0.10)' },
                                }}
                              >
                                <UndoIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        )}
                        {grade.pode_excluir && (
                          <Tooltip title="Excluir" arrow>
                            <span>
                              <IconButton
                                size="small"
                                disabled={salvando}
                                onClick={() => void excluirEscalaDelivery()}
                                sx={{
                                  p: 0.5,
                                  color: colors.textSecondary,
                                  '&:hover': { color: 'error.main', bgcolor: 'rgba(220,38,38,0.10)' },
                                }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        )}
                      </Box>
                    </Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.25, px: 0.25 }}>
                      {montadaPor
                        ? `Montada por ${montadaPor}${
                            st.status === 'aprovado' && revisadaPor ? ` · Aprovada por ${revisadaPor}` : ''
                          }${pendente ? ' · aguardando aprovação' : ''}`
                        : st.status === 'rascunho'
                          ? 'Ainda não enviada'
                          : '—'}
                    </Typography>
                  </Box>
                );
              })()}
            </Box>
          </Box>
        )}

        {grade && grade.regionais.length > 0 && aba === 'visitas' && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 0.75 }}>
            {regionaisAgrupados.flatMap((grupo, indexGrupo) => {
              const bloco: ReactNode[] = [];
              if (indexGrupo > 0) {
                bloco.push(
                  <Box
                    key={`sep-${indexGrupo}`}
                    aria-hidden
                    sx={{
                      width: '1px',
                      height: 18,
                      bgcolor: 'rgba(27, 42, 107, 0.16)',
                      alignSelf: 'center',
                      mx: 0.25,
                      flexShrink: 0,
                    }}
                  />,
                );
              }
              for (const r of grupo.items) {
                bloco.push(
                  <Chip
                    key={r.id_usuario}
                    size="small"
                    label={primeiroNome(r.nome)}
                    title={r.nome}
                    sx={{
                      bgcolor: `${r.cor}22`,
                      border: `1px solid ${r.cor}`,
                      fontWeight: 600,
                      '& .MuiChip-label': { color: colors.textPrimary },
                    }}
                  />,
                );
              }
              return bloco;
            })}
          </Box>
        )}
      </Paper>

      {(loading || salvando) && <LinearProgress />}

      {loading && !grade ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6, flex: 1 }}>
          <CircularProgress />
        </Box>
      ) : aba === 'delivery' ? (
        <Paper
          sx={{
            ...tablePaperSx,
            flex: 1,
            minHeight: { xs: 560, md: 0 },
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {!linhaDelivery ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">Linha de delivery não configurada.</Typography>
            </Box>
          ) : (
            <TableContainer sx={{ ...tableContainerSx, flex: 1 }}>
              <Table size="small" stickyHeader sx={tableSx}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ minWidth: COL_BKN_WIDTH, fontWeight: 700, bgcolor: '#fff', position: 'sticky', left: 0, zIndex: 3 }}>
                      BKN
                    </TableCell>
                    <TableCell sx={{ minWidth: COL_LOJA_MIN_WIDTH, fontWeight: 700, bgcolor: '#fff', position: 'sticky', left: COL_BKN_WIDTH, zIndex: 3 }}>
                      Loja
                    </TableCell>
                    {DIAS.map((label, dia) => {
                      const idsDia = valorCelulaDelivery(linhaDelivery.id_loja, dia, linhaDelivery.dias[dia]);
                      const todas = lojasDelivery.length > 0 && idsDia.length === lojasDelivery.length;
                      return (
                        <TableCell key={label} align="center" sx={{ minWidth: COL_DIA_MIN_WIDTH, fontWeight: 700, whiteSpace: 'nowrap' }}>
                          <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, color: colors.orange }}>
                            {label}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            {fmtDataCurta(addDaysIso(semanaInicio, dia))}
                          </Typography>
                          {podeEditarDelivery && lojasDelivery.length > 0 && (
                            <Button
                              size="small"
                              onClick={() => toggleDiaDeliveryInteiro(dia)}
                              sx={{
                                mt: 0.35,
                                minWidth: 0,
                                px: 0.75,
                                py: 0.15,
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                textTransform: 'none',
                                color: todas ? colors.orange : 'text.secondary',
                              }}
                            >
                              {todas ? 'Limpar' : 'Todas'}
                            </Button>
                          )}
                        </TableCell>
                      );
                    })}
                    <TableCell align="center" sx={{ fontWeight: 700, minWidth: 48 }}>
                      DIAS
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {deliveryLinhas.map((linha) => (
                    <TableRow key={linha.id_loja} hover>
                      <TableCell sx={{ fontWeight: 600, position: 'sticky', left: 0, bgcolor: '#fff', zIndex: 1 }}>
                        {linha.bk_number || '—'}
                      </TableCell>
                      <TableCell sx={{ position: 'sticky', left: COL_BKN_WIDTH, bgcolor: '#fff', zIndex: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap title={linha.nome}>
                          {linha.nome}
                        </Typography>
                      </TableCell>
                      {linha.dias.map((d) => (
                        <TableCell key={d.dia} align="center" sx={{ p: 0.5 }}>
                          <Checkbox
                            size="medium"
                            checked={d.marcada}
                            disabled={!podeEditarDelivery}
                            onChange={() => toggleLojaDelivery(d.dia, linha.id_loja)}
                            sx={{
                              p: 0.5,
                              color: colors.orange,
                              '&.Mui-checked': { color: colors.orange },
                            }}
                          />
                        </TableCell>
                      ))}
                      <TableCell align="center" sx={{ fontWeight: 700 }}>
                        {linha.total}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!deliveryLinhas.length && (
                    <TableRow>
                      <TableCell colSpan={10} align="center" sx={{ py: 4 }}>
                        <Typography color="text.secondary">Nenhuma loja neste filtro.</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      ) : (
        <Paper
          sx={{
            ...tablePaperSx,
            flex: 1,
            minHeight: { xs: 560, md: 0 },
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <TableContainer sx={{ ...tableContainerSx, flex: 1 }}>
            <Table size="small" stickyHeader sx={tableSx}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ minWidth: COL_BKN_WIDTH, fontWeight: 700, bgcolor: '#fff', position: 'sticky', left: 0, zIndex: 3 }}>
                    BKN
                  </TableCell>
                  <TableCell sx={{ minWidth: COL_LOJA_MIN_WIDTH, fontWeight: 700, bgcolor: '#fff', position: 'sticky', left: COL_BKN_WIDTH, zIndex: 3 }}>
                    Loja
                  </TableCell>
                  {DIAS.map((label, i) => (
                    <TableCell key={label} align="center" sx={{ minWidth: COL_DIA_MIN_WIDTH, fontWeight: 700, whiteSpace: 'nowrap' }}>
                      <Typography variant="caption" sx={{ display: 'block', fontWeight: 700 }}>
                        {label}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {fmtDataCurta(addDaysIso(semanaInicio, i))}
                      </Typography>
                    </TableCell>
                  ))}
                  <TableCell align="center" sx={{ fontWeight: 700, minWidth: 48 }}>
                    VIS
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {linhasVisitasComTotais.map((linha) => (
                  <TableRow key={linha.id_loja} hover>
                    <TableCell sx={{ fontWeight: 600, position: 'sticky', left: 0, bgcolor: '#fff', zIndex: 1 }}>
                      {linha.bk_number || '—'}
                    </TableCell>
                    <TableCell sx={{ position: 'sticky', left: COL_BKN_WIDTH, bgcolor: '#fff', zIndex: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap title={linha.nome}>
                        {linha.nome}
                      </Typography>
                      {linha.nome_regiao && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          {linha.nome_regiao}
                        </Typography>
                      )}
                    </TableCell>
                    {linha.dias.map((d) => {
                      const idsReg = 'ids_regional_efetivo' in d ? d.ids_regional_efetivo : [];
                      const nomes = idsReg
                        .map((id) => mapNomeRegional.get(id))
                        .filter(Boolean)
                        .map((n) => primeiroNome(n!));
                      const tooltip = nomes.length ? nomes.join(', ') : 'Sem visita';
                      const cor = idsReg.length === 1 ? mapCorRegional.get(idsReg[0]) || '#64748B' : undefined;
                      return (
                        <TableCell key={d.dia} align="center" sx={{ p: 0.5, verticalAlign: 'top' }}>
                          {podeEditarGrade && ehRegional ? (
                            <Button
                              size="small"
                              onClick={() =>
                                toggleCelulaRegionalEquipe(linha.id_loja, d.dia, linha.id_regiao, idsReg)
                              }
                              sx={{
                                ...SELECT_CELULA_SX,
                                minHeight: 36,
                                textTransform: 'none',
                                fontWeight: 700,
                                color: colors.textPrimary,
                                border: idsReg.length
                                  ? `1px solid ${cor ?? colors.navy}`
                                  : '1px dashed #e5e7eb',
                                bgcolor: cor
                                  ? `${cor}33`
                                  : idsReg.length
                                    ? `${COR_ESCALA_MULTI}33`
                                    : 'transparent',
                              }}
                            >
                              {idsReg.length
                                ? idsReg
                                    .map((id) => primeiroNome(mapNomeRegional.get(id) ?? ''))
                                    .filter(Boolean)
                                    .join(', ') || 'Equipe'
                                : '+'}
                            </Button>
                          ) : podeEditarGrade ? (
                            <Select
                              multiple
                              size="small"
                              displayEmpty
                              value={idsReg}
                              input={<OutlinedInput />}
                              onChange={(e) => {
                                const v = e.target.value;
                                const lista = typeof v === 'string' ? v.split(',').map(Number) : (v as number[]);
                                alterarCelulaRegional(linha.id_loja, d.dia, lista);
                              }}
                              renderValue={(selected) => {
                                const ids = selected as number[];
                                if (!ids.length) return '—';
                                return ids
                                  .map((id) => primeiroNome(mapNomeRegional.get(id) ?? ''))
                                  .filter(Boolean)
                                  .join(', ');
                              }}
                              sx={{
                                ...SELECT_CELULA_SX,
                                bgcolor: cor
                                  ? `${cor}33`
                                  : idsReg.length > 1
                                    ? `${COR_ESCALA_MULTI}33`
                                    : undefined,
                              }}
                            >
                              {(grade?.regionais ?? []).map((r) => (
                                <MenuItem key={r.id_usuario} value={r.id_usuario} sx={{ py: 0.35 }}>
                                  <Checkbox
                                    size="small"
                                    checked={idsReg.includes(r.id_usuario)}
                                    sx={{ py: 0, mr: 0.5 }}
                                  />
                                  <ListItemText
                                    primary={r.nome}
                                    slotProps={{ primary: { sx: { fontSize: '0.82rem' } } }}
                                  />
                                </MenuItem>
                              ))}
                            </Select>
                          ) : (
                            <Tooltip title={tooltip}>
                              <Box
                                sx={{
                                  py: 0.65,
                                  px: 0.5,
                                  borderRadius: 1,
                                  bgcolor: cor
                                    ? `${cor}44`
                                    : idsReg.length
                                      ? `${COR_ESCALA_MULTI}33`
                                      : 'transparent',
                                  border: idsReg.length
                                    ? `1px solid ${cor ?? COR_ESCALA_MULTI}`
                                    : '1px dashed #e5e7eb',
                                  fontSize: '0.72rem',
                                  fontWeight: 600,
                                  minHeight: 32,
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: 0.25,
                                }}
                              >
                                {nomes.length ? (
                                  nomes.map((n) => (
                                    <Box key={n} component="span" sx={{ lineHeight: 1.2 }}>
                                      {n}
                                    </Box>
                                  ))
                                ) : (
                                  '—'
                                )}
                              </Box>
                            </Tooltip>
                          )}
                        </TableCell>
                      );
                    })}
                    <TableCell align="center" sx={{ fontWeight: 700 }}>
                      {linha.total_visitas_efetivo}
                    </TableCell>
                  </TableRow>
                ))}
                {!linhasVisitasComTotais.length && (
                  <TableRow>
                    <TableCell colSpan={10} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">Nenhuma loja neste filtro.</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {!podeEditarGrade && !podeEditarDelivery && (
        <Typography variant="caption" color="text.secondary" sx={{ px: 1, flexShrink: 0 }}>
          {ehRegional
            ? 'Modo leitura — escala pendente ou já aprovada. Aguarde devolução do diretor para editar.'
            : 'Modo leitura — supervisores montam a região; o diretor aprova.'}
        </Typography>
      )}
      {ehDeliveryOnly && (
        <Typography variant="caption" color="text.secondary" sx={{ px: 1, flexShrink: 0 }}>
          Você preenche apenas a escala de delivery.
        </Typography>
      )}
      {ehRegional && podeEditarGrade && (
        <Typography variant="caption" color="text.secondary" sx={{ px: 1, flexShrink: 0 }}>
          Toque na célula para marcar sua visita. Só entram diretor, regionais e marketing.
        </Typography>
      )}
    </Box>
  );
}
