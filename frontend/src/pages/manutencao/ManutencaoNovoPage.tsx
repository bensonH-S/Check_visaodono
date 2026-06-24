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

import InputAdornment from '@mui/material/InputAdornment';

import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

import PhotoCaptureMulti from '../../components/checklist/PhotoCaptureMulti';

import { api } from '../../api/client';

import type { ManutFormulario } from '../../api/client';

import { getUsuario, temPermissao } from '../../lib/auth';

import { urgenciaChip } from '../../utils/manutencaoUi';
import { extensaoMidia } from '../../utils/mediaFile';



const CACHE_KEY = 'manut_formulario_v1';

const ORANGE = '#E8520A';



function dataUrlToBlob(dataUrl: string): Blob {

  const [meta, b64] = dataUrl.split(',');

  const mime = meta.match(/:(.*?);/)?.[1] || 'image/jpeg';

  const bin = atob(b64);

  const arr = new Uint8Array(bin.length);

  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);

  return new Blob([arr], { type: mime });

}



function LojaCampo({

  form,

  idLoja,

  lojaFixa,

  onChange,

}: {

  form: ManutFormulario;

  idLoja: number | '';

  lojaFixa: boolean;

  onChange: (id: number | '') => void;

}) {

  const lojaNome = form.lojas.find((l) => l.id_loja === idLoja)?.nome;



  if (lojaFixa) {

    return (

      <Paper variant="outlined" sx={{ p: 1.5 }}>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>

          <LocationOnOutlinedIcon sx={{ fontSize: 20, color: ORANGE, flexShrink: 0 }} />

          <Box sx={{ minWidth: 0 }}>

            <Typography variant="caption" color="text.secondary">

              Loja

            </Typography>

            <Typography variant="body2" sx={{ fontWeight: 600 }}>

              {lojaNome}

            </Typography>

          </Box>

        </Box>

      </Paper>

    );

  }



  return (

    <TextField

      select

      label="Loja"

      required

      fullWidth

      size="small"

      value={idLoja}

      onChange={(e) => {

        const v = e.target.value;

        onChange(v ? Number(v) : '');

      }}

      slotProps={{

        inputLabel: { shrink: true },

        input: {

          startAdornment: (

            <InputAdornment position="start">

              <LocationOnOutlinedIcon sx={{ fontSize: 20, color: ORANGE }} />

            </InputAdornment>

          ),

        },

        select: {

          displayEmpty: true,

          renderValue: (selected: unknown) => {

            if (selected === '' || selected == null) {

              return (

                <Typography component="span" variant="body2" color="text.secondary">

                  Selecione a Loja

                </Typography>

              );

            }

            return lojaNome ?? '';

          },

        },

      }}

    >

      <MenuItem value="">

        <em>Selecione a Loja</em>

      </MenuItem>

      {form.lojas.map((l) => (

        <MenuItem key={l.id_loja} value={l.id_loja}>

          {l.nome}

        </MenuItem>

      ))}

    </TextField>

  );

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

  useEffect(() => {

    const usuario = getUsuario();

    if (!usuario || !temPermissao('chamados.abrir', usuario)) {

      navigate('/chamados', { replace: true });

      return;

    }



    let ativo = true;



    const cached = sessionStorage.getItem(CACHE_KEY);

    if (cached) {

      try {

        const data = JSON.parse(cached) as ManutFormulario;

        if (ativo) {

          setForm(data);

          setLoading(false);

        }

      } catch {

        /* ignore */

      }

    }



    const acessoTodas = temPermissao('lojas.todas', usuario);

    const lojaUnicaUsuario =

      !acessoTodas && usuario.lojas?.length === 1 ? usuario.lojas[0].id_loja : null;



    api

      .manutFormulario()

      .then((f) => {

        if (!ativo) return;

        setForm(f);

        sessionStorage.setItem(CACHE_KEY, JSON.stringify(f));

        if (lojaUnicaUsuario) {

          const lojaId =

            f.lojas.find((l) => l.id_loja === lojaUnicaUsuario)?.id_loja ?? f.lojas[0]?.id_loja;

          if (lojaId) setIdLoja(lojaId);

        }

      })

      .catch((e) => {

        if (ativo) setErro(e instanceof Error ? e.message : 'Erro ao carregar formulário');

      })

      .finally(() => {

        if (ativo) setLoading(false);

      });



    return () => {

      ativo = false;

    };

  }, [navigate]);



  const cat = form?.categorias.find((c) => c.id_categoria === idCategoria);

  const acessoTodasLojas = sessao && temPermissao('lojas.todas', sessao);

  const lojaFixa = sessao && !acessoTodasLojas && (sessao.lojas?.length ?? 0) === 1;



  async function enviar(e: React.FormEvent) {

    e.preventDefault();

    setErro('');

    if (!sessao) return;

    if (!fotos.length) {

      setErro('Adicione pelo menos uma foto ou vídeo.');

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

        urgencia: cat?.urgencia_padrao || undefined,

      });



      const fd = new FormData();

      fotos.forEach((dataUrl, i) => {
        const blob = dataUrlToBlob(dataUrl);
        fd.append('fotos', blob, `anexo-${i}${extensaoMidia(blob)}`);
      });

      await api.manutEnviarFotos(chamado.id_chamado, fd, { notificar: false });

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

    <Box component="form" onSubmit={enviar} className="w-full max-w-lg md:max-w-none mx-auto md:mx-0">

      <Button
        type="button"
        size="small"
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate('/chamados')}
        sx={{ mb: 2 }}
      >
        Voltar
      </Button>

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

          Fotos e vídeos do problema *

        </Typography>

        <PhotoCaptureMulti
          fotos={fotos}
          onChange={setFotos}
          max={10}
          disabled={salvando}
          inlineActions
          hideCaption
        />

      </Paper>



      <Paper sx={{ p: 2, mb: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>

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

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>

            <TextField

              select

              label="Categoria"

              required

              fullWidth

              size="small"

              value={idCategoria}

              onChange={(e) => {

                const v = e.target.value;

                setIdCategoria(v ? Number(v) : '');

              }}

              slotProps={{

                inputLabel: { shrink: true },

                select: {

                  displayEmpty: true,

                  renderValue: (selected: unknown) => {

                    if (selected === '' || selected == null) {

                      return (

                        <Typography component="span" variant="body2" color="text.secondary">

                          Selecione uma categoria

                        </Typography>

                      );

                    }

                    const categoria = form.categorias.find((c) => c.id_categoria === Number(selected));

                    return categoria?.nome ?? '';

                  },

                },

              }}

              sx={{ flex: 1, minWidth: 160 }}

            >

              <MenuItem value="">

                <em>Selecione uma categoria</em>

              </MenuItem>

              {form.categorias.map((c) => (

                <MenuItem key={c.id_categoria} value={c.id_categoria}>

                  {c.nome}

                </MenuItem>

              ))}

            </TextField>

            {cat && <Box sx={{ flexShrink: 0 }}>{urgenciaChip(cat.urgencia_padrao)}</Box>}

          </Box>

        )}

        {form && form.lojas.length > 0 && (

          <LojaCampo

            form={form}

            idLoja={idLoja}

            lojaFixa={!!lojaFixa}

            onChange={setIdLoja}

          />

        )}



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


