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
import ThumbUpAltOutlinedIcon from '@mui/icons-material/ThumbUpAltOutlined';
import PhotoCaptureMulti from '../checklist/PhotoCaptureMulti';
import OrcamentoAnexosInput from './OrcamentoAnexosInput';
import ChamadoTimeline from './ChamadoTimeline';
import { api, type ManutChamadoDetalhe, type Cargo } from '../../api/client';
import { getUsuario, temPermissao } from '../../lib/auth';
import { formatDataHoraBrasilia } from '../../utils/dateBr';
import { extensaoMidia } from '../../utils/mediaFile';
import { chamadoEncerrado, destinoPermiteCargoAprovacao, statusChip, tipoChamadoChip, urgenciaChip } from '../../utils/manutencaoUi';
import { useToast } from '../../hooks/useToast';
import { dispararAtualizacaoNotificacoes } from '../../utils/notificacoesEvent';

const NAVY = '#1B2A6B';
const ABERTOS = new Set(['aberto', 'em_atendimento', 'em_aprovacao', 'aprovado']);

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(',');
  const mime = meta.match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function MetaLinha({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      component="p"
      variant="caption"
      color="text.secondary"
      sx={{ m: 0, display: 'block', lineHeight: 1.5 }}
    >
      {children}
    </Typography>
  );
}

type Props = {
  idChamado: number;
  onDetalheCarregado?: (detalhe: ManutChamadoDetalhe) => void;
  /** Mobile: sem orçamento, encerramento nem aprovação */
  variante?: 'desktop' | 'mobile';
  /** Página de aprovações: só visualização + botão aprovar */
  modoAprovacao?: boolean;
  permitirEncerrar?: boolean;
};

export default function ChamadoDetalheConteudo({
  idChamado,
  onDetalheCarregado,
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
  const podeEditar =
    !modoAprovacao &&
    !isMobile &&
    detalhe &&
    ABERTOS.has(detalhe.status) &&
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
    ['aberto', 'em_atendimento'].includes(detalhe.status);

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
    ABERTOS.has(detalhe.status) &&
    podeGerir &&
    (detalhe.tipo_chamado !== 'orcamento' || detalhe.status === 'aprovado');

  const podeReabrir =
    !modoAprovacao &&
    permitirEncerrar &&
    encerrado &&
    detalhe &&
    sessao &&
    (temPermissao('chamados.assumir', sessao) || temPermissao('chamados.ver', sessao));

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
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
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

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto', width: '100%' }}>
      <Paper
        sx={{
          p: 2,
          mb: 2,
          borderRadius: 2,
          border: '1px solid rgba(27, 42, 107, 0.12)',
          borderTop: `3px solid ${NAVY}`,
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1, mb: 1 }}>
          <Typography sx={{ fontWeight: 800, color: NAVY, fontSize: '1.15rem' }}>
            #{detalhe.numero}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {statusChip(detalhe.status)}
            {detalhe.tipo_chamado === 'orcamento' && tipoChamadoChip('orcamento')}
            {urgenciaChip(detalhe.urgencia)}
          </Box>
        </Box>

        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.25, lineHeight: 1.3 }}>
          {detalhe.titulo}
        </Typography>

        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 0.5,
            py: 1,
            px: 1.25,
            borderRadius: 1.5,
            bgcolor: 'rgba(27, 42, 107, 0.04)',
          }}
        >
          <MetaLinha>Aberto em {formatDataHoraBrasilia(detalhe.aberto_em || detalhe.prazo_sla)}</MetaLinha>
          <MetaLinha>Prazo SLA {formatDataHoraBrasilia(detalhe.prazo_sla)}</MetaLinha>
          <MetaLinha>Solicitante: {detalhe.solicitante}</MetaLinha>
          {detalhe.tecnico && <MetaLinha>Técnico: {detalhe.tecnico}</MetaLinha>}
          {detalhe.local_detalhe && <MetaLinha>Local: {detalhe.local_detalhe}</MetaLinha>}
        </Box>
      </Paper>

      {encerrado && !modoAprovacao && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Este chamado está encerrado e não aceita novas informações até ser reaberto.
        </Alert>
      )}

      {podeReabrir && (
        <Paper sx={{ p: 2, mb: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: NAVY }}>
            Reabrir chamado
          </Typography>
          <TextField
            label="Motivo da reabertura (opcional)"
            multiline
            minRows={2}
            fullWidth
            size="small"
            value={obsReabertura}
            onChange={(e) => setObsReabertura(e.target.value)}
            placeholder="Informe o motivo da reabertura"
            slotProps={{ input: { style: { fontSize: 16 } } }}
          />
          <Button
            variant="contained"
            startIcon={<ReplayIcon />}
            disabled={reabrindo}
            onClick={reabrirChamado}
            sx={{ alignSelf: 'flex-start' }}
          >
            {reabrindo ? 'Reabrindo...' : 'Reabrir ticket'}
          </Button>
        </Paper>
      )}

      <Box sx={{ mb: 2 }}>
        <ChamadoTimeline detalhe={detalhe} variante={isMobile ? 'mobile' : 'desktop'} />
      </Box>

      {podeEnviarAprovacao && (
        <Paper sx={{ p: 2, mb: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: NAVY }}>
            Orçamento e aprovação
          </Typography>
          <TextField
            label="Observação do orçamento (opcional)"
            multiline
            minRows={2}
            fullWidth
            size="small"
            value={obsOrcamento}
            onChange={(e) => setObsOrcamento(e.target.value)}
            placeholder="Descreva valores, fornecedor ou detalhes do orçamento"
            slotProps={{ input: { style: { fontSize: 16 } } }}
          />
          <Typography variant="body2" color="text.secondary">
            Fotos do orçamento ou recibo em PDF (máx. 5)
          </Typography>
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 2,
              alignItems: 'center',
            }}
          >
            <FormControl size="small" sx={{ flex: '1 1 220px', minWidth: 200, maxWidth: 360 }}>
              <InputLabel id="destino-aprovacao-label" shrink={!!destinoAprovacao}>
                Selecione o aprovador
              </InputLabel>
              <Select
                labelId="destino-aprovacao-label"
                label="Selecione o aprovador"
                displayEmpty
                value={destinoAprovacao}
                onChange={(e) => setDestinoAprovacao(e.target.value)}
                disabled={enviandoAprovacao || !cargosAprovador.length}
                renderValue={(valor) => {
                  if (!valor) {
                    return (
                      <Typography component="span" variant="body2" color="text.secondary">
                        Selecione o aprovador
                      </Typography>
                    );
                  }
                  return cargosAprovador.find((c) => c.codigo === valor)?.nome || valor;
                }}
              >
                <MenuItem value="" disabled>
                  Selecione o aprovador
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
            <Alert severity="warning" sx={{ py: 0.5 }}>
              Cadastre cargos aprovadores em Configurações → Cargos.
            </Alert>
          )}
          <Button
            variant="contained"
            startIcon={<SendIcon />}
            disabled={enviandoAprovacao || !destinoAprovacao}
            onClick={enviarParaAprovacao}
            sx={{ alignSelf: 'flex-start' }}
          >
            {enviandoAprovacao ? 'Enviando...' : 'Pedir aprovação de orçamento'}
          </Button>
        </Paper>
      )}

      {podeAprovar && (
        <Paper sx={{ p: 2, mb: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: NAVY }}>
            Aprovar orçamento
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Revise os anexos na linha do tempo acima. Após aprovar, a equipe de manutenção dará continuidade ao chamado.
          </Typography>
          <TextField
            label="Observação da aprovação (opcional)"
            multiline
            minRows={2}
            fullWidth
            size="small"
            value={obsOrcamento}
            onChange={(e) => setObsOrcamento(e.target.value)}
            placeholder="Comentário para o financeiro ou manutenção"
            slotProps={{ input: { style: { fontSize: 16 } } }}
          />
          <Button
            variant="contained"
            color="success"
            startIcon={<ThumbUpAltOutlinedIcon />}
            disabled={aprovando}
            onClick={aprovarOrcamento}
            sx={{ alignSelf: 'flex-start' }}
          >
            {aprovando ? 'Aprovando...' : 'Aprovar orçamento'}
          </Button>
        </Paper>
      )}

      {podeEditar && (
        <Paper sx={{ p: 2, mb: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: NAVY }}>
            Responder
          </Typography>
          <TextField
            label="Sua mensagem"
            multiline
            minRows={3}
            fullWidth
            size="small"
            value={novaInfo}
            onChange={(e) => setNovaInfo(e.target.value)}
            slotProps={{ input: { style: { fontSize: 16 } } }}
          />
          <Button variant="contained" disabled={salvando || novaInfo.trim().length < 3} onClick={enviarAtualizacao}>
            {salvando ? 'Enviando...' : 'Enviar resposta'}
          </Button>
        </Paper>
      )}

      {(podeEditar || podeEditarMobile) && (
        <Paper sx={{ p: 2, mb: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: NAVY }}>
            Anexar fotos, vídeos ou arquivos
          </Typography>
          <PhotoCaptureMulti
            fotos={fotosNovas}
            onChange={setFotosNovas}
            max={10}
            disabled={enviandoFotos}
            inlineActions
            hideCaption
          />
          {fotosNovas.length > 0 && (
            <Button variant="outlined" disabled={enviandoFotos} onClick={enviarFotos}>
              {enviandoFotos ? 'Enviando...' : 'Enviar anexos'}
            </Button>
          )}
        </Paper>
      )}

      {podeFinalizar && (
        <Paper sx={{ p: 2, mb: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: NAVY }}>
            Encerrar chamado
          </Typography>
          <TextField
            label="Observação final (opcional)"
            multiline
            minRows={2}
            fullWidth
            size="small"
            value={obsEncerramento}
            onChange={(e) => setObsEncerramento(e.target.value)}
            placeholder="Descreva o que foi feito ou o motivo do encerramento"
            slotProps={{ input: { style: { fontSize: 16 } } }}
          />
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            <Button
              variant="contained"
              color="success"
              startIcon={<CheckCircleIcon />}
              disabled={finalizando}
              onClick={() => finalizarChamado('concluido')}
            >
              {finalizando ? 'Encerrando...' : 'Concluir chamado'}
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<CloseIcon />}
              disabled={finalizando}
              onClick={() => setDialogCancelar(true)}
            >
              Cancelar chamado
            </Button>
          </Box>
        </Paper>
      )}

      {erro && <Alert severity="error">{erro}</Alert>}

      <Dialog open={dialogCancelar} onClose={() => !finalizando && setDialogCancelar(false)}>
        <DialogTitle>Cancelar chamado?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            O chamado #{detalhe.numero} será cancelado.
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
    </Box>
  );
}
