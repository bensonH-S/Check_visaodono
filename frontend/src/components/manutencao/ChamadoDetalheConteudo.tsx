import { useCallback, useEffect, useRef, useState } from 'react';
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
import DialogActions from '@mui/material/DialogActions';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Close';
import ReplayIcon from '@mui/icons-material/Replay';
import SendIcon from '@mui/icons-material/Send';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined';
import PhotoLibraryOutlinedIcon from '@mui/icons-material/PhotoLibraryOutlined';
import RequestQuoteOutlinedIcon from '@mui/icons-material/RequestQuoteOutlined';
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined';
import ThumbUpAltOutlinedIcon from '@mui/icons-material/ThumbUpAltOutlined';
import PhotoCaptureMulti from '../checklist/PhotoCaptureMulti';
import OrcamentoAnexosInput from './OrcamentoAnexosInput';
import ChamadoTimeline from './ChamadoTimeline';
import ChamadoDetalheHeader from './ChamadoDetalheHeader';
import ChamadoAnexosGaleria from './ChamadoAnexosGaleria';
import DetalheSecao from './DetalheSecao';
import { api, type ManutChamadoDetalhe, type Cargo } from '../../api/client';
import { getUsuario, temPermissao, chamadoPodeAssumirMobile } from '../../lib/auth';
import { extensaoMidia } from '../../utils/mediaFile';
import { chamadoEncerrado, destinoPermiteCargoAprovacao } from '../../utils/manutencaoUi';
import { useToast } from '../../hooks/useToast';
import { dispararAtualizacaoNotificacoes } from '../../utils/notificacoesEvent';
import { detalheChamadoSx } from '../../utils/responsiveLayout';
import { MOBILE_SCROLL_AREA } from '../../theme/safeArea';

const NAVY = '#1B2A6B';
const ABERTOS = new Set(['aberto', 'em_atendimento', 'em_aprovacao', 'aprovado']);

const tituloModalSx = {
  display: 'flex',
  alignItems: 'center',
  gap: 1,
  fontWeight: 800,
  color: NAVY,
  fontSize: '1rem',
  py: 1.5,
};

const selectAprovadorSx = {
  flex: '1 1 140px',
  maxWidth: 220,
  minWidth: 0,
  '& .MuiInputLabel-root': {
    fontSize: '0.8rem',
    fontWeight: 600,
    bgcolor: 'background.paper',
    px: 0.5,
  },
  '& .MuiOutlinedInput-root': {
    fontSize: '0.875rem',
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

type Props = {
  idChamado: number;
  onDetalheCarregado?: (detalhe: ManutChamadoDetalhe) => void;
  onVoltar?: () => void;
  voltarLabel?: string;
  /** Mobile: sem orçamento, encerramento nem aprovação */
  variante?: 'desktop' | 'mobile';
  /** Página de aprovações: só visualização + botão aprovar */
  modoAprovacao?: boolean;
  permitirEncerrar?: boolean;
};

export default function ChamadoDetalheConteudo({
  idChamado,
  onDetalheCarregado,
  onVoltar,
  voltarLabel,
  variante = 'desktop',
  modoAprovacao = false,
  permitirEncerrar = true,
}: Props) {
  const sessao = getUsuario();
  const isMobile = variante === 'mobile';
  const [detalhe, setDetalhe] = useState<ManutChamadoDetalhe | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [novaInfo, setNovaInfo] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [fotosNovas, setFotosNovas] = useState<string[]>([]);
  const [enviandoFotos, setEnviandoFotos] = useState(false);
  const [obsEncerramento, setObsEncerramento] = useState('');
  const [obsReabertura, setObsReabertura] = useState('');
  const [finalizando, setFinalizando] = useState(false);
  const [reabrindo, setReabrindo] = useState(false);
  const [dialogCancelar, setDialogCancelar] = useState(false);
  const [obsOrcamento, setObsOrcamento] = useState('');
  const [anexosOrcamento, setAnexosOrcamento] = useState<string[]>([]);
  const [cargosAprovador, setCargosAprovador] = useState<Cargo[]>([]);
  const [destinoAprovacao, setDestinoAprovacao] = useState('');
  const [enviandoAprovacao, setEnviandoAprovacao] = useState(false);
  const [aprovando, setAprovando] = useState(false);
  const [assumindo, setAssumindo] = useState(false);
  const [acaoDialog, setAcaoDialog] = useState<
    'orcamento' | 'encerrar' | 'reabrir' | 'anexos' | 'aprovar' | null
  >(null);
  const { showToast, ToastSnackbar } = useToast();
  const enviandoRef = useRef(false);

  useEffect(() => {
    api
      .cargos({ aprovador: true })
      .then((lista) => setCargosAprovador(lista))
      .catch(() => setCargosAprovador([]));
  }, []);

  useEffect(() => {
    setDestinoAprovacao('');
    setAnexosOrcamento([]);
    setObsOrcamento('');
  }, [idChamado]);

  const carregar = useCallback(() => {
    if (!Number.isFinite(idChamado)) return;
    setLoading(true);
    api
      .manutChamadoDetalhe(idChamado)
      .then((d) => {
        setDetalhe(d);
        onDetalheCarregado?.(d);
      })
      .catch((e) => setErro(e instanceof Error ? e.message : 'Erro ao carregar'))
      .finally(() => setLoading(false));
  }, [idChamado, onDetalheCarregado]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    if (!Number.isFinite(idChamado) || modoAprovacao) return;
    api.manutNotificacoesMarcarChamadoLidas(idChamado).then(() => {
      dispararAtualizacaoNotificacoes();
    }).catch(() => {});
  }, [idChamado, modoAprovacao]);

  const encerrado = detalhe ? chamadoEncerrado(detalhe.status) : false;
  const podeAssumir = Boolean(
    !modoAprovacao && detalhe && sessao && chamadoPodeAssumirMobile(detalhe, sessao),
  );

  const rotuloAssumir =
    detalhe?.status === 'em_atendimento' && detalhe.id_tecnico
      ? 'Assumir chamado'
      : 'Assumir ticket';

  const podeEditar =
    !modoAprovacao &&
    !isMobile &&
    detalhe &&
    detalhe.status === 'em_atendimento' &&
    sessao &&
    (temPermissao('chamados.abrir', sessao) ||
      temPermissao('chamados.ver', sessao) ||
      temPermissao('chamados.assumir', sessao));

  const podeEditarMobile =
    isMobile &&
    !modoAprovacao &&
    detalhe &&
    ABERTOS.has(detalhe.status) &&
    sessao &&
    (temPermissao('chamados.abrir', sessao) ||
      temPermissao('chamados.ver', sessao) ||
      temPermissao('chamados.assumir', sessao));

  const podeGerir =
    sessao &&
    (temPermissao('chamados.assumir', sessao) || temPermissao('chamados.ver', sessao));

  const podeEnviarAprovacao =
    !modoAprovacao &&
    !isMobile &&
    permitirEncerrar &&
    podeGerir &&
    detalhe &&
    detalhe.status === 'em_atendimento';

  const podeAprovar =
    modoAprovacao &&
    sessao &&
    temPermissao('chamados.aprovar', sessao) &&
    detalhe?.status === 'em_aprovacao' &&
    !!sessao.cargo_aprovacao &&
    destinoPermiteCargoAprovacao(detalhe.aprovacao_destino, sessao.cargo_aprovacao);

  const podeFinalizar =
    !modoAprovacao &&
    permitirEncerrar &&
    detalhe &&
    podeGerir &&
    (detalhe.status === 'em_atendimento' ||
      (detalhe.tipo_chamado === 'orcamento' && detalhe.status === 'aprovado'));

  const podeReabrir =
    !modoAprovacao &&
    permitirEncerrar &&
    encerrado &&
    detalhe &&
    sessao &&
    (temPermissao('chamados.assumir', sessao) || temPermissao('chamados.ver', sessao));

  async function assumirChamado() {
    if (!detalhe || assumindo) return;
    setAssumindo(true);
    setErro('');
    try {
      await api.manutAssumirChamado(detalhe.id_chamado);
      showToast('Ticket assumido!');
      dispararAtualizacaoNotificacoes();
      carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao assumir chamado');
    } finally {
      setAssumindo(false);
    }
  }

  async function enviarAnexos(dataUrls: string[]) {
    if (!detalhe || !dataUrls.length) return;
    const fd = new FormData();
    dataUrls.forEach((dataUrl, i) => {
      const blob = dataUrlToBlob(dataUrl);
      fd.append('fotos', blob, `orcamento-${i}${extensaoMidia(blob)}`);
    });
    await api.manutEnviarFotos(detalhe.id_chamado, fd);
  }

  async function enviarAtualizacao() {
    if (!detalhe || !novaInfo.trim() || enviandoRef.current) return;
    enviandoRef.current = true;
    setSalvando(true);
    setErro('');
    try {
      await api.manutAdicionarAtualizacao(detalhe.id_chamado, novaInfo.trim());
      setNovaInfo('');
      showToast('Mensagem enviada!');
      dispararAtualizacaoNotificacoes();
      carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      enviandoRef.current = false;
      setSalvando(false);
    }
  }

  async function finalizarChamado(status: 'concluido' | 'cancelado') {
    if (!detalhe || finalizando) return;
    setFinalizando(true);
    setErro('');
    try {
      await api.manutFinalizarChamado(
        detalhe.id_chamado,
        status,
        obsEncerramento.trim() || undefined,
      );
      setObsEncerramento('');
      setDialogCancelar(false);
      setAcaoDialog(null);
      showToast(status === 'concluido' ? 'Chamado concluído!' : 'Chamado cancelado.');
      dispararAtualizacaoNotificacoes();
      carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao encerrar chamado');
    } finally {
      setFinalizando(false);
    }
  }

  async function enviarParaAprovacao() {
    if (!detalhe || enviandoAprovacao) return;
    setEnviandoAprovacao(true);
    setErro('');
    try {
      if (anexosOrcamento.length) {
        await enviarAnexos(anexosOrcamento);
        setAnexosOrcamento([]);
      }
      const res = await api.manutEnviarAprovacao(
        detalhe.id_chamado,
        obsOrcamento.trim() || undefined,
        destinoAprovacao,
      );
      setObsOrcamento('');
      setDestinoAprovacao('');
      const nomeDestino =
        cargosAprovador.find((c) => c.codigo === destinoAprovacao)?.nome || 'aprovador';
      showToast(
        res.aviso
          ? `Enviado para ${nomeDestino}. ${res.aviso}`
          : `Enviado para aprovação do ${nomeDestino}!`,
      );
      dispararAtualizacaoNotificacoes();
      setAcaoDialog(null);
      carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao enviar para aprovação');
    } finally {
      setEnviandoAprovacao(false);
    }
  }

  async function aprovarOrcamento() {
    if (!detalhe || aprovando) return;
    setAprovando(true);
    setErro('');
    try {
      await api.manutAprovarChamado(detalhe.id_chamado, obsOrcamento.trim() || undefined);
      setObsOrcamento('');
      showToast('Orçamento aprovado! O chamado pode seguir para execução.');
      dispararAtualizacaoNotificacoes();
      setAcaoDialog(null);
      carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao aprovar orçamento');
    } finally {
      setAprovando(false);
    }
  }

  async function reabrirChamado() {
    if (!detalhe || reabrindo) return;
    setReabrindo(true);
    setErro('');
    try {
      await api.manutReabrirChamado(detalhe.id_chamado, obsReabertura.trim() || undefined);
      setObsReabertura('');
      setAcaoDialog(null);
      showToast('Chamado reaberto!');
      dispararAtualizacaoNotificacoes();
      carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao reabrir chamado');
    } finally {
      setReabrindo(false);
    }
  }

  async function enviarFotos() {
    if (!detalhe || !fotosNovas.length) return;
    setEnviandoFotos(true);
    setErro('');
    try {
      await enviarAnexos(fotosNovas);
      setFotosNovas([]);
      setAcaoDialog(null);
      dispararAtualizacaoNotificacoes();
      carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao enviar fotos');
    } finally {
      setEnviandoFotos(false);
    }
  }

  if (loading && !detalhe) {
    return (
      <Box
        sx={{
          ...(isMobile ? detalheChamadoSx('mobile') : {}),
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          flex: 1,
          py: 8,
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!detalhe) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {erro || 'Chamado não encontrado'}
      </Alert>
    );
  }

  if (modoAprovacao && detalhe.status !== 'em_aprovacao') {
    return (
      <Alert severity="info" sx={{ mb: 2 }}>
        Este chamado não está aguardando aprovação de orçamento.
      </Alert>
    );
  }

  const temAcoes =
    podeReabrir ||
    podeEnviarAprovacao ||
    podeAprovar ||
    podeEditar ||
    podeEditarMobile ||
    podeFinalizar;

  const temBarraSecundaria =
    podeEnviarAprovacao || podeAprovar || podeFinalizar || podeReabrir;

  function fecharAcaoDialog() {
    if (!enviandoAprovacao && !finalizando && !reabrindo && !aprovando && !enviandoFotos) {
      setAcaoDialog(null);
    }
  }

  const headerChamado = (
    <ChamadoDetalheHeader
      detalhe={detalhe}
      variante={variante}
      onVoltar={onVoltar}
      voltarLabel={voltarLabel}
      podeAssumir={podeAssumir}
      assumindo={assumindo}
      onAssumir={assumirChamado}
      rotuloAssumir={rotuloAssumir}
    />
  );

  const corpoAposHeader = (
    <>
      {encerrado && !modoAprovacao && (
        <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
          Este chamado está encerrado e não aceita novas informações até ser reaberto.
        </Alert>
      )}

      {podeAprovar && (
        <Alert
          severity="success"
          sx={{ mb: 2, borderRadius: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => setAcaoDialog('aprovar')}>
              Revisar e aprovar
            </Button>
          }
        >
          Orçamento aguardando sua aprovação.
        </Alert>
      )}

      {!isMobile && !modoAprovacao && (
        <DetalheSecao
          titulo="Anexos"
          icone={<PhotoLibraryOutlinedIcon sx={{ fontSize: 18, color: NAVY }} />}
        >
          <ChamadoAnexosGaleria anexos={detalhe.anexos} tamanhoMiniatura={64} />
        </DetalheSecao>
      )}

      <DetalheSecao
        titulo="Histórico do chamado"
        icone={<ScheduleOutlinedIcon sx={{ fontSize: 18, color: NAVY }} />}
        semPadding
      >
        <ChamadoTimeline detalhe={detalhe} variante={isMobile ? 'mobile' : 'desktop'} />
      </DetalheSecao>

      {temAcoes && (
        <Paper
          elevation={0}
          sx={{
            mt: 2,
            p: 2,
            borderRadius: 2,
            border: '1px solid rgba(27, 42, 107, 0.1)',
            bgcolor: '#fff',
            boxShadow: '0 1px 6px rgba(27, 42, 107, 0.06)',
          }}
        >
          {(podeEditar || podeEditarMobile) && (
            <Box>
              <TextField
                placeholder={
                  isMobile
                    ? 'Adicione uma mensagem para o técnico...'
                    : 'Escreva uma resposta para o solicitante ou equipe...'
                }
                multiline
                minRows={2}
                maxRows={6}
                fullWidth
                size="small"
                value={novaInfo}
                onChange={(e) => setNovaInfo(e.target.value)}
                slotProps={{ input: { style: { fontSize: 16 } } }}
                sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'rgba(27, 42, 107, 0.02)' } }}
              />
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1.25, justifyContent: 'flex-end' }}>
                <Button
                  size="small"
                  startIcon={<AttachFileOutlinedIcon />}
                  onClick={() => setAcaoDialog('anexos')}
                >
                  Anexar
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<SendIcon />}
                  disabled={salvando || novaInfo.trim().length < 3}
                  onClick={enviarAtualizacao}
                >
                  {salvando ? 'Enviando...' : 'Enviar'}
                </Button>
              </Box>
            </Box>
          )}

          {temBarraSecundaria && (
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 1,
                mt: podeEditar || podeEditarMobile ? 2 : 0,
                pt: podeEditar || podeEditarMobile ? 2 : 0,
                borderTop: podeEditar || podeEditarMobile ? '1px solid rgba(27, 42, 107, 0.08)' : 'none',
              }}
            >
              {podeEnviarAprovacao && (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<RequestQuoteOutlinedIcon />}
                  onClick={() => setAcaoDialog('orcamento')}
                >
                  Pedir aprovação
                </Button>
              )}
              {podeFinalizar && (
                <>
                  <Button
                    size="small"
                    variant="contained"
                    color="success"
                    startIcon={<TaskAltOutlinedIcon />}
                    onClick={() => setAcaoDialog('encerrar')}
                  >
                    Concluir
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    startIcon={<CloseIcon />}
                    onClick={() => setDialogCancelar(true)}
                  >
                    Cancelar
                  </Button>
                </>
              )}
              {podeReabrir && (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<ReplayIcon />}
                  onClick={() => setAcaoDialog('reabrir')}
                >
                  Reabrir
                </Button>
              )}
            </Box>
          )}
        </Paper>
      )}

      {erro && (
        <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }}>
          {erro}
        </Alert>
      )}
    </>
  );

  return (
    <>
    <Box sx={detalheChamadoSx(variante)}>
      {isMobile ? (
        <>
          <Box sx={{ flexShrink: 0 }}>{headerChamado}</Box>
          <Box sx={{ ...MOBILE_SCROLL_AREA, pt: 0.5 }}>{corpoAposHeader}</Box>
        </>
      ) : (
        <>
          {headerChamado}
          {corpoAposHeader}
        </>
      )}
    </Box>

      <Dialog
        open={acaoDialog === 'orcamento'}
        onClose={fecharAcaoDialog}
        maxWidth={false}
        slotProps={{ paper: { sx: { width: '100%', maxWidth: 400, mx: 2 } } }}
      >
        <DialogTitle sx={tituloModalSx}>
          <RequestQuoteOutlinedIcon sx={{ fontSize: 20, color: NAVY }} />
          Pedir aprovação de orçamento
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.75, pt: 0.5 }}>
          <TextField
            label="Observação (opcional)"
            multiline
            minRows={2}
            fullWidth
            size="small"
            value={obsOrcamento}
            onChange={(e) => setObsOrcamento(e.target.value)}
            placeholder="Valores, fornecedor ou detalhes"
            slotProps={{ input: { style: { fontSize: 16 } } }}
          />
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25, alignItems: 'flex-end' }}>
            <FormControl size="small" sx={selectAprovadorSx}>
              <InputLabel id="destino-aprovacao-label" shrink>
                Aprovador
              </InputLabel>
              <Select
                labelId="destino-aprovacao-label"
                label="Aprovador"
                value={destinoAprovacao}
                onChange={(e) => setDestinoAprovacao(e.target.value)}
                disabled={enviandoAprovacao || !cargosAprovador.length}
                displayEmpty
                renderValue={(v) => {
                  if (!v) return <Typography variant="body2" color="text.secondary">Selecione</Typography>;
                  return cargosAprovador.find((c) => c.codigo === v)?.nome ?? v;
                }}
              >
                <MenuItem value="" disabled>
                  Selecione
                </MenuItem>
                {cargosAprovador.map((c) => (
                  <MenuItem key={c.codigo} value={c.codigo}>
                    {c.nome}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <OrcamentoAnexosInput
              anexos={anexosOrcamento}
              onChange={setAnexosOrcamento}
              disabled={enviandoAprovacao}
              inline
            />
          </Box>
          {!cargosAprovador.length && (
            <Alert severity="warning">Cadastre cargos aprovadores em Configurações → Cargos.</Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={fecharAcaoDialog} disabled={enviandoAprovacao}>
            Voltar
          </Button>
          <Button
            variant="contained"
            startIcon={<SendIcon />}
            disabled={enviandoAprovacao || !destinoAprovacao}
            onClick={enviarParaAprovacao}
          >
            {enviandoAprovacao ? 'Enviando...' : 'Enviar para aprovação'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={acaoDialog === 'aprovar'} onClose={fecharAcaoDialog} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 800, color: NAVY }}>Aprovar orçamento</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Revise os anexos no histórico antes de aprovar.
          </Typography>
          <TextField
            label="Observação (opcional)"
            multiline
            minRows={2}
            fullWidth
            size="small"
            value={obsOrcamento}
            onChange={(e) => setObsOrcamento(e.target.value)}
            slotProps={{ input: { style: { fontSize: 16 } } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={fecharAcaoDialog} disabled={aprovando}>
            Voltar
          </Button>
          <Button
            variant="contained"
            color="success"
            startIcon={<ThumbUpAltOutlinedIcon />}
            disabled={aprovando}
            onClick={aprovarOrcamento}
          >
            {aprovando ? 'Aprovando...' : 'Confirmar aprovação'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={acaoDialog === 'encerrar'} onClose={fecharAcaoDialog} fullWidth maxWidth="sm">
        <DialogTitle sx={tituloModalSx}>
          <TaskAltOutlinedIcon sx={{ fontSize: 20, color: '#166534' }} />
          Concluir chamado
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <TextField
            label="Observação final (opcional)"
            multiline
            minRows={2}
            fullWidth
            size="small"
            value={obsEncerramento}
            onChange={(e) => setObsEncerramento(e.target.value)}
            placeholder="Descreva o que foi realizado"
            slotProps={{ input: { style: { fontSize: 16 } } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={fecharAcaoDialog} disabled={finalizando}>
            Voltar
          </Button>
          <Button
            variant="contained"
            color="success"
            startIcon={<CheckCircleIcon />}
            disabled={finalizando}
            onClick={() => finalizarChamado('concluido')}
          >
            {finalizando ? 'Concluindo...' : 'Confirmar conclusão'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={acaoDialog === 'reabrir'} onClose={fecharAcaoDialog} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 800, color: NAVY }}>Reabrir chamado</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <TextField
            label="Motivo (opcional)"
            multiline
            minRows={2}
            fullWidth
            size="small"
            value={obsReabertura}
            onChange={(e) => setObsReabertura(e.target.value)}
            slotProps={{ input: { style: { fontSize: 16 } } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={fecharAcaoDialog} disabled={reabrindo}>
            Voltar
          </Button>
          <Button
            variant="contained"
            startIcon={<ReplayIcon />}
            disabled={reabrindo}
            onClick={reabrirChamado}
          >
            {reabrindo ? 'Reabrindo...' : 'Reabrir chamado'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={acaoDialog === 'anexos'}
        onClose={fecharAcaoDialog}
        maxWidth={false}
        slotProps={{ paper: { sx: { width: '100%', maxWidth: 400, mx: 2 } } }}
      >
        <DialogTitle sx={tituloModalSx}>
          <AttachFileOutlinedIcon sx={{ fontSize: 20, color: NAVY }} />
          Anexar arquivos
        </DialogTitle>
        <DialogContent sx={{ pt: 0.5 }}>
          <PhotoCaptureMulti
            fotos={fotosNovas}
            onChange={setFotosNovas}
            max={10}
            disabled={enviandoFotos}
            inlineActions
            compactThumbs
            hideCaption
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={fecharAcaoDialog} disabled={enviandoFotos}>
            Voltar
          </Button>
          <Button
            variant="contained"
            disabled={enviandoFotos || fotosNovas.length === 0}
            onClick={enviarFotos}
          >
            {enviandoFotos ? 'Enviando...' : 'Enviar anexos'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dialogCancelar} onClose={() => !finalizando && setDialogCancelar(false)}>
        <DialogTitle>Cancelar chamado?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            O chamado #{detalhe.numero} será cancelado permanentemente.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogCancelar(false)} disabled={finalizando}>
            Voltar
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={finalizando}
            onClick={() => finalizarChamado('cancelado')}
          >
            {finalizando ? 'Cancelando...' : 'Confirmar cancelamento'}
          </Button>
        </DialogActions>
      </Dialog>

      <ToastSnackbar />
    </>
  );
}
