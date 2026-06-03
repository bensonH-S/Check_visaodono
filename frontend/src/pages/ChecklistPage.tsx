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
import Chip from '@mui/material/Chip';
import Rating from '@mui/material/Rating';
import TextField from '@mui/material/TextField';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import StarIcon from '@mui/icons-material/Star';
import WarningIcon from '@mui/icons-material/Warning';
import { api } from '../api/client';
import type { CategoriaChecklist, Loja, Usuario, Pergunta, RespostaInput } from '../api/client';

interface RespostaLocal {
  resposta?: 'Sim' | 'Não' | 'N/A';
  nota_estrelas?: number;
  foto_url?: string;
  observacao?: string;
}

function usaEstrelas(p: Pergunta) {
  return p.tipo_resposta === 'estrelas' || p.tipo_resposta === 'estrelas_foto';
}

function usaSimNao(p: Pergunta) {
  return p.tipo_resposta === 'sim_nao' || p.tipo_resposta === 'sim_nao_foto';
}

function isRespondida(p: Pergunta, r?: RespostaLocal) {
  if (!r) return false;
  if (usaEstrelas(p) && !r.nota_estrelas) return false;
  if (usaSimNao(p) && !r.resposta) return false;
  if (p.requer_foto && !r.foto_url) return false;
  if (r.resposta === 'Não' && p.requer_obs_em_nao && !r.observacao?.trim()) return false;
  return true;
}

export default function ChecklistPage() {
  const navigate = useNavigate();
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [checklist, setChecklist] = useState<CategoriaChecklist[]>([]);
  const [idLoja, setIdLoja] = useState<number | ''>('');
  const [idUsuario, setIdUsuario] = useState<number | ''>('');
  const [visitaId, setVisitaId] = useState<number | null>(null);
  const [respostas, setRespostas] = useState<Record<number, RespostaLocal>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const totalPerguntas = checklist.reduce((n, c) => n + c.perguntas.length, 0);
  const comFoto = checklist.reduce(
    (n, c) => n + c.perguntas.filter((p) => p.requer_foto).length,
    0
  );
  const comEstrelas = checklist.reduce(
    (n, c) => n + c.perguntas.filter((p) => usaEstrelas(p)).length,
    0
  );

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

  const patchResposta = (id: number, patch: Partial<RespostaLocal>) => {
    setRespostas((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const handleFoto = (id: number, file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => patchResposta(id, { foto_url: reader.result as string });
    reader.readAsDataURL(file);
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
      setRespostas({});
      setMsg(`Visita #${v.id_visita} iniciada — ${totalPerguntas} perguntas`);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setSaving(false);
    }
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
        if (p.obrigatoria && !isRespondida(p, r)) {
          setMsg(`Complete a pergunta ${p.codigo}: ${p.texto.slice(0, 60)}...`);
          return;
        }
        if (!r || (!r.resposta && !r.nota_estrelas)) continue;
        lista.push({
          id_pergunta: p.id_pergunta,
          resposta: r.resposta ?? null,
          nota_estrelas: r.nota_estrelas ?? null,
          observacao: r.observacao,
          foto_url: r.foto_url ?? null,
        });
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

      <Paper className="p-4 mb-3">
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
          Checklist Visão de Dono
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {totalPerguntas} perguntas · {checklist.length} seções · {comFoto} com foto · {comEstrelas}{' '}
          com estrelas
        </Typography>
        <Box className="flex flex-wrap gap-2">
          <Chip size="small" icon={<CameraAltIcon />} label="Foto obrigatória" variant="outlined" />
          <Chip size="small" icon={<StarIcon />} label="Avaliar 1–5 estrelas" variant="outlined" />
          <Chip size="small" label="Sim / Não" variant="outlined" />
          <Chip size="small" icon={<WarningIcon />} label="Crítico" color="error" variant="outlined" />
        </Box>
      </Paper>

      <Paper className="p-4 mb-4 flex flex-wrap gap-4 items-end justify-between">
        <Box className="flex flex-wrap gap-3">
          <FormControl size="small" sx={{ minWidth: 220 }}>
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

      {checklist.map((cat, idx) => (
        <Paper key={cat.id_categoria} className="mb-3 overflow-hidden">
          <Box sx={{ bgcolor: 'secondary.main', color: 'white', px: 2, py: 1.25 }}>
            <Typography variant="subtitle2">
              {idx + 1}. {cat.nome}
            </Typography>
          </Box>
          {cat.perguntas.map((p) => {
            const r = respostas[p.id_pergunta];
            return (
              <Box
                key={p.id_pergunta}
                className="px-4 py-3 border-b border-gray-100 last:border-0"
              >
                <Box className="flex flex-wrap items-start gap-2 mb-2">
                  <Chip label={p.codigo} size="small" sx={{ fontWeight: 600 }} />
                  {p.critica && <Chip label="Crítico" size="small" color="error" />}
                  {p.requer_foto && (
                    <Chip label="Foto" size="small" icon={<CameraAltIcon />} variant="outlined" />
                  )}
                  {usaEstrelas(p) && (
                    <Chip label="1–5" size="small" icon={<StarIcon />} variant="outlined" />
                  )}
                </Box>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  {p.texto}
                </Typography>
                <Box className="flex flex-col gap-2 items-start">
                  {usaEstrelas(p) && (
                    <Rating
                      value={r?.nota_estrelas ?? 0}
                      onChange={(_, v) => patchResposta(p.id_pergunta, { nota_estrelas: v || undefined })}
                      disabled={!visitaId}
                      size="large"
                    />
                  )}
                  {usaSimNao(p) && (
                    <ToggleButtonGroup
                      exclusive
                      size="small"
                      value={r?.resposta || ''}
                      onChange={(_, v) => patchResposta(p.id_pergunta, { resposta: v || undefined })}
                      disabled={!visitaId}
                    >
                      <ToggleButton value="Sim" sx={{ '&.Mui-selected': { bgcolor: '#EAF3DE', color: '#3B6D11' } }}>
                        Sim
                      </ToggleButton>
                      <ToggleButton value="Não" sx={{ '&.Mui-selected': { bgcolor: '#FCEBEB', color: '#A32D2D' } }}>
                        Não
                      </ToggleButton>
                    </ToggleButtonGroup>
                  )}
                  {p.requer_foto && (
                    <Box className="flex items-center gap-2 flex-wrap">
                      <Button
                        component="label"
                        size="small"
                        variant="outlined"
                        startIcon={<CameraAltIcon />}
                        disabled={!visitaId}
                      >
                        {r?.foto_url ? 'Trocar foto' : 'Anexar foto'}
                        <input
                          type="file"
                          accept="image/*"
                          hidden
                          onChange={(e) => handleFoto(p.id_pergunta, e.target.files?.[0] || null)}
                        />
                      </Button>
                      {r?.foto_url && (
                        <Box
                          component="img"
                          src={r.foto_url}
                          alt="Evidência"
                          sx={{ height: 48, borderRadius: 1, border: '1px solid #ddd' }}
                        />
                      )}
                    </Box>
                  )}
                  {r?.resposta === 'Não' && p.requer_obs_em_nao && (
                    <TextField
                      size="small"
                      fullWidth
                      label="Observação (obrigatória em Não)"
                      value={r.observacao || ''}
                      onChange={(e) => patchResposta(p.id_pergunta, { observacao: e.target.value })}
                      disabled={!visitaId}
                    />
                  )}
                </Box>
              </Box>
            );
          })}
        </Paper>
      ))}
    </Box>
  );
}
