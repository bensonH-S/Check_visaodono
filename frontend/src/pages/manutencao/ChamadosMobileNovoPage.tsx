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
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import PhotoCaptureMulti from '../../components/checklist/PhotoCaptureMulti';
import { api } from '../../api/client';
import type { ManutFormulario, ManutLoja } from '../../api/client';import {
  getUsuario,
  temPermissao,
  ehGestorLojaMobile,
  deveEscolherLojaNovoChamadoMobile,
} from '../../lib/auth';
import { urgenciaChip } from '../../utils/manutencaoUi';
import { extensaoMidia } from '../../utils/mediaFile';
import { useChamadosMobileLoja } from '../../context/ChamadosMobileLojaContext';
import { selectMenuScrollProps } from '../../utils/selectMenuScroll';

const ROTA_LISTA = '/chamados/mobile';
const CACHE_KEY = 'manut_formulario_mobile_v1';
const ORANGE = '#E8520A';
const NAVY = '#1B2A6B';

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(',');
  const mime = meta.match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
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
  const [expandido, setExpandido] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const multiplas = lojas.length > 1;
  const lojaAtual = lojas.find((l) => l.id_loja === idLoja) ?? lojas[0];
  const nomeExibido = lojaAtual?.nome ?? 'Selecione a loja';

  useEffect(() => {
    if (!expandido) return;
    function fecharFora(e: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setExpandido(false);
      }
    }
    document.addEventListener('mousedown', fecharFora);
    document.addEventListener('touchstart', fecharFora);
    return () => {
      document.removeEventListener('mousedown', fecharFora);
      document.removeEventListener('touchstart', fecharFora);
    };
  }, [expandido]);

  if (!lojas.length) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1.25, pt: 1.25, borderTop: '1px solid rgba(27, 42, 107, 0.08)' }}>
        Nenhuma loja disponível
      </Typography>
    );
  }

  return (
    <Box
      ref={containerRef}
      sx={{
        position: 'relative',
        mt: 1.25,
        pt: 1.25,
        borderTop: '1px solid rgba(27, 42, 107, 0.08)',
        zIndex: expandido ? 40 : 'auto',
      }}
    >
      <Box
        role={multiplas ? 'button' : undefined}
        tabIndex={multiplas ? 0 : undefined}
        onClick={() => multiplas && setExpandido((v) => !v)}
        onKeyDown={(e) => {
          if (multiplas && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            setExpandido((v) => !v);
          }
        }}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          minWidth: 0,
          minHeight: 24,
          cursor: multiplas ? 'pointer' : 'default',
          borderRadius: 1.5,
          py: 0.35,
          px: 0.25,
          mx: -0.25,
          bgcolor: multiplas && expandido ? 'rgba(27, 42, 107, 0.05)' : 'transparent',
          '&:hover': multiplas ? { bgcolor: 'rgba(27, 42, 107, 0.05)' } : undefined,
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
        {multiplas && (
          <UnfoldMoreIcon
            sx={{
              fontSize: 18,
              color: 'text.secondary',
              flexShrink: 0,
              transform: expandido ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.15s ease',
            }}
          />
        )}
      </Box>

      {multiplas && expandido && (
        <Box
          sx={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            mt: 0.5,
            zIndex: 50,
            borderRadius: 2,
            border: '1px solid rgba(27, 42, 107, 0.15)',
            bgcolor: '#fff',
            maxHeight: 280,
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            boxShadow: '0 8px 24px rgba(27, 42, 107, 0.18)',
          }}
        >
          {lojas.map((loja) => {
            const ativa = loja.id_loja === idLoja;
            return (
              <Box
                key={loja.id_loja}
                role="button"
                tabIndex={0}
                onClick={() => {
                  onSelecionar(loja.id_loja);
                  setExpandido(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelecionar(loja.id_loja);
                    setExpandido(false);
                  }
                }}
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 1,
                  px: 1.5,
                  py: 1.15,
                  minHeight: 44,
                  cursor: 'pointer',
                  bgcolor: ativa ? 'rgba(232, 82, 10, 0.08)' : 'transparent',
                  borderBottom: '1px solid rgba(27, 42, 107, 0.08)',
                  '&:last-child': { borderBottom: 'none' },
                  '&:hover': { bgcolor: ativa ? 'rgba(232, 82, 10, 0.12)' : 'rgba(27, 42, 107, 0.04)' },
                }}
              >
                <LocationOnOutlinedIcon
                  sx={{
                    fontSize: 18,
                    color: ativa ? ORANGE : 'text.secondary',
                    flexShrink: 0,
                    mt: 0.1,
                  }}
                />
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: ativa ? 700 : 600,
                    color: ativa ? NAVY : 'text.secondary',
                    lineHeight: 1.35,
                    textAlign: 'left',
                    flex: 1,
                    minWidth: 0,
                    wordBreak: 'break-word',
                  }}
                >
                  {loja.nome}
                </Typography>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}

export default function ChamadosMobileNovoPage() {  const navigate = useNavigate();
  const sessao = getUsuario();
  const { idLoja: lojaSelecionada, setIdLoja: setLojaContexto } = useChamadosMobileLoja();
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

    const acessoTodas = temPermissao('lojas.todas', usuario);
    const escolherLoja = deveEscolherLojaNovoChamadoMobile(usuario);
    const gestorLoja = ehGestorLojaMobile(usuario);

    api
      .manutFormulario()
      .then((f) => {
        if (!ativo) return;
        setForm(f);
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(f));
        if (gestorLoja && !acessoTodas) {
          const lojaCtx =
            lojaSelecionada && f.lojas.some((l) => l.id_loja === lojaSelecionada)
              ? lojaSelecionada
              : usuario.lojas?.[0]?.id_loja;
          const lojaId =
            lojaCtx && f.lojas.some((l) => l.id_loja === lojaCtx)
              ? lojaCtx
              : f.lojas[0]?.id_loja;
          if (lojaId) setIdLoja(lojaId);
        } else if (!escolherLoja && lojaSelecionada && f.lojas.some((l) => l.id_loja === lojaSelecionada)) {
          setIdLoja(lojaSelecionada);
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
  }, [navigate, lojaSelecionada]);

  const cat = form?.categorias.find((c) => c.id_categoria === idCategoria);
  const lojasDisponiveis = form?.lojas ?? [];
  const descricaoCompleta = Boolean(
    idLoja && idCategoria && titulo.trim().length > 0 && descricao.trim().length >= 10,
  );
  const etapaAtiva = descricaoCompleta ? 1 : 0;
  const podeEnviar = descricaoCompleta && fotos.length > 0;

  useEffect(() => {
    if (lojasDisponiveis.length === 1 && !idLoja) {
      const unica = lojasDisponiveis[0].id_loja;
      setIdLoja(unica);
      setLojaContexto(unica);
    }
  }, [lojasDisponiveis, idLoja, setLojaContexto]);

  useEffect(() => {
    if (!descricaoCompleta && fotos.length) setFotos([]);
  }, [descricaoCompleta, fotos.length]);

  function selecionarLoja(lojaId: number) {
    setIdLoja(lojaId);
    setLojaContexto(lojaId);
  }

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
            gap: 0.75,
            minWidth: 0,
            minHeight: 24,
          }}
        >
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

        {lojasDisponiveis.length > 0 && (
          <SeletorLojaNovoChamado
            lojas={lojasDisponiveis}
            idLoja={idLoja}
            onSelecionar={selecionarLoja}
          />
        )}
      </Paper>

      <Paper sx={{ p: 2, mb: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Stepper activeStep={etapaAtiva} alternativeLabel sx={{ mb: 0.5 }}>
          <Step>
            <StepLabel>Descrição</StepLabel>
          </Step>
          <Step>
            <StepLabel>Fotos</StepLabel>
          </Step>
        </Stepper>

        {form && form.categorias.length > 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <TextField
              select
              label="Categoria"
              required
              size="small"
              value={idCategoria}
              onChange={(e) => {
                const v = e.target.value;
                setIdCategoria(v ? Number(v) : '');
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

        <TextField
          label="Título"
          required
          fullWidth
          size="small"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          slotProps={{ input: { style: { fontSize: 16 } } }}
        />

        <TextField
          label="Local do ocorrido"
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

        {descricaoCompleta && (
          <Box sx={{ pt: 0.5 }}>
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

        {!descricaoCompleta && (
          <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
            Preencha categoria, título e descrição (mín. 10 caracteres) para liberar as fotos.
          </Typography>
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
