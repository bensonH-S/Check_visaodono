import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import CircularProgress from '@mui/material/CircularProgress';
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
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
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
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import {
  api,
  fetchMediaAutenticada,
  type FrotaAbastecimentoPortal,
  type FrotaDebitoDetran,
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
import PdfBoletoDialog from '../../components/frota/PdfBoletoDialog';
import { colors, radius, shadows } from '../../theme/tokens';
import { dataHojeBrasilia, formatDataHoraBrasilia } from '../../utils/dateBr';
import { dataDentroIntervalo, matchVeiculo, matchVeiculoObj } from '../../utils/frotaPortalFiltros';
import { tableCellWrapSx, tableContainerSx, tablePageLayoutSx, tableSx } from '../../utils/tablePageLayout';
import { gerarPdfMultasFrota } from '../../utils/gerarPdfMultasFrota';

export type AbaOperacao = 'cadastro' | 'combustivel' | 'manutencoes' | 'multas' | 'debitos';

/** Intervalo padrão entre manutenções (usuário citou ~10 mil km). */
export const INTERVALO_MANUTENCAO_KM = 10_000;

const ABAS: { id: AbaOperacao; label: string }[] = [
  { id: 'cadastro', label: 'Cadastro' },
  { id: 'combustivel', label: 'Combustível' },
  { id: 'manutencoes', label: 'Manutenções' },
  { id: 'multas', label: 'Multas' },
  { id: 'debitos', label: 'Débitos' },
];

const ANO_IPVA_INICIO = 2020;

function anosIpvaDisponiveis() {
  const atual = new Date().getFullYear();
  const lista: number[] = [];
  for (let a = atual; a >= ANO_IPVA_INICIO; a -= 1) lista.push(a);
  return lista;
}

function parseAba(raw: string | undefined | null): AbaOperacao {
  if (
    raw === 'combustivel' ||
    raw === 'manutencoes' ||
    raw === 'cadastro' ||
    raw === 'multas' ||
    raw === 'debitos'
  ) {
    return raw;
  }
  return 'cadastro';
}

/** Redireciona URLs antigas `/frota/operacao?aba=multas` → `/frota/operacao/multas`. */
export function FrotaOperacaoLegacyRedirect() {
  const [searchParams] = useSearchParams();
  const aba = parseAba(searchParams.get('aba'));
  return <Navigate to={`/frota/operacao/${aba}`} replace />;
}

function fmtData(d: string | null) {
  if (!d) return '—';
  const [y, m, day] = d.slice(0, 10).split('-');
  return `${day}/${m}/${y}`;
}

function fmtDataHora(d: string | null | undefined, h?: string | null) {
  if (!d) return '—';
  const data = fmtData(d);
  const hora = h?.trim().slice(0, 5) || '00:00';
  return `${data} ${hora}`;
}

function fmtMoeda(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return '—';
  return `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

function placaComModelo(placa: string, modelo?: string | null) {
  return modelo ? `${placa} - ${modelo}` : placa;
}

function normalizarGrupo(natureza?: string | null) {
  return String(natureza || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function obterGrupoChipEstilo(natureza?: string | null) {
  const n = normalizarGrupo(natureza);
  if (/gravissima/.test(n)) {
    return { bgcolor: 'rgba(183, 28, 28, 0.12)', color: '#b71c1c', border: '1px solid #b71c1c' };
  }
  if (/grave/.test(n)) {
    return { bgcolor: 'rgba(230, 81, 0, 0.12)', color: '#e65100', border: '1px solid #e65100' };
  }
  if (/media|média/.test(n) || n === 'media') {
    return { bgcolor: 'rgba(249, 168, 37, 0.16)', color: '#f57f17', border: '1px solid #f9a825' };
  }
  if (/leve/.test(n)) {
    return { bgcolor: 'rgba(46, 125, 50, 0.12)', color: '#2e7d32', border: '1px solid #2e7d32' };
  }
  return { bgcolor: 'rgba(84, 110, 122, 0.1)', color: '#546e7a', border: '1px solid #78909c' };
}

function multaTemDescricao(m: FrotaMultaDetran) {
  return Boolean(
    m.descricao ||
      m.local_infracao ||
      m.orgao ||
      m.pontos != null ||
      m.velocidade_aferida != null ||
      m.velocidade_permitida != null ||
      m.responsavel_infracao ||
      m.data_notificacao_autuacao,
  );
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
  const { aba: abaParam } = useParams<{ aba: string }>();
  const aba = parseAba(abaParam);

  const [veiculos, setVeiculos] = useState<FrotaVeiculo[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  
  const sessao = useMemo(() => getUsuario(), []);
  const podeSincronizar = useMemo(() => temPermissao('frota.multas.sync', sessao), [sessao]);
  const podeVerDebitos = useMemo(() => temPermissao('frota.debitos.ver', sessao), [sessao]);
  const abasVisiveis = useMemo(
    () => ABAS.filter((item) => item.id !== 'debitos' || podeVerDebitos),
    [podeVerDebitos],
  );
  const [modalDetalheMulta, setModalDetalheMulta] = useState<{
    open: boolean;
    multa: FrotaMultaDetran | null;
  }>({
    open: false,
    multa: null,
  });
  const [modalDebito, setModalDebito] = useState<{ open: boolean; debito: FrotaDebitoDetran | null }>({
    open: false,
    debito: null,
  });
  const [syncVeiculoIds, setSyncVeiculoIds] = useState<number[]>([]);
  const [confirmarSyncOpen, setConfirmarSyncOpen] = useState(false);
  const [syncTipo, setSyncTipo] = useState<'multas' | 'debitos'>('multas');
  const [syncDebitosTipos, setSyncDebitosTipos] = useState<{ ipva: boolean; licenciamento: boolean }>({
    ipva: false,
    licenciamento: false,
  });
  const [syncIpvaAnos, setSyncIpvaAnos] = useState<number[]>(() => [new Date().getFullYear()]);
  const opcoesAnosIpva = useMemo(() => anosIpvaDisponiveis(), []);
  const [modalBoletoPdf, setModalBoletoPdf] = useState<{
    open: boolean;
    url: string | null;
    idDebito: number | null;
    titulo: string;
  }>({
    open: false,
    url: null,
    idDebito: null,
    titulo: '',
  });
  const [syncProgress, setSyncProgress] = useState<{
    open: boolean;
    fase: 'progresso' | 'resultado';
    pct: number;
    atual: string;
    total: number;
    feitos: number;
    mensagem: string;
    ok: boolean;
    detalhes: string[];
  }>({
    open: false,
    fase: 'progresso',
    pct: 0,
    atual: '',
    total: 0,
    feitos: 0,
    mensagem: '',
    ok: true,
    detalhes: [],
  });
  const [abastecimentos, setAbastecimentos] = useState<FrotaAbastecimentoPortal[]>([]);
  const [manutencoes, setManutencoes] = useState<FrotaManutencaoPortal[]>([]);
  const [multas, setMultas] = useState<FrotaMultaDetran[]>([]);
  const [debitos, setDebitos] = useState<FrotaDebitoDetran[]>([]);
  const [multasAvisos, setMultasAvisos] = useState<string[]>([]);
  const [multasConsultadoEm, setMultasConsultadoEm] = useState<string | null>(null);
  const [carregandoMultas, setCarregandoMultas] = useState(false);
  const [carregandoDebitos, setCarregandoDebitos] = useState(false);
  const [gerandoPdfMultas, setGerandoPdfMultas] = useState(false);
  const [statusMenuAnchor, setStatusMenuAnchor] = useState<{
    anchorEl: HTMLElement;
    multa?: FrotaMultaDetran;
    debito?: FrotaDebitoDetran;
  } | null>(null);
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

  const carregarDebitosCache = useCallback(async (idVeiculo?: number | null) => {
    setCarregandoDebitos(true);
    try {
      const r = await api.frotaDebitosDetran(idVeiculo ?? undefined);
      setDebitos(r.debitos || []);
      if (r.consultado_em) setMultasConsultadoEm(r.consultado_em);
      if (r.avisos?.length) setMultasAvisos((prev) => [...prev, ...r.avisos]);
    } catch (e) {
      setDebitos([]);
      setMultasAvisos((prev) => [
        ...prev,
        e instanceof Error ? e.message : 'Falha ao carregar débitos do cache',
      ]);
    } finally {
      setCarregandoDebitos(false);
    }
  }, []);

  const sincronizarDetran = async (ids?: number[], tipo: 'multas' | 'debitos' = syncTipo) => {
    const listaIds =
      Array.isArray(ids) && ids.length > 0
        ? ids
        : veiculos.filter((v) => v.renavam && v.renavam.trim() !== '').map((v) => v.id_veiculo);

    if (!listaIds.length) {
      setSyncProgress({
        open: true,
        fase: 'resultado',
        pct: 0,
        atual: '',
        total: 0,
        feitos: 0,
        ok: false,
        mensagem: 'Nenhum veículo com RENAVAM selecionado para sincronizar.',
        detalhes: [],
      });
      return;
    }

    const tiposDebitos: Array<'IPVA' | 'Licenciamento'> = [];
    let anosIpvaSel: number[] = [];
    if (tipo === 'debitos') {
      if (syncDebitosTipos.ipva) tiposDebitos.push('IPVA');
      if (syncDebitosTipos.licenciamento) tiposDebitos.push('Licenciamento');
      if (!tiposDebitos.length) {
        setSyncProgress({
          open: true,
          fase: 'resultado',
          pct: 0,
          atual: '',
          total: 0,
          feitos: 0,
          ok: false,
          mensagem: 'Selecione ao menos IPVA ou Licenciamento para sincronizar.',
          detalhes: [],
        });
        return;
      }
      if (syncDebitosTipos.ipva) {
        anosIpvaSel = syncIpvaAnos.length ? [...syncIpvaAnos] : [new Date().getFullYear()];
      }
    }

    setConfirmarSyncOpen(false);
    const incluiMultasComLic = tipo === 'debitos' && syncDebitosTipos.licenciamento;
    if (tipo === 'multas' || incluiMultasComLic) setCarregandoMultas(true);
    if (tipo === 'debitos') setCarregandoDebitos(true);
    setMultasAvisos([]);
    setSyncProgress({
      open: true,
      fase: 'progresso',
      pct: 0,
      atual: '',
      total: listaIds.length,
      feitos: 0,
      mensagem: '',
      ok: true,
      detalhes: [],
    });

    let somaMultas = 0;
    let somaIpva = 0;
    let somaLic = 0;
    let okVeiculos = 0;
    const avisosAcum: string[] = [];

    for (let i = 0; i < listaIds.length; i++) {
      const id = listaIds[i];
      const v = veiculos.find((x) => x.id_veiculo === id);
      const rotulo = v ? `${v.placa}${v.modelo ? ` - ${v.modelo}` : ''}` : `Veículo #${id}`;
      setSyncProgress((prev) => ({
        ...prev,
        fase: 'progresso',
        atual: rotulo,
        feitos: i,
        pct: Math.round((i / listaIds.length) * 100),
      }));

      try {
        if (tipo === 'multas') {
          const r = await api.frotaMultasDetranSync(true, [id]);
          if (r.ok === false) {
            const motivo = r.motivo || r.error || r.status || 'falha';
            const avisosVeic = [...(r.avisos || []), ...(r.erros || [])];
            if (avisosVeic.length) {
              for (const a of avisosVeic) {
                if (a && !avisosAcum.includes(a)) avisosAcum.push(a);
              }
            } else {
              avisosAcum.push(`${rotulo}: ${motivo}`);
            }
          } else {
            okVeiculos += 1;
            somaMultas += Number(r.qtd_multas ?? 0);
            for (const a of [...(r.avisos || []), ...(r.erros || [])]) {
              if (a && !avisosAcum.includes(a)) avisosAcum.push(a);
            }
          }
        } else {
          let okDeb = true;
          const r = await api.frotaDebitosDetranSync(true, [id], tiposDebitos, anosIpvaSel);
          if (r.ok === false) {
            okDeb = false;
            const motivo = r.motivo || r.error || r.status || 'falha';
            const avisosVeic = [...(r.avisos || []), ...(r.erros || [])];
            if (avisosVeic.length) {
              for (const a of avisosVeic) {
                if (a && !avisosAcum.includes(a)) avisosAcum.push(a);
              }
            } else {
              avisosAcum.push(`${rotulo}: ${motivo}`);
            }
          } else {
            somaIpva += Number(r.qtd_ipva ?? 0);
            somaLic += Number(r.qtd_licenciamento ?? 0);
            for (const a of [...(r.avisos || []), ...(r.erros || [])]) {
              if (a && !avisosAcum.includes(a)) avisosAcum.push(a);
            }
          }

          if (incluiMultasComLic) {
            try {
              const rm = await api.frotaMultasDetranSync(true, [id]);
              if (rm.ok === false) {
                okDeb = false;
                const motivo = rm.motivo || rm.error || rm.status || 'falha multas';
                const avisosVeic = [...(rm.avisos || []), ...(rm.erros || [])];
                if (avisosVeic.length) {
                  for (const a of avisosVeic) {
                    if (a && !avisosAcum.includes(a)) avisosAcum.push(a);
                  }
                } else {
                  avisosAcum.push(`${rotulo} (multas): ${motivo}`);
                }
              } else {
                somaMultas += Number(rm.qtd_multas ?? 0);
                for (const a of [...(rm.avisos || []), ...(rm.erros || [])]) {
                  if (a && !avisosAcum.includes(a)) avisosAcum.push(a);
                }
              }
            } catch (eM) {
              okDeb = false;
              avisosAcum.push(`${rotulo} (multas): ${eM instanceof Error ? eM.message : 'Falha'}`);
            }
          }

          if (okDeb) okVeiculos += 1;
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Falha na consulta';
        avisosAcum.push(`${rotulo}: ${msg}`);
      }

      setSyncProgress((prev) => ({
        ...prev,
        feitos: i + 1,
        pct: Math.round(((i + 1) / listaIds.length) * 100),
      }));
    }

    try {
      if (tipo === 'multas' || incluiMultasComLic) {
        const cacheMultas = await api.frotaMultasDetran(veiculoSel?.id_veiculo ?? undefined);
        setMultas(cacheMultas.multas || []);
        setMultasConsultadoEm(cacheMultas.consultado_em || null);
      }
      if (tipo === 'debitos') {
        const cacheDebitos = await api.frotaDebitosDetran(veiculoSel?.id_veiculo ?? undefined);
        setDebitos(cacheDebitos.debitos || []);
        if (!incluiMultasComLic) {
          setMultasConsultadoEm(cacheDebitos.consultado_em || null);
        }
      }
      setMultasAvisos(avisosAcum.slice(0, 30));
    } catch (e) {
      avisosAcum.push(e instanceof Error ? e.message : 'Falha ao recarregar cache');
      setMultasAvisos(avisosAcum.slice(0, 30));
    } finally {
      setCarregandoMultas(false);
      setCarregandoDebitos(false);
    }

    const sucesso = okVeiculos === listaIds.length;
    const msgOk =
      tipo === 'multas'
        ? `Os dados de multas foram trazidos conforme solicitado. ${okVeiculos} veículo(s) · ${somaMultas} multa(s) nova(s).`
        : incluiMultasComLic
          ? `Consulta concluída. ${okVeiculos} veículo(s) · ${somaIpva} IPVA · ${somaLic} licenciamento(s) · ${somaMultas} multa(s) nova(s).`
          : tiposDebitos.includes('IPVA') && !tiposDebitos.includes('Licenciamento')
            ? `Consulta IPVA concluída. ${okVeiculos} veículo(s) · ${somaIpva} registro(s).`
            : tiposDebitos.includes('Licenciamento') && !tiposDebitos.includes('IPVA')
              ? `Consulta Licenciamento concluída. ${okVeiculos} veículo(s) · ${somaLic} registro(s).`
              : `Os dados de débitos foram trazidos conforme solicitado. ${okVeiculos} veículo(s) · ${somaIpva} IPVA · ${somaLic} licenciamento(s).`;
    const msgErro =
      tipo === 'multas'
        ? `A sincronização de multas terminou com falhas em ${listaIds.length - okVeiculos} de ${listaIds.length} veículo(s). Multas novas: ${somaMultas}.`
        : `A sincronização terminou com falhas em ${listaIds.length - okVeiculos} de ${listaIds.length} veículo(s).` +
          (tiposDebitos.includes('IPVA') ? ` IPVA: ${somaIpva}.` : '') +
          (tiposDebitos.includes('Licenciamento') ? ` Licenciamento: ${somaLic}.` : '') +
          (incluiMultasComLic ? ` Multas: ${somaMultas}.` : '');

    setSyncProgress({
      open: true,
      fase: 'resultado',
      pct: 100,
      atual: '',
      total: listaIds.length,
      feitos: listaIds.length,
      ok: sucesso,
      mensagem: sucesso ? msgOk : msgErro,
      detalhes: avisosAcum.slice(0, 12),
    });
  };

  const obterStatusChipEstilo = (status?: string) => {
    switch (status) {
      case 'Paga':
      case 'Quitado':
      case 'Isento':
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

  const obterStatusEfetivoDebito = (d: FrotaDebitoDetran) => {
    if (d.status === 'Paga' || d.status === 'Quitado' || d.status === 'Isento') {
      return d.status === 'Quitado' || d.status === 'Isento' ? d.status : 'Paga';
    }
    if (d.status === 'Vencida') return 'Vencida';
    if (d.data_vencimento) {
      const hoje = dataHojeBrasilia();
      const vencFmt = String(d.data_vencimento).slice(0, 10);
      if (vencFmt && vencFmt < hoje) return 'Vencida';
    }
    return d.status || 'Em Aberto';
  };

  const alterarStatusMulta = async (novoStatus: 'Em Aberto' | 'Paga' | 'Vencida') => {
    if (!statusMenuAnchor?.multa) return;
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

  const alterarStatusDebito = async (novoStatus: 'Em Aberto' | 'Paga' | 'Vencida') => {
    if (!statusMenuAnchor?.debito) return;
    const { debito } = statusMenuAnchor;
    setStatusMenuAnchor(null);
    try {
      await api.frotaAtualizarStatusDebitoDetran(debito.id_debito_detran, novoStatus);
      setDebitos((prev) =>
        prev.map((item) =>
          item.id_debito_detran === debito.id_debito_detran ? { ...item, status: novoStatus } : item
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
    if (aba !== 'multas' && aba !== 'debitos') return;
    void carregarMultasCache(veiculoSel?.id_veiculo ?? null);
  }, [aba, veiculoSel?.id_veiculo, carregarMultasCache]);

  useEffect(() => {
    if (aba !== 'multas' && aba !== 'debitos') return;
    void carregarDebitosCache(veiculoSel?.id_veiculo ?? null);
  }, [aba, veiculoSel?.id_veiculo, carregarDebitosCache]);

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

  const debitosFiltrados = useMemo(
    () =>
      debitos.filter((d) => {
        if (veiculoSel && d.id_veiculo !== veiculoSel.id_veiculo) return false;
        if (!dataInicio && !dataFim) return true;
        if (d.data_vencimento) return dataDentroIntervalo(d.data_vencimento, dataInicio, dataFim);
        if (d.ano_referencia && /^\d{4}$/.test(d.ano_referencia)) {
          const ano = Number(d.ano_referencia);
          const iniY = dataInicio ? Number(String(dataInicio).slice(0, 4)) : null;
          const fimY = dataFim ? Number(String(dataFim).slice(0, 4)) : null;
          if (iniY != null && ano < iniY) return false;
          if (fimY != null && ano > fimY) return false;
          return true;
        }
        return !dataInicio && !dataFim;
      }),
    [debitos, veiculoSel, dataInicio, dataFim],
  );
  const debitosIpva = useMemo(
    () => debitosFiltrados.filter((d) => d.tipo === 'IPVA'),
    [debitosFiltrados],
  );
  const debitosLicenciamento = useMemo(
    () => debitosFiltrados.filter((d) => d.tipo === 'Licenciamento'),
    [debitosFiltrados],
  );

  const totalMultas = multasFiltradas.reduce((s, m) => s + (m.valor ?? 0), 0);
  const totalDebitos = debitosFiltrados.reduce((s, d) => s + (d.valor_total ?? 0), 0);

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

  /** Versão filtrada por período para exibição na tabela de manutenções */
  const statusManutencaoFiltrado = useMemo(
    () =>
      statusManutencao.filter(
        (s) => !s.ultima || dataDentroIntervalo(s.ultima.data_manutencao, dataInicio, dataFim),
      ),
    [statusManutencao, dataInicio, dataFim],
  );

  const totalCombustivel = abastecimentosFiltrados.reduce((s, a) => s + a.valor_abastecido, 0);
  const filtrosAtivos = veiculoSel != null || !!dataInicio || !!dataFim;
  const mostrarPeriodo = aba === 'combustivel' || aba === 'multas' || aba === 'manutencoes' || aba === 'debitos';

  function setAba(next: AbaOperacao) {
    navigate(`/frota/operacao/${next}`, { replace: true });
  }

  async function gerarRelatorioMultas() {
    setGerandoPdfMultas(true);
    try {
      await gerarPdfMultasFrota(multasFiltradas, {
        veiculoLabel: veiculoSel ? placaComModelo(veiculoSel.placa, veiculoSel.modelo) : null,
        dataInicio: dataInicio || null,
        dataFim: dataFim || null,
      });
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao gerar relatório de multas');
    } finally {
      setGerandoPdfMultas(false);
    }
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

  if (aba === 'debitos' && !podeVerDebitos) {
    return <Navigate to="/frota/operacao/cadastro" replace />;
  }

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
            aba === 'manutencoes'
              ? 'Com registro'
              : aba === 'multas'
                ? 'Multas'
                : aba === 'debitos'
                  ? 'Débitos'
                  : 'Abastecimentos'
          }
          valor={String(
            aba === 'manutencoes'
              ? qtdComRegistroManut
              : aba === 'multas'
                ? multasFiltradas.length
                : aba === 'debitos'
                  ? debitosFiltrados.length
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
            {abasVisiveis.map((item) => (
              <Tab key={item.id} value={item.id} label={item.label} />
            ))}
          </Tabs>
          {aba === 'combustivel' && abastecimentosFiltrados.length > 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ pr: 1, whiteSpace: 'nowrap' }}>
              R$ {totalCombustivel.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </Typography>
          )}
          {aba === 'multas' && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pr: 1 }}>
              <Tooltip title="Gera PDF das multas filtradas" arrow>
                <span>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<PictureAsPdfIcon />}
                    onClick={() => void gerarRelatorioMultas()}
                    disabled={gerandoPdfMultas || carregandoMultas || multasFiltradas.length === 0}
                    sx={{ textTransform: 'none', fontWeight: 600, height: 30 }}
                  >
                    {gerandoPdfMultas ? 'Gerando...' : 'Relatório'}
                  </Button>
                </span>
              </Tooltip>
              {podeSincronizar && (
                <Tooltip title="Consulta somente multas — independente de débitos" arrow>
                  <span>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<SyncIcon />}
                      onClick={() => {
                        const veiculosComRenavam = veiculos.filter((v) => v.renavam && v.renavam.trim() !== '');
                        setSyncTipo('multas');
                        setSyncVeiculoIds(veiculosComRenavam.map((v) => v.id_veiculo));
                        setConfirmarSyncOpen(true);
                      }}
                      disabled={carregandoMultas || loading}
                      sx={{ textTransform: 'none', fontWeight: 600, height: 30 }}
                    >
                      {carregandoMultas ? 'Sincronizando...' : 'Sincronizar'}
                    </Button>
                  </span>
                </Tooltip>
              )}
            </Box>
          )}
          {(aba === 'debitos') && podeSincronizar && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pr: 1 }}>
              <Tooltip title="Consulta IPVA e/ou Licenciamento — independente de multas" arrow>
                <span>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<SyncIcon />}
                    onClick={() => {
                      const veiculosComRenavam = veiculos.filter((v) => v.renavam && v.renavam.trim() !== '');
                      setSyncTipo('debitos');
                      setSyncDebitosTipos({ ipva: false, licenciamento: false });
                      setSyncIpvaAnos([new Date().getFullYear()]);
                      setSyncVeiculoIds(veiculosComRenavam.map((v) => v.id_veiculo));
                      setConfirmarSyncOpen(true);
                    }}
                    disabled={carregandoDebitos || loading}
                    sx={{ textTransform: 'none', fontWeight: 600, height: 30 }}
                  >
                    {carregandoDebitos ? 'Sincronizando...' : 'Sincronizar'}
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
                {statusManutencaoFiltrado.map(
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
                {!loading && statusManutencaoFiltrado.length === 0 && (
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
                  ? `Última sincronização: ${formatDataHoraBrasilia(multasConsultadoEm)}`
                  : 'Nenhuma sincronização ainda. A consulta de multas só ocorre quando você clicar em “Sincronizar”.'}
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
                    <TableCell align="left">Placa</TableCell>
                    <TableCell align="center">Nº do Auto</TableCell>
                    <TableCell align="center">Data da Infração</TableCell>
                    <TableCell align="center">Gravidade</TableCell>
                    <TableCell align="center">Valor</TableCell>
                    <TableCell align="center">Vencimento</TableCell>
                    <TableCell align="center">Descrição</TableCell>
                    <TableCell align="center">Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {multasFiltradas.map((m, i) => {
                    const statusEfetivo = obterStatusEfetivo(m);
                    return (
                      <TableRow key={`${m.placa}-${m.auto}-${i}`} hover>
                        <TableCell align="left" sx={{ fontWeight: 600 }}>
                          {placaComModelo(m.placa, m.modelo)}
                        </TableCell>
                        <TableCell align="center" sx={tableCellWrapSx}>{m.auto || '—'}</TableCell>
                        <TableCell align="center">{fmtDataHora(m.data_multa, m.hora_multa)}</TableCell>
                        <TableCell align="center">
                          {m.natureza ? (
                            <Chip
                              label={m.natureza}
                              size="small"
                              sx={{ fontWeight: 700, height: 22, ...obterGrupoChipEstilo(m.natureza) }}
                            />
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell align="center" sx={{ fontWeight: 600, color: colors.navy }}>
                          {fmtMoeda(m.valor)}
                        </TableCell>
                        <TableCell align="center">{m.data_vencimento ? fmtData(m.data_vencimento) : '—'}</TableCell>
                        <TableCell align="center">
                          {multaTemDescricao(m) ? (
                            <Tooltip title={m.descricao || 'Ver detalhes da infração'} arrow>
                              <span>
                                <Button
                                  size="small"
                                  onClick={() => setModalDetalheMulta({ open: true, multa: m })}
                                  sx={{ textTransform: 'none', minWidth: 0, p: 0, textAlign: 'center', display: 'inline', color: colors.navy }}
                                >
                                  Ver Descrição
                                </Button>
                              </span>
                            </Tooltip>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={statusEfetivo}
                            size="small"
                            onClick={statusEfetivo === 'Paga' ? undefined : (e) => setStatusMenuAnchor({ anchorEl: e.currentTarget, multa: m })}
                            sx={{
                              cursor: statusEfetivo === 'Paga' ? 'default' : 'pointer',
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
                        Nenhuma multa no cache
                        {veiculoSel ? ` para ${veiculoSel.placa}` : ''}.
                        {podeSincronizar
                          ? ' Use “Sincronizar” quando quiser consultar (não há consulta automática).'
                          : ' Aguarde uma sincronização autorizada.'}
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
                  {fmtMoeda(totalMultas)}
                </Typography>
              </Box>
            )}
          </>
        )}

        {aba === 'debitos' && (
          <>
            {!carregandoDebitos && (
              <Typography variant="caption" sx={{ display: 'block', px: 2, pt: 1, color: 'text.secondary' }}>
                {multasConsultadoEm
                  ? `Última sincronização de débitos: ${formatDataHoraBrasilia(multasConsultadoEm)}`
                  : 'Nenhuma sincronização ainda. Use “Sincronizar” e escolha IPVA e/ou Licenciamento.'}
              </Typography>
            )}
            {(carregandoDebitos || loading) && <LinearProgress />}

            <Box
              sx={{
                px: 2,
                pt: 1.5,
                pb: 0.5,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: '#1565c0' }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1565c0' }}>
                IPVA (SEFAZ-DF)
              </Typography>
            </Box>
            <TableContainer
              sx={{
                ...tableContainerSx,
                flex: '0 0 auto',
                maxHeight: 280,
                borderLeft: '3px solid #1565c0',
              }}
            >
              <Table size="small" stickyHeader sx={tableSx}>
                <TableHead>
                  <TableRow>
                    <TableCell align="left">Placa</TableCell>
                    <TableCell align="center">Ano</TableCell>
                    <TableCell align="center">Cota</TableCell>
                    <TableCell align="center">Valor total</TableCell>
                    <TableCell align="center">Boleto</TableCell>
                    <TableCell align="center">Outros valores</TableCell>
                    <TableCell align="center">Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {debitosIpva.map((d) => {
                    const statusEfetivo = obterStatusEfetivoDebito(d);
                    const bloqueado = statusEfetivo === 'Paga' || statusEfetivo === 'Quitado' || statusEfetivo === 'Isento';
                    return (
                      <TableRow key={d.id_debito_detran} hover>
                        <TableCell align="left" sx={{ fontWeight: 600 }}>
                          {placaComModelo(d.placa, d.modelo)}
                        </TableCell>
                        <TableCell align="center">{d.ano_referencia || '—'}</TableCell>
                        <TableCell align="center">{d.cota || '—'}</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 600, color: colors.navy }}>
                          {fmtMoeda(d.valor_total)}
                        </TableCell>
                        <TableCell align="center">
                          {d.boleto ? (
                            <Button
                              size="small"
                              startIcon={<PictureAsPdfIcon sx={{ fontSize: 16 }} />}
                              onClick={() =>
                                setModalBoletoPdf({
                                  open: true,
                                  url: d.boleto,
                                  idDebito: d.id_debito_detran,
                                  titulo: `Boleto IPVA · ${d.placa} · ${d.ano_referencia || ''}`,
                                })
                              }
                              sx={{ textTransform: 'none', minWidth: 0, color: colors.navy }}
                            >
                              Ver PDF
                            </Button>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell align="center">
                          <Button
                            size="small"
                            onClick={() => setModalDebito({ open: true, debito: d })}
                            sx={{ textTransform: 'none', minWidth: 0, p: 0, color: colors.navy }}
                          >
                            Ver valores
                          </Button>
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={statusEfetivo}
                            size="small"
                            onClick={
                              bloqueado
                                ? undefined
                                : (e) => setStatusMenuAnchor({ anchorEl: e.currentTarget, debito: d })
                            }
                            sx={{
                              cursor: bloqueado ? 'default' : 'pointer',
                              fontWeight: 600,
                              ...obterStatusChipEstilo(statusEfetivo),
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {!loading && !carregandoDebitos && debitosIpva.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                        Nenhum IPVA no cache{veiculoSel ? ` para ${veiculoSel.placa}` : ''}.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <Box
              sx={{
                px: 2,
                pt: 2,
                pb: 0.5,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: '#e65100' }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#e65100' }}>
                Licenciamento (DETRAN-DF)
              </Typography>
            </Box>
            <TableContainer
              sx={{
                ...tableContainerSx,
                flex: 1,
                borderLeft: '3px solid #e65100',
              }}
            >
              <Table size="small" stickyHeader sx={tableSx}>
                <TableHead>
                  <TableRow>
                    <TableCell align="left">Placa</TableCell>
                    <TableCell align="center">Ano</TableCell>
                    <TableCell align="center">Data validade</TableCell>
                    <TableCell align="center">Data vencimento</TableCell>
                    <TableCell align="center">Valor total</TableCell>
                    <TableCell align="center">Outros valores</TableCell>
                    <TableCell align="center">Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {debitosLicenciamento.map((d) => {
                    const statusEfetivo = obterStatusEfetivoDebito(d);
                    const bloqueado = statusEfetivo === 'Paga' || statusEfetivo === 'Quitado' || statusEfetivo === 'Isento';
                    return (
                      <TableRow key={d.id_debito_detran} hover>
                        <TableCell align="left" sx={{ fontWeight: 600 }}>
                          {placaComModelo(d.placa, d.modelo)}
                        </TableCell>
                        <TableCell align="center">{d.ano_referencia || '—'}</TableCell>
                        <TableCell align="center">{d.data_validade ? fmtData(d.data_validade) : '—'}</TableCell>
                        <TableCell align="center">{d.data_vencimento ? fmtData(d.data_vencimento) : '—'}</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 600, color: colors.navy }}>
                          {fmtMoeda(d.valor_total)}
                        </TableCell>
                        <TableCell align="center">
                          <Button
                            size="small"
                            onClick={() => setModalDebito({ open: true, debito: d })}
                            sx={{ textTransform: 'none', minWidth: 0, p: 0, color: colors.navy }}
                          >
                            Ver valores
                          </Button>
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={statusEfetivo}
                            size="small"
                            onClick={
                              bloqueado
                                ? undefined
                                : (e) => setStatusMenuAnchor({ anchorEl: e.currentTarget, debito: d })
                            }
                            sx={{
                              cursor: bloqueado ? 'default' : 'pointer',
                              fontWeight: 600,
                              ...obterStatusChipEstilo(statusEfetivo),
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {!loading && !carregandoDebitos && debitosLicenciamento.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                        Nenhum licenciamento no cache{veiculoSel ? ` para ${veiculoSel.placa}` : ''}.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            {debitosFiltrados.length > 0 && (
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
                  Total de Débitos
                </Typography>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: colors.navy }}>
                  {fmtMoeda(totalDebitos)}
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
        onClose={() => setModalDetalheMulta({ open: false, multa: null })}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle sx={{ fontWeight: 700, color: colors.navy, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <WarningAmberIcon color="warning" />
          Descrição da Infração
          {modalDetalheMulta.multa?.auto ? (
            <Typography component="span" variant="body2" sx={{ color: 'text.secondary', fontWeight: 600 }}>
              · Nº {modalDetalheMulta.multa.auto}
            </Typography>
          ) : null}
          {modalDetalheMulta.multa?.natureza ? (
            <Chip
              label={modalDetalheMulta.multa.natureza}
              size="small"
              sx={{ fontWeight: 700, ...obterGrupoChipEstilo(modalDetalheMulta.multa.natureza) }}
            />
          ) : null}
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {modalDetalheMulta.multa && (
            <>
              {modalDetalheMulta.multa.descricao && (
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25, mb: 2 }}>
                  <Box
                    sx={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      bgcolor: colors.orange,
                      mt: 0.85,
                      flexShrink: 0,
                    }}
                  />
                  <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontWeight: 500 }}>
                    {modalDetalheMulta.multa.descricao}
                  </Typography>
                </Box>
              )}

              {modalDetalheMulta.multa.local_infracao && (
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 2 }}>
                  <PlaceIcon sx={{ fontSize: 18, color: colors.orange, mt: 0.2 }} />
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, letterSpacing: '0.04em' }}>
                      LOCAL DA INFRAÇÃO
                    </Typography>
                    <Typography variant="body2" sx={{ color: colors.navy, fontWeight: 600 }}>
                      {modalDetalheMulta.multa.local_infracao}
                    </Typography>
                  </Box>
                </Box>
              )}

              {(() => {
                const pontos = modalDetalheMulta.multa.pontos;
                const velPerm = modalDetalheMulta.multa.velocidade_permitida;
                const velAfer = modalDetalheMulta.multa.velocidade_aferida;
                const showPontos = pontos != null;
                const showVelPerm = velPerm != null && Number(velPerm) > 0;
                const showVelAfer = velAfer != null && Number(velAfer) > 0;
                if (!showPontos && !showVelPerm && !showVelAfer) return null;
                return (
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: {
                        xs: '1fr',
                        sm: 'repeat(auto-fit, minmax(140px, 1fr))',
                      },
                      gap: 1.25,
                      mb: 2,
                      p: 1.5,
                      borderRadius: 1,
                      bgcolor: 'rgba(11, 26, 59, 0.03)',
                      border: `1px solid ${colors.border}`,
                    }}
                  >
                    {showPontos && (
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: 'block' }}>
                          PONTOS
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: colors.navy, mt: 0.75 }}>
                          {pontos}
                        </Typography>
                      </Box>
                    )}
                    {showVelPerm && (
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: 'block' }}>
                          VEL. PERMITIDA
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: colors.navy, mt: 0.75 }}>
                          {velPerm} km/h
                        </Typography>
                      </Box>
                    )}
                    {showVelAfer && (
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: 'block' }}>
                          VEL. AFERIDA
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: colors.navy, mt: 0.75 }}>
                          {velAfer} km/h
                        </Typography>
                      </Box>
                    )}
                  </Box>
                );
              })()}

              {modalDetalheMulta.multa.responsavel_infracao && (
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1.5 }}>
                  <PersonOutlinedIcon sx={{ fontSize: 18, color: colors.navy, mt: 0.2 }} />
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, letterSpacing: '0.04em' }}>
                      RESPONSÁVEL DA INFRAÇÃO
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: colors.navy }}>
                      {modalDetalheMulta.multa.responsavel_infracao}
                    </Typography>
                  </Box>
                </Box>
              )}

              {modalDetalheMulta.multa.data_notificacao_autuacao && (
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1.5 }}>
                  <NotificationsNoneIcon sx={{ fontSize: 18, color: colors.orange, mt: 0.2 }} />
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, letterSpacing: '0.04em' }}>
                      DATA DE NOTIFICAÇÃO DA AUTUAÇÃO
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: colors.navy }}>
                      {fmtData(modalDetalheMulta.multa.data_notificacao_autuacao)}
                    </Typography>
                  </Box>
                </Box>
              )}

              {modalDetalheMulta.multa.orgao && (
                <Box sx={{ mt: 1.5, pt: 1.5, borderTop: `1px dashed ${colors.border}` }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
                    <AccountBalanceIcon sx={{ fontSize: 16, color: colors.orange }} />
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, letterSpacing: '0.05em' }}>
                      ÓRGÃO AUTUADOR
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: colors.navy, pl: 2.85 }}>
                    {modalDetalheMulta.multa.orgao}
                  </Typography>
                </Box>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setModalDetalheMulta({ open: false, multa: null })}>
            Fechar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={modalDebito.open}
        onClose={() => setModalDebito({ open: false, debito: null })}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle sx={{ fontWeight: 700, color: colors.navy }}>
          Outros valores · {modalDebito.debito?.tipo || 'Débito'}
          {modalDebito.debito?.placa ? ` · ${modalDebito.debito.placa}` : ''}
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {modalDebito.debito ? (
            <Box>
              {modalDebito.debito.razao_social ? (
                <Box sx={{ mb: 2, p: 1.25, border: `1px solid ${colors.border}`, borderRadius: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, letterSpacing: '0.04em' }}>
                    RAZÃO SOCIAL
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: colors.navy }}>
                    {modalDebito.debito.razao_social}
                  </Typography>
                </Box>
              ) : null}
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
                {(modalDebito.debito.tipo === 'IPVA'
                  ? [
                      { label: 'Valor principal', valor: modalDebito.debito.valor_original },
                      { label: 'Valor juros', valor: modalDebito.debito.valor_mora },
                      { label: 'Valor multa', valor: modalDebito.debito.valor_multa },
                      { label: 'Valor outros', valor: modalDebito.debito.valor_outros },
                      { label: 'Valor total', valor: modalDebito.debito.valor_total },
                    ]
                  : [
                      { label: 'Valor total', valor: modalDebito.debito.valor_total },
                      { label: 'Valor principal', valor: modalDebito.debito.valor_original },
                      { label: 'Valor pago', valor: modalDebito.debito.valor_pago },
                      { label: 'Valor multa', valor: modalDebito.debito.valor_multa },
                      { label: 'Valor juros', valor: modalDebito.debito.valor_mora },
                      { label: 'Valor outros', valor: modalDebito.debito.valor_outros },
                      { label: 'Valor diferença', valor: modalDebito.debito.valor_diferenca },
                    ]
                )
                  .filter((c) => c.valor != null && Number(c.valor) !== 0)
                  .map((c) => (
                    <Box key={c.label} sx={{ p: 1.25, border: `1px solid ${colors.border}`, borderRadius: 1 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                        {c.label}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: colors.navy }}>
                        {fmtMoeda(c.valor)}
                      </Typography>
                    </Box>
                  ))}
              </Box>
              {modalDebito.debito.tipo === 'IPVA' &&
              modalDebito.debito.boleto &&
              /^https?:\/\//i.test(modalDebito.debito.boleto) ? (
                <Box sx={{ mt: 2 }}>
                  <Button
                    variant="outlined"
                    startIcon={<PictureAsPdfIcon />}
                    onClick={() =>
                      setModalBoletoPdf({
                        open: true,
                        url: modalDebito.debito!.boleto,
                        idDebito: modalDebito.debito!.id_debito_detran,
                        titulo: `Boleto · IPVA · ${modalDebito.debito!.placa}`,
                      })
                    }
                    sx={{ textTransform: 'none', fontWeight: 600 }}
                  >
                    Abrir boleto PDF
                  </Button>
                </Box>
              ) : null}
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setModalDebito({ open: false, debito: null })}>Fechar</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmarSyncOpen} onClose={() => setConfirmarSyncOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 700, color: colors.navy, display: 'flex', alignItems: 'center', gap: 1 }}>
          <SyncIcon /> {syncTipo === 'debitos' ? 'Confirmar sincronização' : 'Confirmar sincronização de Multas'}
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {syncTipo === 'debitos' && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
                O que deseja consultar?
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={syncDebitosTipos.ipva}
                      onChange={(e) => setSyncDebitosTipos((prev) => ({ ...prev, ipva: e.target.checked }))}
                      size="small"
                    />
                  }
                  label={<Typography variant="body2" sx={{ fontWeight: 700, color: colors.navy }}>IPVA</Typography>}
                  sx={{ m: 0 }}
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={syncDebitosTipos.licenciamento}
                      onChange={(e) =>
                        setSyncDebitosTipos((prev) => ({ ...prev, licenciamento: e.target.checked }))
                      }
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontWeight: 700, color: colors.navy }}>
                      Licenciamento
                    </Typography>
                  }
                  sx={{ m: 0 }}
                />
                {syncDebitosTipos.ipva && (
                  <FormControl size="small" sx={{ minWidth: 140 }}>
                    <Select
                      multiple
                      displayEmpty
                      value={syncIpvaAnos}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const vals = (typeof raw === 'string' ? raw.split(',') : raw)
                          .map(Number)
                          .filter((n) => Number.isFinite(n));
                        setSyncIpvaAnos(vals.length ? vals.sort((a, b) => b - a) : [new Date().getFullYear()]);
                      }}
                      renderValue={(selected) =>
                        selected.length ? selected.slice().sort((a, b) => b - a).join(', ') : 'Anos'
                      }
                      sx={{ fontSize: '0.85rem', fontWeight: 600, height: 32 }}
                    >
                      {opcoesAnosIpva.map((ano) => (
                        <MenuItem key={ano} value={ano} dense>
                          <Checkbox size="small" checked={syncIpvaAnos.includes(ano)} sx={{ p: 0.5, mr: 1 }} />
                          {ano}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              </Box>
            </Box>
          )}
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {syncTipo === 'debitos'
              ? 'Selecione os veículos:'
              : 'Selecione os veículos para consultar somente multas:'}
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 1.5,
              maxHeight: 240,
              overflowY: 'auto',
              pr: 1,
            }}
          >
            {veiculos
              .filter(() => true)
              .map((v) => {
                const temRenavam = Boolean(v.renavam && v.renavam.trim() !== '');
                const isSelected = syncVeiculoIds.includes(v.id_veiculo);
                return (
                  <FormControlLabel
                    key={v.id_veiculo}
                    control={
                      <Checkbox
                        checked={isSelected && temRenavam}
                        disabled={!temRenavam}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSyncVeiculoIds((prev) => [...prev, v.id_veiculo]);
                          } else {
                            setSyncVeiculoIds((prev) => prev.filter((id) => id !== v.id_veiculo));
                          }
                        }}
                        size="small"
                      />
                    }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap', lineHeight: 1 }}>
                        <Typography
                          variant="body2"
                          sx={{ fontWeight: 700, color: temRenavam ? 'text.primary' : 'text.disabled', lineHeight: 1 }}
                        >
                          {v.placa}{v.modelo ? ` - ${v.modelo}` : ''}
                        </Typography>
                        {!temRenavam && (
                          <Box
                            component="span"
                            sx={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              px: 0.6,
                              py: 0.1,
                              borderRadius: 1,
                              bgcolor: '#ffebee',
                              color: '#c62828',
                              fontSize: '0.65rem',
                              fontWeight: 600,
                              lineHeight: 1.4,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Sem RENAVAM
                          </Box>
                        )}
                      </Box>
                    }
                    sx={{ display: 'flex', alignItems: 'center', m: 0 }}
                  />
                );
              })}
            {veiculos.length === 0 && (
              <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1, gridColumn: 'span 2' }}>
                Nenhum veículo ativo cadastrado.
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmarSyncOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            startIcon={<SyncIcon />}
            disabled={
              syncVeiculoIds.length === 0 ||
              (syncTipo === 'debitos' && !syncDebitosTipos.ipva && !syncDebitosTipos.licenciamento) ||
              (syncTipo === 'debitos' && syncDebitosTipos.ipva && syncIpvaAnos.length === 0)
            }
            onClick={() => {
              void sincronizarDetran(syncVeiculoIds, syncTipo);
            }}
          >
            Confirmar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={syncProgress.open}
        onClose={(_e, reason) => {
          if (syncProgress.fase === 'progresso') return;
          if (reason === 'backdropClick' || reason === 'escapeKeyDown' || syncProgress.fase === 'resultado') {
            setSyncProgress((prev) => ({ ...prev, open: false }));
          }
        }}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle sx={{ fontWeight: 700, color: colors.navy, display: 'flex', alignItems: 'center', gap: 1 }}>
          {syncProgress.fase === 'progresso' ? (
            <>
              <SyncIcon /> Sincronizando
            </>
          ) : syncProgress.ok ? (
            <>
              <CheckCircleIcon sx={{ color: '#2e7d32' }} /> Consulta concluída
            </>
          ) : (
            <>
              <WarningAmberIcon sx={{ color: '#ed6c02' }} /> Consulta com pendências
            </>
          )}
        </DialogTitle>
        <DialogContent>
          {syncProgress.fase === 'progresso' ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 1 }}>
              <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                <CircularProgress
                  variant="determinate"
                  value={syncProgress.pct}
                  size={88}
                  thickness={4}
                  sx={{ color: colors.navy }}
                />
                <Box
                  sx={{
                    top: 0,
                    left: 0,
                    bottom: 0,
                    right: 0,
                    position: 'absolute',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Typography variant="subtitle1" component="div" sx={{ fontWeight: 700, color: colors.navy }}>
                    {syncProgress.pct}%
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ width: '100%' }}>
                <LinearProgress
                  variant="determinate"
                  value={syncProgress.pct}
                  sx={{ height: 10, borderRadius: 1, mb: 1.5 }}
                />
                <Typography variant="body2" color="text.secondary" align="center">
                  Consultando {syncProgress.feitos} de {syncProgress.total} veículo(s)
                </Typography>
                {syncProgress.atual && (
                  <Typography variant="body2" align="center" sx={{ mt: 0.5, fontWeight: 600 }}>
                    {syncProgress.atual}
                  </Typography>
                )}
              </Box>
            </Box>
          ) : (
            <Box sx={{ py: 0.5 }}>
              <Alert severity={syncProgress.ok ? 'success' : 'warning'} sx={{ mb: syncProgress.detalhes.length ? 1.5 : 0 }}>
                {syncProgress.mensagem}
              </Alert>
              {syncProgress.detalhes.length > 0 && (
                <Box sx={{ maxHeight: 160, overflowY: 'auto' }}>
                  {syncProgress.detalhes.map((d) => (
                    <Typography key={d} variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                      • {d}
                    </Typography>
                  ))}
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        {syncProgress.fase === 'resultado' && (
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button
              variant="contained"
              onClick={() => setSyncProgress((prev) => ({ ...prev, open: false }))}
            >
              OK
            </Button>
          </DialogActions>
        )}
      </Dialog>

      <PdfBoletoDialog
        open={modalBoletoPdf.open}
        url={modalBoletoPdf.url}
        idDebito={modalBoletoPdf.idDebito}
        titulo={modalBoletoPdf.titulo}
        onClose={() => setModalBoletoPdf({ open: false, url: null, idDebito: null, titulo: '' })}
      />

      <Menu
        anchorEl={statusMenuAnchor?.anchorEl}
        open={Boolean(statusMenuAnchor)}
        onClose={() => setStatusMenuAnchor(null)}
      >
        <MenuItem
          onClick={() =>
            statusMenuAnchor?.debito ? void alterarStatusDebito('Paga') : void alterarStatusMulta('Paga')
          }
        >
          <CheckCircleIcon sx={{ color: '#2e7d32', mr: 1, fontSize: 18 }} />
          Paga
        </MenuItem>
      </Menu>
    </Box>
  );
}
