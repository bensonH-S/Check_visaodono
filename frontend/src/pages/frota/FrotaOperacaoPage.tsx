import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import Tooltip from '@mui/material/Tooltip';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import PersonAddAlt1OutlinedIcon from '@mui/icons-material/PersonAddAlt1Outlined';
import PersonRemoveAlt1OutlinedIcon from '@mui/icons-material/PersonRemoveAlt1Outlined';
import SpeedOutlinedIcon from '@mui/icons-material/SpeedOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import PlaceIcon from '@mui/icons-material/Place';
import SyncIcon from '@mui/icons-material/Sync';
import {
  api,
  fetchMediaAutenticada,
  type FrotaAbastecimentoPortal,
  type FrotaManutencaoPortal,
  type FrotaMultaDetran,
  type FrotaVeiculo,
  type Usuario,
} from '../../api/client';
import { getUsuario, temPermissao } from '../../lib/auth';
import FrotaVeiculoDialog from '../../components/frota/FrotaVeiculoDialog';
import FrotaVeiculoAutocomplete from '../../components/frota/FrotaVeiculoAutocomplete';
import FiltroIntervaloDatasFrota from '../../components/frota/FiltroIntervaloDatasFrota';
import ImageLightbox from '../../components/ImageLightbox';
import { colors, radius, shadows } from '../../theme/tokens';
import { dataHojeBrasilia, formatDataHoraBrasilia } from '../../utils/dateBr';
import { dataDentroIntervalo, matchVeiculo, matchVeiculoObj } from '../../utils/frotaPortalFiltros';
import { tableCellWrapSx, tableContainerSx, tablePageLayoutSx, tableSx } from '../../utils/tablePageLayout';

export type AbaOperacao = 'cadastro' | 'combustivel' | 'manutencoes' | 'multas';

/** Intervalo padrão entre manutenções (usuário citou ~10 mil km). */
export const INTERVALO_MANUTENCAO_KM = 10_000;

const ABAS: { id: AbaOperacao; label: string }[] = [
  { id: 'cadastro', label: 'Cadastro' },
  { id: 'combustivel', label: 'Combustível' },
  { id: 'manutencoes', label: 'Manutenções' },
  { id: 'multas', label: 'Multas' },
];

function parseAba(raw: string | null): AbaOperacao {
  if (raw === 'combustivel' || raw === 'manutencoes' || raw === 'cadastro' || raw === 'multas') return raw;
  return 'cadastro';
}

function fmtData(d: string | null) {
  if (!d) return '—';
  const [y, m, day] = d.slice(0, 10).split('-');
  return `${day}/${m}/${y}`;
}

function fmtKm(n: number | null | undefined) {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return Number(n).toLocaleString('pt-BR');
}

function tituloVeiculo(v: FrotaVeiculo) {
  return [v.marca, v.modelo].filter(Boolean).join(' ') || 'Veículo';
}

function proximaManutencaoKm(kmManutencao: number | null | undefined) {
  if (kmManutencao == null || !Number.isFinite(Number(kmManutencao))) return null;
  return Number(kmManutencao) + INTERVALO_MANUTENCAO_KM;
}

function KpiItem({ label, valor }: { label: string; valor: string }) {
  return (
    <Box sx={{ minWidth: 0, px: { xs: 1, md: 1.5 }, py: 1 }}>
      <Typography
        sx={{
          fontSize: '0.6875rem',
          fontWeight: 600,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: colors.textMuted,
          mb: 0.35,
        }}
      >
        {label}
      </Typography>
      <Typography
        sx={{
          fontWeight: 700,
          fontSize: { xs: '1.15rem', md: '1.35rem' },
          lineHeight: 1.15,
          color: colors.textPrimary,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {valor}
      </Typography>
    </Box>
  );
}

export default function FrotaOperacaoPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const aba = parseAba(searchParams.get('aba'));

  const [veiculos, setVeiculos] = useState<FrotaVeiculo[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  
  const sessao = useMemo(() => getUsuario(), []);
  const podeSincronizar = useMemo(() => temPermissao('frota.multas.sync', sessao), [sessao]);
  const [modalDetalheMulta, setModalDetalheMulta] = useState<{ open: boolean; titulo: string; conteudo: string; tipo: 'descricao' | 'local' | '' }>({
    open: false,
    titulo: '',
    conteudo: '',
    tipo: '',
  });
  const [confirmarSyncOpen, setConfirmarSyncOpen] = useState(false);
  const [abastecimentos, setAbastecimentos] = useState<FrotaAbastecimentoPortal[]>([]);
  const [manutencoes, setManutencoes] = useState<FrotaManutencaoPortal[]>([]);
  const [multas, setMultas] = useState<FrotaMultaDetran[]>([]);
  const [multasAvisos, setMultasAvisos] = useState<string[]>([]);
  const [multasConsultadoEm, setMultasConsultadoEm] = useState<string | null>(null);
  const [carregandoMultas, setCarregandoMultas] = useState(false);
  const [statusMenuAnchor, setStatusMenuAnchor] = useState<{ anchorEl: HTMLElement; multa: FrotaMultaDetran } | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [veiculoSel, setVeiculoSel] = useState<FrotaVeiculo | null>(null);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [dialogAberto, setDialogAberto] = useState(false);
  const [editando, setEditando] = useState<FrotaVeiculo | null>(null);

  const [atribuirOpen, setAtribuirOpen] = useState(false);
  const [atribuirVeiculo, setAtribuirVeiculo] = useState<FrotaVeiculo | null>(null);
  const [atribuirUsuario, setAtribuirUsuario] = useState<Usuario | null>(null);
  const [atribuirKm, setAtribuirKm] = useState('');
  const [atribuirSalvando, setAtribuirSalvando] = useState(false);
  const [atribuirErro, setAtribuirErro] = useState('');
  const [kmAtribOpen, setKmAtribOpen] = useState(false);
  const [kmAtribVeiculo, setKmAtribVeiculo] = useState<FrotaVeiculo | null>(null);
  const [kmAtribValor, setKmAtribValor] = useState('');
  const [kmAtribAtual, setKmAtribAtual] = useState('');
  const [kmAtribSalvando, setKmAtribSalvando] = useState(false);
  const [kmAtribErro, setKmAtribErro] = useState('');
  const [proxOpen, setProxOpen] = useState(false);
  const [proxVeiculo, setProxVeiculo] = useState<FrotaVeiculo | null>(null);
  const [proxValor, setProxValor] = useState('');
  const [proxSalvando, setProxSalvando] = useState(false);
  const [proxErro, setProxErro] = useState('');
  const [liberarOpen, setLiberarOpen] = useState(false);
  const [comprovanteSrc, setComprovanteSrc] = useState<string | null>(null);
  const [comprovanteTitulo, setComprovanteTitulo] = useState('');
  const [carregandoComprovante, setCarregandoComprovante] = useState(false);
  const [liberarVeiculo, setLiberarVeiculo] = useState<FrotaVeiculo | null>(null);
  const [liberarKm, setLiberarKm] = useState('');
  const [liberarSalvando, setLiberarSalvando] = useState(false);
  const [liberarErro, setLiberarErro] = useState('');

  const carregar = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.frotaVeiculos(),
      api.frotaAbastecimentosPortal(),
      api.frotaManutencoesPortal(),
      api.usuarios().catch(() => [] as Usuario[]),
    ])
      .then(([v, ab, m, u]) => {
        setVeiculos(v);
        setAbastecimentos(ab);
        setManutencoes(m);
        setUsuarios(u);
      })
      .catch((e) => setErro(e instanceof Error ? e.message : 'Erro ao carregar'))
      .finally(() => setLoading(false));
  }, []);

  const carregarMultasCache = useCallback(async (idVeiculo?: number | null) => {
    setCarregandoMultas(true);
    setMultasAvisos([]);
    try {
      const r = await api.frotaMultasDetran(idVeiculo ?? undefined);
      setMultas(r.multas || []);
      setMultasAvisos(r.avisos || []);
      setMultasConsultadoEm(r.consultado_em || null);
    } catch (e) {
      setMultas([]);
      setMultasAvisos([e instanceof Error ? e.message : 'Falha ao carregar multas do cache']);
      setMultasConsultadoEm(null);
    } finally {
      setCarregandoMultas(false);
    }
  }, []);

  const sincronizarMultas = async () => {
    setCarregandoMultas(true);
    setMultasAvisos([]);
    try {
      const r = await api.frotaMultasDetranSync(true);
      const cache = r.cache || {};
      setMultas(cache.multas || []);
      setMultasAvisos(cache.avisos || []);
      setMultasConsultadoEm(cache.consultado_em || null);
      if (r.erros && r.erros.length > 0) {
        setMultasAvisos((prev) => [...prev, ...r.erros]);
      }
    } catch (e) {
      setMultasAvisos([e instanceof Error ? e.message : 'Falha ao sincronizar multas']);
    } finally {
      setCarregandoMultas(false);
    }
  };

  const obterStatusChipEstilo = (status?: string) => {
    switch (status) {
      case 'Paga':
        return { bgcolor: 'rgba(46, 125, 50, 0.12)', color: '#2e7d32', border: '1px solid #2e7d32' };
      case 'Vencida':
        return { bgcolor: 'rgba(211, 47, 47, 0.12)', color: '#d32f2f', border: '1px solid #d32f2f' };
      default:
        return { bgcolor: 'rgba(2, 136, 209, 0.12)', color: '#0288d1', border: '1px solid #0288d1' };
    }
  };

  const obterStatusEfetivo = (m: FrotaMultaDetran) => {
    if (m.status === 'Paga') return 'Paga';
    if (m.status === 'Vencida') return 'Vencida';
    if (m.data_vencimento) {
      const hoje = dataHojeBrasilia();
      const vencFmt = String(m.data_vencimento).slice(0, 10);
      if (vencFmt && vencFmt < hoje) {
        return 'Vencida';
      }
    }
    return m.status || 'Em Aberto';
  };

  const alterarStatusMulta = async (novoStatus: 'Em Aberto' | 'Paga' | 'Vencida') => {
    if (!statusMenuAnchor) return;
    const { multa } = statusMenuAnchor;
    setStatusMenuAnchor(null);
    try {
      await api.frotaAtualizarStatusMultaDetran(multa.id_multa_detran, novoStatus);
      setMultas((prev) =>
        prev.map((item) =>
          item.id_multa_detran === multa.id_multa_detran ? { ...item, status: novoStatus } : item
        )
      );
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao atualizar status');
    }
  };

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    if (aba !== 'multas') return;
    void carregarMultasCache(veiculoSel?.id_veiculo ?? null);
  }, [aba, veiculoSel?.id_veiculo, carregarMultasCache]);

  const idVeiculoFiltro = veiculoSel?.id_veiculo ?? null;
  const veiculosOrdenados = useMemo(
    () => [...veiculos].sort((a, b) => a.placa.localeCompare(b.placa, 'pt-BR')),
    [veiculos],
  );
  const usuariosOrdenados = useMemo(
    () => [...usuarios].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [usuarios],
  );

  const veiculosFiltrados = useMemo(
    () => veiculosOrdenados.filter((v) => matchVeiculoObj(v, idVeiculoFiltro, '')),
    [veiculosOrdenados, idVeiculoFiltro],
  );

  /** Manutenções / KM por GPS: só veículos com rastreador instalado. */
  const veiculosGpsTodos = useMemo(
    () => veiculosOrdenados.filter((v) => v.gps_instalado || v.id_rastreamento != null),
    [veiculosOrdenados],
  );
  const veiculosComGps = useMemo(
    () => veiculosGpsTodos.filter((v) => matchVeiculoObj(v, idVeiculoFiltro, '')),
    [veiculosGpsTodos, idVeiculoFiltro],
  );

  const qtdEmUso = useMemo(
    () =>
      (aba === 'manutencoes' ? veiculosComGps : veiculosFiltrados).filter((v) => v.id_usuario_responsavel)
        .length,
    [aba, veiculosComGps, veiculosFiltrados],
  );
  const qtdLivres =
    (aba === 'manutencoes' ? veiculosComGps.length : veiculosFiltrados.length) - qtdEmUso;

  const abastecimentosFiltrados = useMemo(
    () =>
      abastecimentos.filter(
        (a) =>
          (!veiculoSel || a.id_veiculo === veiculoSel.id_veiculo) &&
          dataDentroIntervalo(a.data_abastecimento, dataInicio, dataFim),
      ),
    [abastecimentos, veiculoSel, dataInicio, dataFim],
  );

  const multasFiltradas = useMemo(
    () =>
      multas.filter(
        (m) =>
          (!veiculoSel || m.id_veiculo === veiculoSel.id_veiculo) &&
          (m.data_multa ? dataDentroIntervalo(m.data_multa, dataInicio, dataFim) : (!dataInicio && !dataFim)),
      ),
    [multas, veiculoSel, dataInicio, dataFim],
  );

  const totalMultas = multasFiltradas.reduce((s, m) => s + (m.valor ?? 0), 0);

  /** Status atual por veículo (KM + última manutenção), mesmo sem lançamentos. */
  const statusManutencao = useMemo(() => {
    const ultimaPorVeiculo = new Map<number, FrotaManutencaoPortal>();
    for (const m of manutencoes) {
      if (!matchVeiculo(m, idVeiculoFiltro, '', veiculos)) continue;
      const atual = ultimaPorVeiculo.get(m.id_veiculo);
      if (!atual) {
        ultimaPorVeiculo.set(m.id_veiculo, m);
        continue;
      }
      const tNovo = Date.parse(m.data_manutencao) || 0;
      const tAtual = Date.parse(atual.data_manutencao) || 0;
      if (tNovo > tAtual || (tNovo === tAtual && m.id_manutencao > atual.id_manutencao)) {
        ultimaPorVeiculo.set(m.id_veiculo, m);
      }
    }
    return veiculosComGps.map((v) => {
      const ultima = ultimaPorVeiculo.get(v.id_veiculo) ?? null;
      const kmManut = ultima?.km ?? null;
      const proxKm =
        ultima?.proxima_manutencao_km != null && Number.isFinite(Number(ultima.proxima_manutencao_km))
          ? Number(ultima.proxima_manutencao_km)
          : v.proxima_manutencao_km != null && Number.isFinite(Number(v.proxima_manutencao_km))
            ? Number(v.proxima_manutencao_km)
            : proximaManutencaoKm(kmManut);
      const kmAtual = v.km_atual ?? ultima?.km_atual_veiculo ?? null;
      const faltam =
        proxKm != null && kmAtual != null ? Math.max(0, proxKm - kmAtual) : null;
      const atrasada = proxKm != null && kmAtual != null && kmAtual >= proxKm;
      return { veiculo: v, ultima, kmManut, kmAtual, proxKm, faltam, atrasada };
    });
  }, [manutencoes, veiculosComGps, idVeiculoFiltro, veiculos]);

  const qtdComRegistroManut = useMemo(
    () => statusManutencao.filter((s) => s.ultima != null).length,
    [statusManutencao],
  );

  const totalCombustivel = abastecimentosFiltrados.reduce((s, a) => s + a.valor_abastecido, 0);
  const filtrosAtivos = veiculoSel != null || !!dataInicio || !!dataFim;
  const mostrarPeriodo = aba === 'combustivel' || aba === 'multas';

  function setAba(next: AbaOperacao) {
    if (
      next === 'manutencoes' &&
      veiculoSel &&
      !(veiculoSel.gps_instalado || veiculoSel.id_rastreamento != null)
    ) {
      setVeiculoSel(null);
    }
    setSearchParams(next === 'cadastro' ? {} : { aba: next }, { replace: true });
  }

  function limparFiltros() {
    setVeiculoSel(null);
    setDataInicio('');
    setDataFim('');
  }

  function abrirNovo() {
    setEditando(null);
    setErro('');
    setDialogAberto(true);
  }

  function abrirEditar(v: FrotaVeiculo) {
    navigate(`/frota/veiculos/${v.id_veiculo}?editar=1`);
  }

  function abrirAtribuir(v: FrotaVeiculo) {
    setAtribuirVeiculo(v);
    setAtribuirUsuario(
      v.id_usuario_responsavel
        ? usuariosOrdenados.find((u) => u.id_usuario === v.id_usuario_responsavel) ?? null
        : null,
    );
    setAtribuirKm(
      v.km_assuncao != null
        ? String(v.km_assuncao)
        : v.km_atual != null
          ? String(v.km_atual)
          : '',
    );
    setAtribuirErro('');
    setAtribuirOpen(true);
  }

  function abrirEditarKmAtribuicao(v: FrotaVeiculo) {
    if (!v.id_usuario_responsavel) {
      setErro('Atribua um responsável antes de editar o KM da atribuição');
      return;
    }
    setKmAtribVeiculo(v);
    setKmAtribValor(
      v.km_assuncao != null ? String(v.km_assuncao) : v.km_inicial != null ? String(v.km_inicial) : '',
    );
    setKmAtribAtual(v.km_atual != null ? String(v.km_atual) : '');
    setKmAtribErro('');
    setKmAtribOpen(true);
  }

  async function confirmarAtribuir() {
    if (!atribuirVeiculo || !atribuirUsuario) {
      setAtribuirErro('Selecione o responsável');
      return;
    }
    setAtribuirSalvando(true);
    setAtribuirErro('');
    try {
      const kmNum = atribuirKm.replace(/\D/g, '');
      await api.frotaAtribuirVeiculo(atribuirVeiculo.id_veiculo, {
        id_usuario: atribuirUsuario.id_usuario,
        ...(kmNum ? { km_atual: Number(kmNum) } : {}),
      });
      setAtribuirOpen(false);
      carregar();
    } catch (e) {
      setAtribuirErro(e instanceof Error ? e.message : 'Erro ao atribuir');
    } finally {
      setAtribuirSalvando(false);
    }
  }

  async function confirmarKmAtribuicao() {
    if (!kmAtribVeiculo) return;
    const kmNum = kmAtribValor.replace(/\D/g, '');
    if (!kmNum) {
      setKmAtribErro('Informe o KM da atribuição');
      return;
    }
    setKmAtribSalvando(true);
    setKmAtribErro('');
    try {
      const kmAtualNum = kmAtribAtual.replace(/\D/g, '');
      await api.frotaAtualizarKmAtribuicao(kmAtribVeiculo.id_veiculo, {
        km_atribuicao: Number(kmNum),
        ...(kmAtualNum ? { km_atual: Number(kmAtualNum) } : {}),
      });
      setKmAtribOpen(false);
      carregar();
    } catch (e) {
      setKmAtribErro(e instanceof Error ? e.message : 'Erro ao salvar KM');
    } finally {
      setKmAtribSalvando(false);
    }
  }

  function abrirEditarProxima(v: FrotaVeiculo, proxAtual?: number | null) {
    setProxVeiculo(v);
    const sugestao =
      proxAtual ??
      v.proxima_manutencao_km ??
      (v.km_atual != null ? v.km_atual + INTERVALO_MANUTENCAO_KM : null);
    setProxValor(sugestao != null ? String(sugestao) : '');
    setProxErro('');
    setProxOpen(true);
  }

  async function confirmarProximaManutencao() {
    if (!proxVeiculo) return;
    const kmNum = proxValor.replace(/\D/g, '');
    if (!kmNum) {
      setProxErro('Informe o KM da próxima manutenção');
      return;
    }
    setProxSalvando(true);
    setProxErro('');
    try {
      await api.frotaAtualizarProximaManutencao(proxVeiculo.id_veiculo, {
        proxima_manutencao_km: Number(kmNum),
      });
      setProxOpen(false);
      carregar();
    } catch (e) {
      setProxErro(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setProxSalvando(false);
    }
  }

  function abrirLiberar(v: FrotaVeiculo) {
    if (!v.id_usuario_responsavel) {
      setErro('Este veículo já está livre');
      return;
    }
    setLiberarVeiculo(v);
    setLiberarKm(v.km_atual != null ? String(v.km_atual) : '');
    setLiberarErro('');
    setLiberarOpen(true);
  }

  async function confirmarLiberarVeiculo() {
    if (!liberarVeiculo) return;
    setLiberarSalvando(true);
    setLiberarErro('');
    try {
      const kmNum = liberarKm.replace(/\D/g, '');
      await api.frotaDevolverVeiculoPortal(liberarVeiculo.id_veiculo, {
        ...(kmNum ? { km_atual: Number(kmNum) } : {}),
      });
      setLiberarOpen(false);
      setAtribuirOpen(false);
      carregar();
    } catch (e) {
      setLiberarErro(e instanceof Error ? e.message : 'Erro ao liberar');
    } finally {
      setLiberarSalvando(false);
    }
  }

  async function confirmarLiberar() {
    if (!atribuirVeiculo) return;
    abrirLiberar(atribuirVeiculo);
  }

  async function abrirComprovante(a: FrotaAbastecimentoPortal) {
    if (!a.comprovante_url || carregandoComprovante) return;
    setCarregandoComprovante(true);
    try {
      const path = a.comprovante_url.startsWith('http')
        ? a.comprovante_url
        : `${window.location.origin}${a.comprovante_url}`;
      const blob = await fetchMediaAutenticada(path);
      setComprovanteSrc((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return blob;
      });
      setComprovanteTitulo(`Comprovante · ${a.placa}${a.nome_usuario ? ` · ${a.nome_usuario}` : ''}`);
    } catch {
      setErro('Não foi possível abrir o comprovante');
    } finally {
      setCarregandoComprovante(false);
    }
  }

  function fecharComprovante() {
    setComprovanteSrc((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setComprovanteTitulo('');
  }

  const painelSx = {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    border: '1px solid',
    borderColor: colors.border,
    borderRadius: `${radius.lg}px`,
    bgcolor: colors.surface,
    boxShadow: shadows.sm,
  } as const;

  return (
    <Box sx={{ ...tablePageLayoutSx, gap: 1.25 }}>
      <Paper
        elevation={0}
        sx={{
          p: 1.5,
          flexShrink: 0,
          border: '1px solid',
          borderColor: colors.navyBorder,
          borderRadius: `${radius.lg}px`,
          bgcolor: colors.surface,
          boxShadow: shadows.sm,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 1.5,
          alignItems: 'flex-end',
        }}
      >
        <FrotaVeiculoAutocomplete
          options={aba === 'manutencoes' ? veiculosGpsTodos : veiculosOrdenados}
          value={veiculoSel}
          onChange={setVeiculoSel}
          sx={{ minWidth: 260, flex: '1 1 260px', maxWidth: 400 }}
        />
        {mostrarPeriodo && (
          <FiltroIntervaloDatasFrota
            dataInicio={dataInicio}
            dataFim={dataFim}
            onChangeInicio={setDataInicio}
            onChangeFim={setDataFim}
          />
        )}
        {filtrosAtivos && (
          <Button size="small" onClick={limparFiltros} sx={{ mb: 0.25 }}>
            Limpar
          </Button>
        )}
        {aba === 'cadastro' && (
          <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={abrirNovo} sx={{ ml: 'auto' }}>
            Adicionar veículo
          </Button>
        )}
      </Paper>

      {erro && !dialogAberto && (
        <Alert severity="error" onClose={() => setErro('')} sx={{ flexShrink: 0 }}>
          {erro}
        </Alert>
      )}

      {loading && <LinearProgress sx={{ flexShrink: 0, borderRadius: 1 }} />}

      <Paper
        elevation={0}
        sx={{
          flexShrink: 0,
          border: '1px solid',
          borderColor: colors.border,
          borderRadius: `${radius.lg}px`,
          bgcolor: colors.surface,
          boxShadow: shadows.sm,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, minmax(0, 1fr))' },
          '& > *:not(:last-child)': { borderRight: { md: `1px solid ${colors.border}` } },
          '& > *:nth-of-type(odd)': { borderBottom: { xs: `1px solid ${colors.border}`, md: 'none' } },
        }}
      >
        <KpiItem
          label="Veículos"
          valor={String(aba === 'manutencoes' ? veiculosComGps.length : veiculosFiltrados.length)}
        />
        <KpiItem label="Em uso" valor={String(qtdEmUso)} />
        <KpiItem label="Livres" valor={String(qtdLivres)} />
        <KpiItem
          label={
            aba === 'manutencoes' ? 'Com registro' : aba === 'multas' ? 'Multas' : 'Abastecimentos'
          }
          valor={String(
            aba === 'manutencoes'
              ? qtdComRegistroManut
              : aba === 'multas'
                ? multasFiltradas.length
                : abastecimentosFiltrados.length,
          )}
        />
      </Paper>

      <Paper elevation={0} sx={painelSx}>
        <Box
          sx={{
            px: 1.25,
            borderBottom: '1px solid',
            borderColor: colors.border,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
          }}
        >
          <Tabs
            value={aba}
            onChange={(_, v: AbaOperacao) => setAba(v)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              minHeight: 44,
              '& .MuiTab-root': {
                textTransform: 'none',
                fontWeight: 600,
                minHeight: 44,
                color: colors.textSecondary,
              },
              '& .Mui-selected': { color: `${colors.navy} !important` },
              '& .MuiTabs-indicator': { backgroundColor: colors.navy, height: 2.5 },
            }}
          >
            {ABAS.map((item) => (
              <Tab key={item.id} value={item.id} label={item.label} />
            ))}
          </Tabs>
          {aba === 'combustivel' && abastecimentosFiltrados.length > 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ pr: 1, whiteSpace: 'nowrap' }}>
              R$ {totalCombustivel.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </Typography>
          )}
          {aba === 'multas' && podeSincronizar && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pr: 1 }}>
              <Tooltip title="Realiza a consulta de multas atualizadas diretamente no portal do DETRAN-DF (Infosimples)" arrow>
                <span>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => setConfirmarSyncOpen(true)}
                    disabled={carregandoMultas || loading}
                    sx={{ textTransform: 'none', fontWeight: 600, height: 30 }}
                  >
                    {carregandoMultas ? 'Sincronizando...' : 'Sincronizar DETRAN'}
                  </Button>
                </span>
              </Tooltip>
            </Box>
          )}
          {aba === 'manutencoes' && (
            <Typography variant="caption" color="text.secondary" sx={{ pr: 1, whiteSpace: 'nowrap' }}>
              Só veículos com GPS · clique em Próxima para editar
            </Typography>
          )}
        </Box>

        {aba === 'cadastro' && (
          <TableContainer sx={{ ...tableContainerSx, flex: 1 }}>
            <Table size="small" stickyHeader sx={tableSx}>
              <TableHead>
                <TableRow>
                  <TableCell>Placa</TableCell>
                  <TableCell>Veículo</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Responsável</TableCell>
                  <TableCell>Região</TableCell>
                  <TableCell align="right">KM atribuição</TableCell>
                  <TableCell align="right">KM atual</TableCell>
                  <TableCell align="right" width={160} />
                </TableRow>
              </TableHead>
              <TableBody>
                {veiculosFiltrados.map((v) => {
                  const emUso = Boolean(v.id_usuario_responsavel);
                  return (
                    <TableRow
                      key={v.id_veiculo}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/frota/veiculos/${v.id_veiculo}`)}
                    >
                      <TableCell sx={{ fontWeight: 700, color: colors.navy }}>{v.placa}</TableCell>
                      <TableCell sx={tableCellWrapSx}>{tituloVeiculo(v)}</TableCell>
                      <TableCell>
                        <Chip
                          label={emUso ? 'Em uso' : 'Livre'}
                          size="small"
                          color={emUso ? 'success' : 'default'}
                          variant="outlined"
                          sx={{ fontWeight: 600, height: 22 }}
                        />
                      </TableCell>
                      <TableCell sx={tableCellWrapSx}>{v.nome_responsavel || '—'}</TableCell>
                      <TableCell sx={tableCellWrapSx}>{v.nome_regiao || '—'}</TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {fmtKm(v.km_assuncao ?? (emUso ? v.km_inicial : null))}
                      </TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {fmtKm(v.km_atual)}
                      </TableCell>
                      <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                        {emUso && (
                          <Tooltip title={`Remover ${v.nome_responsavel || 'responsável'}`}>
                            <IconButton
                              size="small"
                              aria-label="Remover responsável"
                              onClick={() => abrirLiberar(v)}
                              sx={{ color: colors.orange }}
                            >
                              <PersonRemoveAlt1OutlinedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {emUso && (
                          <Tooltip title="Editar KM da atribuição">
                            <IconButton
                              size="small"
                              aria-label="Editar KM da atribuição"
                              onClick={() => abrirEditarKmAtribuicao(v)}
                              sx={{ color: colors.navy }}
                            >
                              <SpeedOutlinedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title={emUso ? 'Trocar responsável' : 'Atribuir responsável'}>
                          <IconButton
                            size="small"
                            aria-label="Atribuir responsável"
                            onClick={() => abrirAtribuir(v)}
                            sx={{ color: colors.navy }}
                          >
                            <PersonAddAlt1OutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Editar">
                          <IconButton
                            size="small"
                            aria-label="Editar veículo"
                            onClick={() => abrirEditar(v)}
                            sx={{ color: colors.navy }}
                          >
                            <EditOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!loading && veiculosFiltrados.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      {veiculoSel ? 'Nenhum veículo com o filtro atual.' : 'Nenhum veículo cadastrado.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {aba === 'combustivel' && (
          <TableContainer sx={{ ...tableContainerSx, flex: 1 }}>
            <Table size="small" stickyHeader sx={tableSx}>
              <TableHead>
                <TableRow>
                  <TableCell>Placa</TableCell>
                  <TableCell>Usuário</TableCell>
                  <TableCell align="right">KM</TableCell>
                  <TableCell align="right">Valor</TableCell>
                  <TableCell>Data</TableCell>
                  <TableCell align="center" width={100}>
                    Comprovante
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {abastecimentosFiltrados.map((a) => (
                  <TableRow key={a.id_abastecimento} hover>
                    <TableCell sx={{ fontWeight: 600 }}>{a.placa}</TableCell>
                    <TableCell sx={tableCellWrapSx}>{a.nome_usuario}</TableCell>
                    <TableCell align="right">{fmtKm(a.km_atual)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600, color: colors.navy }}>
                      R$ {a.valor_abastecido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>{formatDataHoraBrasilia(a.data_abastecimento)}</TableCell>
                    <TableCell align="center">
                      {a.comprovante_url ? (
                        <Button
                          size="small"
                          disabled={carregandoComprovante}
                          onClick={() => void abrirComprovante(a)}
                        >
                          Ver
                        </Button>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && abastecimentosFiltrados.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      Nenhum abastecimento encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {aba === 'manutencoes' && (
          <TableContainer sx={{ ...tableContainerSx, flex: 1 }}>
            <Table size="small" stickyHeader sx={tableSx}>
              <TableHead>
                <TableRow>
                  <TableCell>Placa</TableCell>
                  <TableCell>Responsável</TableCell>
                  <TableCell>Última manutenção</TableCell>
                  <TableCell>Registrado por</TableCell>
                  <TableCell align="right">KM atribuição</TableCell>
                  <TableCell align="right">KM manutenção</TableCell>
                  <TableCell align="right">KM atual</TableCell>
                  <TableCell align="right">Próxima (km)</TableCell>
                  <TableCell align="right">Faltam</TableCell>
                  <TableCell>Data da última</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {statusManutencao.map(
                  ({ veiculo: v, ultima, kmManut, kmAtual, proxKm, faltam, atrasada }) => (
                    <TableRow key={v.id_veiculo} hover>
                      <TableCell sx={{ fontWeight: 600 }}>{v.placa}</TableCell>
                      <TableCell sx={tableCellWrapSx}>{v.nome_responsavel || '—'}</TableCell>
                      <TableCell sx={tableCellWrapSx}>
                        {ultima?.descricao ?? (
                          <Box component="span" sx={{ color: 'text.secondary' }}>
                            Sem registro ainda
                          </Box>
                        )}
                      </TableCell>
                      <TableCell sx={tableCellWrapSx}>{ultima?.nome_usuario ?? '—'}</TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {fmtKm(v.km_assuncao ?? v.km_inicial)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {fmtKm(kmManut)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {fmtKm(kmAtual)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        <Tooltip title="Clique para editar a próxima manutenção">
                          <Button
                            size="small"
                            onClick={() => abrirEditarProxima(v, proxKm)}
                            sx={{
                              minWidth: 0,
                              px: 0.75,
                              fontWeight: 700,
                              fontVariantNumeric: 'tabular-nums',
                              color: colors.navy,
                              textTransform: 'none',
                            }}
                          >
                            {fmtKm(proxKm)}
                          </Button>
                        </Tooltip>
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          fontVariantNumeric: 'tabular-nums',
                          fontWeight: 700,
                          color: atrasada ? colors.orange : colors.textPrimary,
                        }}
                      >
                        {faltam == null
                          ? '—'
                          : atrasada
                            ? 'Vencida'
                            : `${faltam.toLocaleString('pt-BR')} km`}
                      </TableCell>
                      <TableCell>{ultima ? fmtData(ultima.data_manutencao) : '—'}</TableCell>
                    </TableRow>
                  ),
                )}
                {!loading && statusManutencao.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      Nenhum veículo com GPS instalado encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {aba === 'multas' && (
          <>
            {!carregandoMultas && (
              <Typography variant="caption" sx={{ display: 'block', px: 2, pt: 1, color: 'text.secondary' }}>
                {multasConsultadoEm
                  ? `Última consulta: ${formatDataHoraBrasilia(multasConsultadoEm)}`
                  : 'Última consulta: —'}
              </Typography>
            )}
            <TableContainer sx={{ ...tableContainerSx, flex: 1 }}>
              {(carregandoMultas || loading) && <LinearProgress />}
              {multasAvisos.length > 0 &&
                !multasAvisos.every((a) => /não habilitada|nao habilitada|habilitar|infosimples/i.test(a)) && (
                <Alert severity="warning" sx={{ m: 1.5, mb: 0 }}>
                  {multasAvisos.slice(0, 5).join(' · ')}
                  {multasAvisos.length > 5 ? ` (+${multasAvisos.length - 5})` : ''}
                </Alert>
              )}
              <Table size="small" stickyHeader sx={tableSx}>
                <TableHead>
                  <TableRow>
                    <TableCell align="center">Placa</TableCell>
                    <TableCell align="center">Número da Autuação</TableCell>
                    <TableCell align="center">Data de Autuação</TableCell>
                    <TableCell align="center">Valor</TableCell>
                    <TableCell align="center">Vencimento</TableCell>
                    <TableCell align="center">Local</TableCell>
                    <TableCell align="center">Descrição</TableCell>
                    <TableCell align="center">Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {multasFiltradas.map((m, i) => {
                    const statusEfetivo = obterStatusEfetivo(m);
                    return (
                      <TableRow key={`${m.placa}-${m.auto}-${i}`} hover>
                        <TableCell align="center" sx={{ fontWeight: 600 }}>{m.placa}</TableCell>
                        <TableCell align="center" sx={tableCellWrapSx}>{m.auto || '—'}</TableCell>
                        <TableCell align="center">{m.data_multa ? fmtData(m.data_multa) : '—'}</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 600, color: colors.navy }}>
                          {m.valor != null
                            ? `R$ ${m.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                            : '—'}
                        </TableCell>
                        <TableCell align="center">{m.data_vencimento ? fmtData(m.data_vencimento) : '—'}</TableCell>
                        <TableCell align="center">
                          {m.local_infracao ? (
                            <Button
                              size="small"
                              onClick={() => setModalDetalheMulta({ open: true, titulo: 'Local da Infração', conteudo: m.local_infracao || '', tipo: 'local' })}
                              sx={{ textTransform: 'none', minWidth: 0, p: 0, textAlign: 'center', display: 'inline', color: colors.navy }}
                            >
                              Ver Local
                            </Button>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell align="center">
                          {m.descricao ? (
                            <Button
                              size="small"
                              onClick={() => setModalDetalheMulta({ open: true, titulo: 'Descrição da Infração', conteudo: m.descricao || '', tipo: 'descricao' })}
                              sx={{ textTransform: 'none', minWidth: 0, p: 0, textAlign: 'center', display: 'inline', color: colors.navy }}
                            >
                              Ver Descrição
                            </Button>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={statusEfetivo}
                            size="small"
                            onClick={(e) => setStatusMenuAnchor({ anchorEl: e.currentTarget, multa: m })}
                            sx={{
                              cursor: 'pointer',
                              fontWeight: 600,
                              ...obterStatusChipEstilo(statusEfetivo),
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {!loading && !carregandoMultas && multasFiltradas.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                        Nenhuma multa encontrada no DETRAN-DF
                        {veiculoSel ? ` para ${veiculoSel.placa}` : ''}. Confira se o RENAVAM está
                        cadastrado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            {multasFiltradas.length > 0 && (
              <Box
                sx={{
                  borderTop: `1px solid ${colors.border}`,
                  p: 1.5,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  bgcolor: colors.surface,
                  borderRadius: `0 0 ${radius.lg}px ${radius.lg}px`,
                }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  Total de Multas
                </Typography>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: colors.navy }}>
                  R$ {totalMultas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </Typography>
              </Box>
            )}
          </>
        )}
      </Paper>

      <FrotaVeiculoDialog
        open={dialogAberto}
        veiculo={editando}
        onClose={() => setDialogAberto(false)}
        onSalvo={carregar}
      />

      <Dialog open={atribuirOpen} onClose={() => !atribuirSalvando && setAtribuirOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 700, color: colors.navy }}>
          Atribuir · {atribuirVeiculo?.placa}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Define quem está com o veículo pelo portal (sem precisar do app).
          </Typography>
          {atribuirErro && <Alert severity="error">{atribuirErro}</Alert>}
          <Autocomplete
            options={usuariosOrdenados}
            value={atribuirUsuario}
            onChange={(_, u) => setAtribuirUsuario(u)}
            getOptionLabel={(u) => u.nome}
            isOptionEqualToValue={(a, b) => a.id_usuario === b.id_usuario}
            renderInput={(params) => <TextField {...params} label="Responsável" size="small" />}
          />
          <TextField
            size="small"
            label="KM da atribuição"
            value={atribuirKm}
            onChange={(e) => setAtribuirKm(e.target.value.replace(/\D/g, ''))}
            helperText="Odômetro no momento em que o responsável assume (ou na instalação do GPS)"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1, flexWrap: 'wrap' }}>
          {atribuirVeiculo?.id_usuario_responsavel ? (
            <>
              <Button
                color="error"
                disabled={atribuirSalvando}
                onClick={() => void confirmarLiberar()}
              >
                Remover responsável
              </Button>
              <Button
                color="inherit"
                disabled={atribuirSalvando}
                onClick={() => {
                  if (!atribuirVeiculo) return;
                  setAtribuirOpen(false);
                  abrirEditarKmAtribuicao(atribuirVeiculo);
                }}
              >
                Editar KM
              </Button>
            </>
          ) : null}
          <Box sx={{ flex: 1 }} />
          <Button disabled={atribuirSalvando} onClick={() => setAtribuirOpen(false)}>
            Cancelar
          </Button>
          <Button variant="contained" disabled={atribuirSalvando} onClick={() => void confirmarAtribuir()}>
            Atribuir
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={kmAtribOpen} onClose={() => !kmAtribSalvando && setKmAtribOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 700, color: colors.navy }}>
          KM atribuição · {kmAtribVeiculo?.placa}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Ajuste o odômetro do início do uso. Dica: KM painel atual − KM rodado no GPS desde a instalação.
          </Typography>
          {kmAtribErro && <Alert severity="error">{kmAtribErro}</Alert>}
          <TextField
            size="small"
            label="KM da atribuição"
            value={kmAtribValor}
            onChange={(e) => setKmAtribValor(e.target.value.replace(/\D/g, ''))}
            autoFocus
            helperText={
              kmAtribVeiculo?.nome_responsavel
                ? `Responsável: ${kmAtribVeiculo.nome_responsavel}`
                : undefined
            }
          />
          <TextField
            size="small"
            label="KM atual (opcional)"
            value={kmAtribAtual}
            onChange={(e) => setKmAtribAtual(e.target.value.replace(/\D/g, ''))}
            helperText="Se vazio, mantém o KM atual e o GPS continua somando a partir da atribuição"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button disabled={kmAtribSalvando} onClick={() => setKmAtribOpen(false)}>
            Cancelar
          </Button>
          <Button variant="contained" disabled={kmAtribSalvando} onClick={() => void confirmarKmAtribuicao()}>
            Salvar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={proxOpen} onClose={() => !proxSalvando && setProxOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 700, color: colors.navy }}>
          Próxima manutenção · {proxVeiculo?.placa}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Informe o odômetro em que a próxima manutenção deve ocorrer (ex.: troca de óleo a cada{' '}
            {INTERVALO_MANUTENCAO_KM.toLocaleString('pt-BR')} km).
          </Typography>
          {proxErro && <Alert severity="error">{proxErro}</Alert>}
          <TextField
            size="small"
            label="Próxima manutenção (km)"
            value={proxValor}
            onChange={(e) => setProxValor(e.target.value.replace(/\D/g, ''))}
            autoFocus
            helperText={
              proxVeiculo?.km_atual != null
                ? `KM atual: ${proxVeiculo.km_atual.toLocaleString('pt-BR')}`
                : undefined
            }
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button disabled={proxSalvando} onClick={() => setProxOpen(false)}>
            Cancelar
          </Button>
          <Button variant="contained" disabled={proxSalvando} onClick={() => void confirmarProximaManutencao()}>
            Salvar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={liberarOpen} onClose={() => !liberarSalvando && setLiberarOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 700, color: colors.navy }}>
          Remover responsável · {liberarVeiculo?.placa}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            O veículo volta a ficar livre no portal e no app.
            {liberarVeiculo?.nome_responsavel ? (
              <>
                {' '}
                Responsável atual: <strong>{liberarVeiculo.nome_responsavel}</strong>.
              </>
            ) : null}
          </Typography>
          {liberarErro && <Alert severity="error">{liberarErro}</Alert>}
          <TextField
            size="small"
            label="KM atual na devolução"
            value={liberarKm}
            onChange={(e) => setLiberarKm(e.target.value.replace(/\D/g, ''))}
            helperText="Opcional — se vazio, usa o KM atual já cadastrado"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button disabled={liberarSalvando} onClick={() => setLiberarOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={liberarSalvando}
            onClick={() => void confirmarLiberarVeiculo()}
          >
            Remover responsável
          </Button>
        </DialogActions>
      </Dialog>

      <ImageLightbox
        open={Boolean(comprovanteSrc)}
        src={comprovanteSrc}
        titulo={comprovanteTitulo}
        alt="Comprovante de abastecimento"
        onClose={fecharComprovante}
      />

      <Dialog
        open={modalDetalheMulta.open}
        onClose={() => setModalDetalheMulta((prev) => ({ ...prev, open: false }))}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle sx={{ fontWeight: 700, color: colors.navy, display: 'flex', alignItems: 'center', gap: 1 }}>
          {modalDetalheMulta.tipo === 'descricao' && <WarningAmberIcon color="warning" />}
          {modalDetalheMulta.tipo === 'local' && <PlaceIcon color="primary" />}
          {modalDetalheMulta.titulo}
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {modalDetalheMulta.conteudo || '—'}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setModalDetalheMulta((prev) => ({ ...prev, open: false }))}>
            Fechar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmarSyncOpen} onClose={() => setConfirmarSyncOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 700, color: colors.navy, display: 'flex', alignItems: 'center', gap: 1 }}>
          <SyncIcon /> Confirmar Consulta DETRAN
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Deseja realizar a consulta de multas atualizadas no DETRAN-DF?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmarSyncOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            startIcon={<SyncIcon />}
            onClick={() => {
              setConfirmarSyncOpen(false);
              void sincronizarMultas();
            }}
          >
            Confirmar
          </Button>
        </DialogActions>
      </Dialog>

      <Menu
        anchorEl={statusMenuAnchor?.anchorEl}
        open={Boolean(statusMenuAnchor)}
        onClose={() => setStatusMenuAnchor(null)}
      >
        <MenuItem onClick={() => alterarStatusMulta('Em Aberto')}>Em Aberto</MenuItem>
        <MenuItem onClick={() => alterarStatusMulta('Paga')}>Paga</MenuItem>
        <MenuItem onClick={() => alterarStatusMulta('Vencida')}>Vencida</MenuItem>
      </Menu>
    </Box>
  );
}
