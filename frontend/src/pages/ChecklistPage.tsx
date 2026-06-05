import { useEffect, useMemo, useState } from 'react';
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
import IconButton from '@mui/material/IconButton';
import Snackbar from '@mui/material/Snackbar';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import SaveIcon from '@mui/icons-material/Save';
import CheckIcon from '@mui/icons-material/Check';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { api } from '../api/client';
import { getUsuario, podeFazerChecklist, podeVerGestao } from '../lib/auth';
import type { CategoriaChecklist, Loja, Usuario, Pergunta, RespostaInput } from '../api/client';
import ChecklistPerguntaCard, {
  perguntaRespondida,
  type RespostaLocal,
} from '../components/checklist/ChecklistPerguntaCard';
import VisitaIniciadaScreen from '../components/checklist/VisitaIniciadaScreen';
import { usePageTitle } from '../hooks/usePageTitle';
import {
  exibeFoto,
  exibeObservacao,
  serializeFotos,
  deveLimparFotos,
  deveLimparObservacao,
  parseFotos,
} from '../utils/checklistRules';

function getFotos(r?: RespostaLocal): string[] {
  if (r?.fotos?.length) return r.fotos;
  return parseFotos(r?.foto_url);
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

  if (exibeFoto(p, r.resposta)) input.foto_url = serializeFotos(fotos);
  if (exibeObservacao(p, r.resposta) && r.observacao) input.observacao = r.observacao;

  return input;
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
  const [respostas, setRespostas] = useState<Record<number, RespostaLocal>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [snack, setSnack] = useState('');
  const [fase, setFase] = useState<Fase>('setup');
  const [indiceSecao, setIndiceSecao] = useState(0);

  const totalPerguntas = useMemo(
    () => checklist.reduce((n, c) => n + c.perguntas.length, 0),
    [checklist]
  );

  const secaoAtual = checklist[indiceSecao];
  const totalSecoes = checklist.length;

  const tabTitle =
    fase === 'setup'
      ? 'Novo Checklist'
      : fase === 'iniciada'
        ? 'Checklist'
        : secaoAtual
          ? `Checklist — ${secaoAtual.nome}`
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

  useEffect(() => {
    const s = getUsuario();
    if (s && !podeFazerChecklist(s.perfil)) {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    const reiniciar = (location.state as { reiniciar?: boolean })?.reiniciar;
    if (reiniciar) {
      setFase('setup');
      setVisitaId(null);
      setDataVisita(null);
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
    const comUsuarios = sessao && podeVerGestao(sessao.perfil);

    Promise.all([
      ...cargas,
      comUsuarios ? api.usuarios() : Promise.resolve([] as Usuario[]),
    ])
      .then(([l, c, u]) => {
        setLojas(l);
        setChecklist(c);
        setUsuarios(u);
        if (sessao) setIdUsuario(sessao.id_usuario);
        if (sessao?.id_loja) setIdLoja(sessao.id_loja);
        else if (l[0]) setIdLoja(l[0].id_loja);
      })
      .catch((e) => setMsg(e.message))
      .finally(() => setLoading(false));
  }, []);

  const patchResposta = (id: number, patch: Partial<RespostaLocal>) => {
    setRespostas((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
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

  const salvarItens = async (itens: RespostaInput[], silencioso = false) => {
    if (!visitaId || !itens.length) return true;
    setSaving(true);
    try {
      for (const item of itens) {
        await api.salvarRespostas(visitaId, [item]);
      }
      if (!silencioso) setSnack('Seção salva');
      return true;
    } catch (e) {
      if (!silencioso) setMsg((e as Error).message);
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

  const salvarTodas = async () => {
    const itens: RespostaInput[] = [];
    for (const cat of checklist) itens.push(...itensSecao(cat));
    return salvarItens(itens, true);
  };

  const validarSecao = (cat: CategoriaChecklist): string | null => {
    for (const p of cat.perguntas) {
      if (!p.obrigatoria) continue;
      if (!perguntaRespondida(p, respostas[p.id_pergunta])) {
        return `Complete a pergunta ${p.codigo} antes de continuar.`;
      }
    }
    return null;
  };

  const iniciarVisita = async () => {
    if (!idLoja || !idUsuario) return;
    setSaving(true);
    setMsg('');
    try {
      const v = await api.criarVisita({
        id_loja: Number(idLoja),
        id_usuario: Number(idUsuario),
      });
      setVisitaId(v.id_visita);
      setDataVisita(v.data_visita ?? null);
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

  const irProximaSecao = async () => {
    if (!secaoAtual) return;
    const erro = validarSecao(secaoAtual);
    if (erro) {
      setMsg(erro);
      return;
    }
    setMsg('');
    const ok = await salvarSecaoAtual(true);
    if (!ok) return;
    if (indiceSecao < totalSecoes - 1) setIndiceSecao((i) => i + 1);
  };

  const finalizar = async () => {
    if (!secaoAtual) return;
    const erroSecao = validarSecao(secaoAtual);
    if (erroSecao) {
      setMsg(erroSecao);
      return;
    }
    for (const cat of checklist) {
      const erro = validarSecao(cat);
      if (erro) {
        setMsg(erro);
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
            p: 2.5,
            mb: 2,
            borderRadius: 2,
            background: 'linear-gradient(135deg, #1B2A6B 0%, #2a3d8f 100%)',
            color: 'white',
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
            Nova visita
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.9 }}>
            {totalPerguntas} perguntas em {totalSecoes} seções — responda bloco a bloco na loja.
          </Typography>
        </Paper>

        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>Loja</InputLabel>
          <Select label="Loja" value={idLoja} onChange={(e) => setIdLoja(Number(e.target.value))}>
            {lojas.map((l) => (
              <MenuItem key={l.id_loja} value={l.id_loja}>
                {l.name}
                {l.bk_number ? ` · BKN ${l.bk_number}` : ''}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {getUsuario() && podeVerGestao(getUsuario()!.perfil) ? (
          <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel>Auditor</InputLabel>
            <Select
              label="Auditor"
              value={idUsuario}
              onChange={(e) => setIdUsuario(Number(e.target.value))}
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
        totalSecoes={totalSecoes}
        totalPerguntas={totalPerguntas}
        onComecar={() => setFase('perguntas')}
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
                onClick={() => {
                  setMsg('');
                  setIndiceSecao(idx);
                }}
                icon={completa ? <CheckCircleIcon /> : undefined}
                color={ativa ? 'primary' : completa ? 'success' : 'default'}
                variant={ativa ? 'filled' : 'outlined'}
                sx={{ flexShrink: 0, fontWeight: ativa ? 700 : 500 }}
              />
            );
          })}
        </Box>
      </Box>

      <Box
        sx={{
          px: 2,
          py: 1.5,
          background: 'linear-gradient(90deg, #E8520A 0%, #ff7a3d 100%)',
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
          <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setMsg('')}>
            {msg}
          </Alert>
        )}

        {secaoAtual.perguntas.map((p) => (
          <ChecklistPerguntaCard
            key={p.id_pergunta}
            pergunta={p}
            resposta={respostas[p.id_pergunta]}
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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton
            disabled={indiceSecao === 0 || saving}
            onClick={() => {
              setMsg('');
              setIndiceSecao((i) => Math.max(0, i - 1));
            }}
            aria-label="Seção anterior"
          >
            <NavigateBeforeIcon />
          </IconButton>

          <Button
            variant="outlined"
            size="small"
            startIcon={<SaveIcon />}
            disabled={saving}
            onClick={() => salvarSecaoAtual(false)}
          >
            Salvar
          </Button>

          <Box sx={{ flex: 1 }} />

          {ehUltimaSecao ? (
            <Button
              variant="contained"
              color="success"
              endIcon={<CheckIcon />}
              disabled={saving}
              onClick={finalizar}
              sx={{ minHeight: 48, px: 2, fontWeight: 700 }}
            >
              Finalizar
            </Button>
          ) : (
            <Button
              variant="contained"
              endIcon={<NavigateNextIcon />}
              disabled={saving}
              onClick={irProximaSecao}
              sx={{ minHeight: 48, px: 2, fontWeight: 700 }}
            >
              Próxima seção
            </Button>
          )}
        </Box>
      </Box>

      <Snackbar
        open={!!snack}
        autoHideDuration={2500}
        message={snack}
        onClose={() => setSnack('')}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      />
    </Box>
  );
}
