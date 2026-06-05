import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import LinearProgress from '@mui/material/LinearProgress';
import PhotoCaptureMulti from '../../components/checklist/PhotoCaptureMulti';
import { api } from '../../api/client';
import type { ManutFormulario } from '../../api/client';
import { getUsuario, temPermissao } from '../../lib/auth';

const CACHE_KEY = 'manut_formulario_v1';

const URGENCIAS = [
  { v: '', l: 'Padrão da categoria' },
  { v: 'baixa', l: 'Baixa' },
  { v: 'media', l: 'Média' },
  { v: 'alta', l: 'Alta' },
  { v: 'critica', l: 'Crítica' },
];

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(',');
  const mime = meta.match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export default function ManutencaoNovoPage() {
  const navigate = useNavigate();
  const sessao = getUsuario();
  const [form, setForm] = useState<ManutFormulario | null>(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [fotos, setFotos] = useState<string[]>([]);

  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [idCategoria, setIdCategoria] = useState<number | ''>('');
  const [idLoja, setIdLoja] = useState<number | ''>('');
  const [local, setLocal] = useState('');
  const [urgencia, setUrgencia] = useState('');

  useEffect(() => {
    if (!sessao || !temPermissao('chamados.abrir', sessao)) {
      navigate('/chamados', { replace: true });
      return;
    }

    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const data = JSON.parse(cached) as ManutFormulario;
        setForm(data);
        if (data.categorias[0]) setIdCategoria(data.categorias[0].id_categoria);
        if (data.lojas[0]) setIdLoja(data.lojas[0].id_loja);
        setLoading(false);
      } catch {
        /* ignore */
      }
    }

    api
      .manutFormulario()
      .then((f) => {
        setForm(f);
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(f));
        if (!idCategoria && f.categorias[0]) setIdCategoria(f.categorias[0].id_categoria);
        if (!idLoja && f.lojas.length === 1) setIdLoja(f.lojas[0].id_loja);
        else if (!idLoja && sessao.lojas?.length === 1) setIdLoja(sessao.lojas[0].id_loja);
      })
      .catch((e) => setErro(e.message))
      .finally(() => setLoading(false));
  }, [navigate, sessao]);

  const cat = form?.categorias.find((c) => c.id_categoria === idCategoria);
  const lojaFixa = sessao && !temPermissao('lojas.todas', sessao) && (form?.lojas?.length === 1);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    if (!sessao) return;
    if (!fotos.length) {
      setErro('Adicione pelo menos uma foto.');
      return;
    }
    if (!titulo.trim() || descricao.trim().length < 10 || !idCategoria || !idLoja) {
      setErro('Preencha título, descrição (mín. 10 caracteres), loja e categoria.');
      return;
    }

    setSalvando(true);
    try {
      const chamado = await api.manutCriarChamado({
        titulo: titulo.trim(),
        descricao: descricao.trim(),
        id_categoria: idCategoria,
        id_loja: idLoja,
        id_solicitante: sessao.id_usuario,
        local_detalhe: local.trim() || undefined,
        urgencia: urgencia || undefined,
      });

      const fd = new FormData();
      fotos.forEach((dataUrl, i) => {
        fd.append('fotos', dataUrlToBlob(dataUrl), `foto-${i}.jpg`);
      });
      await api.manutEnviarFotos(chamado.id_chamado, fd);
      sessionStorage.removeItem(CACHE_KEY);
      navigate('/chamados');
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao abrir chamado');
    } finally {
      setSalvando(false);
    }
  }

  if (loading && !form) {
    return (
      <Box>
        <LinearProgress />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
          Carregando...
        </Typography>
      </Box>
    );
  }

  return (
    <Box component="form" onSubmit={enviar} className="max-w-lg mx-auto w-full">
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="caption" color="text.secondary">
          Solicitante
        </Typography>
        <Typography variant="body1" sx={{ fontWeight: 600 }}>
          {sessao?.nome}
        </Typography>
      </Paper>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
          Fotos do problema *
        </Typography>
        <PhotoCaptureMulti fotos={fotos} onChange={setFotos} max={10} disabled={salvando} />
      </Paper>

      <Paper sx={{ p: 2, mb: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {cat && (
          <Alert severity="info" sx={{ py: 0.5 }}>
            {cat.nome} — SLA {cat.sla_horas}h
          </Alert>
        )}

        <TextField
          label="Título"
          required
          fullWidth
          size="small"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          slotProps={{ input: { style: { fontSize: 16 } } }}
        />

        {form && form.categorias.length > 0 && (
          <TextField
            select
            label="Categoria"
            required
            fullWidth
            size="small"
            value={idCategoria}
            onChange={(e) => setIdCategoria(Number(e.target.value))}
          >
            {form.categorias.map((c) => (
              <MenuItem key={c.id_categoria} value={c.id_categoria}>
                {c.nome} ({c.sla_horas}h)
              </MenuItem>
            ))}
          </TextField>
        )}

        {form && form.lojas.length > 0 && (
          lojaFixa ? (
            <Paper variant="outlined" sx={{ p: 1.5 }}>
              <Typography variant="caption" color="text.secondary">
                Loja
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {form.lojas.find((l) => l.id_loja === idLoja)?.nome}
              </Typography>
            </Paper>
          ) : (
            <TextField
              select
              label="Loja"
              required
              fullWidth
              size="small"
              value={idLoja}
              onChange={(e) => setIdLoja(Number(e.target.value))}
            >
              {form.lojas.map((l) => (
                <MenuItem key={l.id_loja} value={l.id_loja}>
                  {l.nome}
                </MenuItem>
              ))}
            </TextField>
          )
        )}

        <TextField
          select
          label="Urgência"
          fullWidth
          size="small"
          value={urgencia}
          onChange={(e) => setUrgencia(e.target.value)}
        >
          {URGENCIAS.map((u) => (
            <MenuItem key={u.v || 'p'} value={u.v}>
              {u.l}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          label="Local / detalhe"
          fullWidth
          size="small"
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          slotProps={{ input: { style: { fontSize: 16 } } }}
        />

        <TextField
          label="Descrição"
          required
          fullWidth
          multiline
          minRows={4}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          slotProps={{ input: { style: { fontSize: 16 } } }}
        />
      </Paper>

      {erro && <Alert severity="error" sx={{ mb: 2 }}>{erro}</Alert>}

      <Box className="flex gap-2 pt-2 pb-2">
        <Button fullWidth variant="outlined" disabled={salvando} onClick={() => navigate('/chamados')}>
          Cancelar
        </Button>
        <Button fullWidth type="submit" variant="contained" disabled={salvando}>
          {salvando ? 'Enviando...' : 'Abrir chamado'}
        </Button>
      </Box>
    </Box>
  );
}
