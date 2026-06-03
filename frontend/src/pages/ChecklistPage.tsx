import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Alert from '@mui/material/Alert';
import LinearProgress from '@mui/material/LinearProgress';
import { api } from '../api/client';
import type { CategoriaChecklist, Loja, Usuario, RespostaInput } from '../api/client';

type RespostaMap = Record<number, RespostaInput['resposta']>;

export default function ChecklistPage() {
  const navigate = useNavigate();
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [checklist, setChecklist] = useState<CategoriaChecklist[]>([]);
  const [idLoja, setIdLoja] = useState<number | ''>('');
  const [idUsuario, setIdUsuario] = useState<number | ''>('');
  const [visitaId, setVisitaId] = useState<number | null>(null);
  const [respostas, setRespostas] = useState<RespostaMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    Promise.all([
      api.lojas({ ativas: true, operacionais: true }),
      api.usuarios(),
      api.checklist(),
    ])
      .then(([l, u, c]) => {
        setLojas(l);
        setUsuarios(u);
        setChecklist(c);
        if (l[0]) setIdLoja(l[0].id_loja);
        if (u[0]) setIdUsuario(u[0].id_usuario);
      })
      .catch((e) => setMsg(e.message))
      .finally(() => setLoading(false));
  }, []);

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
      setMsg(`Visita #${v.id_visita} iniciada`);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const setResposta = (idPergunta: number, val: RespostaInput['resposta'] | null) => {
    if (!val) return;
    setRespostas((prev) => ({ ...prev, [idPergunta]: val }));
  };

  const salvar = async (finalizar: boolean) => {
    if (!visitaId) {
      setMsg('Inicie a visita antes de responder');
      return;
    }
    const lista: RespostaInput[] = [];
    for (const cat of checklist) {
      for (const p of cat.perguntas) {
        const r = respostas[p.id_pergunta];
        if (p.obrigatoria && !r) {
          setMsg(`Responda: ${p.texto.slice(0, 50)}...`);
          return;
        }
        if (r) lista.push({ id_pergunta: p.id_pergunta, resposta: r });
      }
    }
    setSaving(true);
    setMsg('');
    try {
      await api.salvarRespostas(visitaId, lista);
      if (finalizar) {
        await api.finalizarVisita(visitaId, { duracao_minutos: 90 });
        navigate(`/relatorio/visita/${visitaId}`);
      } else {
        setMsg('Rascunho salvo');
      }
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LinearProgress />;
  const lojaSel = lojas.find((l) => l.id_loja === idLoja);

  return (
    <Box>
      {msg && (
        <Alert severity={msg.includes('erro') || msg.includes('Erro') ? 'error' : 'info'} sx={{ mb: 2 }}>
          {msg}
        </Alert>
      )}

      <Paper className="p-4 mb-4 flex flex-wrap gap-4 items-end justify-between">
        <Box className="flex flex-wrap gap-3">
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Loja</InputLabel>
            <Select
              label="Loja"
              value={idLoja}
              onChange={(e) => setIdLoja(Number(e.target.value))}
              disabled={!!visitaId}
            >
              {lojas.map((l) => (
                <MenuItem key={l.id_loja} value={l.id_loja}>
                  {l.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Auditor</InputLabel>
            <Select
              label="Auditor"
              value={idUsuario}
              onChange={(e) => setIdUsuario(Number(e.target.value))}
              disabled={!!visitaId}
            >
              {usuarios.map((u) => (
                <MenuItem key={u.id_usuario} value={u.id_usuario}>
                  {u.nome}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
        {!visitaId ? (
          <Button variant="contained" onClick={iniciarVisita} disabled={saving}>
            Iniciar visita
          </Button>
        ) : (
          <Box className="flex gap-2">
            <Button variant="outlined" onClick={() => salvar(false)} disabled={saving}>
              Salvar rascunho
            </Button>
            <Button variant="contained" onClick={() => salvar(true)} disabled={saving}>
              Finalizar visita
            </Button>
          </Box>
        )}
      </Paper>

      {lojaSel && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {lojaSel.name} · BKN {lojaSel.bk_number}
          {visitaId && ` · Visita #${visitaId}`}
        </Typography>
      )}

      {checklist.map((cat) => (
        <Paper key={cat.id_categoria} className="mb-3 overflow-hidden">
          <Box sx={{ bgcolor: 'secondary.main', color: 'white', px: 2, py: 1 }}>
            <Typography variant="subtitle2">{cat.nome}</Typography>
          </Box>
          {cat.perguntas.map((p) => (
            <Box
              key={p.id_pergunta}
              className="flex items-center justify-between gap-4 px-4 py-3 border-b border-gray-100 last:border-0"
            >
              <Typography variant="body2" className="flex-1">
                {p.texto}
              </Typography>
              <ToggleButtonGroup
                exclusive
                size="small"
                value={respostas[p.id_pergunta] || ''}
                onChange={(_, v) => setResposta(p.id_pergunta, v)}
                disabled={!visitaId}
              >
                <ToggleButton value="Sim" sx={{ '&.Mui-selected': { bgcolor: '#EAF3DE', color: '#3B6D11' } }}>
                  Sim
                </ToggleButton>
                <ToggleButton value="Não" sx={{ '&.Mui-selected': { bgcolor: '#FCEBEB', color: '#A32D2D' } }}>
                  Não
                </ToggleButton>
                <ToggleButton value="N/A" sx={{ '&.Mui-selected': { bgcolor: '#E8EBF5', color: '#1B2A6B' } }}>
                  N/A
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>
          ))}
        </Paper>
      ))}
    </Box>
  );
}
