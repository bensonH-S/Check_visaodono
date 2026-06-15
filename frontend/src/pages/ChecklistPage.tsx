import { useEffect, useMemo, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import { api } from '../api/client';
import { getUsuario, temPermissao } from '../lib/auth';
import type { CategoriaChecklist, Loja, Usuario, Pergunta, RespostaInput } from '../api/client';
import ChecklistPerguntaCard, {
  perguntaRespondida,
  type ErroPerguntaCampo,
  type RespostaLocal,
} from '../components/checklist/ChecklistPerguntaCard';
import VisitaIniciadaScreen from '../components/checklist/VisitaIniciadaScreen';
import { usePageTitle } from '../hooks/usePageTitle';
import { selectMenuScrollProps } from '../utils/selectMenuScroll';
import { showToast } from '../utils/toast';
import { CHECKLIST_REFRESH } from '../utils/checklistEvent';
import { dataHojeBrasilia, normalizarDataVisita } from '../utils/dateBr';
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
  if (exibeObservacao(p, r.resposta) && r.observacao) input.observacao = r.observacao;

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
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
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

  const sessao = getUsuario();
  const somenteVisualizacao = !temPermissao('checklist.executar', sessao);

  useEffect(() => {
    setErrosPerguntas({});
  }, [indiceSecao]);

  const recarregarChecklist = useCallback(async () => {
    try {
      const c = await api.checklist();
      setChecklist(c);
      setIndiceSecao((idx) => Math.min(idx, Math.max(0, c.length - 1)));
    } catch {
      /* atualização em segundo plano */
    }
  }, []);

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
      setFase('setup');
      setVisitaId(null);
      setDataVisita(null);
      setHoraInicio(null);
      setRespostas({});
      setIndiceSecao(0);
      setMsg('');
      navigate('/checklist', { replace: true, state: {} });
    }
  }, [location.state, navigate]);

  useEffect(() => {
    const sessao = getUsuario();
    const cargas: [Promise<Loja[]>, Promise<CategoriaChecklist[]>] = [
      api.lojas({ ativas: true, operacionais: true }),
      api.checklist(),
    ];
    const comUsuarios = sessao && temPermissao('usuarios.listar', sessao);

    Promise.all([
      ...cargas,
      comUsuarios ? api.usuarios() : Promise.resolve([] as Usuario[]),
    ])
      .then(([l, c, u]) => {
        setLojas(l);
        setChecklist(c);
        setUsuarios(u);
        if (sessao) setIdUsuario(sessao.id_usuario);
        if (sessao?.lojas?.length === 1) setIdLoja(sessao.lojas[0].id_loja);
        else if (l.length === 1) setIdLoja(l[0].id_loja);
        else if (l[0]) setIdLoja(l[0].id_loja);
      })
      .catch((e) => setMsg(e.message))
      .finally(() => setLoading(false));
  }, []);

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
    if (!idLoja || !idUsuario) return;
    setSaving(true);
    setMsg('');
    try {
      const hoje = dataHojeBrasilia();
      const v = await api.criarVisita({
        id_loja: Number(idLoja),
        id_usuario: Number(idUsuario),
        data_visita: hoje,
      });
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
      await api.finalizarVisita(visitaId!, { duracao_minutos: 90 });
      navigate(`/checklist/concluido/${visitaId}`);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 2 }}>
        <LinearProgress />
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

  const lojaSel = lojas.find((l) => l.id_loja === idLoja);

  if (fase === 'setup') {
    return (
      <Box sx={{ p: 2, pb: 4, flex: 1 }}>
        {msg && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setMsg('')}>
            {msg}
          </Alert>
        )}
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
            Nova visita
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1 }}>
            <Chip
              label={`${totalPerguntas} perguntas`}
              size="small"
              sx={{ bgcolor: 'rgba(255,255,255,0.18)', color: 'white', fontWeight: 600, height: 24 }}
            />
            <Chip
              label={`${totalSecoes} seções`}
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

        {getUsuario() && temPermissao('usuarios.listar', getUsuario()) ? (
          <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel>Auditor</InputLabel>
            <Select
              label="Auditor"
              value={idUsuario}
              onChange={(e) => setIdUsuario(Number(e.target.value))}
              renderValue={(value) => {
                const auditor = usuarios.find((u) => u.id_usuario === value);
                if (!auditor) return '';
                return (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
                    <PersonOutlineOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary', flexShrink: 0 }} />
                    <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
                      {auditor.nome}
                    </Typography>
                  </Box>
                );
              }}
              {...selectMenuScrollProps}
            >
              {usuarios.map((u) => (
                <MenuItem key={u.id_usuario} value={u.id_usuario} sx={{ py: 0.85, alignItems: 'center' }}>
                  <PersonOutlineOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary', mr: 1, flexShrink: 0 }} />
                  <Typography variant="body2" sx={{ fontSize: '0.78rem', fontWeight: 500, lineHeight: 1.3 }}>
                    {u.nome}
                  </Typography>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        ) : (
          <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
            <Typography variant="caption" color="text.secondary">
              Responsável
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 600 }}>
              {getUsuario()?.nome}
            </Typography>
          </Paper>
        )}

        <Button
          fullWidth
          variant="contained"
          size="large"
          disabled={saving || !idLoja || !idUsuario}
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
    return (
      <VisitaIniciadaScreen
        visitaId={visitaId}
        loja={lojaSel}
        auditor={auditorSel}
        dataVisita={dataVisita}
        horaInicio={horaInicio}
        totalSecoes={totalSecoes}
        totalPerguntas={totalPerguntas}
        onComecar={comecarAvaliacao}
      />
    );
  }

  if (!secaoAtual) return null;

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
