import { useCallback, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import CloseIcon from '@mui/icons-material/Close';
import DialogActions from '@mui/material/DialogActions';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import { api, fetchMediaAutenticada, type ManutAnexo, type ManutChamadoDetalhe, type Cargo } from '../../api/client';
import { getUsuario } from '../../lib/auth';
import { formatDataHoraBrasilia } from '../../utils/dateBr';
import { destinoAprovacaoChip, destinoPermiteCargoAprovacao, statusChip, urgenciaChip } from '../../utils/manutencaoUi';
import { useToast } from '../../hooks/useToast';
import { dispararAtualizacaoNotificacoes } from '../../utils/notificacoesEvent';

const NAVY = '#1B2A6B';

type TipoAnexo = 'imagem' | 'video' | 'pdf' | 'arquivo';

function tipoAnexo(mime: string): TipoAnexo {
  if (mime === 'application/pdf') return 'pdf';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('image/')) return 'imagem';
  return 'arquivo';
}

function labelTipo(tipo: TipoAnexo) {
  if (tipo === 'pdf') return 'PDF';
  if (tipo === 'video') return 'Vídeo';
  if (tipo === 'imagem') return 'Foto';
  return 'Arquivo';
}

function useAnexoUrl(mediaUrl: string) {
  const [src, setSrc] = useState<string | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let url: string | null = null;
    let ativo = true;
    setSrc(null);
    setErro(false);
    fetchMediaAutenticada(mediaUrl)
      .then((u) => {
        if (ativo) {
          url = u;
          setSrc(u);
        }
      })
      .catch(() => ativo && setErro(true));
    return () => {
      ativo = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [mediaUrl]);

  return { src, erro };
}

function AnexoQuadrado({
  anexo,
  onClick,
}: {
  anexo: ManutAnexo;
  onClick: () => void;
}) {
  const tipo = tipoAnexo(anexo.tipo_mime);
  const { src, erro } = useAnexoUrl(anexo.media_url);

  return (
    <Box
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick();
      }}
      sx={{
        aspectRatio: '1',
        borderRadius: 2,
        overflow: 'hidden',
        border: '1px solid rgba(27, 42, 107, 0.15)',
        bgcolor: '#f3f4f6',
        cursor: 'pointer',
        position: 'relative',
        transition: 'box-shadow 0.15s, transform 0.15s',
        '&:hover': { boxShadow: '0 4px 14px rgba(27, 42, 107, 0.18)', transform: 'scale(1.02)' },
        '&:focus-visible': { outline: `2px solid ${NAVY}`, outlineOffset: 2 },
      }}
    >
      {erro && (
        <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 1 }}>
          <Typography variant="caption" color="error" sx={{ textAlign: 'center' }}>
            Erro
          </Typography>
        </Box>
      )}

      {!erro && !src && (
        <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress size={24} />
        </Box>
      )}

      {!erro && src && tipo === 'imagem' && (
        <Box
          component="img"
          src={src}
          alt={anexo.nome_arquivo || 'Anexo'}
          sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      )}

      {!erro && src && tipo === 'video' && (
        <>
          <Box
            component="video"
            src={src}
            muted
            playsInline
            preload="metadata"
            sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', bgcolor: '#000' }}
          />
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'rgba(0,0,0,0.35)',
            }}
          >
            <PlayCircleIcon sx={{ fontSize: 40, color: '#fff' }} />
          </Box>
        </>
      )}

      {!erro && src && tipo === 'pdf' && (
        <Box
          sx={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.5,
            bgcolor: '#FEE2E2',
            p: 1,
          }}
        >
          <PictureAsPdfIcon sx={{ fontSize: 36, color: '#DC2626' }} />
          <Typography variant="caption" sx={{ fontWeight: 700, color: '#991B1B', textAlign: 'center', lineHeight: 1.2 }}>
            PDF
          </Typography>
        </Box>
      )}

      {!erro && src && tipo === 'arquivo' && (
        <Box
          sx={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.5,
            bgcolor: '#E5E7EB',
            p: 1,
          }}
        >
          <InsertDriveFileIcon sx={{ fontSize: 36, color: NAVY }} />
          <Typography variant="caption" sx={{ fontWeight: 700, color: NAVY, textAlign: 'center', lineHeight: 1.2 }}>
            Arquivo
          </Typography>
        </Box>
      )}

      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          px: 0.75,
          py: 0.5,
          bgcolor: 'rgba(0,0,0,0.55)',
        }}
      >
        <Typography
          variant="caption"
          sx={{
            color: '#fff',
            fontWeight: 600,
            fontSize: '0.65rem',
            display: 'block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {anexo.nome_arquivo || labelTipo(tipo)}
        </Typography>
      </Box>
    </Box>
  );
}

function AnexoModal({
  anexo,
  open,
  onClose,
}: {
  anexo: ManutAnexo | null;
  open: boolean;
  onClose: () => void;
}) {
  const { src, erro } = useAnexoUrl(anexo?.media_url ?? '');
  const tipo = anexo ? tipoAnexo(anexo.tipo_mime) : 'arquivo';

  return (
    <Dialog open={open} onClose={onClose} maxWidth={tipo === 'pdf' ? 'lg' : 'md'} fullWidth>
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          fontWeight: 700,
          color: NAVY,
          pr: 1,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography component="span" variant="subtitle1" sx={{ fontWeight: 700, display: 'block' }}>
            {anexo?.nome_arquivo || labelTipo(tipo)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {labelTipo(tipo)}
            {anexo?.created_at && ` · ${formatDataHoraBrasilia(anexo.created_at)}`}
          </Typography>
        </Box>
        <IconButton onClick={onClose} aria-label="Fechar">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ minHeight: 200, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {erro && <Alert severity="error">Não foi possível carregar este anexo.</Alert>}

        {!erro && !src && (
          <Box sx={{ py: 6 }}>
            <CircularProgress />
          </Box>
        )}

        {!erro && src && tipo === 'imagem' && (
          <Box
            component="img"
            src={src}
            alt={anexo?.nome_arquivo || 'Anexo'}
            sx={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: 1 }}
          />
        )}

        {!erro && src && tipo === 'video' && (
          <Box
            component="video"
            src={src}
            controls
            autoPlay
            sx={{ width: '100%', maxHeight: '70vh', borderRadius: 1, bgcolor: '#000' }}
          />
        )}

        {!erro && src && tipo === 'pdf' && (
          <Box
            component="iframe"
            src={src}
            title={anexo?.nome_arquivo || 'PDF do orçamento'}
            sx={{
              width: '100%',
              height: { xs: '60vh', sm: '72vh' },
              border: 'none',
              borderRadius: 1,
              bgcolor: '#f3f4f6',
            }}
          />
        )}

        {!erro && src && tipo === 'arquivo' && (
          <Box sx={{ width: '100%', textAlign: 'center', py: 2 }}>
            <InsertDriveFileIcon sx={{ fontSize: 64, color: NAVY, mb: 2 }} />
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Arquivo anexado ao orçamento
            </Typography>
            <Button component="a" href={src} target="_blank" rel="noopener noreferrer" variant="contained" download>
              Baixar arquivo
            </Button>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}

function GaleriaAnexosOrcamento({ anexos }: { anexos: ManutAnexo[] }) {
  const [modalAnexo, setModalAnexo] = useState<ManutAnexo | null>(null);

  if (!anexos.length) {
    return (
      <Typography variant="body2" color="text.secondary">
        Nenhum anexo enviado com este orçamento.
      </Typography>
    );
  }

  return (
    <>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(108px, 1fr))',
          gap: 1.5,
        }}
      >
        {anexos.map((a) => (
          <AnexoQuadrado key={a.id_anexo} anexo={a} onClick={() => setModalAnexo(a)} />
        ))}
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
        Toque no anexo para ver em tamanho maior.
      </Typography>
      <AnexoModal anexo={modalAnexo} open={modalAnexo != null} onClose={() => setModalAnexo(null)} />
    </>
  );
}

function textoSolicitacaoOrcamento(detalhe: ManutChamadoDetalhe): string {
  const evento = detalhe.eventos?.find((e) => e.tipo === 'envio_aprovacao');
  if (evento?.texto?.trim()) return evento.texto.trim();
  const ultima = [...(detalhe.atualizacoes || [])].reverse().find((a) => a.texto?.trim());
  if (ultima?.texto?.trim()) return ultima.texto.trim();
  return detalhe.descricao?.trim() || 'Sem descrição adicional do orçamento.';
}

function infoAprovacao(detalhe: ManutChamadoDetalhe) {
  const evento = detalhe.eventos?.find((e) => e.tipo === 'aprovacao');
  if (!evento) return null;
  return {
    texto: evento.texto?.trim() || 'Orçamento aprovado.',
    autor: evento.autor,
    quando: evento.created_at,
  };
}

const TEXTOS_PADRAO_AVALIACAO_DIRETOR = [
  'Aprovado pelo Diretor. Aguarda aprovação final do Financeiro.',
  'Aprovado pelo Diretor.',
];

function textoAvaliacaoDiretorExibicao(texto?: string | null) {
  if (!texto?.trim()) return '';
  let t = texto.trim();
  for (const padrao of TEXTOS_PADRAO_AVALIACAO_DIRETOR) {
    t = t.replace(padrao, '').trim();
  }
  return t.replace(/\n{3,}/g, '\n\n').trim();
}

function infoAprovacaoDiretor(detalhe: ManutChamadoDetalhe) {
  const evento = detalhe.eventos?.find((e) => e.tipo === 'aprovacao_diretor');
  if (!evento) return null;
  const texto = textoAvaliacaoDiretorExibicao(evento.texto);
  if (!texto) return null;
  return {
    texto,
    autor: evento.autor,
    quando: evento.created_at,
  };
}

type Props = {
  idChamado: number;
  onConcluido?: () => void;
};

export default function AprovacaoOrcamentoDetalhe({ idChamado, onConcluido }: Props) {
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [detalhe, setDetalhe] = useState<ManutChamadoDetalhe | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [obsAprovacao, setObsAprovacao] = useState('');
  const [processando, setProcessando] = useState(false);
  const [dialogRecusar, setDialogRecusar] = useState(false);
  const { showToast, ToastSnackbar } = useToast();

  const carregar = useCallback(() => {
    if (!Number.isFinite(idChamado)) return;
    setLoading(true);
    api
      .manutChamadoDetalhe(idChamado)
      .then(setDetalhe)
      .catch((e) => setErro(e instanceof Error ? e.message : 'Erro ao carregar'))
      .finally(() => setLoading(false));
  }, [idChamado]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    api.cargos().then(setCargos).catch(() => setCargos([]));
  }, []);

  async function aprovar(modo: 'definitivo' | 'devolver_financeiro' = 'definitivo') {
    if (!detalhe || processando) return;
    setProcessando(true);
    setErro('');
    try {
      await api.manutAprovarChamado(detalhe.id_chamado, obsAprovacao.trim() || undefined, modo);
      showToast(
        modo === 'devolver_financeiro'
          ? 'Aprovado pelo Diretor. Devolvido ao Financeiro para aprovação final.'
          : 'Orçamento aprovado!',
      );
      dispararAtualizacaoNotificacoes();
      setObsAprovacao('');
      onConcluido?.();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao aprovar');
    } finally {
      setProcessando(false);
    }
  }

  async function encaminharDiretor() {
    if (!detalhe || processando) return;
    setProcessando(true);
    setErro('');
    try {
      await api.manutEncaminharDiretor(detalhe.id_chamado, obsAprovacao.trim() || undefined);
      showToast('Encaminhado ao Diretor para avaliação.');
      dispararAtualizacaoNotificacoes();
      setObsAprovacao('');
      onConcluido?.();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao encaminhar ao Diretor');
    } finally {
      setProcessando(false);
    }
  }

  async function recusar() {
    if (!detalhe || processando) return;
    setProcessando(true);
    setErro('');
    setDialogRecusar(false);
    try {
      await api.manutRecusarOrcamento(detalhe.id_chamado, obsAprovacao.trim() || undefined);
      showToast('Orçamento não aprovado. Chamado voltou para em andamento.');
      dispararAtualizacaoNotificacoes();
      onConcluido?.();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao recusar orçamento');
    } finally {
      setProcessando(false);
    }
  }

  if (loading && !detalhe) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!detalhe) {
    return <Alert severity="error">{erro || 'Chamado não encontrado'}</Alert>;
  }

  const sessao = getUsuario();
  const pendente = detalhe.status === 'em_aprovacao';
  const aprovado = detalhe.status === 'aprovado';
  const podeDecidir =
    pendente &&
    !!sessao?.cargo_aprovacao &&
    destinoPermiteCargoAprovacao(detalhe.aprovacao_destino, sessao.cargo_aprovacao);
  const solicitacao = textoSolicitacaoOrcamento(detalhe);
  const aprovacao = infoAprovacao(detalhe);
  const aprovacaoDiretor = infoAprovacaoDiretor(detalhe);
  const cargoUsuario = sessao?.cargo_aprovacao || '';
  const ehFinanceiro = cargoUsuario === 'financeiro';
  const ehDiretor = cargoUsuario === 'diretor';
  const aguardaDiretor = detalhe.aprovacao_destino === 'diretor';
  const aguardaFinanceiroFinal =
    detalhe.aprovacao_destino === 'financeiro' && !!detalhe.aprovacao_diretor_ok;
  const financeiroPodeEncaminhar =
    ehFinanceiro && detalhe.aprovacao_destino === 'financeiro' && !detalhe.aprovacao_diretor_ok;

  if (!pendente && !aprovado) {
    return <Alert severity="info">Este chamado não faz parte do fluxo de aprovação de orçamento.</Alert>;
  }

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto', width: '100%' }}>
      <Paper sx={{ p: 2, mb: 2, borderRadius: 2, border: '1px solid rgba(27, 42, 107, 0.12)', borderTop: `3px solid ${NAVY}` }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap', mb: 1 }}>
          <Typography sx={{ fontWeight: 800, color: NAVY, fontSize: '1.15rem' }}>
            #{detalhe.numero} · {detalhe.titulo}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
            {statusChip(detalhe.status)}
            {urgenciaChip(detalhe.urgencia)}
            {destinoAprovacaoChip(detalhe.aprovacao_destino, cargos)}
          </Box>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
          {detalhe.categoria}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
          <LocationOnOutlinedIcon sx={{ fontSize: 18, color: '#E8520A' }} />
          <Typography variant="body2" sx={{ fontWeight: 600, color: NAVY }}>
            {detalhe.loja}
          </Typography>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          Solicitante: {detalhe.solicitante} · Aberto em {formatDataHoraBrasilia(detalhe.aberto_em || detalhe.prazo_sla)}
        </Typography>
      </Paper>

      <Paper sx={{ p: 2, mb: 2, borderRadius: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: NAVY, mb: 1 }}>
          O que está sendo solicitado
        </Typography>
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
          {solicitacao}
        </Typography>
      </Paper>

      <Paper sx={{ p: 2, mb: 2, borderRadius: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: NAVY, mb: 1.5 }}>
          Anexos do orçamento
        </Typography>
        <GaleriaAnexosOrcamento anexos={detalhe.anexos} />
      </Paper>

      {pendente && aprovacaoDiretor && (
        <Paper sx={{ p: 2, mb: 2, borderRadius: 2, bgcolor: 'rgba(30, 64, 175, 0.08)' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1E40AF', mb: 1 }}>
            Avaliação do Diretor
          </Typography>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mb: 0.5 }}>
            {aprovacaoDiretor.texto}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {aprovacaoDiretor.autor && `${aprovacaoDiretor.autor} · `}
            {formatDataHoraBrasilia(aprovacaoDiretor.quando)}
          </Typography>
        </Paper>
      )}

      {aprovado && aprovacao && (
        <Paper sx={{ p: 2, mb: 2, borderRadius: 2, bgcolor: 'rgba(20, 184, 166, 0.08)' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0F766E', mb: 1 }}>
            Aprovação registrada
          </Typography>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mb: 0.5 }}>
            {aprovacao.texto}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {aprovacao.autor && `${aprovacao.autor} · `}
            {formatDataHoraBrasilia(aprovacao.quando)}
          </Typography>
        </Paper>
      )}

      {podeDecidir && (
        <Paper sx={{ p: 2, mb: 2, borderRadius: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: NAVY }}>
            {ehDiretor
              ? 'Avaliação do Diretor'
              : aguardaFinanceiroFinal
                ? 'Aprovação final do Financeiro'
                : 'Sua aprovação'}
          </Typography>
          <TextField
            label="Observações (opcional)"
            multiline
            minRows={3}
            fullWidth
            size="small"
            value={obsAprovacao}
            onChange={(e) => setObsAprovacao(e.target.value)}
            placeholder="Valores autorizados, motivo da recusa ou outras observações"
            slotProps={{ input: { style: { fontSize: 16 } } }}
          />
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'row',
              flexWrap: 'nowrap',
              gap: 1,
              width: '100%',
              '& > .MuiButton-root': {
                flex: '1 1 0',
                minWidth: 0,
                fontSize: '0.78rem',
                px: 1,
                py: 0.85,
                whiteSpace: 'nowrap',
              },
            }}
          >
            {ehDiretor && aguardaDiretor && (
              <>
                <Button
                  variant="contained"
                  color="success"
                  size="small"
                  disabled={processando}
                  onClick={() => aprovar('definitivo')}
                >
                  {processando ? '...' : 'Aprovar definitivo'}
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  disabled={processando}
                  onClick={() => aprovar('devolver_financeiro')}
                  sx={{ bgcolor: '#1E40AF', '&:hover': { bgcolor: '#1D4ED8' } }}
                >
                  {processando ? '...' : 'Devolver ao Financeiro'}
                </Button>
              </>
            )}
            {ehFinanceiro && financeiroPodeEncaminhar && (
              <>
                <Button
                  variant="contained"
                  color="success"
                  size="small"
                  disabled={processando}
                  onClick={() => aprovar('definitivo')}
                >
                  {processando ? '...' : 'Aprovar orçamento'}
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  disabled={processando}
                  onClick={encaminharDiretor}
                  sx={{ borderColor: '#1E40AF', color: '#1E40AF' }}
                >
                  {processando ? '...' : 'Encaminhar ao Diretor'}
                </Button>
              </>
            )}
            {ehFinanceiro && aguardaFinanceiroFinal && (
              <Button
                variant="contained"
                color="success"
                size="small"
                disabled={processando}
                onClick={() => aprovar('definitivo')}
              >
                {processando ? '...' : 'Aprovar (final)'}
              </Button>
            )}
            {!ehDiretor && !ehFinanceiro && (
              <Button
                variant="contained"
                color="success"
                size="small"
                disabled={processando}
                onClick={() => aprovar('definitivo')}
              >
                {processando ? '...' : 'Aprovar orçamento'}
              </Button>
            )}
            <Button
              variant="outlined"
              color="error"
              size="small"
              disabled={processando}
              onClick={() => setDialogRecusar(true)}
            >
              Não aprovar
            </Button>
          </Box>
        </Paper>
      )}

      <Dialog open={dialogRecusar} onClose={() => !processando && setDialogRecusar(false)}>
        <DialogTitle>Não aprovar orçamento?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            O chamado #{detalhe.numero} voltará para <strong>Em andamento</strong> para a equipe de manutenção revisar o orçamento.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogRecusar(false)} disabled={processando}>
            Cancelar
          </Button>
          <Button color="error" variant="contained" disabled={processando} onClick={recusar}>
            {processando ? 'Recusando...' : 'Confirmar recusa'}
          </Button>
        </DialogActions>
      </Dialog>

      {erro && <Alert severity="error">{erro}</Alert>}
      <ToastSnackbar />
    </Box>
  );
}
