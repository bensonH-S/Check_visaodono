import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import FilterListIcon from '@mui/icons-material/FilterList';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import SaveIcon from '@mui/icons-material/Save';
import SendIcon from '@mui/icons-material/Send';
import {
  api,
  type EscalaGestoresGrade,
  type EscalaManutencaoGrade,
  type EscalaVisitasAtribuicao,
  type EscalaVisitasDia,
  type EscalaVisitasGrade,
  type EscalaVisitasLinha,
  type EscalaVisitasNotificacao,
} from '../../api/client';
import {
  getUsuario,
  podeEditarEscalaDelivery,
  podeEditarEscalaRegiao,
  podeGerenciarEscalaVisitas,
  podeVerEscalaVisitas,
} from '../../lib/auth';
import { showToast } from '../../utils/toast';
import { useAppTheme } from '../../context/ThemeContext';
import CkMarkLogoMenu from '../CkMarkLogoMenu';
import {
  DIAS_ABREV,
  DIAS_LONGO,
  addDaysIso,
  diaIndexNaSemana,
  fmtDataCurta,
  fmtEnvioQuando,
  montarCardsAprovacaoEscala,
  primeiroNome,
  segundaFeiraAtual,
} from './escalaVisitasUtils';
import {
  atribuicoesDoDia,
  diaTemRegional,
  idsLojasDestinoDoDia,
  idsRegionaisDoDia,
  linhaDeliveryDaGrade,
} from './escalaVisitasModel';
import '../visitas/visitas-mobile.css';
import './escala-mobile.css';

const ORANGE = '#E8520A';
const NAVY = '#1B2A6B';

function formatarHoraDigitada(raw: string): string {
  const digitos = raw.replace(/\D/g, '').slice(0, 4);
  if (digitos.length <= 2) return digitos;
  return `${digitos.slice(0, 2)}:${digitos.slice(2)}`;
}

type ModoVisualizacao = 'minhas' | 'dia' | 'lojas' | 'delivery' | 'gestores' | 'manutencao' | 'montar';
type PendingMap = Map<
  string,
  | { id_loja: number; dia: number; id_regionais: number[] }
  | { id_loja: number; dia: number; id_lojas_destino: number[] }
>;

function chaveCelula(idLoja: number, dia: number) {
  return `${idLoja}-${dia}`;
}

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

function FaixaSemanaLoja({
  dias,
  ehDelivery = false,
  idsPorDia,
  mapNome,
  mapCor,
  editavel = false,
  onCelula,
}: {
  dias: EscalaVisitasDia[];
  ehDelivery?: boolean;
  idsPorDia?: number[][];
  mapNome?: Map<number, string>;
  mapCor?: Map<number, string>;
  editavel?: boolean;
  onCelula?: (dia: number) => void;
}) {
  return (
    <div className="ck-escala__faixa">
      {dias.map((d, i) => {
        const idsOverride = idsPorDia?.[i];
        const attrs: EscalaVisitasAtribuicao[] =
          idsOverride != null
            ? idsOverride.map((id) => ({
                id_regional: id,
                nome_regional: mapNome?.get(id) ?? String(id),
                cor: mapCor?.get(id) ?? null,
              }))
            : atribuicoesDoDia(d);
        const temVisita = attrs.length > 0;
        const cor = ehDelivery ? 'var(--ck-accent, #E8520A)' : attrs[0]?.cor || 'rgba(27,42,107,0.2)';
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
        const pillClass = `ck-escala__faixa-pill${temVisita ? ' is-on' : ''}${editavel ? ' is-edit' : ''}`;
        const pillStyle = temVisita ? { background: `${cor}20`, borderColor: cor } : undefined;
        const pillText = temVisita ? rotulo : editavel ? '+' : '—';
        return (
          <div key={d.dia} className="ck-escala__faixa-cell">
            <span>{DIAS_ABREV[i]}</span>
            {editavel ? (
              <button
                type="button"
                title={titulo}
                className={pillClass}
                style={pillStyle}
                onClick={() => onCelula?.(d.dia)}
              >
                {pillText}
              </button>
            ) : (
              <div title={titulo} className={pillClass} style={pillStyle}>
                {pillText}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CardLojaSemana({
  linha,
  idsPorDia,
  mapNome,
  mapCor,
  editavel = false,
  onCelula,
}: {
  linha: EscalaVisitasLinha;
  idsPorDia?: number[][];
  mapNome?: Map<number, string>;
  mapCor?: Map<number, string>;
  editavel?: boolean;
  onCelula?: (idLoja: number, dia: number) => void;
}) {
  const ehDelivery = linha.tipo === 'delivery';
  return (
    <div className={`ck-escala__loja-semana${ehDelivery ? ' is-delivery' : ''}${editavel ? ' is-edit' : ''}`}>
      <strong>
        {ehDelivery ? linha.nome : `${linha.bk_number ? `${linha.bk_number} · ` : ''}${linha.nome}`}
      </strong>
      <FaixaSemanaLoja
        dias={linha.dias}
        ehDelivery={ehDelivery}
        idsPorDia={idsPorDia}
        mapNome={mapNome}
        mapCor={mapCor}
        editavel={editavel && !ehDelivery}
        onCelula={onCelula ? (dia) => onCelula(linha.id_loja, dia) : undefined}
      />
    </div>
  );
}

export default function EscalaVisitasMobileView() {
  const { mode } = useAppTheme();
  const escuro = mode === 'dark';
  const acento = escuro ? ORANGE : NAVY;
  const user = getUsuario();
  const idEu = user?.id_usuario;
  const podeVer = podeVerEscalaVisitas(user);
  const ehDiretor = podeGerenciarEscalaVisitas(user);
  const ehRegional = !ehDiretor && podeEditarEscalaRegiao(user);
  const ehDeliveryOnly = !ehDiretor && !ehRegional && podeEditarEscalaDelivery(user);

  const [semanaInicio, setSemanaInicio] = useState(segundaFeiraAtual());
  const [idRegiao, setIdRegiao] = useState<number | ''>('');
  const [idUsuarioFiltro, setIdUsuarioFiltro] = useState<number | null>(null);
  const [idEnvio, setIdEnvio] = useState<number | null>(null);
  const [modo, setModo] = useState<ModoVisualizacao>(
    ehDeliveryOnly ? 'minhas' : ehRegional ? 'minhas' : ehDiretor ? 'dia' : 'minhas',
  );
  const [diaSelecionado, setDiaSelecionado] = useState(() => diaIndexNaSemana(segundaFeiraAtual()) ?? 0);
  const [grade, setGrade] = useState<EscalaVisitasGrade | null>(null);
  const [gestores, setGestores] = useState<EscalaGestoresGrade | null>(null);
  const [manutencao, setManutencao] = useState<EscalaManutencaoGrade | null>(null);
  const [idTecnicoManut, setIdTecnicoManut] = useState<number | null>(null);
  const [pendingManut, setPendingManut] = useState<Map<string, { id_usuario: number; dia: number; id_lojas: number[] }>>(
    new Map(),
  );
  const [horariosManutLocal, setHorariosManutLocal] = useState<
    Map<number, { hora_inicio: string; hora_fim: string }>
  >(() => new Map());
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [pending, setPending] = useState<PendingMap>(new Map());
  const [filtroRegiaoAberto, setFiltroRegiaoAberto] = useState(false);
  const [editor, setEditor] = useState<{ id_loja: number; dia: number; ids: number[] } | null>(null);
  const [notifs, setNotifs] = useState<EscalaVisitasNotificacao[]>([]);

  const podeEditarGrade = Boolean(grade?.pode_editar || grade?.pode_editar_regiao);
  const podeEditarDelivery = Boolean(grade?.pode_editar_delivery);
  const cardsAprovacao = useMemo(
    () => montarCardsAprovacaoEscala(grade?.status_por_regiao ?? [], grade?.regionais ?? [], idUsuarioFiltro),
    [grade?.status_por_regiao, grade?.regionais, idUsuarioFiltro],
  );
  const pendentesAprovacao = useMemo(() => {
    const regioes = cardsAprovacao.filter((c) => c.status === 'pendente_aprovacao');
    const deliveryPendente = grade?.status_delivery?.status === 'pendente_aprovacao';
    return { regioes, deliveryPendente, length: regioes.length + (deliveryPendente ? 1 : 0) };
  }, [cardsAprovacao, grade?.status_delivery]);
  const modos = useMemo(() => {
    if (ehDeliveryOnly) {
      return [
        { id: 'minhas' as const, label: 'Minhas' },
        { id: 'montar' as const, label: 'Montar' },
      ];
    }
    // Regional: Minhas (só o próprio nome) + Montar (quando tem permissão de região).
    if (ehRegional) {
      return [
        { id: 'minhas' as const, label: 'Minhas' },
        { id: 'gestores' as const, label: 'Gestores' },
        { id: 'manutencao' as const, label: 'Manutenção' },
        { id: 'montar' as const, label: 'Montar' },
      ];
    }
    const base: Array<{ id: ModoVisualizacao; label: string }> = [
      { id: 'minhas', label: 'Minhas' },
      { id: 'dia', label: 'Por dia' },
      { id: 'lojas', label: 'Por loja' },
      { id: 'delivery', label: 'Delivery' },
      { id: 'gestores', label: 'Gestores' },
      { id: 'manutencao', label: 'Manutenção' },
    ];
    if (ehDiretor || grade?.pode_editar_regiao || grade?.pode_editar) {
      base.unshift({ id: 'montar', label: 'Montar' });
    }
    return base;
  }, [ehRegional, ehDiretor, ehDeliveryOnly, grade?.pode_editar_regiao, grade?.pode_editar]);

  const carregar = useCallback(async () => {
    if (!podeVer) return;
    setLoading(true);
    try {
      const q = new URLSearchParams({ semana_inicio: semanaInicio });
      // Regional não filtra por região — senão some a escala pessoal (ex.: Igor sem frota).
      if (!ehRegional && idRegiao !== '') q.set('id_regiao', String(idRegiao));
      const verCopia = modo !== 'montar' && modo !== 'delivery';
      if (verCopia && idEnvio) q.set('id_envio', String(idEnvio));
      else if (verCopia && idUsuarioFiltro != null) q.set('id_usuario_envio', String(idUsuarioFiltro));
      const data = await api.escalaVisitasSemana(q.toString());
      setGrade(data);
      setPending(new Map());
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao carregar escala', 'error');
    } finally {
      setLoading(false);
    }
  }, [podeVer, semanaInicio, idRegiao, idEnvio, idUsuarioFiltro, ehRegional, modo]);

  const carregarGestores = useCallback(async () => {
    if (!podeVer || ehDeliveryOnly) return;
    try {
      const data = await api.escalaGestoresSemana(semanaInicio);
      setGestores(data);
    } catch {
      /* silencioso no mobile se a aba ainda não existir no backend antigo */
    }
  }, [podeVer, ehDeliveryOnly, semanaInicio]);

  const carregarManutencao = useCallback(async () => {
    if (!podeVer || ehDeliveryOnly) return;
    try {
      const data = await api.escalaManutencaoSemana(semanaInicio);
      setManutencao(data);
    } catch {
      /* silencioso no mobile se a aba ainda não existir no backend antigo */
    }
  }, [podeVer, ehDeliveryOnly, semanaInicio]);

  const carregarNotifs = useCallback(async () => {
    if (!podeVer) return;
    try {
      const lista = await api.escalaVisitasNotificacoes(true);
      setNotifs(lista);
    } catch {
      /* silencioso */
    }
  }, [podeVer]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    void carregarGestores();
  }, [carregarGestores]);

  useEffect(() => {
    void carregarManutencao();
  }, [carregarManutencao]);

  useEffect(() => {
    const ids = (manutencao?.tecnicos ?? []).map((t) => t.id_usuario);
    if (!ids.length) {
      setIdTecnicoManut(null);
      return;
    }
    setIdTecnicoManut((atual) => (atual != null && ids.includes(atual) ? atual : ids[0]));
    setPendingManut(new Map());
    setHorariosManutLocal(new Map());
  }, [manutencao?.tecnicos, semanaInicio]);

  useEffect(() => {
    void carregarNotifs();
  }, [carregarNotifs, grade?.id_semana, grade?.status_por_regiao]);

  useEffect(() => {
    const hoje = diaIndexNaSemana(semanaInicio);
    setDiaSelecionado(hoje ?? 0);
  }, [semanaInicio]);

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
  }, [grade]);

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
  }, [grade]);

  function valorCelulaRegional(idLoja: number, dia: number, original: EscalaVisitasDia) {
    const p = pending.get(chaveCelula(idLoja, dia));
    if (p && 'id_regionais' in p) return p.id_regionais;
    return idsRegionaisDoDia(original);
  }

  function valorCelulaDelivery(idLoja: number, dia: number, original: EscalaVisitasDia) {
    const p = pending.get(chaveCelula(idLoja, dia));
    if (p && 'id_lojas_destino' in p) return p.id_lojas_destino;
    return idsLojasDestinoDoDia(original);
  }

  function toggleDeliveryLoja(dia: number, idLojaDestino: number) {
    if (!podeEditarDelivery || !linhaDelivery) return;
    const atual = valorCelulaDelivery(linhaDelivery.id_loja, dia, linhaDelivery.dias[dia]);
    const next = atual.includes(idLojaDestino)
      ? atual.filter((id) => id !== idLojaDestino)
      : [...atual, idLojaDestino];
    setPending((prev) => {
      const m = new Map(prev);
      m.set(chaveCelula(linhaDelivery.id_loja, dia), {
        id_loja: linhaDelivery.id_loja,
        dia,
        id_lojas_destino: next,
      });
      return m;
    });
  }

  function idsLojasManut(idUsuario: number, dia: number) {
    const p = pendingManut.get(`${idUsuario}-${dia}`);
    if (p) return p.id_lojas;
    return (manutencao?.visitas ?? [])
      .filter((v) => v.id_usuario === idUsuario && v.dia === dia)
      .map((v) => v.id_loja);
  }

  function toggleManutLoja(dia: number, idLoja: number) {
    if (!manutencao?.pode_editar || idTecnicoManut == null) return;
    const atual = idsLojasManut(idTecnicoManut, dia);
    const next = atual.includes(idLoja) ? atual.filter((id) => id !== idLoja) : [...atual, idLoja];
    setPendingManut((prev) => {
      const m = new Map(prev);
      m.set(`${idTecnicoManut}-${dia}`, { id_usuario: idTecnicoManut, dia, id_lojas: next });
      return m;
    });
  }

  function horarioManutTecnico(idUsuario: number) {
    const local = horariosManutLocal.get(idUsuario);
    if (local) return local;
    const h = (manutencao?.horarios ?? []).find(
      (x) => x.id_usuario === idUsuario && (x.hora_inicio || x.hora_fim),
    );
    return { hora_inicio: h?.hora_inicio || '', hora_fim: h?.hora_fim || '' };
  }

  function alterarHorarioManut(campo: 'hora_inicio' | 'hora_fim', valor: string) {
    if (idTecnicoManut == null || !manutencao?.pode_editar) return;
    setHorariosManutLocal((prev) => {
      const fromPrev = prev.get(idTecnicoManut);
      const fromServer = (manutencao?.horarios ?? []).find(
        (x) => x.id_usuario === idTecnicoManut && (x.hora_inicio || x.hora_fim),
      );
      const atual = fromPrev || {
        hora_inicio: fromServer?.hora_inicio || '',
        hora_fim: fromServer?.hora_fim || '',
      };
      const next = new Map(prev);
      next.set(idTecnicoManut, { ...atual, [campo]: valor });
      return next;
    });
  }

  function alterarHorarioGestorLocal(
    idGestor: number,
    campo: 'hora_inicio' | 'hora_fim',
    valor: string,
  ) {
    setGestores((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        linhas: prev.linhas.map((linha) =>
          linha.id_gestor !== idGestor
            ? linha
            : {
                ...linha,
                dias: linha.dias.map((d) => ({ ...d, [campo]: valor || null })),
              },
        ),
      };
    });
  }

  async function salvarHorarioGestor(idGestor: number, horaInicio: string, horaFim: string) {
    if (!gestores?.pode_editar) return;
    setSalvando(true);
    try {
      const data = await api.escalaGestoresSalvar({
        semana_inicio: semanaInicio,
        celulas: Array.from({ length: 7 }, (_, dia) => ({
          id_gestor: idGestor,
          dia,
          hora_inicio: horaInicio || null,
          hora_fim: horaFim || null,
        })),
      });
      setGestores(data);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao salvar horário', 'error');
    } finally {
      setSalvando(false);
    }
  }

  function marcarCelula(idLoja: number, dia: number) {
    if (!podeEditarGrade) return;
    const linha = grade?.linhas.find((l) => l.id_loja === idLoja);
    if (!linha || linha.tipo === 'delivery') return;
    const atual = valorCelulaRegional(idLoja, dia, linha.dias[dia]);

    // Regional: o card não mostra nome — toque liga/desliga a visita do dia.
    if (ehRegional) {
      if (!idEu) return;
      const meuId = Number(idEu);
      const idsPaleta = new Set((grade?.regionais ?? []).map((r) => Number(r.id_usuario)));
      const paleta = atual.filter((id) => idsPaleta.has(Number(id)));
      const estou = paleta.some((id) => Number(id) === meuId);
      const outros = paleta.filter((id) => Number(id) !== meuId);
      setPending((prev) => {
        const next = new Map(prev);
        next.set(chaveCelula(idLoja, dia), {
          id_loja: idLoja,
          dia,
          id_regionais: estou ? outros : [...outros, meuId],
        });
        return next;
      });
      return;
    }

    setEditor({
      id_loja: idLoja,
      dia,
      ids: [...atual],
    });
  }

  function toggleMontarLoja(dia: number, idLoja: number) {
    marcarCelula(idLoja, dia);
  }

  function confirmarEditor() {
    if (!editor) return;
    setPending((prev) => {
      const next = new Map(prev);
      next.set(chaveCelula(editor.id_loja, editor.dia), {
        id_loja: editor.id_loja,
        dia: editor.dia,
        id_regionais: editor.ids,
      });
      return next;
    });
    setEditor(null);
  }

  async function salvar() {
    if (!pending.size) {
      showToast('Nada para salvar', 'info');
      return;
    }
    setSalvando(true);
    try {
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

  async function salvarManutencaoAgenda() {
    if (!pendingManut.size && !horariosManutLocal.size) {
      showToast('Nada para salvar', 'info');
      return;
    }
    setSalvando(true);
    try {
      const data = await api.escalaManutencaoSalvar({
        semana_inicio: semanaInicio,
        celulas: [...pendingManut.values()],
        horarios: [...horariosManutLocal.entries()].flatMap(([idUsuario, v]) =>
          Array.from({ length: 7 }, (_, dia) => ({
            id_usuario: idUsuario,
            dia,
            hora_inicio: v.hora_inicio || null,
            hora_fim: v.hora_fim || null,
          })),
        ),
      });
      setManutencao(data);
      setPendingManut(new Map());
      setHorariosManutLocal(new Map());
      showToast('Escala de manutenção salva', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao salvar', 'error');
    } finally {
      setSalvando(false);
    }
  }

  async function enviarAprovacao() {
    const id =
      idRegiao !== ''
        ? Number(idRegiao)
        : grade?.regioes.length === 1
          ? grade.regioes[0].id_regiao
          : null;
    setSalvando(true);
    try {
      if (pending.size) {
        await api.escalaVisitasSalvar({
          semana_inicio: semanaInicio,
          id_regiao: idRegiao === '' ? null : idRegiao,
          celulas: [...pending.values()],
        });
        setPending(new Map());
      }
      const data = await api.escalaVisitasSubmeter({
        semana_inicio: semanaInicio,
        ...(id ? { id_regiao: id } : {}),
      });
      setGrade(data);
      showToast('Escala enviada para aprovação', 'success');
      void carregarNotifs();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao enviar', 'error');
    } finally {
      setSalvando(false);
    }
  }

  function visualizarEscalaPessoa(idUsuario: number) {
    setIdRegiao('');
    setIdUsuarioFiltro(Number(idUsuario));
    setIdEnvio(null);
    setModo('dia');
  }

  async function aprovarRegioes(ids: number[]) {
    if (!ids.length) return;
    setSalvando(true);
    try {
      let data = grade;
      for (const id of ids) {
        data = await api.escalaVisitasAprovar({ semana_inicio: semanaInicio, id_regiao: id });
      }
      if (data) setGrade(data);
      showToast('Escala aprovada', 'success');
      void carregarNotifs();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao aprovar', 'error');
    } finally {
      setSalvando(false);
    }
  }

  async function recusarRegioes(ids: number[]) {
    if (!ids.length) return;
    setSalvando(true);
    try {
      let data = grade;
      for (const id of ids) {
        data = await api.escalaVisitasDevolver({ semana_inicio: semanaInicio, id_regiao: id });
      }
      if (data) setGrade(data);
      showToast('Escala recusada — regional pode montar de novo', 'success');
      void carregarNotifs();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao recusar', 'error');
    } finally {
      setSalvando(false);
    }
  }

  async function enviarDeliveryAprovacao() {
    setSalvando(true);
    try {
      if (pending.size) {
        await api.escalaVisitasSalvar({
          semana_inicio: semanaInicio,
          id_regiao: idRegiao === '' ? null : idRegiao,
          celulas: [...pending.values()],
        });
        setPending(new Map());
      }
      const data = await api.escalaVisitasDeliverySubmeter({ semana_inicio: semanaInicio });
      setGrade(data);
      showToast('Delivery enviado para aprovação', 'success');
      void carregarNotifs();
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
      void carregarNotifs();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao aprovar', 'error');
    } finally {
      setSalvando(false);
    }
  }

  async function recusarDelivery() {
    setSalvando(true);
    try {
      const data = await api.escalaVisitasDeliveryDevolver({ semana_inicio: semanaInicio });
      setGrade(data);
      showToast('Delivery recusado — pode montar de novo', 'success');
      void carregarNotifs();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao recusar', 'error');
    } finally {
      setSalvando(false);
    }
  }

  async function dispensarNotifs() {
    try {
      await api.escalaVisitasNotificacoesLidas();
      setNotifs([]);
    } catch {
      /* ignore */
    }
  }

  function voltarVisaoGeral() {
    setIdRegiao('');
    setIdUsuarioFiltro(null);
    setIdEnvio(null);
  }

  function visualizarEscalaRegiao(id: number, idUsuario?: number | null, idEnvioArg?: number | null) {
    setIdRegiao(id);
    setIdUsuarioFiltro(idUsuario != null ? Number(idUsuario) : null);
    setIdEnvio(idEnvioArg != null ? Number(idEnvioArg) : null);
    setModo('dia');
  }

  function alternarFiltroPessoa(idUsuario: number) {
    if (idUsuarioFiltro === idUsuario) {
      setIdUsuarioFiltro(null);
      setIdEnvio(null);
      return;
    }
    setIdUsuarioFiltro(idUsuario);
    setIdRegiao('');
    setIdEnvio(null);
  }

  const statusAtivo = ehDeliveryOnly
    ? grade?.status_delivery?.status || null
    : grade?.status_regiao ||
      (idRegiao !== ''
        ? grade?.status_por_regiao?.find((s) => s.id_regiao === idRegiao)?.status
        : grade?.status_por_regiao?.[0]?.status) ||
      null;

  const linhaDelivery = useMemo(() => linhaDeliveryDaGrade(grade?.linhas), [grade?.linhas]);

  const deliveryPorDia = useMemo(() => {
    if (!grade || !linhaDelivery) return [];
    return DIAS_LONGO.map((label, dia) => {
      const idsMarcados = valorCelulaDelivery(linhaDelivery.id_loja, dia, linhaDelivery.dias[dia]);
      const lojas = grade.lojas_destino ?? [];
      return {
        dia,
        label,
        data: fmtDataCurta(addDaysIso(grade.semana_inicio, dia)),
        lojas: lojas
          .map((loja) => ({
            ...loja,
            marcada: idsMarcados.includes(loja.id_loja),
          }))
          .sort((a, b) => Number(b.marcada) - Number(a.marcada)),
        totalMarcadas: idsMarcados.length,
      };
    });
  }, [grade, linhaDelivery, pending]);

  const manutPorDia = useMemo(() => {
    if (!manutencao || idTecnicoManut == null) return [];
    return DIAS_LONGO.map((label, dia) => {
      const idsMarcados = idsLojasManut(idTecnicoManut, dia);
      return {
        dia,
        label,
        data: fmtDataCurta(addDaysIso(manutencao.semana_inicio, dia)),
        lojas: (manutencao.lojas ?? []).map((loja) => ({
          ...loja,
          marcada: idsMarcados.includes(loja.id_loja),
        })),
        totalMarcadas: idsMarcados.length,
      };
    });
  }, [manutencao, idTecnicoManut, pendingManut]);

  /** Montar regional no padrão delivery: dia → lista de lojas. */
  const montarPorDia = useMemo(() => {
    if (!grade) return [];
    const idsPaleta = new Set((grade.regionais ?? []).map((r) => Number(r.id_usuario)));
    const linhas = grade.linhas.filter((l) => l.tipo !== 'delivery');
    return DIAS_LONGO.map((label, dia) => {
      const lojas = linhas.map((linha) => {
        const ids = valorCelulaRegional(linha.id_loja, dia, linha.dias[dia]).filter((id) =>
          idsPaleta.has(Number(id)),
        );
        return {
          id_loja: linha.id_loja,
          nome: linha.nome,
          bk_number: linha.bk_number,
          id_regiao: linha.id_regiao,
          marcada: idEu ? ids.some((id) => Number(id) === Number(idEu)) : ids.length > 0,
          temVisita: idEu ? ids.some((id) => Number(id) === Number(idEu)) : ids.length > 0,
        };
      });
      return {
        dia,
        label,
        data: fmtDataCurta(addDaysIso(grade.semana_inicio, dia)),
        lojas,
        totalMarcadas: lojas.filter((l) => l.temVisita).length,
      };
    });
  }, [grade, pending, idEu]);

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
        const filtrados = idUsuarioFiltro
          ? attrs.filter((a) => Number(a.id_regional) === Number(idUsuarioFiltro))
          : attrs;
        if (!filtrados.length) continue;
        itens.push({
          id_loja: linha.id_loja,
          nome: linha.nome,
          bk: linha.bk_number,
          regionais: filtrados.map((a) => ({
            nome: a.nome_regional ?? mapNomeRegional.get(a.id_regional!) ?? '—',
            cor: a.cor ?? undefined,
          })),
          cor: filtrados[0]?.cor ?? undefined,
        });
      }
      return {
        dia,
        label,
        data: fmtDataCurta(addDaysIso(grade.semana_inicio, dia)),
        itens,
      };
    });
  }, [grade, mapNomeRegional, idUsuarioFiltro]);

  const minhasVisitas = useMemo(() => {
    if (ehDeliveryOnly && linhaDelivery && grade) {
      return DIAS_LONGO.map((label, dia) => {
        const destinos = atribuicoesDoDia(linhaDelivery.dias[dia] || { dia, atribuicoes: [] }).filter(
          (a) => a.id_loja_destino != null,
        );
        return {
          dia,
          label,
          data: fmtDataCurta(addDaysIso(grade.semana_inicio, dia)),
          itens: destinos.map((a) => ({
            id_loja: Number(a.id_loja_destino),
            nome: a.nome_loja_destino || 'Loja',
            bk: a.bk_loja_destino,
            regionais: [] as Array<{ nome: string; cor?: string | null }>,
            cor: acento,
          })),
        };
      }).filter((d) => d.itens.length > 0);
    }
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
  }, [visitasPorDia, idEu, grade, ehDeliveryOnly, linhaDelivery, acento]);

  const totalVisitas = useMemo(() => {
    if (!grade) return 0;
    if (ehDeliveryOnly && linhaDelivery) {
      return linhaDelivery.dias.reduce((n, d) => n + atribuicoesDoDia(d).length, 0);
    }
    let n = 0;
    for (const linha of grade.linhas) {
      for (const d of linha.dias) n += atribuicoesDoDia(d).length;
    }
    return n;
  }, [grade, ehDeliveryOnly, linhaDelivery]);
  const hojeIndex = diaIndexNaSemana(semanaInicio);
  const visitasHojeMinhas = useMemo(() => {
    if (hojeIndex == null || !idEu) return 0;
    return minhasVisitas.find((d) => d.dia === hojeIndex)?.itens.length ?? 0;
  }, [minhasVisitas, hojeIndex, idEu]);

  const diaAtual = visitasPorDia[diaSelecionado];

  if (!podeVer) return null;

  const labelSemanaCurta = grade
    ? `${fmtDataCurta(grade.semana_inicio)} – ${fmtDataCurta(grade.semana_fim)}`
    : '…';

  const temFiltroRegiao = !ehDeliveryOnly && grade != null && grade.regioes.length > 1;
  const regiaoAtiva = grade?.regioes.find((r) => r.id_regiao === idRegiao);
  const nomeFiltroPessoa = idUsuarioFiltro
    ? primeiroNome(
        grade?.regionais.find((r) => Number(r.id_usuario) === Number(idUsuarioFiltro))?.nome ??
          (grade?.status_por_regiao ?? []).find(
            (s) => s.submetido_por != null && Number(s.submetido_por) === Number(idUsuarioFiltro),
          )?.nome_submetido_por ??
          (grade?.envios ?? []).find(
            (e) => e.submetido_por != null && Number(e.submetido_por) === Number(idUsuarioFiltro),
          )?.nome_submetido_por ??
          '',
      ) || null
    : null;
  const filtrandoEscala = idRegiao !== '' || idUsuarioFiltro != null || idEnvio != null;
  const rotuloEnvio = grade?.envio_atual
    ? `Cópia de ${
        grade.envio_atual.nome_submetido_por
          ? primeiroNome(grade.envio_atual.nome_submetido_por)
          : 'envio'
      }${grade.envio_atual.submetido_em ? ` · ${fmtEnvioQuando(grade.envio_atual.submetido_em)}` : ''}`
    : null;
  const modoMontarDelivery = ehDeliveryOnly && modo === 'montar';
  const modoTrabalho = modo === 'montar' || modo === 'delivery';
  const semanaAlvo = segundaFeiraAtual();
  const semanaEhAtual = semanaInicio === semanaAlvo;

  return (
    <div
      className={`ck-visitas ck-escala ck-escala--page${modoTrabalho ? ' ck-escala--compact' : ''}`}
      style={
        {
          ['--ck-accent' as string]: acento,
          ['--ck-accent-soft' as string]: escuro ? 'rgba(232, 82, 10, 0.12)' : 'rgba(27, 42, 107, 0.1)',
          ['--ck-accent-border' as string]: escuro ? 'rgba(232, 82, 10, 0.45)' : 'rgba(27, 42, 107, 0.45)',
          ['--ck-accent-shadow' as string]: escuro ? 'rgba(232, 82, 10, 0.18)' : 'rgba(27, 42, 107, 0.16)',
        } as CSSProperties
      }
    >
      <div className="ck-visitas__stage">
        <div className="ck-visitas__glow ck-visitas__glow--a" aria-hidden />
        <div className="ck-visitas__glow ck-visitas__glow--b" aria-hidden />
        <div className="ck-visitas__mesh" aria-hidden />

        <div className="ck-visitas__stage-inner">
          {modoTrabalho ? (
            <>
              <div className="ck-escala__compact-top">
                <div>
                  <h1 className="ck-escala__compact-title">
                    {ehDeliveryOnly ? 'Escala delivery' : 'Montar escala'}
                  </h1>
                  <p className="ck-escala__compact-sub">
                    {ehDeliveryOnly || modo === 'delivery'
                      ? podeEditarDelivery
                        ? statusAtivo === 'pendente_aprovacao'
                          ? 'Ajuste as lojas e envie de novo para o diretor'
                          : 'Toque nas lojas do dia, salve e envie para o diretor aprovar'
                        : 'Rota de delivery da semana (só leitura)'
                      : ehRegional
                        ? podeEditarGrade
                          ? statusAtivo === 'pendente_aprovacao'
                            ? 'Ajuste as lojas e envie de novo para o diretor'
                            : 'Escolha o dia, toque nas lojas e envie para aprovação'
                          : 'Escala em só leitura — use Minhas para ver sua rota'
                        : 'Toque nos dias e envie para aprovação'}
                  </p>
                </div>
                <CkMarkLogoMenu size={44} className="ck-visitas__mark-icon" />
              </div>
              <div className="ck-escala__week ck-escala__week--compact">
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
                    onClick={() => setSemanaInicio(semanaAlvo)}
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
            </>
          ) : (
            <>
              <div className="ck-visitas__hero-row ck-visitas__anim ck-visitas__anim--1">
                <div>
                  <p className="ck-visitas__mark-text">Grupo Alvim</p>
                  <h1 className="ck-visitas__title ck-visitas__title--oneline">
                    {ehDeliveryOnly ? 'Escala delivery' : 'Escala visitas'}
                  </h1>
                </div>
                <CkMarkLogoMenu size={72} className="ck-visitas__mark-icon" />
              </div>

              <p className="ck-visitas__sub ck-visitas__anim ck-visitas__anim--2">
                {ehDiretor
                  ? pendentesAprovacao.length
                    ? 'Há escalas aguardando sua aprovação.'
                    : 'Veja a escala consolidada da semana.'
                  : ehDeliveryOnly
                    ? 'Sua rota de delivery da semana.'
                    : ehRegional
                    ? 'Suas visitas da semana — só o que está marcado no seu nome.'
                    : 'Veja suas visitas da semana, por dia, por loja ou delivery.'}
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
                  <strong>
                    {loading
                      ? '—'
                      : ehDeliveryOnly
                        ? minhasVisitas.reduce((n, d) => n + d.itens.length, 0)
                        : grade?.linhas.filter((l) => l.tipo !== 'delivery').length ?? 0}
                  </strong>
                  <span>{ehDeliveryOnly ? 'na rota' : 'lojas'}</span>
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
                    onClick={() => setSemanaInicio(semanaAlvo)}
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
            </>
          )}
        </div>
      </div>

      <div className="ck-visitas__sheet ck-escala__sheet--fill ck-visitas__anim ck-visitas__anim--4">
          {notifs.length > 0 && (
            <div className="ck-escala__alertas">
              {notifs.slice(0, 3).map((n) => (
                <div
                  key={n.id_notificacao}
                  className={`ck-escala__alerta ck-escala__alerta--${n.tipo}`}
                >
                  <strong>
                    {n.tipo === 'aprovado'
                      ? 'Aprovada'
                      : n.tipo === 'recusado'
                        ? 'Recusada'
                        : 'Para aprovar'}
                  </strong>
                  <p>{n.mensagem}</p>
                </div>
              ))}
              <button type="button" className="ck-escala__alerta-ok" onClick={() => void dispensarNotifs()}>
                Ok, entendi
              </button>
            </div>
          )}

          {modos.length > 1 && (
          <div className="ck-escala__filtro-row">
            <div className="ck-visitas__seg" role="tablist">
              {modos.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={modo === id}
                  className={`ck-visitas__seg-btn${modo === id ? ' is-on' : ''}`}
                  onClick={() => {
                    setModo(id);
                    if (id === 'montar' || id === 'delivery') {
                      setIdEnvio(null);
                      setIdUsuarioFiltro(null);
                    }
                    setSemanaInicio(segundaFeiraAtual());
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            {temFiltroRegiao && !ehRegional && modo !== 'gestores' && modo !== 'manutencao' && (
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
          )}

          <div className="ck-escala__sticky">
            {(filtrandoEscala || regiaoAtiva) && ehDiretor && (
              <div className="ck-escala__voltar-row">
                {filtrandoEscala && (
                  <button type="button" className="ck-escala__voltar" onClick={voltarVisaoGeral}>
                    ← Voltar
                  </button>
                )}
                <p className="ck-escala__regiao">
                  {nomeFiltroPessoa ? `Escala de ${nomeFiltroPessoa}` : 'Exibindo'}
                  {regiaoAtiva ? ` · ${regiaoAtiva.nome}` : ''}
                  {rotuloEnvio && grade?.somente_leitura ? ` · ${rotuloEnvio}` : ''}
                </p>
              </div>
            )}
            {ehDiretor && modo === 'dia' && (grade?.regionais ?? []).length > 0 && (
              <div className="ck-escala__pessoas">
                {(grade?.regionais ?? []).map((r) => (
                  <button
                    key={r.id_usuario}
                    type="button"
                    className={`ck-escala__pessoa${idUsuarioFiltro === r.id_usuario ? ' is-on' : ''}`}
                    style={{ borderColor: r.cor ?? '#94a3b8', background: `${r.cor ?? '#94a3b8'}22` }}
                    onClick={() => alternarFiltroPessoa(r.id_usuario)}
                  >
                    {primeiroNome(r.nome)}
                  </button>
                ))}
              </div>
            )}
            {modo === 'manutencao' && (manutencao?.tecnicos.length ?? 0) > 0 && (
              <div className="ck-escala__pessoas">
                {(manutencao?.tecnicos ?? []).map((t) => (
                  <button
                    key={t.id_usuario}
                    type="button"
                    className={`ck-escala__pessoa${idTecnicoManut === t.id_usuario ? ' is-on' : ''}`}
                    onClick={() => setIdTecnicoManut(t.id_usuario)}
                  >
                    {primeiroNome(t.nome)}
                  </button>
                ))}
              </div>
            )}
            {(modo === 'delivery' ||
              modo === 'manutencao' ||
              (modo === 'montar' && ehRegional) ||
              modoMontarDelivery) &&
              !loading && (
              <div className="ck-escala__dias">
                {((modo === 'delivery' || modoMontarDelivery)
                  ? deliveryPorDia
                  : modo === 'manutencao'
                    ? manutPorDia
                    : montarPorDia
                ).map((d) => {
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
          {/* Diretor: só cards de pendência (aprovar/recusar). Sem chip "aprovado". */}
          {ehDiretor && !loading && pendentesAprovacao.length > 0 && (
            <div className="ck-escala__aprovacoes">
              <p className="ck-escala__section">Para aprovar</p>
              {pendentesAprovacao.regioes.map((card) => (
                  <div
                    key={card.key}
                    className="ck-escala__aprovacao-card ck-escala__aprovacao-card--pendente_aprovacao"
                  >
                    <button
                      type="button"
                      className="ck-escala__aprovacao-info"
                      onClick={() =>
                        card.tipo === 'pessoa' && card.id_usuario
                          ? visualizarEscalaPessoa(card.id_usuario)
                          : visualizarEscalaRegiao(card.id_regiao!, null, card.id_envio)
                      }
                    >
                      <strong>
                        {card.titulo}
                        <em>Pendente</em>
                      </strong>
                      <span>
                        {card.tipo === 'pessoa'
                          ? 'Todas as lojas · aguardando aprovação'
                          : card.montadaPor
                            ? `Montada por ${card.montadaPor}`
                            : 'Aguardando envio'}
                      </span>
                      <span className="ck-escala__aprovacao-ver">Toque para ver a escala →</span>
                    </button>
                    <div className="ck-escala__aprovacao-acoes">
                      <button
                        type="button"
                        className="ck-escala__btn-aprovar"
                        disabled={salvando || card.ids_regiao_aprovar.length === 0}
                        onClick={() => void aprovarRegioes(card.ids_regiao_aprovar)}
                      >
                        Aprovar
                      </button>
                      <button
                        type="button"
                        className="ck-escala__btn-recusar"
                        disabled={salvando}
                        onClick={() =>
                          void recusarRegioes(card.ids_regiao_aprovar.length ? card.ids_regiao_aprovar : card.ids_regiao)
                        }
                      >
                        Recusar
                      </button>
                    </div>
                  </div>
                ))}
              {grade?.status_delivery?.status === 'pendente_aprovacao' && (
                <div className="ck-escala__aprovacao-card ck-escala__aprovacao-card--pendente_aprovacao">
                  <button
                    type="button"
                    className="ck-escala__aprovacao-info"
                    onClick={() => setModo('delivery')}
                  >
                    <strong>
                      Delivery
                      <em>Pendente</em>
                    </strong>
                    <span>
                      {grade.status_delivery.nome_submetido_por
                        ? `Montada por ${primeiroNome(grade.status_delivery.nome_submetido_por)}`
                        : 'Aguardando envio'}
                    </span>
                    <span className="ck-escala__aprovacao-ver">Toque para ver o delivery →</span>
                  </button>
                  <div className="ck-escala__aprovacao-acoes">
                    <button
                      type="button"
                      className="ck-escala__btn-aprovar"
                      disabled={salvando}
                      onClick={() => void aprovarDelivery()}
                    >
                      Aprovar
                    </button>
                    <button
                      type="button"
                      className="ck-escala__btn-recusar"
                      disabled={salvando}
                      onClick={() => void recusarDelivery()}
                    >
                      Recusar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
              <CircularProgress size={28} sx={{ color: NAVY }} />
            </div>
          ) : modo === 'montar' && !ehDeliveryOnly ? (
            ehRegional ? (
              <>
                {!podeEditarGrade && (
                  <div className="ck-escala__empty" style={{ marginBottom: 12 }}>
                    <strong>
                      {statusAtivo === 'aprovado' ? 'Escala aprovada' : 'Escala bloqueada'}
                    </strong>
                    <p>
                      {statusAtivo === 'aprovado'
                        ? 'Só leitura. Use Minhas para ver o cronograma. Peça devolução ao diretor para editar.'
                        : 'Sem permissão para montar nesta região.'}
                    </p>
                  </div>
                )}
                {podeEditarGrade && statusAtivo === 'pendente_aprovacao' && (
                  <div className="ck-escala__empty" style={{ marginBottom: 12 }}>
                    <strong>Enviada para aprovação</strong>
                    <p>O diretor já recebeu. Toque nas lojas para ajustar a sua escala e envie de novo se precisar.</p>
                  </div>
                )}
                {(montarPorDia.find((d) => d.dia === diaSelecionado)?.lojas ?? []).length === 0 ? (
                  <div className="ck-escala__empty">
                    <p>Nenhuma loja nesta região.</p>
                  </div>
                ) : (
                  (montarPorDia.find((d) => d.dia === diaSelecionado)?.lojas ?? [])
                    .filter((loja) => podeEditarGrade || loja.temVisita)
                    .map((loja) => (
                      <button
                        key={loja.id_loja}
                        type="button"
                        className={`ck-escala__card${loja.temVisita ? ' is-delivery-on' : ''}${
                          podeEditarGrade ? ' is-edit' : ''
                        }`}
                        disabled={!podeEditarGrade || salvando}
                        onClick={() => toggleMontarLoja(diaSelecionado, loja.id_loja)}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          cursor: podeEditarGrade ? 'pointer' : 'default',
                        }}
                      >
                        <div
                          className="ck-escala__card-stripe"
                          style={{
                            background: loja.temVisita ? acento : 'rgba(27,42,107,0.2)',
                          }}
                          aria-hidden
                        />
                        <div className="ck-escala__card-body">
                          <p className="ck-escala__card-title">
                            {loja.bk_number ? `${loja.bk_number} · ` : ''}
                            {loja.nome}
                          </p>
                          <p className={`ck-escala__card-meta${loja.temVisita ? ' is-on' : ' is-off'}`}>
                            {loja.temVisita
                              ? podeEditarGrade
                                ? 'Visita · toque para remover'
                                : 'Visita agendada'
                              : 'Toque para agendar'}
                          </p>
                        </div>
                      </button>
                    ))
                )}
                {!podeEditarGrade &&
                  (montarPorDia.find((d) => d.dia === diaSelecionado)?.lojas ?? []).every(
                    (l) => !l.temVisita,
                  ) && (
                    <div className="ck-escala__empty">
                      <p>Nenhuma visita neste dia nesta região.</p>
                    </div>
                  )}
              </>
            ) : (grade?.linhas.filter((l) => l.tipo !== 'delivery').length ?? 0) === 0 ? (
              <div className="ck-escala__empty">
                <p>Nenhuma loja nesta região.</p>
              </div>
            ) : (
              grade?.linhas
                .filter((linha) => linha.tipo !== 'delivery')
                .map((linha) => (
                  <CardLojaSemana
                    key={linha.id_loja}
                    linha={linha}
                    editavel
                    mapNome={mapNomeRegional}
                    mapCor={mapCorRegional}
                    idsPorDia={linha.dias.map((d) => valorCelulaRegional(linha.id_loja, d.dia, d))}
                    onCelula={marcarCelula}
                  />
                ))
            )
          ) : modo === 'gestores' ? (
            !gestores?.linhas.length ? (
              <div className="ck-escala__empty">
                <strong>Sem escala de gestores</strong>
                <p>Ainda não há folgas lançadas nesta semana.</p>
              </div>
            ) : (
              gestores.linhas.map((linha, idx) => {
                const mostraGrupo = idx === 0 || linha.grupo !== gestores.linhas[idx - 1].grupo;
                return (
                  <div key={linha.id_gestor}>
                    {mostraGrupo && (
                      <p className="ck-escala__section">
                        {linha.grupo === 'campo' ? 'Time de campo' : 'Gestores'}
                      </p>
                    )}
                    <div className="ck-escala__card" style={{ marginBottom: 8 }}>
                      <div className="ck-escala__card-body">
                        <p className="ck-escala__card-title">
                          {linha.bk_number ? `${linha.bk_number} · ` : ''}
                          {linha.nome}
                        </p>
                        <p className="ck-escala__card-meta">
                          {linha.nome_loja || linha.folga_padrao || ''}
                        </p>
                        <div className="ck-escala__turno" style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                          {linha.dias.map((d) => {
                            const label = d.tipo === 'folga' ? 'F' : d.tipo === 'ferias' ? 'Fe' : d.tipo === 'falta' ? 'X' : d.tipo === 'ausencia' ? 'A' : '·';
                            return (
                              <button
                                key={d.dia}
                                type="button"
                                disabled={!gestores.pode_editar || salvando}
                                onClick={() => {
                                  if (!gestores.pode_editar) return;
                                  const ordem = [null, 'folga', 'ferias'] as const;
                                  const i = ordem.findIndex((t) => t === d.tipo);
                                  const proximo = ordem[(i + 1) % ordem.length];
                                  setSalvando(true);
                                  void api
                                    .escalaGestoresSalvar({
                                      semana_inicio: semanaInicio,
                                      celulas: [{ id_gestor: linha.id_gestor, dia: d.dia, tipo: proximo }],
                                    })
                                    .then(setGestores)
                                    .catch((e) =>
                                      showToast(e instanceof Error ? e.message : 'Erro ao salvar', 'error'),
                                    )
                                    .finally(() => setSalvando(false));
                                }}
                                style={{
                                  border: 'none',
                                  borderRadius: 8,
                                  padding: '6px 0',
                                  fontSize: 11,
                                  fontWeight: 800,
                                  background:
                                    d.tipo === 'folga'
                                      ? 'rgba(234,88,12,0.18)'
                                      : d.tipo === 'ferias'
                                        ? 'rgba(37,99,235,0.16)'
                                        : 'rgba(27,42,107,0.06)',
                                  color:
                                    d.tipo === 'folga' ? '#C2410C' : d.tipo === 'ferias' ? '#1D4ED8' : '#64748B',
                                }}
                              >
                                <span style={{ display: 'block', fontSize: 9, opacity: 0.7 }}>{DIAS_ABREV[d.dia]}</span>
                                {label}
                              </button>
                            );
                          })}
                        </div>
                        {(() => {
                          const hr = linha.dias.find((d) => d.hora_inicio || d.hora_fim);
                          const inicio = hr?.hora_inicio || '';
                          const fim = hr?.hora_fim || '';
                          const estiloHora = {
                            flex: 1,
                            border: '1px solid rgba(27,42,107,0.16)',
                            borderRadius: 8,
                            padding: '6px 8px',
                            fontWeight: 700,
                            fontSize: 13,
                          } as const;
                          const persistirHora = (el: HTMLInputElement) => {
                            const inputs = el.parentElement?.querySelectorAll('input[data-hora]');
                            const a = (inputs?.[0] as HTMLInputElement | undefined)?.value || '';
                            const b = (inputs?.[1] as HTMLInputElement | undefined)?.value || '';
                            void salvarHorarioGestor(linha.id_gestor, a, b);
                          };
                          return (
                            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 11, fontWeight: 800, color: '#64748B' }}>Horário</span>
                              <input
                                type="text"
                                inputMode="numeric"
                                autoComplete="off"
                                maxLength={5}
                                placeholder="08:00"
                                data-hora="inicio"
                                aria-label={`Início ${linha.nome}`}
                                value={inicio}
                                disabled={!gestores.pode_editar || salvando}
                                onChange={(e) =>
                                  alterarHorarioGestorLocal(
                                    linha.id_gestor,
                                    'hora_inicio',
                                    formatarHoraDigitada(e.target.value),
                                  )
                                }
                                onBlur={(e) => persistirHora(e.currentTarget)}
                                style={estiloHora}
                              />
                              <span style={{ fontSize: 11, color: '#94A3B8' }}>até</span>
                              <input
                                type="text"
                                inputMode="numeric"
                                autoComplete="off"
                                maxLength={5}
                                placeholder="18:00"
                                data-hora="fim"
                                aria-label={`Fim ${linha.nome}`}
                                value={fim}
                                disabled={!gestores.pode_editar || salvando}
                                onChange={(e) =>
                                  alterarHorarioGestorLocal(
                                    linha.id_gestor,
                                    'hora_fim',
                                    formatarHoraDigitada(e.target.value),
                                  )
                                }
                                onBlur={(e) => persistirHora(e.currentTarget)}
                                style={estiloHora}
                              />
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                );
              })
            )
          ) : modo === 'manutencao' ? (
            (() => {
              const diaManut = manutPorDia.find((d) => d.dia === diaSelecionado);
              const lojasDia = manutencao?.pode_editar
                ? (diaManut?.lojas ?? [])
                : (diaManut?.lojas ?? []).filter((l) => l.marcada);
              const hr =
                idTecnicoManut != null
                  ? horarioManutTecnico(idTecnicoManut)
                  : { hora_inicio: '', hora_fim: '' };
              const horario = (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#64748B' }}>Horário</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={5}
                    placeholder="08:00"
                    aria-label="Início do expediente"
                    value={hr.hora_inicio}
                    disabled={!manutencao?.pode_editar || idTecnicoManut == null}
                    onChange={(e) => alterarHorarioManut('hora_inicio', formatarHoraDigitada(e.target.value))}
                    style={{
                      flex: 1,
                      border: '1px solid rgba(27,42,107,0.16)',
                      borderRadius: 10,
                      padding: '8px 10px',
                      fontWeight: 700,
                      fontSize: 14,
                    }}
                  />
                  <span style={{ fontSize: 12, color: '#94A3B8' }}>até</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={5}
                    placeholder="18:00"
                    aria-label="Fim do expediente"
                    value={hr.hora_fim}
                    disabled={!manutencao?.pode_editar || idTecnicoManut == null}
                    onChange={(e) => alterarHorarioManut('hora_fim', formatarHoraDigitada(e.target.value))}
                    style={{
                      flex: 1,
                      border: '1px solid rgba(27,42,107,0.16)',
                      borderRadius: 10,
                      padding: '8px 10px',
                      fontWeight: 700,
                      fontSize: 14,
                    }}
                  />
                </div>
              );
              if (!lojasDia.length) {
                return (
                  <>
                    {horario}
                    <div className="ck-escala__empty">
                    <strong>{manutencao?.pode_editar ? 'Nenhuma loja' : 'Sem visita neste dia'}</strong>
                    <p>
                      {manutencao?.tecnicos.length
                        ? 'Toque nas lojas do dia e salve a rota do técnico.'
                        : 'Nenhum técnico cadastrado.'}
                    </p>
                  </div>
                  </>
                );
              }
              return (
                <>
                  {horario}
                  {lojasDia.map((loja) => (
                <button
                  key={loja.id_loja}
                  type="button"
                  className={`ck-escala__card${loja.marcada ? ' is-delivery-on' : ''}${
                    manutencao?.pode_editar ? ' is-edit' : ''
                  }`}
                  disabled={!manutencao?.pode_editar || salvando}
                  onClick={() => toggleManutLoja(diaSelecionado, loja.id_loja)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    cursor: manutencao?.pode_editar ? 'pointer' : 'default',
                  }}
                >
                  <div
                    className="ck-escala__card-stripe"
                    style={{ background: loja.marcada ? acento : 'rgba(27,42,107,0.2)' }}
                    aria-hidden
                  />
                  <div className="ck-escala__card-body">
                    <p className="ck-escala__card-title">
                      {loja.bk_number ? `${loja.bk_number} · ` : ''}
                      {loja.nome}
                    </p>
                    <p className={`ck-escala__card-meta${loja.marcada ? ' is-on' : ' is-off'}`}>
                      {loja.marcada
                        ? manutencao?.pode_editar
                          ? 'Agendado · toque para remover'
                          : 'Agendado'
                        : 'Toque para agendar'}
                    </p>
                  </div>
                </button>
                  ))}
                </>
              );
            })()
          ) : modo === 'minhas' ? (
            minhasVisitas.length === 0 ? (
              <div className="ck-escala__empty">
                <strong>Nenhuma visita sua</strong>
                <p>
                  {ehDiretor
                    ? 'Use “Por dia” ou “Por loja” para ver o planejamento do time.'
                    : ehDeliveryOnly
                      ? 'Nenhuma loja na sua rota nesta semana. Use Montar para agendar.'
                      : ehRegional
                      ? 'Não há lojas marcadas no seu nome nesta semana.'
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
          ) : modo === 'delivery' || modoMontarDelivery ? (
            (() => {
              const diaDelivery = deliveryPorDia.find((d) => d.dia === diaSelecionado);
              const lojasDia = podeEditarDelivery
                ? (diaDelivery?.lojas ?? [])
                : (diaDelivery?.lojas ?? []).filter((l) => l.marcada);
              if (!lojasDia.length) {
                return (
                  <div className="ck-escala__empty">
                    <strong>{podeEditarDelivery ? 'Nenhuma loja' : 'Sem delivery neste dia'}</strong>
                    <p>
                      {podeEditarDelivery
                        ? 'Não há lojas para agendar.'
                        : diaDelivery
                          ? `${diaDelivery.label} · ${diaDelivery.data} — folga ou sem rota.`
                          : 'Nenhuma rota nesta semana.'}
                    </p>
                  </div>
                );
              }
              return lojasDia.map((loja) => (
                <button
                  key={loja.id_loja}
                  type="button"
                  className={`ck-escala__card${loja.marcada ? ' is-delivery-on' : ''}${
                    podeEditarDelivery ? ' is-edit' : ''
                  }`}
                  disabled={!podeEditarDelivery || salvando}
                  onClick={() => toggleDeliveryLoja(diaSelecionado, loja.id_loja)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    cursor: podeEditarDelivery ? 'pointer' : 'default',
                  }}
                >
                  <div
                    className="ck-escala__card-stripe"
                    style={{ background: loja.marcada ? acento : 'rgba(27,42,107,0.2)' }}
                    aria-hidden
                  />
                  <div className="ck-escala__card-body">
                    <p className="ck-escala__card-title">
                      {loja.bk_number ? `${loja.bk_number} · ` : ''}
                      {loja.nome}
                    </p>
                    <p className={`ck-escala__card-meta${loja.marcada ? ' is-on' : ' is-off'}`}>
                      {loja.marcada
                        ? podeEditarDelivery
                          ? 'Delivery agendado · toque para remover'
                          : 'Delivery agendado'
                        : 'Toque para agendar'}
                    </p>
                  </div>
                </button>
              ));
            })()
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

          {((podeEditarGrade || grade?.pode_submeter) && modo === 'montar' && !ehDeliveryOnly) ||
          ((podeEditarDelivery || grade?.pode_submeter_delivery) &&
            (modo === 'delivery' || modoMontarDelivery)) ||
          (manutencao?.pode_editar && modo === 'manutencao') ? (
            <div className="ck-escala__acoes">
              {(podeEditarGrade ||
                (podeEditarDelivery && (modo === 'delivery' || modoMontarDelivery))) &&
                modo !== 'manutencao' && (
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<SaveIcon />}
                  disabled={salvando || pending.size === 0}
                  onClick={() => void salvar()}
                  sx={{ flex: 1, bgcolor: NAVY, textTransform: 'none', fontWeight: 700 }}
                >
                  Salvar{pending.size > 0 ? ` (${pending.size})` : ''}
                </Button>
              )}
              {modo === 'manutencao' && manutencao?.pode_editar && (
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<SaveIcon />}
                  disabled={salvando || (pendingManut.size === 0 && horariosManutLocal.size === 0)}
                  onClick={() => void salvarManutencaoAgenda()}
                  sx={{ flex: 1, bgcolor: acento, textTransform: 'none', fontWeight: 700 }}
                >
                  Salvar
                  {pendingManut.size > 0
                    ? ` (${pendingManut.size})`
                    : horariosManutLocal.size > 0
                      ? ' (horário)'
                      : ''}
                </Button>
              )}
              {grade?.pode_submeter && modo === 'montar' && !ehDeliveryOnly && (
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<SendIcon />}
                  disabled={salvando}
                  onClick={() => void enviarAprovacao()}
                  sx={{ flex: 1, bgcolor: acento, textTransform: 'none', fontWeight: 700 }}
                >
                  Enviar
                </Button>
              )}
              {grade?.pode_submeter_delivery && (modo === 'delivery' || modoMontarDelivery) && (
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<SendIcon />}
                  disabled={salvando}
                  onClick={() => void enviarDeliveryAprovacao()}
                  sx={{ flex: 1, bgcolor: acento, textTransform: 'none', fontWeight: 700 }}
                >
                  Enviar
                </Button>
              )}
            </div>
          ) : null}
      </div>

      <Dialog open={Boolean(editor)} onClose={() => setEditor(null)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem', color: NAVY, pb: 0.5 }}>
          Quem visita?
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <p className="ck-escala__editor-meta">
            {editor
              ? `${DIAS_LONGO[editor.dia]} · ${
                  grade?.linhas.find((l) => l.id_loja === editor.id_loja)?.nome ?? 'Loja'
                }`
              : ''}
          </p>
          <List dense sx={{ pt: 0 }}>
            {(grade?.regionais ?? []).map((r) => {
              const marcado = editor?.ids.includes(r.id_usuario) ?? false;
              return (
                <ListItemButton
                  key={r.id_usuario}
                  onClick={() => {
                    setEditor((cur) => {
                      if (!cur) return cur;
                      const ids = marcado
                        ? cur.ids.filter((id) => id !== r.id_usuario)
                        : [...cur.ids, r.id_usuario];
                      return { ...cur, ids };
                    });
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <Checkbox edge="start" checked={marcado} tabIndex={-1} disableRipple sx={{ color: r.cor, '&.Mui-checked': { color: r.cor } }} />
                  </ListItemIcon>
                  <ListItemText
                    primary={primeiroNome(r.nome)}
                    secondary={r.nome}
                    slotProps={{
                      primary: { sx: { fontWeight: 700, fontSize: '0.9rem' } },
                      secondary: { sx: { fontSize: '0.72rem' } },
                    }}
                  />
                </ListItemButton>
              );
            })}
          </List>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button onClick={() => setEditor(null)} sx={{ textTransform: 'none' }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={confirmarEditor}
            sx={{ bgcolor: ORANGE, textTransform: 'none', fontWeight: 700 }}
          >
            Aplicar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={filtroRegiaoAberto} onClose={() => setFiltroRegiaoAberto(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem', color: NAVY, pb: 1 }}>
          Filtrar por região
        </DialogTitle>
        <List sx={{ pt: 0, pb: 1 }}>
          {!ehRegional && (
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
          )}
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
