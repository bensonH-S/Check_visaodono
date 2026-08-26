import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { checklistPaths } from '../config/mobileRoutes';
import { toAppPath } from '../config/paths';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Alert from '@mui/material/Alert';
import LinearProgress from '@mui/material/LinearProgress';
import Chip from '@mui/material/Chip';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import SaveIcon from '@mui/icons-material/Save';
import CheckIcon from '@mui/icons-material/Check';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { api, fmtData } from '../api/client';
import type { CategoriaChecklist, Loja, Usuario, Pergunta, RespostaInput, TipoChecklist, MetaVisitaTimeCampo, VisitaResumo } from '../api/client';
import ChecklistPerguntaCard, {
  perguntaRespondida,
  type ErroPerguntaCampo,
  type RespostaLocal,
} from '../components/checklist/ChecklistPerguntaCard';
import ChecklistIonicShell from '../components/checklist/ChecklistIonicShell';
import ChecklistStartScreen from '../components/checklist/ChecklistStartScreen';
import ChecklistIonicFluxo from '../components/checklist/ChecklistIonicFluxo';
import VisitaIniciadaScreen from '../components/checklist/VisitaIniciadaScreen';
import TimeCampoMetaForm from '../components/checklist/TimeCampoMetaForm';
import { useChecklistMobileUi } from '../context/ChecklistMobileUiContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { selectMenuScrollProps } from '../utils/selectMenuScroll';
import { showToast } from '../utils/toast';
import { CHECKLIST_REFRESH } from '../utils/checklistEvent';
import {
  getSessaoChecklist,
  salvarSessaoChecklist,
  limparSessaoChecklist,
  indiceSecaoParaRetomar,
  type ChecklistSessaoLocal,
  type FaseChecklist,
} from '../utils/checklistSessao';
import { getUsuario, temPermissao } from '../lib/auth';
import { useChamadosMobileLojaOpcional } from '../context/ChamadosMobileLojaContext';
import { dataHojeBrasilia, normalizarDataVisita, calcularDuracaoVisitaMinutos } from '../utils/dateBr';
import {
  exibeFoto,
  exibeObservacao,
  exigeFoto,
  exigeObservacao,
  serializeFotos,
  deveLimparFotos,
  deveLimparObservacao,
  parseFotos,
  parseMidiaUrls,
  promoverFotosAposSalvar,
} from '../utils/checklistRules';

const BRAND_ORANGE = '#E8520A';
function BannerResumoChecklist({
  titulo,
  totalPerguntas,
  totalSecoes,
  carregando,
}: {
  titulo: string;
  totalPerguntas: number;
  totalSecoes: number;
  carregando?: boolean;
}) {
  return (
    <Paper
      sx={{
        p: { xs: 2, sm: 2.5 },
        mb: 2,
        borderRadius: 2,
        background: 'linear-gradient(135deg, #1B2A6B 0%, #2a3d8f 100%)',
        color: 'white',
      }}
    >
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1, fontSize: { xs: '1.05rem', sm: '1.25rem' } }}>
        {titulo}
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1 }}>
        <Chip
          label={carregando ? 'Carregando…' : `${totalPerguntas} perguntas`}
          size="small"
          sx={{ bgcolor: 'rgba(255,255,255,0.18)', color: 'white', fontWeight: 600, height: 24 }}
        />
        <Chip
          label={carregando ? '…' : `${totalSecoes} seções`}
          size="small"
          sx={{ bgcolor: 'rgba(255,255,255,0.18)', color: 'white', fontWeight: 600, height: 24 }}
        />
      </Box>
      <Typography
        variant="body2"
        sx={{ opacity: 0.92, fontSize: { xs: '0.78rem', sm: '0.875rem' }, lineHeight: 1.45 }}
      >
        Responda uma seção por vez durante a visita na loja.
      </Typography>
    </Paper>
  );
}

function getFotos(r?: RespostaLocal): string[] {
  if (r?.fotos?.length) return r.fotos;
  return parseFotos(r?.foto_url);
}

function tipoErroPergunta(p: Pergunta, r?: RespostaLocal): ErroPerguntaCampo | null {
  if (!p.obrigatoria) return null;
  if (perguntaRespondida(p, r)) return null;
  if (exigeObservacao(p, r?.resposta, r?.observacao)) return 'observacao';
  if (exigeFoto(p, r?.resposta, getFotos(r), r?.nota_estrelas)) return 'foto';
  return 'resposta';
}

function formatarListaCodigos(codigos: string[]): string {
  if (codigos.length === 1) return codigos[0];
  if (codigos.length === 2) return `${codigos[0]} e ${codigos[1]}`;
  return `${codigos.slice(0, -1).join(', ')} e ${codigos[codigos.length - 1]}`;
}

type ResultadoValidacaoSecao = {
  titulo: string;
  detalhe: string;
};

function montarErroValidacaoSecao(
  pendentes: Array<{ p: Pergunta; tipo: ErroPerguntaCampo }>,
): ResultadoValidacaoSecao {
  const porTipo = {
    resposta: pendentes.filter((x) => x.tipo === 'resposta').map((x) => x.p.codigo),
    foto: pendentes.filter((x) => x.tipo === 'foto').map((x) => x.p.codigo),
    observacao: pendentes.filter((x) => x.tipo === 'observacao').map((x) => x.p.codigo),
  };

  const partes: string[] = [];

  if (porTipo.resposta.length) {
    const lista = formatarListaCodigos(porTipo.resposta);
    partes.push(
      porTipo.resposta.length === 1
        ? `A pergunta ${lista} ainda não foi respondida.`
        : `As perguntas ${lista} ainda não foram respondidas.`,
    );
  }

  if (porTipo.foto.length) {
    const lista = formatarListaCodigos(porTipo.foto);
    partes.push(
      porTipo.foto.length === 1
        ? `A pergunta ${lista} foi respondida, mas falta anexar a foto obrigatória.`
        : `As perguntas ${lista} foram respondidas, mas falta anexar foto obrigatória.`,
    );
  }

  if (porTipo.observacao.length) {
    const lista = formatarListaCodigos(porTipo.observacao);
    partes.push(
      porTipo.observacao.length === 1
        ? `A pergunta ${lista} foi respondida com Não, mas falta preencher a observação.`
        : `As perguntas ${lista} foram respondidas com Não, mas falta preencher a observação.`,
    );
  }

  let titulo = 'Perguntas incompletas';
  if (porTipo.foto.length && !porTipo.resposta.length && !porTipo.observacao.length) {
    titulo = 'Foto obrigatória não anexada!';
  } else if (porTipo.observacao.length && !porTipo.resposta.length && !porTipo.foto.length) {
    titulo = 'Observação obrigatória';
  } else if (porTipo.resposta.length && !porTipo.foto.length && !porTipo.observacao.length) {
    titulo = 'Perguntas não respondidas';
  }

  return {
    titulo,
    detalhe: partes.join(' '),
  };
}

function usaEstrelas(p: Pergunta) {
  return p.tipo_resposta === 'estrelas' || p.tipo_resposta === 'estrelas_foto';
}

function usaSimNao(p: Pergunta) {
  return p.tipo_resposta === 'sim_nao' || p.tipo_resposta === 'sim_nao_foto';
}

function toRespostaInput(p: Pergunta, r: RespostaLocal): RespostaInput {
  const fotos = getFotos(r);
  const input: RespostaInput = { id_pergunta: p.id_pergunta };

  if (usaSimNao(p) && r.resposta) input.resposta = r.resposta;
  if (usaEstrelas(p) && r.nota_estrelas != null && r.nota_estrelas >= 1) {
    input.nota_estrelas = r.nota_estrelas;
  }

  if (exibeFoto(p, r.resposta, r.nota_estrelas)) {
    if (fotos.length) {
      input.foto_url = serializeFotos(fotos);
    } else if (r.limpar_foto) {
      input.foto_url = null;
    }
  }
  if (exibeObservacao(p, r.resposta, r.nota_estrelas) && r.observacao) input.observacao = r.observacao;

  return input;
}

function mapRespostasApi(
  rows: Array<{
    id_pergunta: number;
    resposta: string | null;
    nota_estrelas?: number | null;
    observacao?: string | null;
    midia_urls?: string[];
  }>,
): Record<number, RespostaLocal> {
  const map: Record<number, RespostaLocal> = {};
  for (const r of rows) {
    const local: RespostaLocal = {};
    if (r.resposta === 'Sim' || r.resposta === 'Não' || r.resposta === 'N/A') {
      local.resposta = r.resposta;
    }
    if (r.nota_estrelas != null) local.nota_estrelas = Number(r.nota_estrelas);
    if (r.observacao) local.observacao = r.observacao;
    const fotos = parseMidiaUrls(r.midia_urls);
    if (fotos.length) local.fotos = fotos;
    map[r.id_pergunta] = local;
  }
  return map;
}

type Fase = 'setup' | 'iniciada' | 'perguntas';

export default function ChecklistPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const paths = { ...checklistPaths(location.pathname), mobile: false };
  const retomadaIniciada = useRef(false);
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [tiposChecklist, setTiposChecklist] = useState<TipoChecklist[]>([]);
  const [tipoSelecionado, setTipoSelecionado] = useState<TipoChecklist | null>(null);
  const [metaVisita, setMetaVisita] = useState<MetaVisitaTimeCampo>({});
  const [checklist, setChecklist] = useState<CategoriaChecklist[]>([]);
  const [idLoja, setIdLoja] = useState<number | ''>('');
  const [idUsuario, setIdUsuario] = useState<number | ''>('');
  const [visitaId, setVisitaId] = useState<number | null>(null);
  const [dataVisita, setDataVisita] = useState<string | null>(null);
  const [horaInicio, setHoraInicio] = useState<string | null>(null);
  const [respostas, setRespostas] = useState<Record<number, RespostaLocal>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [msgTitulo, setMsgTitulo] = useState('');
  const [fase, setFase] = useState<Fase>('setup');
  const [indiceSecao, setIndiceSecao] = useState(0);
  const [errosPerguntas, setErrosPerguntas] = useState<Record<number, ErroPerguntaCampo>>({});
  const [rascunhos, setRascunhos] = useState<VisitaResumo[]>([]);
  const [sessaoLocal, setSessaoLocal] = useState<ChecklistSessaoLocal | null>(null);
  const [retomando, setRetomando] = useState(false);
  const [carregandoTipo, setCarregandoTipo] = useState(false);
  const lojaMobileCtx = useChamadosMobileLojaOpcional();
  const { setFase: setChecklistFaseUi, registrarVoltar } = useChecklistMobileUi();
  const pathChecklist = toAppPath(location.pathname);
  const prevPathChecklist = useRef('');

  useEffect(() => {
    if (!paths.mobile) {
      setChecklistFaseUi(null);
      return;
    }
    setChecklistFaseUi(fase);
    return () => setChecklistFaseUi(null);
  }, [paths.mobile, fase, setChecklistFaseUi]);

  useEffect(() => {
    if (!paths.mobile) {
      registrarVoltar(null);
      return;
    }
    registrarVoltar(() => {
      if (fase === 'perguntas' && indiceSecao > 0) {
        setIndiceSecao((i) => Math.max(0, i - 1));
        setMsg('');
        setMsgTitulo('');
        return;
      }
      if (fase === 'perguntas') {
        setFase('iniciada');
        setMsg('');
        setMsgTitulo('');
        return;
      }
      setFase('setup');
      setVisitaId(null);
      setIndiceSecao(0);
      setRespostas({});
      setErrosPerguntas({});
      setMsg('');
      setMsgTitulo('');
    });
    return () => registrarVoltar(null);
  }, [paths.mobile, registrarVoltar, fase, indiceSecao]);


  const totalPerguntas = useMemo(
    () => checklist.reduce((n, c) => n + c.perguntas.length, 0),
    [checklist]
  );

  const secaoAtual = checklist[indiceSecao];
  const totalSecoes = checklist.length;

  const tabTitle =
    fase === 'setup'
      ? 'Checklist'
      : fase === 'iniciada'
        ? 'Checklist'
        : secaoAtual
          ? secaoAtual.nome
          : 'Checklist';
  usePageTitle(tabTitle);

  const respondidas = useMemo(() => {
    let n = 0;
    for (const cat of checklist) {
      for (const p of cat.perguntas) {
        if (perguntaRespondida(p, respostas[p.id_pergunta])) n++;
      }
    }
    return n;
  }, [checklist, respostas]);

  const progressoGeral = totalPerguntas
    ? Math.round((respondidas / totalPerguntas) * 100)
    : 0;

  const secaoCompleta = (cat: CategoriaChecklist) =>
    cat.perguntas.every((p) => !p.obrigatoria || perguntaRespondida(p, respostas[p.id_pergunta]));

  const rascunhosOrdenados = useMemo(() => {
    const user = getUsuario();
    const lista = [...rascunhos];
    lista.sort((a, b) => {
      const aLocal = sessaoLocal?.visitaId === a.id_visita;
      const bLocal = sessaoLocal?.visitaId === b.id_visita;
      if (aLocal !== bLocal) return aLocal ? -1 : 1;
      if (user?.id_usuario) {
        const aMine = a.id_usuario === user.id_usuario;
        const bMine = b.id_usuario === user.id_usuario;
        if (aMine !== bMine) return aMine ? -1 : 1;
      }
      return b.id_visita - a.id_visita;
    });
    return lista;
  }, [rascunhos, sessaoLocal?.visitaId]);

  const sessao = getUsuario();

  const lojaSel = useMemo(
    () => lojas.find((l) => l.id_loja === idLoja),
    [lojas, idLoja],
  );

  const lojasMobile = useMemo(() => {
    if (!paths.mobile || !sessao?.lojas?.length) return lojas;
    const ids = new Set(sessao.lojas.map((l) => l.id_loja));
    const filtradas = lojas.filter((l) => ids.has(l.id_loja));
    return filtradas.length ? filtradas : lojas;
  }, [lojas, paths.mobile, sessao?.lojas]);

  const podeIniciarChecklist = Boolean(idLoja && idUsuario && tipoSelecionado);
  const somenteVisualizacao = !temPermissao('checklist.executar', sessao);

  useEffect(() => {
    setErrosPerguntas({});
  }, [indiceSecao]);

  const recarregarChecklist = useCallback(async (codigoTipo?: string) => {
    const codigo = codigoTipo ?? tipoSelecionado?.codigo;
    if (!codigo) return;
    try {
      const c = await api.checklist(codigo);
      setChecklist(c);
      setIndiceSecao((idx) => Math.min(idx, Math.max(0, c.length - 1)));
    } catch {
      /* atualização em segundo plano */
    }
  }, [tipoSelecionado?.codigo]);

  useEffect(() => {
    function onChecklistAtualizado() {
      void recarregarChecklist();
    }
    window.addEventListener(CHECKLIST_REFRESH, onChecklistAtualizado);
    return () => window.removeEventListener(CHECKLIST_REFRESH, onChecklistAtualizado);
  }, [recarregarChecklist]);

  useEffect(() => {
    const reiniciar = (location.state as { reiniciar?: boolean })?.reiniciar;
    if (reiniciar) {
      const user = getUsuario();
      if (user) limparSessaoChecklist(user.id_usuario);
      setSessaoLocal(null);
      setFase('setup');
      setVisitaId(null);
      setDataVisita(null);
      setHoraInicio(null);
      setRespostas({});
      setIndiceSecao(0);
      setMsg('');
      navigate(paths.base, { replace: true, state: {} });
    }
  }, [location.state, navigate, paths.base]);

  useEffect(() => {
    const user = getUsuario();
    if (user) setSessaoLocal(getSessaoChecklist(user.id_usuario));
  }, []);

  useEffect(() => {
    if (loading || fase !== 'setup') return;
    api
      .visitas({ status: 'Rascunho' })
      .then(setRascunhos)
      .catch(() => setRascunhos([]));
  }, [loading, fase]);

  useEffect(() => {
    const user = getUsuario();
    if (!user?.id_usuario || !visitaId || fase === 'setup') return;
    salvarSessaoChecklist(user.id_usuario, { visitaId, indiceSecao, fase });
    setSessaoLocal(getSessaoChecklist(user.id_usuario));
  }, [visitaId, indiceSecao, fase]);

  useEffect(() => {
    const sessao = getUsuario();
    const carregarAuditores = sessao && temPermissao('checklist.executar', sessao);

    Promise.all([
      api.lojas({ ativas: true, operacionais: true }),
      api.checklistTipos(),
      carregarAuditores ? api.auditoresChecklist() : Promise.resolve([] as Usuario[]),
    ])
      .then(async ([l, tipos, auditoresList]) => {
        setLojas(l);
        setUsuarios(auditoresList);
        setTiposChecklist(tipos);
        if (paths.mobile) {
          if (tipos.length === 1) {
            const unico = tipos[0];
            setTipoSelecionado(unico);
            const c = await api.checklist(unico.codigo);
            setChecklist(c);
          } else {
            setTipoSelecionado(null);
            setChecklist([]);
          }
        } else {
          const tipo = tipos[0] ?? null;
          setTipoSelecionado(tipo);
          if (tipo) {
            const c = await api.checklist(tipo.codigo);
            setChecklist(c);
          }
        }
        if (sessao) {
          /* Mobile: auditor = usuário logado (não escolhe outro). */
          setIdUsuario(sessao.id_usuario);
        }
        const idsLojasUsuario = sessao?.lojas?.map((loja) => loja.id_loja) ?? [];
        const lojasIniciais =
          paths.mobile && idsLojasUsuario.length
            ? l.filter((loja) => idsLojasUsuario.includes(loja.id_loja))
            : l;
        const listaLojas = lojasIniciais.length ? lojasIniciais : l;
        if (paths.mobile) {
          if (listaLojas.length === 1) setIdLoja(listaLojas[0].id_loja);
        } else if (sessao?.lojas?.length === 1) {
          setIdLoja(sessao.lojas[0].id_loja);
        } else if (l.length === 1) {
          setIdLoja(l[0].id_loja);
        } else if (l[0]) {
          setIdLoja(l[0].id_loja);
        }
      })
      .catch((e) => setMsg(e.message))
      .finally(() => setLoading(false));
  }, [paths.mobile]);

  useEffect(() => {
    if (!paths.mobile || fase !== 'setup') return;
    const entrouNoHub =
      pathChecklist === '/checklist/mobile' && prevPathChecklist.current !== '/checklist/mobile';
    prevPathChecklist.current = pathChecklist;
    if (!entrouNoHub || lojasMobile.length <= 1) return;
    setIdLoja('');
  }, [pathChecklist, paths.mobile, fase, lojasMobile.length]);

  const selecionarLojaMobile = (lojaId: number) => {
    setIdLoja(lojaId);
    lojaMobileCtx?.setIdLoja(lojaId);
  };

  const selecionarTipo = async (codigo: string) => {
    const tipo = tiposChecklist.find((t) => t.codigo === codigo) ?? null;
    setTipoSelecionado(tipo);
    setMetaVisita({});
    setRespostas({});
    setIndiceSecao(0);
    if (tipo) {
      setCarregandoTipo(true);
      try {
        const c = await api.checklist(tipo.codigo);
        setChecklist(c);
      } catch (e) {
        setMsg((e as Error).message);
      } finally {
        setCarregandoTipo(false);
      }
    } else {
      setChecklist([]);
    }
  };

  const retomarVisita = useCallback(
    async (
      idVisita: number,
      opts?: { indiceSecao?: number; fase?: FaseChecklist; silencioso?: boolean },
    ) => {
      if (loading || tiposChecklist.length === 0) {
        setMsg('Aguarde o carregamento do checklist e tente novamente.');
        return false;
      }
      setRetomando(true);
      setSaving(true);
      setMsg('');
      try {
        const det = await api.visita(idVisita);
        const v = det.visita;
        if (v.status !== 'Rascunho') {
          const user = getUsuario();
          if (user) limparSessaoChecklist(user.id_usuario);
          setSessaoLocal(null);
          setMsg('Esta visita já foi finalizada.');
          setFase('setup');
          return false;
        }
        const codigo = v.tipo_checklist_codigo ?? tiposChecklist[0]?.codigo;
        if (!codigo) throw new Error('Tipo de checklist não encontrado');
        const tipo = tiposChecklist.find((t) => t.codigo === codigo) ?? null;
        const c = await api.checklist(codigo);
        if (!c.length) {
          throw new Error('Checklist vazio ou indisponível para esta visita.');
        }
        const respostasMap = mapRespostasApi(det.respostas);
        const idx = indiceSecaoParaRetomar(c, respostasMap, opts?.indiceSecao);

        setChecklist(c);
        setTipoSelecionado(tipo);
        setMetaVisita(v.meta_visita ?? {});
        setIdLoja(v.id_loja);
        if (v.id_usuario) setIdUsuario(v.id_usuario);
        setVisitaId(v.id_visita);
        setDataVisita(normalizarDataVisita(v.data_visita));
        setHoraInicio(v.hora_inicio ?? null);
        setRespostas(respostasMap);
        setIndiceSecao(idx);
        const novaFase: Fase = 'perguntas';
        setFase(novaFase);
        const user = getUsuario();
        if (user) {
          salvarSessaoChecklist(user.id_usuario, {
            visitaId: v.id_visita,
            indiceSecao: idx,
            fase: novaFase,
          });
          setSessaoLocal(getSessaoChecklist(user.id_usuario));
        }
        if (!opts?.silencioso) showToast('Checklist retomado de onde parou', 'success');
        return true;
      } catch (e) {
        setMsg((e as Error).message);
        setFase('setup');
        return false;
      } finally {
        setSaving(false);
        setRetomando(false);
      }
    },
    [loading, tiposChecklist],
  );

  useEffect(() => {
    if (loading || retomadaIniciada.current) return;
    const param = searchParams.get('visita');
    const stateId = (location.state as { retomarVisitaId?: number } | null)?.retomarVisitaId;
    const id = param ? Number(param) : stateId;
    if (!id || Number.isNaN(id)) return;
    retomadaIniciada.current = true;
    const user = getUsuario();
    const local = user ? getSessaoChecklist(user.id_usuario) : null;
    const sessaoDaVisita = local?.visitaId === id ? local : null;
    void retomarVisita(id, {
      silencioso: true,
      indiceSecao: sessaoDaVisita?.indiceSecao,
      fase: sessaoDaVisita?.fase,
    }).finally(() => {
      if (param) {
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev);
            next.delete('visita');
            return next;
          },
          { replace: true },
        );
      }
    });
  }, [loading, searchParams, location.state, retomarVisita, setSearchParams]);

  const patchResposta = (id: number, patch: Partial<RespostaLocal>) => {
    setRespostas((prev) => {
      const nextPatch = { ...patch };
      if ('fotos' in patch) {
        const prevFotos = getFotos(prev[id]);
        if ((patch.fotos?.length ?? 0) === 0 && prevFotos.length > 0) nextPatch.limpar_foto = true;
        if (patch.fotos?.length) nextPatch.limpar_foto = false;
      }
      return { ...prev, [id]: { ...prev[id], ...nextPatch } };
    });
    setErrosPerguntas((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const escolherSimNao = (p: Pergunta, opt: 'Sim' | 'Não' | 'N/A') => {
    const patch: Partial<RespostaLocal> = { resposta: opt };
    if (deveLimparFotos(p, opt)) {
      patch.fotos = [];
      patch.foto_url = undefined;
      patch.limpar_foto = true;
    }
    if (deveLimparObservacao(p, opt)) patch.observacao = undefined;
    patchResposta(p.id_pergunta, patch);
  };

  const reportarErroSalvar = (mensagem: string) => {
    setMsg(mensagem);
    showToast(mensagem, 'error');
  };

  const salvarItens = async (itens: RespostaInput[], silencioso = false) => {
    if (!visitaId) {
      if (!silencioso) {
        reportarErroSalvar('Visita não iniciada. Retome o checklist na tela inicial.');
      }
      return false;
    }
    if (!itens.length) {
      if (!silencioso) {
        setMsg('Nenhuma resposta para salvar nesta seção.');
        showToast('Nenhuma resposta para salvar nesta seção.', 'warning');
      }
      return true;
    }
    setSaving(true);
    try {
      await api.salvarRespostas(visitaId, itens);
      setRespostas((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const item of itens) {
          const r = prev[item.id_pergunta];
          if (!r) continue;
          const fotos = getFotos(r);
          if (!fotos.some((f) => f.startsWith('data:'))) continue;
          const promovidas = promoverFotosAposSalvar(fotos, visitaId, item.id_pergunta);
          next[item.id_pergunta] = {
            ...r,
            fotos: promovidas,
            foto_url: serializeFotos(promovidas) ?? undefined,
          };
          changed = true;
        }
        return changed ? next : prev;
      });
      if (!silencioso) showToast('Seção salva', 'success');
      return true;
    } catch (e) {
      reportarErroSalvar((e as Error).message || 'Não foi possível salvar o progresso.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const itensSecao = (cat: CategoriaChecklist): RespostaInput[] => {
    const itens: RespostaInput[] = [];
    for (const p of cat.perguntas) {
      const r = respostas[p.id_pergunta];
      if (!r || (!r.resposta && !r.nota_estrelas && !getFotos(r).length)) continue;
      itens.push(toRespostaInput(p, r));
    }
    return itens;
  };

  const salvarSecaoAtual = async (silencioso = true) => {
    if (!secaoAtual || !visitaId) return true;
    return salvarItens(itensSecao(secaoAtual), silencioso);
  };

  const validarSecao = (cat: CategoriaChecklist): ResultadoValidacaoSecao | null => {
    const novosErros: Record<number, ErroPerguntaCampo> = {};
    const pendentes: Array<{ p: Pergunta; tipo: ErroPerguntaCampo }> = [];

    for (const p of cat.perguntas) {
      const tipo = tipoErroPergunta(p, respostas[p.id_pergunta]);
      if (!tipo) continue;
      novosErros[p.id_pergunta] = tipo;
      pendentes.push({ p, tipo });
    }

    if (pendentes.length) {
      setErrosPerguntas(novosErros);
      return montarErroValidacaoSecao(pendentes);
    }

    setErrosPerguntas({});
    return null;
  };

  const exibirErroValidacao = (erro: ResultadoValidacaoSecao) => {
    setMsgTitulo(erro.titulo);
    setMsg(erro.detalhe);
    showToast(erro.titulo, 'warning');
  };

  const limparMsg = () => {
    setMsg('');
    setMsgTitulo('');
  };

  const iniciarVisita = async () => {
    if (!idLoja || !idUsuario || !tipoSelecionado) return;
    setSaving(true);
    setMsg('');
    try {
      const hoje = dataHojeBrasilia();
      const body: Parameters<typeof api.criarVisita>[0] = {
        id_loja: Number(idLoja),
        id_usuario: Number(idUsuario),
        data_visita: hoje,
        codigo_tipo_checklist: tipoSelecionado.codigo,
      };
      if (tipoSelecionado.codigo === 'time_de_campo') {
        body.meta_visita = metaVisita;
      }
      const v = await api.criarVisita(body);
      let cats = checklist;
      if (!cats.length) {
        cats = await api.checklist(tipoSelecionado.codigo);
        setChecklist(cats);
      }
      if (!cats.length) {
        setMsg('Checklist sem seções disponíveis. Verifique a configuração.');
        return;
      }
      setVisitaId(v.id_visita);
      setDataVisita(normalizarDataVisita(v.data_visita) ?? hoje);
      setHoraInicio(v.hora_inicio ?? null);
      setRespostas({});
      setIndiceSecao(0);
      setFase('perguntas');
    } catch (e) {
      const m = (e as Error).message;
      setMsg(
        m.includes('fetch') || m.includes('Failed') || m.includes('500')
          ? 'Conexão com a API caiu (reinício do servidor). Aguarde 2s e tente de novo.'
          : m
      );
    } finally {
      setSaving(false);
    }
  };

  const salvarSecaoAntesDeNavegar = async (cat: CategoriaChecklist) => {
    const itens = itensSecao(cat);
    if (!itens.length) return true;
    return salvarItens(itens, false);
  };

  const irProximaSecao = async () => {
    if (!secaoAtual) return;
    const erro = validarSecao(secaoAtual);
    if (erro) {
      exibirErroValidacao(erro);
      return;
    }
    limparMsg();
    const ok = await salvarSecaoAntesDeNavegar(secaoAtual);
    if (!ok) return;
    if (indiceSecao < totalSecoes - 1) setIndiceSecao((i) => i + 1);
  };

  const irSecaoAnterior = async () => {
    if (indiceSecao === 0 || !secaoAtual) return;
    limparMsg();
    const ok = await salvarSecaoAntesDeNavegar(secaoAtual);
    if (!ok) return;
    setIndiceSecao((i) => Math.max(0, i - 1));
  };

  const irParaSecao = async (idx: number) => {
    if (idx === indiceSecao || !secaoAtual) return;
    limparMsg();
    const ok = await salvarSecaoAntesDeNavegar(secaoAtual);
    if (!ok) return;
    setIndiceSecao(idx);
  };

  const comecarAvaliacao = async () => {
    if (!visitaId) {
      setFase('perguntas');
      return;
    }
    setSaving(true);
    try {
      const det = await api.visita(visitaId);
      setRespostas(mapRespostasApi(det.respostas));
      setFase('perguntas');
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const finalizar = async () => {
    if (!secaoAtual) return;
    const erroSecao = validarSecao(secaoAtual);
    if (erroSecao) {
      exibirErroValidacao(erroSecao);
      return;
    }
    for (const cat of checklist) {
      const erro = validarSecao(cat);
      if (erro) {
        exibirErroValidacao(erro);
        setIndiceSecao(checklist.indexOf(cat));
        return;
      }
    }
    setSaving(true);
    setMsg('');
    try {
      const ok = await salvarSecaoAtual(false);
      if (!ok) return;
      const duracao = calcularDuracaoVisitaMinutos(dataVisita, horaInicio);
      await api.finalizarVisita(visitaId!, duracao != null ? { duracao_minutos: duracao } : {});
      const user = getUsuario();
      if (user) {
        limparSessaoChecklist(user.id_usuario);
        setSessaoLocal(null);
      }
      navigate(paths.concluido(visitaId!));
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading || retomando) {
    if (paths.mobile) {
      return (
        <ChecklistIonicShell>
          <div className="checklist-ionic" style={{ padding: 24, textAlign: 'center' }}>
            <LinearProgress sx={{ borderRadius: 1, mb: 1.5 }} />
            <Typography variant="body2" color="text.secondary">
              {retomando ? 'Retomando checklist…' : 'Carregando…'}
            </Typography>
          </div>
        </ChecklistIonicShell>
      );
    }
    return (
      <Box sx={{ p: 2 }}>
        <LinearProgress sx={{ borderRadius: 1 }} />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, textAlign: 'center' }}>
          {retomando ? 'Retomando checklist…' : 'Carregando…'}
        </Typography>
      </Box>
    );
  }

  if (somenteVisualizacao) {
    return (
      <Box sx={{ p: 2, maxWidth: 480, mx: 'auto' }}>
        <Alert severity="info">
          Perfil <strong>TI</strong>: você visualiza o portal completo. O checklist em loja é
          executado por gerente, coordenador ou administrador.
        </Alert>
      </Box>
    );
  }

  if (fase === 'setup') {
    if (paths.mobile) {
      return (
        <ChecklistStartScreen
          msg={msg}
          onClearMsg={() => setMsg('')}
          sessaoLocal={sessaoLocal}
          onContinuar={() =>
            void retomarVisita(sessaoLocal!.visitaId, {
              indiceSecao: sessaoLocal!.indiceSecao,
              fase: sessaoLocal!.fase,
            })
          }
          onEsquecer={() => {
            const user = getUsuario();
            if (user) limparSessaoChecklist(user.id_usuario);
            setSessaoLocal(null);
          }}
          saving={saving}
          retomando={retomando}
          totalPerguntas={totalPerguntas}
          totalSecoes={totalSecoes}
          carregandoTipo={carregandoTipo}
          auditores={usuarios}
          idAuditor={idUsuario}
          nomeAuditorFallback={sessao?.nome ?? '—'}
          onSelecionarAuditor={setIdUsuario}
          lojas={lojasMobile}
          idLoja={idLoja}
          onSelecionarLoja={selecionarLojaMobile}
          tiposChecklist={tiposChecklist}
          tipoCodigo={tipoSelecionado?.codigo ?? ''}
          onSelecionarTipo={(codigo) => void selecionarTipo(codigo)}
          metaVisita={metaVisita}
          onMetaChange={(patch) => setMetaVisita((prev) => ({ ...prev, ...patch }))}
          podeIniciar={podeIniciarChecklist}
          onIniciar={iniciarVisita}
        />
      );
    }

    return (
      <Box sx={{ px: 2, pb: 4, pt: 0, flex: 1 }}>

        {msg && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setMsg('')}>
            {msg}
          </Alert>
        )}

        {sessaoLocal && (
          <Alert
            severity="warning"
            sx={{ mb: 2 }}
            action={
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'flex-end' }}>
                <Button
                  size="small"
                  color="warning"
                  variant="contained"
                  startIcon={<PlayArrowIcon />}
                  disabled={saving || retomando}
                  onClick={() =>
                    void retomarVisita(sessaoLocal.visitaId, {
                      indiceSecao: sessaoLocal.indiceSecao,
                      fase: sessaoLocal.fase,
                    })
                  }
                >
                  Continuar
                </Button>
                <Button
                  size="small"
                  color="inherit"
                  disabled={saving || retomando}
                  onClick={() => {
                    const user = getUsuario();
                    if (user) limparSessaoChecklist(user.id_usuario);
                    setSessaoLocal(null);
                  }}
                >
                  Esquecer
                </Button>
              </Box>
            }
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Checklist interrompido neste aparelho
            </Typography>
            <Typography variant="body2">
              Visita #{sessaoLocal.visitaId} — retome de onde parou para concluir.
            </Typography>
          </Alert>
        )}

        {rascunhosOrdenados.length > 0 && (
          <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              Visitas em andamento ({rascunhosOrdenados.length})
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {rascunhosOrdenados.map((r) => (
                <Box
                  key={r.id_visita}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1,
                    p: 1.25,
                    borderRadius: 1.5,
                    bgcolor: 'rgba(27, 42, 107, 0.03)',
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                      {r.name}
                      {r.bk_number ? ` · BKN ${r.bk_number}` : ''}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Visita #{r.id_visita} · {r.tipo_checklist_nome ?? 'Checklist'} ·{' '}
                      {fmtData(r.data_visita)}
                    </Typography>
                  </Box>
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<PlayArrowIcon />}
                    disabled={saving || retomando}
                    onClick={() =>
                      void retomarVisita(r.id_visita, {
                        indiceSecao:
                          sessaoLocal?.visitaId === r.id_visita ? sessaoLocal.indiceSecao : undefined,
                        fase:
                          sessaoLocal?.visitaId === r.id_visita ? sessaoLocal.fase : undefined,
                      })
                    }
                    sx={{ flexShrink: 0 }}
                  >
                    Continuar
                  </Button>
                </Box>
              ))}
            </Box>
          </Paper>
        )}
        <BannerResumoChecklist
          titulo={tipoSelecionado?.nome ?? 'Nova visita'}
          totalPerguntas={totalPerguntas}
          totalSecoes={totalSecoes}
          carregando={carregandoTipo}
        />

        {tiposChecklist.length > 1 && (
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Tipo de checklist</InputLabel>
            <Select
              label="Tipo de checklist"
              value={tipoSelecionado?.codigo ?? ''}
              onChange={(e) => void selecionarTipo(String(e.target.value))}
              {...selectMenuScrollProps}
            >
              {tiposChecklist.map((t) => (
                <MenuItem key={t.codigo} value={t.codigo}>
                  {t.nome}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>Loja</InputLabel>
          <Select
            label="Loja"
            value={idLoja}
            onChange={(e) => setIdLoja(Number(e.target.value))}
            renderValue={(value) => {
              const loja = lojas.find((l) => l.id_loja === value);
              if (!loja) return '';
              return (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
                  <LocationOnOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary', flexShrink: 0 }} />
                  <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
                    {loja.name}
                    {loja.bk_number ? ` · BKN ${loja.bk_number}` : ''}
                  </Typography>
                </Box>
              );
            }}
            {...selectMenuScrollProps}
          >
            {lojas.map((l) => (
              <MenuItem key={l.id_loja} value={l.id_loja} sx={{ py: 1, alignItems: 'flex-start' }}>
                <LocationOnOutlinedIcon
                  sx={{ fontSize: 18, color: 'text.secondary', mr: 1, mt: 0.2, flexShrink: 0 }}
                />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography
                    variant="body2"
                    sx={{ fontSize: '0.78rem', fontWeight: 500, lineHeight: 1.3, whiteSpace: 'normal' }}
                  >
                    {l.name}
                  </Typography>
                  {l.bk_number && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ fontSize: '0.68rem', display: 'block', mt: 0.25 }}
                    >
                      BKN {l.bk_number}
                    </Typography>
                  )}
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {usuarios.length > 1 ? (
          <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel>Auditor</InputLabel>
            <Select
              label="Auditor"
              value={idUsuario}
              onChange={(e) => setIdUsuario(Number(e.target.value))}
              renderValue={(value) => {
                const auditor = usuarios.find((u) => u.id_usuario === value);
                return auditor?.nome ?? '';
              }}
              {...selectMenuScrollProps}
            >
              {usuarios.map((u) => (
                <MenuItem key={u.id_usuario} value={u.id_usuario}>
                  {u.nome}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        ) : (
          <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
            <Typography variant="caption" color="text.secondary">
              Auditor
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 600 }}>
              {usuarios[0]?.nome ?? getUsuario()?.nome}
            </Typography>
          </Paper>
        )}

        {tipoSelecionado?.codigo === 'time_de_campo' && (
          <TimeCampoMetaForm
            value={metaVisita}
            onChange={(patch) => setMetaVisita((prev) => ({ ...prev, ...patch }))}
          />
        )}

        <Button
          fullWidth
          variant="contained"
          size="large"
          disabled={saving || carregandoTipo || !podeIniciarChecklist}
          onClick={iniciarVisita}
          sx={{ minHeight: 56, fontSize: '1.05rem', fontWeight: 700 }}
        >
          Iniciar checklist
        </Button>

      </Box>
    );
  }

  const auditorSel = usuarios.find((u) => u.id_usuario === idUsuario);

  if (fase === 'iniciada' && visitaId) {
    if (paths.mobile) {
      return (
        <VisitaIniciadaScreen
          visitaId={visitaId}
          loja={lojaSel}
          auditor={auditorSel}
          dataVisita={dataVisita}
          horaInicio={horaInicio}
          totalSecoes={totalSecoes}
          totalPerguntas={totalPerguntas}
          tipoChecklist={tipoSelecionado?.nome}
          metaVisita={tipoSelecionado?.codigo === 'time_de_campo' ? metaVisita : undefined}
          onComecar={comecarAvaliacao}
          ionic
        />
      );
    }
    return (
      <VisitaIniciadaScreen
        visitaId={visitaId}
        loja={lojaSel}
        auditor={auditorSel}
        dataVisita={dataVisita}
        horaInicio={horaInicio}
        totalSecoes={totalSecoes}
        totalPerguntas={totalPerguntas}
        tipoChecklist={tipoSelecionado?.nome}
        metaVisita={tipoSelecionado?.codigo === 'time_de_campo' ? metaVisita : undefined}
        onComecar={comecarAvaliacao}
      />
    );
  }

  if (!secaoAtual) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          Não foi possível abrir a seção do checklist. Tente retomar novamente.
        </Alert>
        {msg && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {msg}
          </Typography>
        )}
        <Button variant="contained" onClick={() => setFase('setup')}>
          Voltar ao início
        </Button>
      </Box>
    );
  }

  const ehUltimaSecao = indiceSecao === totalSecoes - 1;
  const respondidasSecao = secaoAtual.perguntas.filter((p) =>
    perguntaRespondida(p, respostas[p.id_pergunta])
  ).length;

  const telaPerguntas = (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, width: '100%' }}>
      <Box sx={{ px: 2, pt: 1.5, pb: 1, bgcolor: 'white', borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          {lojaSel?.name}
          {visitaId ? ` · Visita #${visitaId}` : ''}
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.5 }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            Progresso geral
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 700, color: 'primary.main' }}>
            {respondidas}/{totalPerguntas} ({progressoGeral}%)
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={progressoGeral}
          sx={{ height: 8, borderRadius: 4, mt: 0.75, mb: 1.5 }}
        />

        <Box
          sx={{
            display: 'flex',
            gap: 0.75,
            overflowX: 'auto',
            pb: 0.5,
            mx: -0.5,
            px: 0.5,
            '&::-webkit-scrollbar': { display: 'none' },
          }}
        >
          {checklist.map((cat, idx) => {
            const completa = secaoCompleta(cat);
            const ativa = idx === indiceSecao;
            return (
              <Chip
                key={cat.id_categoria}
                label={`${idx + 1}. ${cat.nome.split(' ')[0]}`}
                size="small"
                onClick={() => void irParaSecao(idx)}
                icon={completa ? <CheckCircleIcon /> : undefined}
                color={ativa ? undefined : completa ? 'success' : 'default'}
                variant={ativa ? 'filled' : 'outlined'}
                sx={{
                  flexShrink: 0,
                  fontWeight: ativa ? 700 : 500,
                  ...(ativa && {
                    bgcolor: BRAND_ORANGE,
                    color: 'white',
                    '&:hover': { bgcolor: '#C74709' },
                    '& .MuiChip-icon': { color: 'white' },
                  }),
                }}
              />
            );
          })}
        </Box>
      </Box>

      <Box
        sx={{
          px: 2,
          py: 1.5,
          bgcolor: BRAND_ORANGE,
          color: 'white',
        }}
      >
        <Typography variant="overline" sx={{ opacity: 0.9, lineHeight: 1.2 }}>
          Seção {indiceSecao + 1} de {totalSecoes}
        </Typography>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          {secaoAtual.nome}
        </Typography>
        <Typography variant="caption" sx={{ opacity: 0.95 }}>
          {respondidasSecao}/{secaoAtual.perguntas.length} respondidas nesta seção
        </Typography>
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto', px: 2, py: 2 }}>
        {msg && (
          <Alert severity="warning" sx={{ mb: 2 }} onClose={limparMsg}>
            {msgTitulo && (
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.25 }}>
                {msgTitulo}
              </Typography>
            )}
            {msg}
          </Alert>
        )}

        {secaoAtual.perguntas.map((p) => (
          <ChecklistPerguntaCard
            key={p.id_pergunta}
            pergunta={p}
            resposta={respostas[p.id_pergunta]}
            erroCampo={errosPerguntas[p.id_pergunta]}
            onPatch={(patch) => patchResposta(p.id_pergunta, patch)}
            onSimNao={(opt) => escolherSimNao(p, opt)}
          />
        ))}
      </Box>

      <Box
        sx={{
          px: 2,
          py: 1.5,
          pb: 'max(12px, env(safe-area-inset-bottom))',
          bgcolor: 'white',
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {indiceSecao > 0 && (
            <Button
              variant="text"
              startIcon={<NavigateBeforeIcon />}
              disabled={saving}
              onClick={() => void irSecaoAnterior()}
              sx={{ alignSelf: 'flex-start', minHeight: 40, fontWeight: 600 }}
            >
              Seção anterior
            </Button>
          )}

          <Box sx={{ display: 'flex', gap: 1, minWidth: 0 }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<SaveIcon sx={{ fontSize: 18 }} />}
              disabled={saving}
              onClick={() => salvarSecaoAtual(false)}
              sx={{
                flex: 1,
                minWidth: 0,
                minHeight: 40,
                fontWeight: 600,
                fontSize: '0.8rem',
                whiteSpace: 'nowrap',
                px: 1,
              }}
            >
              Salvar
            </Button>

            {ehUltimaSecao ? (
              <Button
                variant="contained"
                color="success"
                size="small"
                endIcon={<CheckIcon sx={{ fontSize: 18 }} />}
                disabled={saving}
                onClick={finalizar}
                sx={{
                  flex: 1,
                  minWidth: 0,
                  minHeight: 40,
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  whiteSpace: 'nowrap',
                  px: 1,
                }}
              >
                Finalizar
              </Button>
            ) : (
              <Button
                variant="contained"
                size="small"
                endIcon={<NavigateNextIcon sx={{ fontSize: 18 }} />}
                disabled={saving}
                onClick={() => void irProximaSecao()}
                sx={{
                  flex: 1,
                  minWidth: 0,
                  minHeight: 40,
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  whiteSpace: 'nowrap',
                  px: 1,
                }}
              >
                Próxima seção
              </Button>
            )}
          </Box>
        </Box>
      </Box>

    </Box>
  );

  if (paths.mobile) {
    return (
      <ChecklistIonicFluxo
        loja={lojaSel}
        visitaId={visitaId}
        checklist={checklist}
        indiceSecao={indiceSecao}
        secaoAtual={secaoAtual}
        respostas={respostas}
        errosPerguntas={errosPerguntas}
        respondidas={respondidas}
        totalPerguntas={totalPerguntas}
        progressoGeral={progressoGeral}
        msg={msg}
        msgTitulo={msgTitulo}
        saving={saving}
        onLimparMsg={limparMsg}
        onIrParaSecao={(idx) => void irParaSecao(idx)}
        onPatch={patchResposta}
        onSimNao={escolherSimNao}
        secaoCompleta={secaoCompleta}
        onSecaoAnterior={() => void irSecaoAnterior()}
        onSalvar={() => void salvarSecaoAtual(false)}
        onProxima={() => void irProximaSecao()}
        onFinalizar={() => void finalizar()}
      />
    );
  }

  return telaPerguntas;
}
