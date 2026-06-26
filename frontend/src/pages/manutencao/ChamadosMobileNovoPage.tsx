import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import LinearProgress from '@mui/material/LinearProgress';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import PhotoCaptureMulti from '../../components/checklist/PhotoCaptureMulti';
import { api } from '../../api/client';
import type { ManutFormulario, ManutLoja } from '../../api/client';
import {
  getUsuario,
  temPermissao,
} from '../../lib/auth';
import { urgenciaChip } from '../../utils/manutencaoUi';
import { extensaoMidia } from '../../utils/mediaFile';
import { useChamadosMobileLoja } from '../../context/ChamadosMobileLojaContext';
import { selectMenuScrollProps } from '../../utils/selectMenuScroll';

const ROTA_LISTA = '/chamados/mobile';
const CACHE_KEY = 'manut_formulario_mobile_v1';
const ORANGE = '#E8520A';
const NAVY = '#1B2A6B';

const campoFormularioProps = {
  size: 'small' as const,
  fullWidth: true,
  slotProps: {
    inputLabel: {
      shrink: true,
      sx: {
        whiteSpace: 'nowrap',
        maxWidth: 'calc(133% - 24px)',
      },
    },
    input: { style: { fontSize: 16 } },
  },
  sx: {
    '& .MuiInputLabel-root.MuiInputLabel-shrink': {
      transform: 'translate(14px, -9px) scale(0.75)',
    },
    '& .MuiOutlinedInput-input': {
      py: 1.1,
    },
  },
};

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(',');
  const mime = meta.match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function IndicadorEtapasNovoChamado({ etapaAtiva }: { etapaAtiva: 0 | 1 }) {
  const passos = ['Descrição', 'Fotos'] as const;

  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', py: 0.5 }}>
      {passos.map((label, i) => (
        <Box key={label} sx={{ display: 'flex', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.45, minWidth: 76 }}>
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                bgcolor: etapaAtiva === i || etapaAtiva > i ? ORANGE : 'rgba(27, 42, 107, 0.2)',
                boxShadow: etapaAtiva === i ? '0 0 0 3px rgba(232, 82, 10, 0.22)' : 'none',
                transition: 'background-color 0.2s ease, box-shadow 0.2s ease',
              }}
            />
            <Typography
              variant="caption"
              sx={{
                fontSize: '0.68rem',
                fontWeight: etapaAtiva === i ? 700 : 500,
                color: etapaAtiva === i ? NAVY : etapaAtiva > i ? ORANGE : 'text.secondary',
                lineHeight: 1.2,
              }}
            >
              {label}
            </Typography>
          </Box>
          {i < passos.length - 1 && (
            <Box
              sx={{
                width: 56,
                height: 2,
                mx: 0.5,
                mt: 0.45,
                borderRadius: 1,
                bgcolor: etapaAtiva > i ? ORANGE : 'rgba(27, 42, 107, 0.12)',
              }}
            />
          )}
        </Box>
      ))}
    </Box>
  );
}

function SeletorLojaNovoChamado({
  lojas,
  idLoja,
  onSelecionar,
}: {
  lojas: ManutLoja[];
  idLoja: number | '';
  onSelecionar: (id: number) => void;
}) {
  const [dialogAberto, setDialogAberto] = useState(false);
  const multiplas = lojas.length > 1;
  const lojaAtual = lojas.find((l) => Number(l.id_loja) === Number(idLoja));
  const nomeExibido = lojaAtual?.nome ?? (multiplas ? 'Selecione a Loja' : lojas[0]?.nome ?? '—');

  if (!lojas.length) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1.25, pt: 1.25, borderTop: '1px solid rgba(27, 42, 107, 0.08)' }}>
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
        <LocationOnOutlinedIcon sx={{ fontSize: 20, color: ORANGE, flexShrink: 0, display: 'block' }} />
        <Typography
          component="div"
          variant="body2"
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            minWidth: 0,
            flex: 1,
            lineHeight: 1.25,
          }}
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
            const ativa = Number(loja.id_loja) === Number(idLoja);
            return (
              <ListItemButton
                key={loja.id_loja}
                selected={ativa}
                onClick={() => {
                  onSelecionar(loja.id_loja);
                  setDialogAberto(false);
                }}
                sx={{
                  py: 1.25,
                  '&.Mui-selected': { bgcolor: 'rgba(232, 82, 10, 0.08)' },
                }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <LocationOnOutlinedIcon sx={{ fontSize: 20, color: ORANGE }} />
                </ListItemIcon>
                <ListItemText
                  primary={loja.nome}
                  primaryTypographyProps={{
                    fontWeight: ativa ? 700 : 600,
                    color: ativa ? NAVY : 'text.primary',
                    fontSize: '0.9rem',
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

export default function ChamadosMobileNovoPage() {
  const navigate = useNavigate();
  const sessao = getUsuario();
  const { setIdLoja: setLojaContexto } = useChamadosMobileLoja();
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
  const fotosRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const usuario = getUsuario();
    if (!usuario || !temPermissao('chamados.abrir', usuario)) {
      navigate(ROTA_LISTA, { replace: true });
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

    api
      .manutFormulario()
      .then((f) => {
        if (!ativo) return;
        setForm(f);
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(f));
        if (f.lojas.length === 1) {
          setIdLoja(f.lojas[0].id_loja);
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

  const cat = form?.categorias.find((c) => Number(c.id_categoria) === Number(idCategoria));
  const lojasDisponiveis = form?.lojas ?? [];
  const categoriaOk = !form?.categorias?.length || (idCategoria !== '' && idCategoria != null);
  const podeAnexarFotos = Boolean(
    categoriaOk && titulo.trim().length > 0 && descricao.trim().length > 0,
  );
  const descricaoValidaEnvio = descricao.trim().length >= 10;
  const descricaoCompleta = Boolean(idLoja && categoriaOk && titulo.trim().length > 0 && descricaoValidaEnvio);
  const etapaAtiva: 0 | 1 = podeAnexarFotos ? 1 : 0;
  const podeEnviar = descricaoCompleta && fotos.length > 0;

  useEffect(() => {
    if (lojasDisponiveis.length === 1 && !idLoja) {
      const unica = lojasDisponiveis[0].id_loja;
      setIdLoja(unica);
      setLojaContexto(unica);
    }
  }, [lojasDisponiveis, idLoja, setLojaContexto]);

  useEffect(() => {
    if (!podeAnexarFotos && fotos.length) setFotos([]);
  }, [podeAnexarFotos, fotos.length]);

  useEffect(() => {
    if (podeAnexarFotos && fotosRef.current) {
      fotosRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [podeAnexarFotos]);

  function selecionarLoja(lojaId: number) {
    setIdLoja(lojaId);
    setLojaContexto(lojaId);
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    if (!sessao) return;
    if (!idLoja) {
      setErro('Selecione a loja antes de abrir o chamado.');
      return;
    }
    if (!fotos.length) {
      setErro('Adicione pelo menos uma foto ou vídeo.');
      return;
    }
    if (!titulo.trim() || !descricaoValidaEnvio || !idCategoria || !idLoja) {
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
      sessionStorage.setItem('chamado_criado_numero', String(chamado.numero));
      navigate(ROTA_LISTA, { state: { chamadoCriado: chamado.numero } });
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
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            minWidth: 0,
            minHeight: 24,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0, flex: 1 }}>
            <PersonOutlineOutlinedIcon
              sx={{
                fontSize: 20,
                color: NAVY,
                opacity: 0.75,
                flexShrink: 0,
                display: 'block',
              }}
            />
            <Typography
              component="div"
              variant="body2"
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                minWidth: 0,
                lineHeight: 1.25,
              }}
            >
              <Box component="span" sx={{ color: 'text.secondary', fontWeight: 500, flexShrink: 0 }}>
                Solicitante:
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
                {sessao?.nome}
              </Box>
            </Typography>
          </Box>
          {cat && <Box sx={{ flexShrink: 0 }}>{urgenciaChip(cat.urgencia_padrao)}</Box>}
        </Box>

        {lojasDisponiveis.length > 0 && (
          <SeletorLojaNovoChamado
            lojas={lojasDisponiveis}
            idLoja={idLoja}
            onSelecionar={selecionarLoja}
          />
        )}
      </Paper>

      <Paper sx={{ p: 2, mb: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <IndicadorEtapasNovoChamado etapaAtiva={etapaAtiva} />

        {form && form.categorias.length > 0 && (
          <TextField
            select
            label="Categoria"
            required
            fullWidth
            size="small"
            value={idCategoria === '' ? '' : String(idCategoria)}
            onChange={(e) => {
              const v = e.target.value;
              setIdCategoria(v === '' ? '' : Number(v));
            }}
            slotProps={{
              inputLabel: { shrink: true },
              select: {
                ...selectMenuScrollProps,
                displayEmpty: true,
                renderValue: (selected: unknown) => {
                  if (selected === '' || selected == null) {
                    return (
                      <Typography component="span" variant="body2" color="text.secondary">
                        Selecione uma categoria
                      </Typography>
                    );
                  }
                  const categoria = form.categorias.find(
                    (c) => String(c.id_categoria) === String(selected),
                  );
                  return categoria?.nome ?? '';
                },
              },
            }}
          >
            <MenuItem value="">
              <em>Selecione uma categoria</em>
            </MenuItem>
            {form.categorias.map((c) => (
              <MenuItem key={c.id_categoria} value={String(c.id_categoria)}>
                {c.nome}
              </MenuItem>
            ))}
          </TextField>
        )}

        <TextField
          label="Título"
          required
          {...campoFormularioProps}
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
        />

        <TextField
          label="Local do ocorrido"
          {...campoFormularioProps}
          value={local}
          onChange={(e) => setLocal(e.target.value)}
        />

        <TextField
          label="Descrição"
          required
          {...campoFormularioProps}
          multiline
          minRows={4}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          sx={{
            ...campoFormularioProps.sx,
            '& .MuiOutlinedInput-input': {
              py: 1.25,
            },
          }}
        />

        {podeAnexarFotos && (
          <Box ref={fotosRef} sx={{ pt: 0.5 }}>
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
          </Box>
        )}

      </Paper>

      {erro && <Alert severity="error" sx={{ mb: 2 }}>{erro}</Alert>}

      <Box className="flex gap-2 pt-2 pb-2">
        <Button
          type="button"
          fullWidth
          variant="outlined"
          disabled={salvando}
          onClick={() => navigate(ROTA_LISTA)}
        >
          Cancelar
        </Button>
        <Button fullWidth type="submit" variant="contained" disabled={salvando || !podeEnviar}>
          {salvando ? 'Enviando...' : 'Abrir chamado'}
        </Button>
      </Box>
    </Box>
  );
}
