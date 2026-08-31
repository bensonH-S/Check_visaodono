import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import LinearProgress from '@mui/material/LinearProgress';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import PhotoCaptureMulti from '../../components/checklist/PhotoCaptureMulti';
import ChamadoAnexosGaleria from '../../components/manutencao/ChamadoAnexosGaleria';
import { api, type EnergiaChamadoDetalhe, type ManutAnexo } from '../../api/client';
import { getUsuario, podeAbrirEnergia } from '../../lib/auth';
import { formatDataHoraBalaoMapa } from '../../utils/dateBr';
import { extensaoMidia } from '../../utils/mediaFile';
import { gerarPdfEnergia } from '../../utils/gerarPdfEnergia';
import { showToast } from '../../utils/toast';
import { colors } from '../../theme/tokens';
import {
  STATUS_ABERTOS,
  STATUS_ENERGIA,
  rotuloTipoOcorrencia,
  type EnergiaStatus,
  dataUrlToBlob,
} from './energiaConstants';

export default function EnergiaDetalhePage() {
  const { idChamado } = useParams();
  const navigate = useNavigate();
  const podeAbrir = podeAbrirEnergia(getUsuario());
  const [item, setItem] = useState<EnergiaChamadoDetalhe | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [fotosNovas, setFotosNovas] = useState<string[]>([]);
  const [enviandoFotos, setEnviandoFotos] = useState(false);
  const [statusLocal, setStatusLocal] = useState('');
  const [finalizarAberto, setFinalizarAberto] = useState(false);
  const [observacaoFinal, setObservacaoFinal] = useState('');
  const [finalizando, setFinalizando] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);

  function carregar() {
    const id = Number(idChamado);
    if (!id) return;
    setLoading(true);
    api
      .energiaDetalhe(id)
      .then((d) => {
        setItem(d);
        setStatusLocal(d.status);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : 'Erro ao carregar'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    carregar();
  }, [idChamado]);

  const aberto = item ? STATUS_ABERTOS.has(item.status as EnergiaStatus) : false;
  const st = item ? STATUS_ENERGIA[item.status as EnergiaStatus] : null;

  async function salvarStatus(proximo: 'aberto' | 'em_andamento') {
    if (!item) return;
    try {
      const atualizado = await api.energiaAtualizar(item.id_chamado, { status: proximo });
      setItem(atualizado);
      setStatusLocal(atualizado.status);
      showToast('Status atualizado.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao atualizar status');
    }
  }

  async function enviarFotos() {
    if (!item || !fotosNovas.length) return;
    setEnviandoFotos(true);
    setErr('');
    try {
      const fd = new FormData();
      fotosNovas.forEach((url, i) => {
        const blob = dataUrlToBlob(url);
        fd.append('fotos', blob, `foto-${i + 1}${extensaoMidia(blob)}`);
      });
      const atualizado = await api.energiaEnviarFotos(item.id_chamado, fd);
      setItem(atualizado);
      setFotosNovas([]);
      showToast('Fotos anexadas.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao enviar fotos');
    } finally {
      setEnviandoFotos(false);
    }
  }

  async function finalizar() {
    if (!item) return;
    setFinalizando(true);
    setErr('');
    try {
      const atualizado = await api.energiaFinalizar(item.id_chamado, {
        observacao_final: observacaoFinal.trim(),
      });
      setItem(atualizado);
      setFinalizarAberto(false);
      showToast('Chamado finalizado. Gerando relatório…');
      setGerandoPdf(true);
      await gerarPdfEnergia(atualizado);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao finalizar');
    } finally {
      setFinalizando(false);
      setGerandoPdf(false);
    }
  }

  async function baixarRelatorio() {
    if (!item) return;
    setGerandoPdf(true);
    setErr('');
    try {
      const atual = await api.energiaDetalhe(item.id_chamado);
      await gerarPdfEnergia(atual);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao gerar relatório');
    } finally {
      setGerandoPdf(false);
    }
  }

  if (loading) return <LinearProgress />;
  if (!item) {
    return (
      <Alert severity="error" action={<Button onClick={() => navigate('/energia')}>Voltar</Button>}>
        {err || 'Chamado não encontrado.'}
      </Alert>
    );
  }

  return (
    <Box sx={{ maxWidth: 760, mx: 'auto', py: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/energia')}>
          Voltar
        </Button>
        <Typography variant="h6" sx={{ fontWeight: 700, color: colors.navy, flex: 1 }}>
          Energia #{item.numero}
        </Typography>
        <Chip size="small" label={st?.label ?? item.status} color={st?.color ?? 'default'} />
      </Box>

      {err && <Alert severity="error">{err}</Alert>}
      {(enviandoFotos || gerandoPdf) && <LinearProgress />}

      <Paper variant="outlined" sx={{ p: 2.5, display: 'grid', gap: 1.25 }}>
        <Linha label="Loja" valor={`${item.nome_loja}${item.bk_number ? ` · BKN ${item.bk_number}` : ''}`} />
        <Linha label="Protocolo" valor={item.protocolo} mono />
        <Linha label="Concessionária" valor={item.concessionaria} />
        <Linha label="Tipo" valor={rotuloTipoOcorrencia(item.tipo_ocorrencia)} />
        <Linha label="Quando" valor={formatDataHoraBalaoMapa(item.ocorrido_em)} />
        <Linha label="Registrado por" valor={item.nome_abriu} />
        {item.descricao && <Linha label="Ocorrência" valor={item.descricao} />}
        {item.status === 'finalizado' && (
          <>
            <Linha label="Finalizado em" valor={formatDataHoraBalaoMapa(item.finalizado_em)} />
            <Linha label="Finalizado por" valor={item.nome_finalizou || '—'} />
            {item.observacao_final && <Linha label="Encerramento" valor={item.observacao_final} />}
          </>
        )}
      </Paper>

      {podeAbrir && aberto && (
        <Paper variant="outlined" sx={{ p: 2, display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField
            select
            size="small"
            label="Status"
            value={statusLocal}
            onChange={(e) => {
              const v = e.target.value as 'aberto' | 'em_andamento';
              setStatusLocal(v);
              void salvarStatus(v);
            }}
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="aberto">Aberto</MenuItem>
            <MenuItem value="em_andamento">Em andamento</MenuItem>
          </TextField>
          <Button variant="contained" color="success" onClick={() => setFinalizarAberto(true)}>
            Finalizar e gerar relatório
          </Button>
        </Paper>
      )}

      {item.status === 'finalizado' && (
        <Button
          variant="contained"
          startIcon={<PictureAsPdfIcon />}
          onClick={() => void baixarRelatorio()}
          disabled={gerandoPdf}
        >
          {gerandoPdf ? 'Gerando PDF…' : 'Baixar relatório'}
        </Button>
      )}

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1.5, color: colors.navy }}>
          Fotos ({item.anexos.length})
        </Typography>
        <ChamadoAnexosGaleria
          anexos={item.anexos as ManutAnexo[]}
          emptyText="Nenhuma foto anexada."
          tamanhoMiniatura={88}
        />
        {podeAbrir && aberto && (
          <Box sx={{ mt: 2 }}>
            <PhotoCaptureMulti fotos={fotosNovas} onChange={setFotosNovas} max={10} inlineActions compactThumbs />
            {fotosNovas.length > 0 && (
              <Button sx={{ mt: 1 }} variant="outlined" onClick={() => void enviarFotos()} disabled={enviandoFotos}>
                Anexar fotos
              </Button>
            )}
          </Box>
        )}
      </Paper>

      <Dialog open={finalizarAberto} onClose={() => !finalizando && setFinalizarAberto(false)} fullWidth maxWidth="sm">
        <DialogTitle>Finalizar chamado</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            O relatório em PDF fica disponível para o gestor com protocolo, data/hora e fotos.
          </Typography>
          <TextField
            fullWidth
            multiline
            minRows={3}
            label="Observação de encerramento (opcional)"
            value={observacaoFinal}
            onChange={(e) => setObservacaoFinal(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFinalizarAberto(false)} disabled={finalizando}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={() => void finalizar()} disabled={finalizando || !item.anexos.length}>
            {finalizando ? 'Finalizando…' : 'Finalizar e baixar PDF'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function Linha({ label, valor, mono }: { label: string; valor: string; mono?: boolean }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: 0.4 }}>
        {label.toUpperCase()}
      </Typography>
      <Typography
        variant="body2"
        sx={{ fontWeight: 600, color: colors.navy, fontFamily: mono ? 'ui-monospace, monospace' : undefined }}
      >
        {valor}
      </Typography>
    </Box>
  );
}
