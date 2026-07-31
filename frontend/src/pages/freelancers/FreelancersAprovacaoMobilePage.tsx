import { useCallback, useEffect, useMemo, useState } from 'react';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Button from '@mui/material/Button';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import FilterListIcon from '@mui/icons-material/FilterList';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import LogoutIcon from '@mui/icons-material/Logout';
import PersonAddAlt1OutlinedIcon from '@mui/icons-material/PersonAddAlt1Outlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import CloseIcon from '@mui/icons-material/Close';
import {
  api,
  fmtData,
  type FreelancerColaborador,
  type FreelancerTurnoAprovacao,
} from '../../api/client';
import { showToast } from '../../utils/toast';
import { usePageTitle } from '../../hooks/usePageTitle';
import CampoDataFrota from '../../components/frota/CampoDataFrota';
import CkMarkLogoMenu from '../../components/CkMarkLogoMenu';
import '../../components/visitas/visitas-mobile.css';
import '../../components/freelancers/freelancers-mobile.css';

const campoDataMobileSx = {
  mb: 0,
  width: '100%',
  '& .MuiOutlinedInput-root, & .MuiPickersOutlinedInput-root': {
    borderRadius: '12px',
    minHeight: 42,
    height: 42,
  },
  '& .MuiInputBase-input, & .MuiPickersInputBase-input': {
    fontSize: '0.82rem',
    fontWeight: 600,
    py: 0,
  },
  '& .MuiInputLabel-root': {
    fontSize: '0.75rem',
  },
  '& .MuiInputLabel-root.MuiInputLabel-shrink': {
    transform: 'translate(14px, -9px) scale(0.75)',
  },
} as const;

type StatusFiltro = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL';
type DialogoHorario = {
  modo: 'saida' | 'ajustar';
  item: FreelancerTurnoAprovacao;
} | null;

const NAVY = '#1B2A6B';
const ORANGE = '#E8520A';

const STATUS_TABS: Array<{ id: StatusFiltro; label: string }> = [
  { id: 'ALL', label: 'Todos' },
  { id: 'PENDING', label: 'Pendentes' },
  { id: 'APPROVED', label: 'Aprovados' },
  { id: 'REJECTED', label: 'Recusados' },
];

function toYmd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Segunda–domingo da semana atual (calendário BR). */
function semanaAtualYmd() {
  const hoje = new Date();
  hoje.setHours(12, 0, 0, 0);
  const diaSemana = (hoje.getDay() + 6) % 7; // seg=0 … dom=6
  const inicio = new Date(hoje);
  inicio.setDate(hoje.getDate() - diaSemana);
  const fim = new Date(inicio);
  fim.setDate(inicio.getDate() + 6);
  return { from: toYmd(inicio), to: toYmd(fim) };
}

function ymdValido(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '').trim());
}

function ordemStatus(status: string) {
  const s = String(status || '').toUpperCase();
  if (s === 'PENDING') return 0;
  if (s === 'APPROVED') return 1;
  if (s === 'REJECTED') return 2;
  return 3;
}

function fmtHora(iso: string | null | undefined) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

type DataHoraPartes = { data: string; hora: string };

function partesFromIso(isoOrDate: string | Date | null | undefined): DataHoraPartes {
  const d = isoOrDate instanceof Date ? isoOrDate : isoOrDate ? new Date(isoOrDate) : new Date();
  if (Number.isNaN(d.getTime())) {
    const agora = new Date();
    return {
      data: toYmd(agora),
      hora: `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`,
    };
  }
  return {
    data: toYmd(d),
    hora: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
  };
}

function partesToIso(partes: DataHoraPartes) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(partes.data) || !/^\d{2}:\d{2}$/.test(partes.hora)) return null;
  const d = new Date(`${partes.data}T${partes.hora}:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function statusLabel(item: FreelancerTurnoAprovacao) {
  if (item.checkout_pending || (!item.check_out_time && item.check_in_time)) {
    return 'Saída pendente';
  }
  if (item.regional_approval_label) return item.regional_approval_label;
  const s = String(item.regional_approval_status || '').toUpperCase();
  if (s === 'PENDING') return 'Aguardando';
  if (s === 'APPROVED') return 'Aprovado';
  if (s === 'REJECTED') return 'Recusado';
  return s || '—';
}

function statusTone(status: string, item?: FreelancerTurnoAprovacao): 'pending' | 'approved' | 'rejected' | '' {
  if (item?.checkout_pending || (!item?.check_out_time && item?.check_in_time)) return 'pending';
  const s = String(status || '').toUpperCase();
  if (s === 'PENDING') return 'pending';
  if (s === 'APPROVED') return 'approved';
  if (s === 'REJECTED') return 'rejected';
  return '';
}

export default function FreelancersAprovacaoMobilePage() {
  usePageTitle('Aprovar freelancers');
  const inicial = useMemo(() => semanaAtualYmd(), []);
  /** Datas aplicadas na busca (não mudam enquanto o usuário digita no input). */
  const [dateFrom, setDateFrom] = useState(inicial.from);
  const [dateTo, setDateTo] = useState(inicial.to);
  /** Rascunho dos inputs — evita o date picker mobile “pular” e disparar fetch no meio. */
  const [draftFrom, setDraftFrom] = useState(inicial.from);
  const [draftTo, setDraftTo] = useState(inicial.to);
  const [status, setStatus] = useState<StatusFiltro>('ALL');
  const [bkFiltro, setBkFiltro] = useState('');
  const [filtroLojaAberto, setFiltroLojaAberto] = useState(false);
  /** Grupos abertos — começa tudo fechado. */
  const [abertos, setAbertos] = useState<Record<string, boolean>>({});
  const [items, setItems] = useState<FreelancerTurnoAprovacao[]>([]);
  const [lojas, setLojas] = useState<Array<{ id_loja: number; nome: string; bk_number: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [err, setErr] = useState('');
  const [dialogo, setDialogo] = useState<DialogoHorario>(null);
  const [draftEntrada, setDraftEntrada] = useState<DataHoraPartes>({ data: '', hora: '' });
  const [draftSaida, setDraftSaida] = useState<DataHoraPartes>({ data: '', hora: '' });
  const [salvandoHorario, setSalvandoHorario] = useState(false);
  const [registrarAberto, setRegistrarAberto] = useState(false);
  const [regPasso, setRegPasso] = useState<1 | 2>(1);
  const [colaboradores, setColaboradores] = useState<FreelancerColaborador[]>([]);
  const [loadingColabs, setLoadingColabs] = useState(false);
  const [regBk, setRegBk] = useState('');
  const [pessoaSel, setPessoaSel] = useState<FreelancerColaborador | null>(null);
  const [regBusca, setRegBusca] = useState('');
  const [regBuscou, setRegBuscou] = useState(false);
  const [regEntrada, setRegEntrada] = useState<DataHoraPartes>(() => partesFromIso(new Date()));
  const [regSaida, setRegSaida] = useState<DataHoraPartes>(() => {
    const d = new Date();
    d.setHours(d.getHours() + 8);
    return partesFromIso(d);
  });
  const [regComSaida, setRegComSaida] = useState(true);
  const [salvandoRegistro, setSalvandoRegistro] = useState(false);
  const [lojaPickerAberto, setLojaPickerAberto] = useState(false);
  const [excluirItem, setExcluirItem] = useState<FreelancerTurnoAprovacao | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  const datasPendentes = draftFrom !== dateFrom || draftTo !== dateTo;

  const carregar = useCallback(async (from: string, to: string, st: StatusFiltro) => {
    if (!ymdValido(from) || !ymdValido(to)) {
      setErr('Informe um período válido (De / Até).');
      return;
    }
    setLoading(true);
    setErr('');
    try {
      const res = await api.freelancersAprovacao({
        date_from: from,
        date_to: to,
        status: st,
      });
      setItems(res.items || []);
      setLojas(res.lojas || []);
    } catch {
      setErr('');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar(dateFrom, dateTo, status);
  }, [carregar, dateFrom, dateTo, status]);

  function aplicarPeriodo() {
    if (!ymdValido(draftFrom) || !ymdValido(draftTo)) {
      showToast('Período inválido', 'error');
      return;
    }
    if (draftFrom > draftTo) {
      showToast('A data inicial não pode ser maior que a final', 'error');
      return;
    }
    setDateFrom(draftFrom);
    setDateTo(draftTo);
    void carregar(draftFrom, draftTo, status);
  }

  const filtrados = useMemo(() => {
    const base = !bkFiltro ? items : items.filter((i) => String(i.bk_number) === bkFiltro);
    return [...base].sort((a, b) => {
      const byStatus = ordemStatus(a.regional_approval_status) - ordemStatus(b.regional_approval_status);
      if (byStatus !== 0) return byStatus;
      const byDate = String(b.work_date || '').localeCompare(String(a.work_date || ''));
      if (byDate !== 0) return byDate;
      return String(a.full_name || '').localeCompare(String(b.full_name || ''), 'pt-BR');
    });
  }, [items, bkFiltro]);

  const porLoja = useMemo(() => {
    const map = new Map<string, FreelancerTurnoAprovacao[]>();
    for (const item of filtrados) {
      const key = `${item.bk_number || ''}::${item.store_name || 'Unidade'}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'));
  }, [filtrados]);

  const totalHoras = useMemo(
    () => filtrados.reduce((s, i) => s + (Number(i.hours) || 0), 0),
    [filtrados],
  );

  const lojaAtiva = lojas.find((l) => l.bk_number === bkFiltro);

  function toggleGrupo(chave: string) {
    setAbertos((prev) => ({ ...prev, [chave]: !prev[chave] }));
  }

  function abrirLancarSaida(item: FreelancerTurnoAprovacao) {
    setDialogo({ modo: 'saida', item });
    setDraftEntrada(partesFromIso(item.check_in_time));
    // Mesmo dia da entrada, hora atual — mais natural no celular
    const base = partesFromIso(item.check_in_time || new Date());
    const agora = partesFromIso(new Date());
    setDraftSaida({ data: base.data, hora: agora.hora });
  }

  function abrirAjustar(item: FreelancerTurnoAprovacao) {
    setDialogo({ modo: 'ajustar', item });
    setDraftEntrada(partesFromIso(item.check_in_time));
    setDraftSaida(partesFromIso(item.check_out_time || item.check_in_time || new Date()));
  }

  function fecharDialogo() {
    if (salvandoHorario) return;
    setDialogo(null);
  }

  async function salvarHorario() {
    if (!dialogo) return;
    const { modo, item } = dialogo;

    setSalvandoHorario(true);
    setBusyId(item.checkin_id);
    try {
      if (modo === 'saida') {
        const saidaIso = partesToIso(draftSaida);
        if (!saidaIso) {
          showToast('Informe data e hora de saída', 'error');
          return;
        }
        if (item.check_in_time && new Date(saidaIso) <= new Date(item.check_in_time)) {
          showToast('A saída deve ser depois da entrada', 'error');
          return;
        }
        await api.freelancersLancarSaida(item.checkin_id, { checkout_time: saidaIso });
        showToast('Saída lançada — agora pode aprovar ou recusar', 'success');
      } else {
        const entradaIso = partesToIso(draftEntrada);
        if (!entradaIso) {
          showToast('Informe data e hora de entrada', 'error');
          return;
        }
        if (item.check_out_time) {
          const saidaIso = partesToIso(draftSaida);
          if (!saidaIso) {
            showToast('Informe data e hora de saída', 'error');
            return;
          }
          if (new Date(saidaIso) <= new Date(entradaIso)) {
            showToast('A saída deve ser depois da entrada', 'error');
            return;
          }
          await api.freelancersAjustarHorario(item.checkin_id, {
            checkin_time: entradaIso,
            checkout_time: saidaIso,
          });
        } else {
          await api.freelancersAjustarHorario(item.checkin_id, { checkin_time: entradaIso });
        }
        showToast('Horário ajustado', 'success');
      }
      setDialogo(null);
      await carregar(dateFrom, dateTo, status);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Falha ao salvar horário', 'error');
    } finally {
      setSalvandoHorario(false);
      setBusyId(null);
    }
  }

  async function aprovar(id: number) {
    setBusyId(id);
    try {
      await api.freelancersAprovar(id);
      showToast('Turno aprovado — passa a contar na folha', 'success');
      await carregar(dateFrom, dateTo, status);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Falha ao aprovar', 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function recusar(id: number) {
    setBusyId(id);
    try {
      await api.freelancersRecusar(id);
      showToast('Turno recusado', 'success');
      await carregar(dateFrom, dateTo, status);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Falha ao recusar', 'error');
    } finally {
      setBusyId(null);
    }
  }

  function abrirRegistrar() {
    setRegistrarAberto(true);
    setRegPasso(1);
    setPessoaSel(null);
    setRegBusca('');
    setRegBuscou(false);
    setColaboradores([]);
    setLojaPickerAberto(false);
    setRegComSaida(true);
    const agora = new Date();
    setRegEntrada(partesFromIso(agora));
    const saida = new Date(agora);
    saida.setHours(saida.getHours() + 8);
    setRegSaida(partesFromIso(saida));
    setRegBk(bkFiltro || lojas[0]?.bk_number || '');
  }

  function fecharRegistrar() {
    if (salvandoRegistro) return;
    setRegistrarAberto(false);
    setLojaPickerAberto(false);
  }

  function tipoColabLabel(c: FreelancerColaborador) {
    const role = String(c.role_name || '').toLowerCase();
    if (role.includes('treinamento')) return 'Treinamento';
    const ct = String(c.contract_type || '').toUpperCase();
    if (ct.includes('FREEL')) return 'Freelancer';
    if (ct.includes('CLT')) return 'CLT / diária';
    return ct || 'Colaborador';
  }

  const lojaSelecionada = useMemo(
    () => lojas.find((l) => l.bk_number === regBk) || null,
    [lojas, regBk],
  );

  async function buscarPessoas() {
    const q = regBusca.trim();
    if (q.length < 2) {
      showToast('Digite pelo menos 2 letras do nome', 'error');
      return;
    }
    setLoadingColabs(true);
    setRegBuscou(true);
    try {
      const res = await api.freelancersListarColaboradores({ q });
      setColaboradores(res.items || []);
      if (!lojas.length && res.lojas?.length) setLojas(res.lojas);
    } catch (e) {
      setColaboradores([]);
      showToast(e instanceof Error ? e.message : 'Erro ao buscar pessoas', 'error');
    } finally {
      setLoadingColabs(false);
    }
  }

  function escolherPessoa(c: FreelancerColaborador) {
    setPessoaSel(c);
    if (c.bk_number && lojas.some((l) => l.bk_number === c.bk_number)) {
      setRegBk(c.bk_number);
    } else if (!regBk) {
      setRegBk(bkFiltro || lojas[0]?.bk_number || '');
    }
    setRegPasso(2);
    setLojaPickerAberto(false);
  }

  function voltarPasso1() {
    if (salvandoRegistro) return;
    setRegPasso(1);
    setLojaPickerAberto(false);
  }

  async function salvarRegistro() {
    if (!pessoaSel) {
      showToast('Escolha o colaborador', 'error');
      return;
    }
    if (!regBk) {
      showToast('Selecione a loja', 'error');
      return;
    }
    const entradaIso = partesToIso(regEntrada);
    if (!entradaIso) {
      showToast('Informe data e hora de entrada', 'error');
      return;
    }
    let saidaIso: string | undefined;
    if (regComSaida) {
      saidaIso = partesToIso(regSaida) || undefined;
      if (!saidaIso) {
        showToast('Informe data e hora de saída', 'error');
        return;
      }
      if (new Date(saidaIso) <= new Date(entradaIso)) {
        showToast('A saída deve ser depois da entrada', 'error');
        return;
      }
    }

    setSalvandoRegistro(true);
    try {
      await api.freelancersRegistrarTurno({
        employee_id: pessoaSel.employee_id,
        bk_number: regBk,
        checkin_time: entradaIso,
        ...(saidaIso ? { checkout_time: saidaIso } : {}),
      });
      showToast(
        saidaIso
          ? 'Turno lançado — agora pode aprovar'
          : 'Entrada lançada — use Lançar saída depois',
        'success',
      );
      setRegistrarAberto(false);
      await carregar(dateFrom, dateTo, status);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Falha ao lançar turno', 'error');
    } finally {
      setSalvandoRegistro(false);
    }
  }

  async function confirmarExcluir() {
    if (!excluirItem) return;
    setExcluindo(true);
    setBusyId(excluirItem.checkin_id);
    try {
      await api.freelancersExcluir(excluirItem.checkin_id);
      showToast('Turno excluído', 'success');
      setExcluirItem(null);
      await carregar(dateFrom, dateTo, status);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Falha ao excluir', 'error');
    } finally {
      setExcluindo(false);
      setBusyId(null);
    }
  }

  return (
    <div className="ck-visitas ck-freela ck-freela--page">
      <div className="ck-visitas__stage">
        <div className="ck-visitas__glow ck-visitas__glow--a" aria-hidden />
        <div className="ck-visitas__glow ck-visitas__glow--b" aria-hidden />
        <div className="ck-visitas__mesh" aria-hidden />

        <div className="ck-visitas__stage-inner">
          <div className="ck-visitas__hero-row ck-visitas__anim ck-visitas__anim--1">
            <div>
              <p className="ck-visitas__mark-text">Grupo Alvim</p>
              <h1 className="ck-visitas__title ck-freela__title">Freelancers</h1>
            </div>
            <CkMarkLogoMenu size={56} className="ck-visitas__mark-icon" />
          </div>

          <p className="ck-visitas__sub ck-visitas__anim ck-visitas__anim--2">
            Conferência da semana atual — pendentes, aprovados e recusados. Ajuste o período se precisar.
          </p>

          <div className="ck-visitas__metrics ck-visitas__anim ck-visitas__anim--3" aria-live="polite">
            <div className="ck-visitas__metric ck-visitas__metric--accent">
              <strong>{loading ? '—' : filtrados.length}</strong>
              <span>Turnos</span>
            </div>
            <div className="ck-visitas__metric">
              <strong>{loading ? '—' : porLoja.length}</strong>
              <span>Lojas</span>
            </div>
            <div className="ck-visitas__metric">
              <strong>{loading ? '—' : totalHoras > 0 ? totalHoras.toFixed(1) : '—'}</strong>
              <span>Horas</span>
            </div>
          </div>
        </div>
      </div>

      <div className="ck-visitas__sheet ck-freela__sheet--fill ck-visitas__anim ck-visitas__anim--4">
          <div className="ck-freela__dates">
            <div className="ck-freela__date-field">
              <CampoDataFrota
                label="De"
                value={draftFrom}
                onChange={setDraftFrom}
                sx={campoDataMobileSx}
              />
            </div>
            <div className="ck-freela__date-field">
              <CampoDataFrota
                label="Até"
                value={draftTo}
                onChange={setDraftTo}
                min={draftFrom || undefined}
                sx={campoDataMobileSx}
              />
            </div>
            <button
              type="button"
              className={`ck-freela__buscar${datasPendentes ? ' is-on' : ''}`}
              onClick={aplicarPeriodo}
            >
              Buscar
            </button>
          </div>

          <div className="ck-freela__filtro-row">
            <div className="ck-visitas__seg" role="tablist" aria-label="Status">
              {STATUS_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={status === t.id}
                  className={`ck-visitas__seg-btn${status === t.id ? ' is-on' : ''}`}
                  onClick={() => setStatus(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className={`ck-freela__filtro-btn${bkFiltro ? ' is-on' : ''}`}
              aria-label="Filtrar por unidade"
              onClick={() => setFiltroLojaAberto(true)}
            >
              <FilterListIcon sx={{ fontSize: 20 }} />
            </button>
          </div>

          {lojaAtiva ? (
            <p className="ck-freela__loja-tag">
              Unidade: {lojaAtiva.nome}
              {lojaAtiva.bk_number ? ` · BK ${lojaAtiva.bk_number}` : ''}
            </p>
          ) : null}

          <p className="ck-freela__loja-tag" style={{ marginTop: lojaAtiva ? -8 : undefined }}>
            Período: {fmtData(dateFrom)} → {fmtData(dateTo)}
          </p>

          <button
            type="button"
            className="ck-freela__registrar"
            onClick={() => void abrirRegistrar()}
          >
            <PersonAddAlt1OutlinedIcon sx={{ fontSize: 20 }} />
            Lançar ponto
          </button>

          {err ? <p className="ck-visitas__erro">{err}</p> : null}

          {loading ? (
            <div className="ck-visitas__loading">
              <CircularProgress size={28} sx={{ color: ORANGE }} />
            </div>
          ) : porLoja.length === 0 ? (
            <div className="ck-freela__empty">
              <strong>Nenhum turno neste filtro</strong>
              Ajuste o período, o status ou a unidade.
            </div>
          ) : (
            porLoja.map(([chave, lista]) => {
              const [, nomeLoja] = chave.split('::');
              const bk = lista[0]?.bk_number || '';
              const aberto = !!abertos[chave];
              const pendentes = lista.filter(
                (i) =>
                  !i.checkout_pending &&
                  i.check_out_time &&
                  String(i.regional_approval_status || '').toUpperCase() === 'PENDING',
              ).length;
              return (
                <div key={chave} className={`ck-freela__grupo${aberto ? ' is-open' : ''}`}>
                  <button
                    type="button"
                    className="ck-freela__grupo-head"
                    aria-expanded={aberto}
                    onClick={() => toggleGrupo(chave)}
                  >
                    <div className="ck-freela__grupo-title">
                      <strong>{nomeLoja}</strong>
                      {bk ? <small>BK {bk}</small> : null}
                      {pendentes > 0 ? (
                        <small className="ck-freela__grupo-pend">
                          {pendentes} pendente{pendentes > 1 ? 's' : ''}
                        </small>
                      ) : null}
                    </div>
                    <span className="ck-freela__grupo-meta">
                      <span className="ck-freela__count">{lista.length}</span>
                      <ExpandMoreIcon
                        className={`ck-freela__chevron${aberto ? ' is-open' : ''}`}
                        sx={{ fontSize: 22 }}
                      />
                    </span>
                  </button>
                  {aberto &&
                    lista.map((item) => {
                      const saidaPendente = !!(
                        item.checkout_pending ||
                        (item.check_in_time && !item.check_out_time)
                      );
                      const pendente =
                        !saidaPendente &&
                        String(item.regional_approval_status || '').toUpperCase() === 'PENDING';
                      const ocupado = busyId === item.checkin_id;
                      const tone = statusTone(item.regional_approval_status, item);
                      return (
                        <div key={item.checkin_id} className="ck-freela__item">
                          <div className="ck-freela__item-top">
                            <strong title={item.full_name || undefined}>{item.full_name}</strong>
                            <span
                              className={`ck-freela__chip${tone ? ` ck-freela__chip--${tone}` : ''}`}
                            >
                              {statusLabel(item)}
                            </span>
                          </div>
                          <p className="ck-freela__meta">
                            {fmtData(item.work_date)} · {fmtHora(item.check_in_time)} →{' '}
                            {fmtHora(item.check_out_time)}
                            {item.hours != null ? ` · ${Number(item.hours).toFixed(1)}h` : ''}
                          </p>
                          {item.session_type ? (
                            <p className="ck-freela__meta">{item.session_type}</p>
                          ) : null}
                          <div className="ck-freela__acoes">
                            {saidaPendente ? (
                              <button
                                type="button"
                                className="ck-freela__btn ck-freela__btn--saida"
                                disabled={ocupado}
                                onClick={() => abrirLancarSaida(item)}
                              >
                                <LogoutIcon sx={{ fontSize: 18 }} />
                                Lançar saída
                              </button>
                            ) : null}
                            {item.check_in_time ? (
                              <button
                                type="button"
                                className="ck-freela__btn ck-freela__btn--ajuste"
                                disabled={ocupado}
                                onClick={() => abrirAjustar(item)}
                              >
                                <AccessTimeIcon sx={{ fontSize: 18 }} />
                                Ajustar
                              </button>
                            ) : null}
                            {pendente ? (
                              <>
                                <button
                                  type="button"
                                  className="ck-freela__btn ck-freela__btn--ok"
                                  disabled={ocupado}
                                  onClick={() => void aprovar(item.checkin_id)}
                                >
                                  <CheckCircleOutlinedIcon sx={{ fontSize: 18 }} />
                                  Aprovar
                                </button>
                                <button
                                  type="button"
                                  className="ck-freela__btn ck-freela__btn--no"
                                  disabled={ocupado}
                                  onClick={() => void recusar(item.checkin_id)}
                                >
                                  <HighlightOffIcon sx={{ fontSize: 18 }} />
                                  Recusar
                                </button>
                              </>
                            ) : null}
                            <button
                              type="button"
                              className="ck-freela__btn ck-freela__btn--excluir"
                              disabled={ocupado}
                              onClick={() => setExcluirItem(item)}
                            >
                              <DeleteOutlineIcon sx={{ fontSize: 18 }} />
                              Excluir
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              );
            })
          )}
      </div>

      <Dialog open={filtroLojaAberto} onClose={() => setFiltroLojaAberto(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem', color: NAVY, pb: 1 }}>
          Filtrar por unidade
        </DialogTitle>
        <List sx={{ pt: 0, pb: 1 }}>
          <ListItemButton
            selected={bkFiltro === ''}
            onClick={() => {
              setBkFiltro('');
              setFiltroLojaAberto(false);
            }}
          >
            <ListItemIcon sx={{ minWidth: 36 }}>
              <StorefrontOutlinedIcon
                sx={{ fontSize: 20, color: bkFiltro === '' ? ORANGE : 'text.disabled' }}
              />
            </ListItemIcon>
            <ListItemText
              primary="Todas da região"
              secondary={`${lojas.length} loja(s) no escopo`}
              slotProps={{
                primary: { sx: { fontWeight: bkFiltro === '' ? 700 : 600, fontSize: '0.9rem' } },
                secondary: { sx: { fontSize: '0.72rem' } },
              }}
            />
          </ListItemButton>
          {lojas.map((l) => {
            const ativa = bkFiltro === l.bk_number;
            return (
              <ListItemButton
                key={l.bk_number}
                selected={ativa}
                onClick={() => {
                  setBkFiltro(l.bk_number);
                  setFiltroLojaAberto(false);
                }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <StorefrontOutlinedIcon
                    sx={{ fontSize: 20, color: ativa ? ORANGE : 'text.disabled' }}
                  />
                </ListItemIcon>
                <ListItemText
                  primary={l.nome}
                  secondary={l.bk_number ? `BK ${l.bk_number}` : undefined}
                  slotProps={{
                    primary: { sx: { fontWeight: ativa ? 700 : 600, fontSize: '0.9rem' } },
                    secondary: { sx: { fontSize: '0.72rem' } },
                  }}
                />
              </ListItemButton>
            );
          })}
        </List>
      </Dialog>

      <Dialog
        open={registrarAberto}
        onClose={fecharRegistrar}
        fullScreen
        slotProps={{ paper: { className: 'ck-freela__wizard' } }}
      >
        <header className="ck-freela__wizard-head">
          <div className="ck-freela__wizard-nav">
            <button
              type="button"
              className="ck-freela__wizard-iconbtn"
              onClick={regPasso === 1 ? fecharRegistrar : voltarPasso1}
              disabled={salvandoRegistro}
              aria-label={regPasso === 1 ? 'Fechar' : 'Voltar'}
            >
              {regPasso === 1 ? (
                <CloseIcon sx={{ fontSize: 22 }} />
              ) : (
                <ArrowBackIosNewIcon sx={{ fontSize: 18 }} />
              )}
            </button>
            <div className="ck-freela__wizard-titles">
              <p>Passo {regPasso} de 2</p>
              <h2>{regPasso === 1 ? 'Buscar colaborador' : 'Loja e horário'}</h2>
            </div>
          </div>
          <div className="ck-freela__passos" aria-hidden>
            <span className={`ck-freela__passo${regPasso >= 1 ? ' is-on' : ''}`} />
            <span className={`ck-freela__passo${regPasso >= 2 ? ' is-on' : ''}`} />
          </div>
        </header>

        <div className="ck-freela__wizard-body">
          {regPasso === 1 ? (
            <>
              <form
                className="ck-freela__busca-card"
                onSubmit={(e) => {
                  e.preventDefault();
                  void buscarPessoas();
                }}
              >
                <label className="ck-freela__wiz-field">
                  <span>Nome do colaborador</span>
                  <input
                    type="search"
                    value={regBusca}
                    onChange={(e) => setRegBusca(e.target.value)}
                    placeholder="Digite o nome"
                    autoComplete="off"
                    autoFocus
                  />
                </label>
                <button type="submit" className="ck-freela__busca-btn" disabled={loadingColabs}>
                  {loadingColabs ? 'Buscando…' : 'Buscar'}
                </button>
              </form>

              <div className="ck-freela__pessoa-lista" role="listbox">
                {loadingColabs ? (
                  <div className="ck-freela__pessoa-vazio">
                    <CircularProgress size={28} sx={{ color: ORANGE }} />
                  </div>
                ) : !regBuscou ? (
                  <p className="ck-freela__pessoa-vazio">
                    Digite o nome e toque em Buscar para listar as pessoas.
                  </p>
                ) : colaboradores.length === 0 ? (
                  <p className="ck-freela__pessoa-vazio">Nenhuma pessoa encontrada com esse nome.</p>
                ) : (
                  colaboradores.map((c) => (
                    <button
                      key={c.employee_id}
                      type="button"
                      className="ck-freela__pessoa-item"
                      onClick={() => escolherPessoa(c)}
                    >
                      <span className="ck-freela__pessoa-item-text">
                        <strong>{c.full_name}</strong>
                        <small>
                          {tipoColabLabel(c)}
                          {c.store_name ? ` · ${c.store_name}` : ''}
                        </small>
                      </span>
                      <ChevronRightIcon sx={{ fontSize: 22, color: 'rgba(20,32,72,0.35)' }} />
                    </button>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="ck-freela__passo2">
              {pessoaSel ? (
                <div className="ck-freela__pessoa-sel">
                  <div>
                    <strong>{pessoaSel.full_name}</strong>
                    <small>{tipoColabLabel(pessoaSel)}</small>
                  </div>
                  <button
                    type="button"
                    className="ck-freela__pessoa-trocar"
                    onClick={voltarPasso1}
                    disabled={salvandoRegistro}
                  >
                    Trocar
                  </button>
                </div>
              ) : null}

              <button
                type="button"
                className="ck-freela__loja-pick"
                onClick={() => setLojaPickerAberto(true)}
              >
                <span>
                  <small>Loja do turno</small>
                  <strong>
                    {lojaSelecionada
                      ? `${lojaSelecionada.nome}${lojaSelecionada.bk_number ? ` · BK ${lojaSelecionada.bk_number}` : ''}`
                      : 'Toque para escolher'}
                  </strong>
                </span>
                <ChevronRightIcon sx={{ fontSize: 22, color: 'rgba(20,32,72,0.35)' }} />
              </button>

              <div className="ck-freela__hora-card">
                <p className="ck-freela__hora-card-title">Entrada</p>
                <div className="ck-freela__hora-grid">
                  <label className="ck-freela__wiz-field">
                    <span>Data</span>
                    <input
                      type="date"
                      value={regEntrada.data}
                      onChange={(e) => {
                        const data = e.target.value;
                        setRegEntrada((p) => ({ ...p, data }));
                        if (regComSaida && regSaida.data < data) {
                          setRegSaida((p) => ({ ...p, data }));
                        }
                      }}
                    />
                  </label>
                  <label className="ck-freela__wiz-field">
                    <span>Hora</span>
                    <input
                      type="time"
                      value={regEntrada.hora}
                      onChange={(e) => setRegEntrada((p) => ({ ...p, hora: e.target.value }))}
                    />
                  </label>
                </div>
              </div>

              <div className="ck-freela__saida-toggle" role="group" aria-label="Tipo de lançamento">
                <button
                  type="button"
                  className={`ck-freela__saida-opt${regComSaida ? ' is-on' : ''}`}
                  onClick={() => setRegComSaida(true)}
                >
                  Entrada e saída
                </button>
                <button
                  type="button"
                  className={`ck-freela__saida-opt${!regComSaida ? ' is-on' : ''}`}
                  onClick={() => setRegComSaida(false)}
                >
                  Só entrada
                </button>
              </div>

              {regComSaida ? (
                <div className="ck-freela__hora-card">
                  <p className="ck-freela__hora-card-title">Saída</p>
                  <div className="ck-freela__hora-grid">
                    <label className="ck-freela__wiz-field">
                      <span>Data</span>
                      <input
                        type="date"
                        value={regSaida.data}
                        min={regEntrada.data || undefined}
                        onChange={(e) => setRegSaida((p) => ({ ...p, data: e.target.value }))}
                      />
                    </label>
                    <label className="ck-freela__wiz-field">
                      <span>Hora</span>
                      <input
                        type="time"
                        value={regSaida.hora}
                        onChange={(e) => setRegSaida((p) => ({ ...p, hora: e.target.value }))}
                      />
                    </label>
                  </div>
                </div>
              ) : (
                <p className="ck-freela__pessoa-hint">
                  Depois use «Lançar saída» no card do turno.
                </p>
              )}
            </div>
          )}
        </div>

        {regPasso === 2 ? (
          <footer className="ck-freela__wizard-foot">
            <button
              type="button"
              className="ck-freela__wizard-confirm"
              disabled={salvandoRegistro || !regBk || !pessoaSel}
              onClick={() => void salvarRegistro()}
            >
              {salvandoRegistro ? 'Salvando…' : 'Confirmar lançamento'}
            </button>
          </footer>
        ) : null}
      </Dialog>

      <Dialog
        open={lojaPickerAberto}
        onClose={() => setLojaPickerAberto(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem', color: NAVY, pb: 1 }}>
          Loja do turno
        </DialogTitle>
        <List sx={{ pt: 0, pb: 1, maxHeight: '60vh', overflow: 'auto' }}>
          {lojas.map((l) => {
            const ativa = regBk === l.bk_number;
            return (
              <ListItemButton
                key={l.bk_number}
                selected={ativa}
                onClick={() => {
                  setRegBk(l.bk_number);
                  setLojaPickerAberto(false);
                }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <StorefrontOutlinedIcon
                    sx={{ fontSize: 20, color: ativa ? ORANGE : 'text.disabled' }}
                  />
                </ListItemIcon>
                <ListItemText
                  primary={l.nome}
                  secondary={l.bk_number ? `BK ${l.bk_number}` : undefined}
                  slotProps={{
                    primary: { sx: { fontWeight: ativa ? 700 : 600, fontSize: '0.9rem' } },
                    secondary: { sx: { fontSize: '0.72rem' } },
                  }}
                />
              </ListItemButton>
            );
          })}
        </List>
      </Dialog>

      <Dialog
        open={!!excluirItem}
        onClose={() => {
          if (!excluindo) setExcluirItem(null);
        }}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem', color: NAVY, pb: 0.5 }}>
          Excluir turno?
        </DialogTitle>
        <DialogContent>
          {excluirItem ? (
            <div className="ck-freela__horario-form">
              <p className="ck-freela__horario-nome">{excluirItem.full_name}</p>
              <p className="ck-freela__meta">
                {fmtData(excluirItem.work_date)} · {fmtHora(excluirItem.check_in_time)} →{' '}
                {fmtHora(excluirItem.check_out_time)}
              </p>
              <p className="ck-freela__meta" style={{ marginTop: 10 }}>
                Esta ação remove o ponto. Não dá para desfazer. Sessões já quitadas na folha não
                podem ser excluídas.
              </p>
            </div>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button
            onClick={() => setExcluirItem(null)}
            disabled={excluindo}
            sx={{ fontWeight: 700 }}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => void confirmarExcluir()}
            disabled={excluindo}
            sx={{ fontWeight: 800 }}
          >
            {excluindo ? 'Excluindo…' : 'Excluir'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!dialogo} onClose={fecharDialogo} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem', color: NAVY, pb: 0.5 }}>
          {dialogo?.modo === 'saida' ? 'Lançar saída' : 'Ajustar horário'}
        </DialogTitle>
        <DialogContent>
          {dialogo ? (
            <div className="ck-freela__horario-form">
              <p className="ck-freela__horario-nome">{dialogo.item.full_name}</p>
              <p className="ck-freela__meta">
                {fmtData(dialogo.item.work_date)} · {dialogo.item.store_name}
              </p>

              {dialogo.modo === 'ajustar' ? (
                <fieldset className="ck-freela__dh-block">
                  <legend>Entrada</legend>
                  <div className="ck-freela__dh-row">
                    <div className="ck-freela__date-field">
                      <CampoDataFrota
                        label="Data"
                        value={draftEntrada.data}
                        onChange={(data) => setDraftEntrada((p) => ({ ...p, data }))}
                        sx={campoDataMobileSx}
                      />
                    </div>
                    <label className="ck-freela__date">
                      <span>Hora</span>
                      <input
                        type="time"
                        value={draftEntrada.hora}
                        onChange={(e) =>
                          setDraftEntrada((p) => ({ ...p, hora: e.target.value }))
                        }
                      />
                    </label>
                  </div>
                </fieldset>
              ) : (
                <p className="ck-freela__meta" style={{ marginTop: 10 }}>
                  Entrada: {fmtData(dialogo.item.work_date)} · {fmtHora(dialogo.item.check_in_time)}
                </p>
              )}

              {dialogo.modo === 'saida' || dialogo.item.check_out_time ? (
                <fieldset className="ck-freela__dh-block">
                  <legend>Saída</legend>
                  <div className="ck-freela__dh-row">
                    <div className="ck-freela__date-field">
                      <CampoDataFrota
                        label="Data"
                        value={draftSaida.data}
                        onChange={(data) => setDraftSaida((p) => ({ ...p, data }))}
                        sx={campoDataMobileSx}
                      />
                    </div>
                    <label className="ck-freela__date">
                      <span>Hora</span>
                      <input
                        type="time"
                        value={draftSaida.hora}
                        onChange={(e) => setDraftSaida((p) => ({ ...p, hora: e.target.value }))}
                      />
                    </label>
                  </div>
                </fieldset>
              ) : (
                <p className="ck-freela__meta" style={{ marginTop: 8 }}>
                  Sem saída ainda — use «Lançar saída» para fechar o turno.
                </p>
              )}
            </div>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button onClick={fecharDialogo} disabled={salvandoHorario} sx={{ fontWeight: 700 }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={() => void salvarHorario()}
            disabled={salvandoHorario}
            sx={{ fontWeight: 800, bgcolor: ORANGE, '&:hover': { bgcolor: '#d04809' } }}
          >
            {salvandoHorario ? 'Salvando…' : 'Salvar'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
