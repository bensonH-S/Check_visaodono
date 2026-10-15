import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import StickyNote2OutlinedIcon from '@mui/icons-material/StickyNote2Outlined';
import { StickyNote } from 'lucide-react';
import { api, type TiNota } from '../api/client';
import { getUsuario, podeAbrirTicketTi, podeGerenciarTicketsTi } from '../lib/auth';
import { colors } from '../theme/tokens';
import { formatDataHoraBrasilia } from '../utils/dateBr';
import {
  finCampoSx,
  FIN_BORDER,
  FIN_MUTED,
  FIN_SURFACE,
  FIN_SURFACE_ALT,
  FIN_TEXT,
} from '../financeiro/temaFinanceiroEscuro';
import NotaEditor, { sanitizarNotaHtml } from './NotaEditor';

type Props = { variante?: 'portal' | 'icone' };

const MAX_COLAB = 2;

export default function AnotacoesTiDialog({ variante = 'portal' }: Props) {
  const user = getUsuario();
  const pode = podeAbrirTicketTi(user);
  const isTi = podeGerenciarTicketsTi(user);
  const [aberto, setAberto] = useState(false);
  const [notas, setNotas] = useState<TiNota[]>([]);
  const [notaAtivaId, setNotaAtivaId] = useState<number | null>(null);
  const [tituloDraft, setTituloDraft] = useState('');
  const [corpoDraft, setCorpoDraft] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  if (!pode) return null;

  const minhas = isTi ? notas.length : notas.filter((n) => n.id_usuario === user?.id_usuario).length;
  const podeCriar = isTi || minhas < MAX_COLAB;

  function selecionar(n: TiNota) {
    setNotaAtivaId(n.id_nota);
    setTituloDraft(n.titulo || '');
    setCorpoDraft(n.corpo || '');
  }

  async function abrir() {
    setErro('');
    try {
      const lista = await api.tiNotas();
      setNotas(lista);
      if (lista[0]) selecionar(lista[0]);
      else {
        setNotaAtivaId(null);
        setTituloDraft('');
        setCorpoDraft('');
      }
      setAberto(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao abrir anotações');
    }
  }

  async function salvar() {
    if (!notaAtivaId) return;
    setSalvando(true);
    setErro('');
    try {
      const n = await api.tiNotaSalvar(notaAtivaId, {
        titulo: tituloDraft.trim() || 'Sem título',
        corpo: sanitizarNotaHtml(corpoDraft),
      });
      setNotas((prev) => prev.map((x) => (x.id_nota === n.id_nota ? n : x)));
      selecionar(n);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  async function novaLista() {
    setErro('');
    try {
      const n = await api.tiNotaCriar({ titulo: `Lista ${notas.length + 1}` });
      setNotas((prev) => [...prev, n]);
      selecionar(n);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao criar lista');
    }
  }

  async function excluirLista(id: number) {
    if (!window.confirm('Excluir esta lista de anotações?')) return;
    setErro('');
    try {
      await api.tiNotaExcluir(id);
      const resto = notas.filter((n) => n.id_nota !== id);
      setNotas(resto);
      if (notaAtivaId === id) {
        if (resto[0]) selecionar(resto[0]);
        else {
          setNotaAtivaId(null);
          setTituloDraft('');
          setCorpoDraft('');
        }
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao excluir');
    }
  }

  const size = variante === 'portal' ? 20 : 18;

  return (
    <>
      <Tooltip title="Anotações">
        <IconButton
          size="small"
          aria-label="Anotações"
          onClick={() => void abrir()}
          sx={{
            color: colors.textSecondary,
            '&:hover': { color: colors.navy, bgcolor: colors.navyMuted },
          }}
        >
          <StickyNote size={size} strokeWidth={2} />
        </IconButton>
      </Tooltip>

      <Dialog
        open={aberto}
        onClose={() => setAberto(false)}
        maxWidth="lg"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              bgcolor: FIN_SURFACE_ALT,
              color: FIN_TEXT,
              height: { xs: '100%', md: '88vh' },
              maxHeight: '88vh',
              display: 'flex',
              flexDirection: 'column',
            },
          },
        }}
      >
        <DialogTitle sx={{ pb: 1, bgcolor: FIN_SURFACE, borderBottom: `1px solid ${FIN_BORDER}` }}>
          Anotações
          <Typography sx={{ fontSize: 12, color: FIN_MUTED, fontWeight: 400, mt: 0.25 }}>
            {isTi
              ? 'TI: todas as listas · negrito e marca-texto no editor'
              : `Até ${MAX_COLAB} listas · ${minhas}/${MAX_COLAB}`}
          </Typography>
        </DialogTitle>
        <DialogContent
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            gap: 0,
            p: '0 !important',
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              width: { xs: '100%', md: 220 },
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              borderRight: { md: `1px solid ${FIN_BORDER}` },
              bgcolor: FIN_SURFACE,
              p: 1.5,
              minHeight: 0,
            }}
          >
            <Button
              startIcon={<AddIcon />}
              variant="outlined"
              size="small"
              onClick={() => void novaLista()}
              disabled={!podeCriar}
              fullWidth
            >
              Nova lista
            </Button>
            {!podeCriar ? (
              <Typography sx={{ fontSize: 11, color: FIN_MUTED, px: 0.5 }}>
                Limite de {MAX_COLAB} anotações atingido.
              </Typography>
            ) : null}
            <Box sx={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              {notas.map((n) => {
                const ativa = n.id_nota === notaAtivaId;
                return (
                  <Box
                    key={n.id_nota}
                    onClick={() => selecionar(n)}
                    sx={{
                      p: 1.1,
                      borderRadius: 1.5,
                      cursor: 'pointer',
                      border: `1px solid ${ativa ? '#1B6EF3' : FIN_BORDER}`,
                      bgcolor: ativa ? 'rgba(27,110,243,0.08)' : FIN_SURFACE_ALT,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                    }}
                  >
                    <StickyNote2OutlinedIcon sx={{ fontSize: 16, color: FIN_MUTED, flexShrink: 0 }} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        sx={{
                          fontSize: 13,
                          fontWeight: 700,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {n.titulo || 'Sem título'}
                      </Typography>
                      <Typography sx={{ fontSize: 10.5, color: FIN_MUTED }} noWrap>
                        {isTi && n.dono_nome ? `${n.dono_nome} · ` : ''}
                        {formatDataHoraBrasilia(n.updated_at)}
                      </Typography>
                    </Box>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        void excluirLista(n.id_nota);
                      }}
                      sx={{ color: '#f87171' }}
                    >
                      <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Box>
                );
              })}
            </Box>
          </Box>

          <Box
            sx={{
              flex: 1,
              minWidth: 0,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 1.25,
              p: 2,
              overflow: 'hidden',
            }}
          >
            {notaAtivaId ? (
              <>
                <TextField
                  label="Título da lista"
                  fullWidth
                  value={tituloDraft}
                  onChange={(e) => setTituloDraft(e.target.value)}
                  sx={{ ...finCampoSx, flexShrink: 0, maxWidth: 760, alignSelf: 'center', width: '100%' }}
                />
                <Box sx={{ flex: 1, minHeight: 0, display: 'flex', justifyContent: 'center' }}>
                  <NotaEditor
                    key={notaAtivaId}
                    value={corpoDraft}
                    onChange={setCorpoDraft}
                    placeholder={'Ex.:\n1. Login\n2. Permissões\n3. Senha\n\nSelecione um trecho e use Negrito ou Marcar.'}
                  />
                </Box>
              </>
            ) : (
              <Typography sx={{ color: FIN_MUTED, mt: 6, textAlign: 'center' }}>
                Crie uma lista para começar a anotar.
              </Typography>
            )}
            {erro ? (
              <Typography sx={{ color: '#f87171', fontSize: 13 }}>{erro}</Typography>
            ) : null}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 2.5, py: 1.5, bgcolor: FIN_SURFACE, borderTop: `1px solid ${FIN_BORDER}` }}>
          <Button onClick={() => setAberto(false)}>Fechar</Button>
          <Button variant="contained" disabled={salvando || !notaAtivaId} onClick={() => void salvar()}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
