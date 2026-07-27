import { useCallback, useEffect, useMemo, useState } from 'react';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import FilterListIcon from '@mui/icons-material/FilterList';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { assetUrl } from '../../config/paths';
import {
  api,
  fmtData,
  type FreelancerTurnoAprovacao,
} from '../../api/client';
import { showToast } from '../../utils/toast';
import { usePageTitle } from '../../hooks/usePageTitle';
import '../../components/visitas/visitas-mobile.css';
import '../../components/freelancers/freelancers-mobile.css';

type StatusFiltro = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL';

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

/** Segunda–domingo da semana anterior (calendário BR). */
function semanaPassadaYmd() {
  const hoje = new Date();
  hoje.setHours(12, 0, 0, 0);
  const diaSemana = (hoje.getDay() + 6) % 7; // seg=0 … dom=6
  const inicioEstaSemana = new Date(hoje);
  inicioEstaSemana.setDate(hoje.getDate() - diaSemana);
  const inicio = new Date(inicioEstaSemana);
  inicio.setDate(inicioEstaSemana.getDate() - 7);
  const fim = new Date(inicioEstaSemana);
  fim.setDate(inicioEstaSemana.getDate() - 1);
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
  const inicial = useMemo(() => semanaPassadaYmd(), []);
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
  const [aviso, setAviso] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [err, setErr] = useState('');

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
      setAviso(res.aviso || '');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao carregar');
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
    // Sempre busca de novo (mesmo se as datas não mudaram)
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

  return (
    <div className="ck-visitas ck-freela">
      <div className="ck-visitas__scroll">
        <div className="ck-visitas__stage">
          <div className="ck-visitas__glow ck-visitas__glow--a" aria-hidden />
          <div className="ck-visitas__glow ck-visitas__glow--b" aria-hidden />
          <div className="ck-visitas__mesh" aria-hidden />

          <div className="ck-visitas__stage-inner">
            <div className="ck-visitas__hero-row ck-visitas__anim ck-visitas__anim--1">
              <div>
                <p className="ck-visitas__mark-text">Grupo Alvim</p>
                <h1 className="ck-visitas__title">
                  Free
                  <br />
                  lancers
                </h1>
              </div>
              <img
                src={assetUrl('Logo_Icon-clear.png')}
                alt=""
                className="ck-visitas__mark-icon"
                width={56}
                height={56}
              />
            </div>

            <p className="ck-visitas__sub ck-visitas__anim ck-visitas__anim--2">
              Conferência da semana — pendentes, aprovados e recusados. Ajuste o período se precisar.
            </p>

            <div className="ck-visitas__metrics ck-visitas__anim ck-visitas__anim--3" aria-live="polite">
              <div className="ck-visitas__metric ck-visitas__metric--accent">
                <strong>{loading ? '—' : filtrados.length}</strong>
                <span>
                  {status === 'PENDING'
                    ? 'pendentes'
                    : status === 'APPROVED'
                      ? 'aprovados'
                      : status === 'REJECTED'
                        ? 'recusados'
                        : 'turnos'}
                </span>
              </div>
              <div className="ck-visitas__metric">
                <strong>{loading ? '—' : lojas.length}</strong>
                <span>lojas</span>
              </div>
              <div className="ck-visitas__metric">
                <strong>{loading ? '—' : totalHoras > 0 ? totalHoras.toFixed(0) : '—'}</strong>
                <span>horas</span>
              </div>
            </div>
          </div>
        </div>

        <div className="ck-visitas__sheet ck-visitas__anim ck-visitas__anim--4">
          <div className="ck-freela__dates">
            <label className="ck-freela__date">
              <span>De</span>
              <input
                type="date"
                value={draftFrom}
                onChange={(e) => {
                  const v = e.target.value;
                  if (ymdValido(v) || v === '') setDraftFrom(v);
                }}
              />
            </label>
            <label className="ck-freela__date">
              <span>Até</span>
              <input
                type="date"
                value={draftTo}
                onChange={(e) => {
                  const v = e.target.value;
                  if (ymdValido(v) || v === '') setDraftTo(v);
                }}
              />
            </label>
            <button
              type="button"
              className={`ck-freela__buscar${datasPendentes ? ' is-on' : ''}`}
              onClick={aplicarPeriodo}
            >
              Buscar
            </button>
          </div>

          <div className="ck-freela__filtro-row">
            <div className="ck-visitas__seg" role="tablist">
              {STATUS_TABS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={status === id}
                  className={`ck-visitas__seg-btn${status === id ? ' is-on' : ''}`}
                  onClick={() => setStatus(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            {lojas.length > 0 && (
              <button
                type="button"
                className={`ck-freela__filtro-btn${bkFiltro ? ' is-on' : ''}`}
                aria-label="Filtrar unidade"
                onClick={() => setFiltroLojaAberto(true)}
              >
                <FilterListIcon sx={{ fontSize: 20 }} />
              </button>
            )}
          </div>

          {!loading && (
            <p className="ck-freela__loja-tag">
              Período: {fmtData(dateFrom)} → {fmtData(dateTo)}
              {lojas.length > 0
                ? ` · ${lojas.length} loja(s) · ${porLoja.length} com turno`
                : ''}
            </p>
          )}
          {lojaAtiva && (
            <p className="ck-freela__loja-tag">Exibindo: {lojaAtiva.nome}</p>
          )}

          {err && (
            <p style={{ color: '#b91c1c', fontWeight: 600, fontSize: '0.85rem', margin: '0 0 12px' }}>
              {err}
            </p>
          )}

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
              <CircularProgress size={28} sx={{ color: NAVY }} />
            </div>
          ) : aviso && !filtrados.length ? (
            <div className="ck-freela__empty">
              <strong>Sem turnos</strong>
              {aviso}
            </div>
          ) : !filtrados.length ? (
            <div className="ck-freela__empty">
              <strong>Nenhum turno neste filtro</strong>
              Ajuste o período, o status ou a unidade.
            </div>
          ) : (
            porLoja.map(([chave, lista]) => {
              const [bk, nomeLoja] = chave.split('::');
              const aberto = !!abertos[chave];
              const pendentes = lista.filter(
                (i) => String(i.regional_approval_status || '').toUpperCase() === 'PENDING',
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
                            <strong>{item.full_name}</strong>
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
                          {pendente && (
                            <div className="ck-freela__acoes">
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
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              );
            })
          )}
        </div>
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
    </div>
  );
}
