import { useCallback, useEffect, useMemo, useState } from 'react';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import FilterListIcon from '@mui/icons-material/FilterList';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import { api, type EscalaVisitasDia, type EscalaVisitasGrade, type EscalaVisitasLinha } from '../../api/client';
import { getUsuario, podeGerenciarEscalaVisitas, podeVerEscalaVisitas } from '../../lib/auth';
import { showToast } from '../../utils/toast';
import CkMarkLogoMenu from '../CkMarkLogoMenu';
import {
  DIAS_ABREV,
  DIAS_LONGO,
  addDaysIso,
  diaIndexNaSemana,
  fmtDataCurta,
  primeiroNome,
  segundaFeiraAtual,
} from './escalaVisitasUtils';
import { atribuicoesDoDia, diaTemRegional, idsLojasDestinoDoDia, linhaDeliveryDaGrade } from './escalaVisitasModel';
import '../visitas/visitas-mobile.css';
import './escala-mobile.css';

const ORANGE = '#E8520A';
const NAVY = '#1B2A6B';

type ModoVisualizacao = 'minhas' | 'dia' | 'lojas' | 'delivery';

const MODOS: Array<{ id: ModoVisualizacao; label: string }> = [
  { id: 'minhas', label: 'Minhas' },
  { id: 'dia', label: 'Por dia' },
  { id: 'lojas', label: 'Por loja' },
  { id: 'delivery', label: 'Delivery' },
];

function LojaVisitaCard({
  nome,
  bk,
  regional,
  regionais,
  cor,
  ocultarRegional = false,
}: {
  nome: string;
  bk?: string | null;
  regional?: string | null;
  regionais?: Array<{ nome: string; cor?: string | null }>;
  cor?: string | null;
  ocultarRegional?: boolean;
}) {
  const lista = regionais?.length
    ? regionais
    : regional
      ? [{ nome: regional, cor }]
      : [];
  const accent = lista[0]?.cor || cor || NAVY;
  return (
    <div className="ck-escala__card">
      <div className="ck-escala__card-stripe" style={{ background: accent }} aria-hidden />
      <div className="ck-escala__card-body">
        <p className="ck-escala__card-title">
          {bk ? `${bk} · ` : ''}
          {nome}
        </p>
        {!ocultarRegional && lista.length > 0 && (
          <div className="ck-escala__chips">
            {lista.map((r) => {
              const c = r.cor || accent;
              return (
                <span
                  key={r.nome}
                  className="ck-escala__chip"
                  style={{ background: `${c}14`, color: NAVY, borderColor: `${c}44` }}
                >
                  {primeiroNome(r.nome)}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function FaixaSemanaLoja({ dias, ehDelivery = false }: { dias: EscalaVisitasDia[]; ehDelivery?: boolean }) {
  return (
    <div className="ck-escala__faixa">
      {dias.map((d, i) => {
        const attrs = atribuicoesDoDia(d);
        const temVisita = attrs.length > 0;
        const cor = ehDelivery ? ORANGE : attrs[0]?.cor || 'rgba(27,42,107,0.2)';
        const rotulo = ehDelivery
          ? attrs.length > 1
            ? String(attrs.length)
            : attrs[0]?.bk_loja_destino ||
              (attrs[0]?.nome_loja_destino ? primeiroNome(attrs[0].nome_loja_destino).slice(0, 3) : '—')
          : attrs.length > 1
            ? String(attrs.length)
            : attrs[0]?.nome_regional
              ? primeiroNome(attrs[0].nome_regional).slice(0, 3)
              : '—';
        const titulo = ehDelivery
          ? attrs.map((a) => a.nome_loja_destino).filter(Boolean).join(', ') || 'Sem loja'
          : attrs.map((a) => a.nome_regional).filter(Boolean).join(', ') || 'Sem visita';
        return (
          <div key={d.dia} className="ck-escala__faixa-cell">
            <span>{DIAS_ABREV[i]}</span>
            <div
              title={titulo}
              className={`ck-escala__faixa-pill${temVisita ? ' is-on' : ''}`}
              style={
                temVisita
                  ? { background: `${cor}20`, borderColor: cor }
                  : undefined
              }
            >
              {temVisita ? rotulo : '—'}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CardLojaSemana({ linha }: { linha: EscalaVisitasLinha }) {
  const ehDelivery = linha.tipo === 'delivery';
  return (
    <div className={`ck-escala__loja-semana${ehDelivery ? ' is-delivery' : ''}`}>
      <strong>
        {ehDelivery ? linha.nome : `${linha.bk_number ? `${linha.bk_number} · ` : ''}${linha.nome}`}
      </strong>
      <FaixaSemanaLoja dias={linha.dias} ehDelivery={ehDelivery} />
    </div>
  );
}

export default function EscalaVisitasMobileView() {
  const user = getUsuario();
  const idEu = user?.id_usuario;
  const podeVer = podeVerEscalaVisitas(user);
  const ehDiretor = podeGerenciarEscalaVisitas(user);

  const [semanaInicio, setSemanaInicio] = useState(segundaFeiraAtual());
  const [idRegiao, setIdRegiao] = useState<number | ''>('');
  const [modo, setModo] = useState<ModoVisualizacao>(ehDiretor ? 'dia' : 'minhas');
  const [diaSelecionado, setDiaSelecionado] = useState(() => diaIndexNaSemana(segundaFeiraAtual()) ?? 0);
  const [grade, setGrade] = useState<EscalaVisitasGrade | null>(null);
  const [loading, setLoading] = useState(true);
  const [filtroRegiaoAberto, setFiltroRegiaoAberto] = useState(false);

  const carregar = useCallback(async () => {
    if (!podeVer) return;
    setLoading(true);
    try {
      const q = new URLSearchParams({ semana_inicio: semanaInicio });
      if (idRegiao !== '') q.set('id_regiao', String(idRegiao));
      const data = await api.escalaVisitasSemana(q.toString());
      setGrade(data);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao carregar escala', 'error');
    } finally {
      setLoading(false);
    }
  }, [podeVer, semanaInicio, idRegiao]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    const hoje = diaIndexNaSemana(semanaInicio);
    setDiaSelecionado(hoje ?? 0);
  }, [semanaInicio]);

  const linhaDelivery = useMemo(() => linhaDeliveryDaGrade(grade?.linhas), [grade?.linhas]);

  const deliveryPorDia = useMemo(() => {
    if (!grade || !linhaDelivery) return [];
    return DIAS_LONGO.map((label, dia) => {
      const idsMarcados = idsLojasDestinoDoDia(linhaDelivery.dias[dia]);
      const lojas = grade.lojas_destino ?? [];
      return {
        dia,
        label,
        data: fmtDataCurta(addDaysIso(grade.semana_inicio, dia)),
        lojas: lojas.map((loja) => ({
          ...loja,
          marcada: idsMarcados.includes(loja.id_loja),
        })),
        totalMarcadas: idsMarcados.length,
      };
    });
  }, [grade, linhaDelivery]);

  const mapNome = useMemo(() => {
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
  }, [grade]);

  const visitasPorDia = useMemo(() => {
    if (!grade) return [];
    return DIAS_LONGO.map((label, dia) => {
      const itens: Array<{
        id_loja: number;
        nome: string;
        bk?: string | null;
        regionais: Array<{ nome: string; cor?: string | null }>;
        cor?: string | null;
      }> = [];
      for (const linha of grade.linhas) {
        if (linha.tipo === 'delivery') continue;
        const c = linha.dias[dia];
        const attrs = atribuicoesDoDia(c);
        if (!attrs.length) continue;
        itens.push({
          id_loja: linha.id_loja,
          nome: linha.nome,
          bk: linha.bk_number,
          regionais: attrs.map((a) => ({
            nome: a.nome_regional ?? mapNome.get(a.id_regional!) ?? '—',
            cor: a.cor ?? undefined,
          })),
          cor: attrs[0]?.cor ?? undefined,
        });
      }
      return {
        dia,
        label,
        data: fmtDataCurta(addDaysIso(grade.semana_inicio, dia)),
        itens,
      };
    });
  }, [grade, mapNome]);

  const minhasVisitas = useMemo(() => {
    if (!idEu) return [];
    return visitasPorDia
      .map((d) => ({
        ...d,
        itens: d.itens.filter((i) => {
          const linha = grade?.linhas.find((l) => l.id_loja === i.id_loja);
          const c = linha?.dias[d.dia];
          return c != null && diaTemRegional(c, idEu);
        }),
      }))
      .filter((d) => d.itens.length > 0);
  }, [visitasPorDia, idEu, grade]);

  const totalVisitas = useMemo(() => {
    if (!grade) return 0;
    let n = 0;
    for (const linha of grade.linhas) {
      for (const d of linha.dias) n += atribuicoesDoDia(d).length;
    }
    return n;
  }, [grade]);
  const hojeIndex = diaIndexNaSemana(semanaInicio);
  const visitasHojeMinhas = useMemo(() => {
    if (hojeIndex == null || !idEu) return 0;
    return minhasVisitas.find((d) => d.dia === hojeIndex)?.itens.length ?? 0;
  }, [minhasVisitas, hojeIndex, idEu]);

  const diaAtual = visitasPorDia[diaSelecionado];
  const semanaEhAtual = semanaInicio === segundaFeiraAtual();

  if (!podeVer) return null;

  const labelSemanaCurta = grade
    ? `${fmtDataCurta(grade.semana_inicio)} – ${fmtDataCurta(grade.semana_fim)}`
    : '…';

  const temFiltroRegiao = grade != null && grade.regioes.length > 1;
  const regiaoAtiva = grade?.regioes.find((r) => r.id_regiao === idRegiao);

  return (
    <div className="ck-visitas ck-escala ck-escala--page">
      <div className="ck-visitas__stage">
        <div className="ck-visitas__glow ck-visitas__glow--a" aria-hidden />
        <div className="ck-visitas__glow ck-visitas__glow--b" aria-hidden />
        <div className="ck-visitas__mesh" aria-hidden />

        <div className="ck-visitas__stage-inner">
          <div className="ck-visitas__hero-row ck-visitas__anim ck-visitas__anim--1">
            <div>
              <p className="ck-visitas__mark-text">Grupo Alvim</p>
              <h1 className="ck-visitas__title ck-visitas__title--oneline">Escala visitas</h1>
            </div>
            <CkMarkLogoMenu size={72} className="ck-visitas__mark-icon" />
          </div>

          <p className="ck-visitas__sub ck-visitas__anim ck-visitas__anim--2">
            Veja suas visitas da semana, por dia, por loja ou delivery.
          </p>

          <div className="ck-visitas__metrics ck-visitas__anim ck-visitas__anim--3" aria-live="polite">
            <div className="ck-visitas__metric ck-visitas__metric--accent">
              <strong>{loading ? '—' : visitasHojeMinhas}</strong>
              <span>suas hoje</span>
            </div>
            <div className="ck-visitas__metric">
              <strong>{loading ? '—' : totalVisitas}</strong>
              <span>na semana</span>
            </div>
            <div className="ck-visitas__metric">
              <strong>{loading ? '—' : grade?.linhas.filter((l) => l.tipo !== 'delivery').length ?? 0}</strong>
              <span>lojas</span>
            </div>
          </div>

          <div className="ck-escala__week ck-visitas__anim ck-visitas__anim--3">
            <button
              type="button"
              className="ck-escala__week-btn"
              aria-label="Semana anterior"
              onClick={() => setSemanaInicio(addDaysIso(semanaInicio, -7))}
            >
              ‹
            </button>
            <span className="ck-escala__week-label">{labelSemanaCurta}</span>
            {!semanaEhAtual ? (
              <button
                type="button"
                className="ck-escala__hoje"
                onClick={() => setSemanaInicio(segundaFeiraAtual())}
              >
                Hoje
              </button>
            ) : (
              <span className="ck-escala__hoje-spacer" aria-hidden />
            )}
            <button
              type="button"
              className="ck-escala__week-btn"
              aria-label="Próxima semana"
              onClick={() => setSemanaInicio(addDaysIso(semanaInicio, 7))}
            >
              ›
            </button>
          </div>
        </div>
      </div>

      <div className="ck-visitas__sheet ck-escala__sheet--fill ck-visitas__anim ck-visitas__anim--4">
          <div className="ck-escala__filtro-row">
            <div className="ck-visitas__seg" role="tablist">
              {MODOS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={modo === id}
                  className={`ck-visitas__seg-btn${modo === id ? ' is-on' : ''}`}
                  onClick={() => setModo(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            {temFiltroRegiao && (
              <button
                type="button"
                className={`ck-escala__filtro-btn${idRegiao !== '' ? ' is-on' : ''}`}
                aria-label="Filtrar região"
                onClick={() => setFiltroRegiaoAberto(true)}
              >
                <FilterListIcon sx={{ fontSize: 20 }} />
              </button>
            )}
          </div>

          <div className="ck-escala__sticky">
            {regiaoAtiva && <p className="ck-escala__regiao">Exibindo: {regiaoAtiva.nome}</p>}
            {modo === 'delivery' && !loading && (
              <div className="ck-escala__dias">
                {deliveryPorDia.map((d) => {
                  const selected = d.dia === diaSelecionado;
                  const isToday = hojeIndex === d.dia;
                  return (
                    <button
                      key={d.dia}
                      type="button"
                      className={`ck-escala__dia${selected ? ' is-on' : ''}${isToday ? ' is-today' : ''}`}
                      onClick={() => setDiaSelecionado(d.dia)}
                    >
                      <strong>{DIAS_ABREV[d.dia]}</strong>
                      <small>{d.data}</small>
                      <span className="ck-escala__dia-n">{d.totalMarcadas}</span>
                    </button>
                  );
                })}
              </div>
            )}
            {modo === 'dia' && !loading && (
              <div className="ck-escala__dias">
                {visitasPorDia.map((d) => {
                  const selected = d.dia === diaSelecionado;
                  const isToday = hojeIndex === d.dia;
                  return (
                    <button
                      key={d.dia}
                      type="button"
                      className={`ck-escala__dia${selected ? ' is-on' : ''}${isToday ? ' is-today' : ''}`}
                      onClick={() => setDiaSelecionado(d.dia)}
                    >
                      <strong>{DIAS_ABREV[d.dia]}</strong>
                      <small>{d.data}</small>
                      {d.itens.length > 0 && <span className="ck-escala__dia-n">{d.itens.length}</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="ck-escala__sheet-body">
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
              <CircularProgress size={28} sx={{ color: NAVY }} />
            </div>
          ) : modo === 'minhas' ? (
            minhasVisitas.length === 0 ? (
              <div className="ck-escala__empty">
                <strong>Nenhuma visita sua</strong>
                <p>
                  {ehDiretor
                    ? 'Use “Por dia” ou “Por loja” para ver o planejamento do time.'
                    : 'Nenhuma visita planejada para você nesta semana.'}
                </p>
              </div>
            ) : (
              minhasVisitas.map((d) => (
                <div key={d.dia} style={{ marginBottom: 14 }}>
                  <p className="ck-escala__section">
                    {d.label} · {d.data}
                  </p>
                  {d.itens.map((item) => (
                    <LojaVisitaCard
                      key={`${d.dia}-${item.id_loja}`}
                      nome={item.nome}
                      bk={item.bk}
                      regionais={item.regionais}
                      cor={item.cor}
                      ocultarRegional
                    />
                  ))}
                </div>
              ))
            )
          ) : modo === 'delivery' ? (
            (deliveryPorDia.find((d) => d.dia === diaSelecionado)?.lojas ?? []).map((loja) => (
              <div
                key={loja.id_loja}
                className={`ck-escala__card${loja.marcada ? ' is-delivery-on' : ''}`}
              >
                <div
                  className="ck-escala__card-stripe"
                  style={{ background: loja.marcada ? ORANGE : 'rgba(27,42,107,0.2)' }}
                  aria-hidden
                />
                <div className="ck-escala__card-body">
                  <p className="ck-escala__card-title">
                    {loja.bk_number ? `${loja.bk_number} · ` : ''}
                    {loja.nome}
                  </p>
                  <p className={`ck-escala__card-meta${loja.marcada ? ' is-on' : ' is-off'}`}>
                    {loja.marcada ? 'Delivery agendado' : 'Sem delivery'}
                  </p>
                </div>
              </div>
            ))
          ) : modo === 'dia' ? (
            diaAtual && diaAtual.itens.length === 0 ? (
              <div className="ck-escala__empty">
                <p>
                  Nenhuma visita em {diaAtual.label.toLowerCase()}, {diaAtual.data}.
                </p>
              </div>
            ) : (
              diaAtual?.itens.map((item) => (
                <LojaVisitaCard
                  key={item.id_loja}
                  nome={item.nome}
                  bk={item.bk}
                  regionais={item.regionais}
                  cor={item.cor}
                />
              ))
            )
          ) : grade?.linhas.filter((linha) => linha.tipo !== 'delivery').length === 0 ? (
            <div className="ck-escala__empty">
              <p>Nenhuma loja neste filtro.</p>
            </div>
          ) : (
            grade?.linhas
              .filter((linha) => linha.tipo !== 'delivery')
              .map((linha) => <CardLojaSemana key={linha.id_loja} linha={linha} />)
          )}
          </div>
      </div>

      <Dialog open={filtroRegiaoAberto} onClose={() => setFiltroRegiaoAberto(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem', color: NAVY, pb: 1 }}>
          Filtrar por região
        </DialogTitle>
        <List sx={{ pt: 0, pb: 1 }}>
          <ListItemButton
            selected={idRegiao === ''}
            onClick={() => {
              setIdRegiao('');
              setFiltroRegiaoAberto(false);
            }}
          >
            <ListItemIcon sx={{ minWidth: 36 }}>
              <LocationOnOutlinedIcon sx={{ fontSize: 20, color: idRegiao === '' ? ORANGE : 'text.disabled' }} />
            </ListItemIcon>
            <ListItemText
              primary="Todas as regiões"
              slotProps={{ primary: { sx: { fontWeight: idRegiao === '' ? 700 : 600, fontSize: '0.9rem' } } }}
            />
          </ListItemButton>
          {grade?.regioes.map((r) => {
            const ativa = idRegiao === r.id_regiao;
            return (
              <ListItemButton
                key={r.id_regiao}
                selected={ativa}
                onClick={() => {
                  setIdRegiao(r.id_regiao);
                  setFiltroRegiaoAberto(false);
                }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <LocationOnOutlinedIcon sx={{ fontSize: 20, color: ativa ? ORANGE : 'text.disabled' }} />
                </ListItemIcon>
                <ListItemText
                  primary={r.nome}
                  slotProps={{ primary: { sx: { fontWeight: ativa ? 700 : 600, fontSize: '0.9rem' } } }}
                />
              </ListItemButton>
            );
          })}
        </List>
      </Dialog>
    </div>
  );
}
