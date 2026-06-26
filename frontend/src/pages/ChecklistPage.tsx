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
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormLabel from '@mui/material/FormLabel';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import SaveIcon from '@mui/icons-material/Save';
import CheckIcon from '@mui/icons-material/Check';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { api, fmtData } from '../api/client';
import type { CategoriaChecklist, Loja, Usuario, Pergunta, RespostaInput, TipoChecklist, MetaVisitaTimeCampo, VisitaResumo } from '../api/client';
import ChecklistPerguntaCard, {
  perguntaRespondida,
  type ErroPerguntaCampo,
  type RespostaLocal,
} from '../components/checklist/ChecklistPerguntaCard';
import VisitaIniciadaScreen from '../components/checklist/VisitaIniciadaScreen';
import TimeCampoMetaForm from '../components/checklist/TimeCampoMetaForm';
import { usePageTitle } from '../hooks/usePageTitle';
import { selectMenuScrollProps } from '../utils/selectMenuScroll';
import { showToast } from '../utils/toast';
import { CHECKLIST_REFRESH } from '../utils/checklistEvent';
import {
  getSessaoChecklist,
  salvarSessaoChecklist,
  limparSessaoChecklist,
  indiceSecaoParaRetomar,
  secaoTemPendencia,
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
} from '../utils/checklistRules';

const BRAND_ORANGE = '#E8520A';
const NAVY = '#1B2A6B';

function SeletorAuditorChecklistMobile({
  auditores,
  idAuditor,
  nomeFallback,
  onSelecionar,
}: {
  auditores: Usuario[];
  idAuditor: number | '';
  nomeFallback: string;
  onSelecionar: (id: number) => void;
}) {
  const [dialogAberto, setDialogAberto] = useState(false);
  const multiplos = auditores.length > 1;
  const auditorAtual = auditores.find((u) => u.id_usuario === idAuditor);
  const nomeExibido = auditorAtual?.nome ?? nomeFallback;

  return (
    <>
      <Box
        role={multiplos ? 'button' : undefined}
        tabIndex={multiplos ? 0 : undefined}
        onClick={() => multiplos && setDialogAberto(true)}
        onKeyDown={(e) => {
          if (multiplos && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            setDialogAberto(true);
          }
        }}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          minWidth: 0,
          minHeight: 24,
          cursor: multiplos ? 'pointer' : 'default',
        }}
      >
        <PersonOutlineOutlinedIcon
          sx={{ fontSize: 20, color: NAVY, opacity: 0.75, flexShrink: 0, display: 'block' }}
        />
        <Typography
          component="div"
          variant="body2"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0, flex: 1, lineHeight: 1.25 }}
        >
          <Box component="span" sx={{ color: 'text.secondary', fontWeight: 500, flexShrink: 0 }}>
            Auditor:
          </Box>
          <Box
            component="span"
            sx={{
              color: NAVY,
              fontWeight: 700,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {nomeExibido}
          </Box>
        </Typography>
      </Box>

      <Dialog open={dialogAberto} onClose={() => setDialogAberto(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem', color: NAVY, pb: 1 }}>
          Escolher auditor
        </DialogTitle>
        <List sx={{ pt: 0, pb: 1 }}>
          {auditores.map((u) => {
            const ativo = u.id_usuario === idAuditor;
            return (
              <ListItemButton
                key={u.id_usuario}
                selected={ativo}
                onClick={() => {
                  onSelecionar(u.id_usuario);
                  setDialogAberto(false);
                }}
                sx={{ py: 1.25, '&.Mui-selected': { bgcolor: 'rgba(232, 82, 10, 0.08)' } }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <PersonOutlineOutlinedIcon sx={{ fontSize: 20, color: BRAND_ORANGE }} />
                </ListItemIcon>
                <ListItemText
                  primary={u.nome}
                  slotProps={{
                    primary: {
                      sx: {
                        fontWeight: ativo ? 700 : 600,
                        color: ativo ? NAVY : 'text.primary',
                        fontSize: '0.9rem',
                      },
                    },
                  }}
                />
              </ListItemButton>
            );
          })}
        </List>
      </Dialog>
    </>
  );
}

function SeletorLojaChecklistMobile({
  lojas,
  idLoja,
  onSelecionar,
}: {
  lojas: Loja[];
  idLoja: number | '';
  onSelecionar: (id: number) => void;
}) {
  const [dialogAberto, setDialogAberto] = useState(false);
  const multiplas = lojas.length > 1;
  const lojaAtual = lojas.find((l) => l.id_loja === idLoja);
  const nomeExibido = lojaAtual?.name ?? (multiplas ? 'Selecione a Loja' : lojas[0]?.name ?? '—');

  if (!lojas.length) {
    return (
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ mt: 1.25, pt: 1.25, borderTop: '1px solid rgba(27, 42, 107, 0.08)' }}
      >
        Nenhuma loja disponível
      </Typography>
    );
  }

  return (
    <>
      <Box
        role={multiplas ? 'button' : undefined}
        tabIndex={multiplas ? 0 : undefined}
        onClick={() => multiplas && setDialogAberto(true)}
        onKeyDown={(e) => {
          if (multiplas && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            setDialogAberto(true);
          }
        }}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          minWidth: 0,
          minHeight: 24,
          mt: 1.25,
          pt: 1.25,
          borderTop: '1px solid rgba(27, 42, 107, 0.08)',
          cursor: multiplas ? 'pointer' : 'default',
        }}
      >
        <LocationOnOutlinedIcon sx={{ fontSize: 20, color: BRAND_ORANGE, flexShrink: 0, display: 'block' }} />
        <Typography
          component="div"
          variant="body2"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0, flex: 1, lineHeight: 1.25 }}
        >
          <Box component="span" sx={{ color: 'text.secondary', fontWeight: 500, flexShrink: 0 }}>
            Loja:
          </Box>
          <Box
            component="span"
            sx={{
              color: lojaAtual ? NAVY : 'text.secondary',
              fontWeight: lojaAtual ? 700 : 500,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {nomeExibido}
          </Box>
        </Typography>
      </Box>

      <Dialog open={dialogAberto} onClose={() => setDialogAberto(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem', color: NAVY, pb: 1 }}>
          Escolher loja
        </DialogTitle>
        <List sx={{ pt: 0, pb: 1 }}>
          {lojas.map((loja) => {
            const ativa = loja.id_loja === idLoja;
            return (
              <ListItemButton
                key={loja.id_loja}
                selected={ativa}
                onClick={() => {
                  onSelecionar(loja.id_loja);
                  setDialogAberto(false);
                }}
                sx={{ py: 1.25, '&.Mui-selected': { bgcolor: 'rgba(232, 82, 10, 0.08)' } }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <LocationOnOutlinedIcon sx={{ fontSize: 20, color: BRAND_ORANGE }} />
                </ListItemIcon>
                <ListItemText
                  primary={loja.name}
                  secondary={loja.bk_number ? `BKN ${loja.bk_number}` : undefined}
                  slotProps={{
                    primary: {
                      sx: {
                        fontWeight: ativa ? 700 : 600,
                        color: ativa ? NAVY : 'text.primary',
                        fontSize: '0.9rem',
                      },
                    },
                    secondary: { sx: { fontSize: '0.75rem' } },
                  }}
                />
              </ListItemButton>
            );
          })}
        </List>
      </Dialog>
    </>
  );
}

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

  if (exibeFoto(p, r.resposta, r.nota_estrelas)) input.foto_url = serializeFotos(fotos);
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
  const paths = checklistPaths(location.pathname);
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
  const pathChecklist = toAppPath(location.pathname);
  const prevPathChecklist = useRef('');

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
          setTipoSelecionado(null);
          setChecklist([]);
        } else {
          const tipo = tipos[0] ?? null;
          setTipoSelecionado(tipo);
          if (tipo) {
            const c = await api.checklist(tipo.codigo);
            setChecklist(c);
          }
        }
        if (sessao) {
          const auditorPadrao = auditoresList.find((u) => u.id_usuario === sessao.id_usuario);
          setIdUsuario(auditorPadrao?.id_usuario ?? auditoresList[0]?.id_usuario ?? sessao.id_usuario);
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
        const temRespostas = det.respostas.length > 0;
        const idx = indiceSecaoParaRetomar(c, respostasMap, opts?.indiceSecao);
        const temPendencia = c.some((_, i) => secaoTemPendencia(c, respostasMap, i));

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
        const novaFase =
          temRespostas || temPendencia || opts?.fase === 'perguntas' ? 'perguntas' : 'iniciada';
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
    setRespostas((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
    setErrosPerguntas((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const escolherSimNao = (p: Pergunta, opt: 'Sim' | 'Não') => {
    const patch: Partial<RespostaLocal> = { resposta: opt };
    if (deveLimparFotos(p, opt)) {
      patch.fotos = [];
      patch.foto_url = undefined;
    }
    if (deveLimparObservacao(p, opt)) patch.observacao = undefined;
    patchResposta(p.id_pergunta, patch);
  };

  const salvarItens = async (
    itens: RespostaInput[],
    silencioso = false,
    opts?: { emSegundoPlano?: boolean },
  ) => {
    if (!visitaId || !itens.length) return true;
    if (!opts?.emSegundoPlano) setSaving(true);
    try {
      await api.salvarRespostas(visitaId, itens);
      if (!silencioso) showToast('Seção salva', 'success');
      return true;
    } catch (e) {
      const mensagem = (e as Error).message;
      if (!silencioso) setMsg(mensagem);
      else showToast('Não foi possível salvar o progresso.', 'error');
      return false;
    } finally {
      if (!opts?.emSegundoPlano) setSaving(false);
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

  const salvarSecaoEmSegundoPlano = (cat: CategoriaChecklist) => {
    const itens = itensSecao(cat);
    if (!itens.length) return;
    void salvarItens(itens, true, { emSegundoPlano: true });
  };

  const salvarSecaoAtual = async (silencioso = true) => {
    if (!secaoAtual || !visitaId) return true;
    return salvarItens(itensSecao(secaoAtual), silencioso);
  };

  const salvarTodas = async () => {
    const itens: RespostaInput[] = [];
    for (const cat of checklist) itens.push(...itensSecao(cat));
    return salvarItens(itens, true);
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
      setVisitaId(v.id_visita);
      setDataVisita(normalizarDataVisita(v.data_visita) ?? hoje);
      setHoraInicio(v.hora_inicio ?? null);
      setRespostas({});
      setIndiceSecao(0);
      setFase('iniciada');
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

  const irProximaSecao = () => {
    if (!secaoAtual) return;
    const erro = validarSecao(secaoAtual);
    if (erro) {
      exibirErroValidacao(erro);
      return;
    }
    limparMsg();
    const secaoSalvar = secaoAtual;
    if (indiceSecao < totalSecoes - 1) setIndiceSecao((i) => i + 1);
    salvarSecaoEmSegundoPlano(secaoSalvar);
  };

  const irSecaoAnterior = () => {
    if (indiceSecao === 0 || !secaoAtual) return;
    limparMsg();
    const secaoSalvar = secaoAtual;
    setIndiceSecao((i) => Math.max(0, i - 1));
    salvarSecaoEmSegundoPlano(secaoSalvar);
  };

  const irParaSecao = (idx: number) => {
    if (idx === indiceSecao || !secaoAtual) return;
    limparMsg();
    const secaoSalvar = secaoAtual;
    setIndiceSecao(idx);
    salvarSecaoEmSegundoPlano(secaoSalvar);
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
      const ok = await salvarTodas();
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
    return (
      <Box sx={{ p: 2 }}>
        <LinearProgress />
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

        {rascunhosOrdenados.length > 0 && !paths.mobile && (
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
        {paths.mobile ? (
          <>
            <BannerResumoChecklist
              titulo={tipoSelecionado?.nome ?? 'Nova visita'}
              totalPerguntas={totalPerguntas}
              totalSecoes={totalSecoes}
              carregando={carregandoTipo}
            />

            <Paper sx={{ p: 2, mb: 2 }}>
              <SeletorAuditorChecklistMobile
                auditores={usuarios}
                idAuditor={idUsuario}
                nomeFallback={sessao?.nome ?? '—'}
                onSelecionar={setIdUsuario}
              />
              <SeletorLojaChecklistMobile
                lojas={lojasMobile}
                idLoja={idLoja}
                onSelecionar={selecionarLojaMobile}
              />
            </Paper>

            <Paper sx={{ p: 2, mb: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {carregandoTipo && <LinearProgress sx={{ mb: 0.5 }} />}
              <FormControl component="fieldset" fullWidth>
                <FormLabel
                  component="legend"
                  sx={{ fontWeight: 700, color: NAVY, fontSize: '0.875rem', mb: 0.5 }}
                >
                  Tipo de checklist
                </FormLabel>
                <RadioGroup
                  value={tipoSelecionado?.codigo ?? ''}
                  onChange={(e) => void selecionarTipo(e.target.value)}
                >
                  {tiposChecklist.map((t) => (
                    <FormControlLabel
                      key={t.codigo}
                      value={t.codigo}
                      control={
                        <Radio
                          sx={{
                            color: 'rgba(27, 42, 107, 0.45)',
                            '&.Mui-checked': { color: BRAND_ORANGE },
                          }}
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: NAVY }}>
                            {t.nome}
                          </Typography>
                          {t.descricao && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                              {t.descricao}
                            </Typography>
                          )}
                        </Box>
                      }
                      sx={{
                        mx: 0,
                        py: 0.75,
                        px: 0.5,
                        borderRadius: 2,
                        alignItems: 'flex-start',
                        '&:has(.Mui-checked)': { bgcolor: 'rgba(232, 82, 10, 0.06)' },
                      }}
                    />
                  ))}
                </RadioGroup>
              </FormControl>

              {tipoSelecionado?.codigo === 'time_de_campo' && (
                <TimeCampoMetaForm
                  value={metaVisita}
                  onChange={(patch) => setMetaVisita((prev) => ({ ...prev, ...patch }))}
                />
              )}
            </Paper>

            <Button
              fullWidth
              variant="contained"
              size="large"
              disabled={saving || carregandoTipo || !podeIniciarChecklist}
              onClick={iniciarVisita}
              sx={{ minHeight: 48, fontWeight: 700 }}
            >
              {saving ? 'Iniciando…' : 'Iniciar checklist'}
            </Button>
          </>
        ) : (
          <>
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
          </>
        )}
      </Box>
    );
  }

  const auditorSel = usuarios.find((u) => u.id_usuario === idUsuario);

  if (fase === 'iniciada' && visitaId) {
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

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
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
                onClick={() => irParaSecao(idx)}
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
              onClick={irSecaoAnterior}
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
                onClick={irProximaSecao}
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
}
