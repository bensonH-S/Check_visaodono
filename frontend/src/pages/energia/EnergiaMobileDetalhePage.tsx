import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import LinearProgress from '@mui/material/LinearProgress';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import PhotoCaptureMulti from '../../components/checklist/PhotoCaptureMulti';
import ChamadoAnexosGaleria from '../../components/manutencao/ChamadoAnexosGaleria';
import CkMarkLogoMenu from '../../components/CkMarkLogoMenu';
import { api, type EnergiaChamadoDetalhe, type ManutAnexo } from '../../api/client';
import { getUsuario, podeAbrirEnergia } from '../../lib/auth';
import { formatDataHoraBalaoMapa } from '../../utils/dateBr';
import { extensaoMidia } from '../../utils/mediaFile';
import { gerarPdfEnergia } from '../../utils/gerarPdfEnergia';
import { showToast } from '../../utils/toast';
import {
  STATUS_ABERTOS,
  rotuloStatusEnergia,
  rotuloTipoOcorrencia,
  type EnergiaStatus,
  dataUrlToBlob,
} from './energiaConstants';
import '../../components/visitas/visitas-mobile.css';
import '../../components/nc/nc-mobile.css';

export default function EnergiaMobileDetalhePage() {
  const { idChamado } = useParams();
  const navigate = useNavigate();
  const podeAbrir = podeAbrirEnergia(getUsuario());
  const [item, setItem] = useState<EnergiaChamadoDetalhe | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [fotosNovas, setFotosNovas] = useState<string[]>([]);
  const [observacaoFinal, setObservacaoFinal] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const id = Number(idChamado);
    if (!id) return;
    api
      .energiaDetalhe(id)
      .then(setItem)
      .catch((e) => setErr(e instanceof Error ? e.message : 'Erro ao carregar'))
      .finally(() => setLoading(false));
  }, [idChamado]);

  const aberto = item ? STATUS_ABERTOS.has(item.status as EnergiaStatus) : false;

  async function mudarStatus(status: 'aberto' | 'em_andamento') {
    if (!item) return;
    setBusy(true);
    try {
      setItem(await api.energiaAtualizar(item.id_chamado, { status }));
      showToast('Status atualizado.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao atualizar');
    } finally {
      setBusy(false);
    }
  }

  async function enviarFotos() {
    if (!item || !fotosNovas.length) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fotosNovas.forEach((url, i) => {
        const blob = dataUrlToBlob(url);
        fd.append('fotos', blob, `foto-${i + 1}${extensaoMidia(blob)}`);
      });
      setItem(await api.energiaEnviarFotos(item.id_chamado, fd));
      setFotosNovas([]);
      showToast('Fotos anexadas.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao enviar fotos');
    } finally {
      setBusy(false);
    }
  }

  async function finalizar() {
    if (!item) return;
    setBusy(true);
    try {
      const atualizado = await api.energiaFinalizar(item.id_chamado, {
        observacao_final: observacaoFinal.trim(),
      });
      setItem(atualizado);
      showToast('Finalizado. Gerando relatório…');
      await gerarPdfEnergia(atualizado);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao finalizar');
    } finally {
      setBusy(false);
    }
  }

  async function baixarPdf() {
    if (!item) return;
    setBusy(true);
    try {
      await gerarPdfEnergia(await api.energiaDetalhe(item.id_chamado));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao gerar PDF');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="ck-visitas ck-nc">
        <LinearProgress />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="ck-visitas ck-nc" style={{ padding: 16 }}>
        <Alert severity="error">{err || 'Não encontrado.'}</Alert>
        <Button sx={{ mt: 2 }} onClick={() => navigate('/energia/mobile')}>
          Voltar
        </Button>
      </div>
    );
  }

  return (
    <div className="ck-visitas ck-nc ck-nc--page">
      <div className="ck-visitas__stage" style={{ minHeight: 150 }}>
        <div className="ck-visitas__glow ck-visitas__glow--a" aria-hidden />
        <div className="ck-visitas__stage-inner">
          <div className="ck-visitas__hero-row">
            <div>
              <p className="ck-visitas__mark-text">Energia #{item.numero}</p>
              <h1 className="ck-visitas__title" style={{ fontSize: '1.4rem' }}>
                {item.protocolo}
              </h1>
              <p className="ck-visitas__sub" style={{ marginTop: 6 }}>
                {item.nome_loja} · {rotuloStatusEnergia(item.status)}
              </p>
            </div>
            <CkMarkLogoMenu size={56} className="ck-visitas__mark-icon" />
          </div>
        </div>
      </div>

      <div className="ck-visitas__sheet">
        {busy && <LinearProgress sx={{ mb: 1 }} />}
        {err && (
          <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setErr('')}>
            {err}
          </Alert>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, pb: 2 }}>
          <Campo label="Concessionária" valor={item.concessionaria} />
          <Campo label="Tipo" valor={rotuloTipoOcorrencia(item.tipo_ocorrencia)} />
          <Campo label="Quando" valor={formatDataHoraBalaoMapa(item.ocorrido_em)} />
          <Campo label="Registrado por" valor={item.nome_abriu} />
          {item.descricao && <Campo label="Detalhes" valor={item.descricao} />}
          {item.status === 'finalizado' && (
            <>
              <Campo label="Finalizado" valor={formatDataHoraBalaoMapa(item.finalizado_em)} />
              {item.observacao_final && <Campo label="Encerramento" valor={item.observacao_final} />}
            </>
          )}

          <ChamadoAnexosGaleria
            anexos={item.anexos as ManutAnexo[]}
            emptyText="Nenhuma foto ainda."
            tamanhoMiniatura={72}
          />

          {podeAbrir && aberto && (
            <>
              <TextField
                select
                size="small"
                label="Status"
                value={item.status}
                onChange={(e) => void mudarStatus(e.target.value as 'aberto' | 'em_andamento')}
              >
                <MenuItem value="aberto">Aberto</MenuItem>
                <MenuItem value="em_andamento">Em andamento</MenuItem>
              </TextField>
              <PhotoCaptureMulti fotos={fotosNovas} onChange={setFotosNovas} max={10} inlineActions compactThumbs hideCaption />
              {fotosNovas.length > 0 && (
                <Button variant="outlined" onClick={() => void enviarFotos()} disabled={busy}>
                  Anexar fotos
                </Button>
              )}
              <TextField
                size="small"
                multiline
                minRows={2}
                label="Observação ao finalizar (opcional)"
                value={observacaoFinal}
                onChange={(e) => setObservacaoFinal(e.target.value)}
              />
              <Button
                variant="contained"
                color="success"
                disabled={busy || !item.anexos.length}
                onClick={() => void finalizar()}
              >
                Finalizar e gerar relatório
              </Button>
            </>
          )}

          {item.status === 'finalizado' && (
            <Button variant="contained" disabled={busy} onClick={() => void baixarPdf()}>
              Baixar relatório PDF
            </Button>
          )}
        </Box>
      </div>
    </div>
  );
}

function Campo({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', letterSpacing: 0.4 }}>{label.toUpperCase()}</div>
      <div style={{ fontSize: 15, fontWeight: 650, color: '#1B2A6B', marginTop: 2 }}>{valor}</div>
    </div>
  );
}
