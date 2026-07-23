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
  { id: 'PENDING', label: 'Pendentes' },
  { id: 'APPROVED', label: 'Aprovados' },
  { id: 'REJECTED', label: 'Recusados' },
  { id: 'ALL', label: 'Todos' },
];

function hojeYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function diasAtrasYmd(dias: number) {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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

function statusTone(status: string): 'pending' | 'approved' | 'rejected' | '' {
  const s = String(status || '').toUpperCase();
  if (s === 'PENDING') return 'pending';
  if (s === 'APPROVED') return 'approved';
  if (s === 'REJECTED') return 'rejected';
  return '';
}

function statusLabel(item: FreelancerTurnoAprovacao) {
  if (item.regional_approval_label) return item.regional_approval_label;
  const s = String(item.regional_approval_status || '').toUpperCase();
  if (s === 'PENDING') return 'Aguardando';
  if (s === 'APPROVED') return 'Aprovado';
  if (s === 'REJECTED') return 'Recusado';
  return s || '—';
}

export default function FreelancersAprovacaoMobilePage() {
  usePageTitle('Aprovar freelancers');
  const [dateFrom, setDateFrom] = useState(() => diasAtrasYmd(7));
  const [dateTo, setDateTo] = useState(() => hojeYmd());
  const [status, setStatus] = useState<StatusFiltro>('PENDING');
  const [bkFiltro, setBkFiltro] = useState('');
  const [filtroLojaAberto, setFiltroLojaAberto] = useState(false);
  const [items, setItems] = useState<FreelancerTurnoAprovacao[]>([]);
  const [lojas, setLojas] = useState<Array<{ id_loja: number; nome: string; bk_number: string }>>([]);
  const [aviso, setAviso] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [err, setErr] = useState('');

  const carregar = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const res = await api.freelancersAprovacao({
        date_from: dateFrom,
        date_to: dateTo,
        status,
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
  }, [dateFrom, dateTo, status]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const filtrados = useMemo(() => {
    if (!bkFiltro) return items;
    return items.filter((i) => String(i.bk_number) === bkFiltro);
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

  async function aprovar(id: number) {
    setBusyId(id);
    try {
      await api.freelancersAprovar(id);
      showToast('Turno aprovado — passa a contar na folha', 'success');
      await carregar();
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
      await carregar();
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
              Confira e aprove os turnos da região — o que passar conta na folha.
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
                <strong>{loading ? '—' : porLoja.length}</strong>
                <span>unidades</span>
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
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </label>
            <label className="ck-freela__date">
              <span>Até</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </label>
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
              return (
                <div key={chave} className="ck-freela__grupo">
                  <div className="ck-freela__grupo-head">
                    <div>
                      <strong>{nomeLoja}</strong>
                      {bk ? <small>BK {bk}</small> : null}
                    </div>
                    <span className="ck-freela__count">{lista.length}</span>
                  </div>
                  {lista.map((item) => {
                    const pendente = String(item.regional_approval_status || '').toUpperCase() === 'PENDING';
                    const ocupado = busyId === item.checkin_id;
                    const tone = statusTone(item.regional_approval_status);
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
              slotProps={{
                primary: { sx: { fontWeight: bkFiltro === '' ? 700 : 600, fontSize: '0.9rem' } },
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
