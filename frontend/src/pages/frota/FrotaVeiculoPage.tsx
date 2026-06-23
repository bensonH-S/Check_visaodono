import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import PhotoCaptureMulti from '../../components/checklist/PhotoCaptureMulti';
import { api } from '../../api/client';
import type { FrotaDocumento, FrotaVeiculo } from '../../api/client';
import { extensaoMidia } from '../../utils/mediaFile';
import { selectMenuScrollProps } from '../../utils/selectMenuScroll';

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(',');
  const mime = meta.match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

const TIPOS_DOC = [
  { value: 'crlv', label: 'Documento do carro (CRLV)' },
  { value: 'multa', label: 'Multa' },
  { value: 'foto_veiculo', label: 'Foto do veículo' },
  { value: 'manutencao', label: 'Comprovante de manutenção' },
  { value: 'outro', label: 'Outro' },
];

export default function FrotaVeiculoPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [veiculos, setVeiculos] = useState<FrotaVeiculo[]>([]);
  const [meuVeiculo, setMeuVeiculo] = useState<FrotaVeiculo | null>(null);
  const [documentos, setDocumentos] = useState<FrotaDocumento[]>([]);
  const [idVeiculoAssumir, setIdVeiculoAssumir] = useState<number | ''>('');
  const [kmAssumir, setKmAssumir] = useState('');
  const [tipoDoc, setTipoDoc] = useState('crlv');
  const [tituloDoc, setTituloDoc] = useState('');
  const [fotosDoc, setFotosDoc] = useState<string[]>([]);
  const [descManut, setDescManut] = useState('');
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    setLoading(true);
    try {
      const [lista, resumo] = await Promise.all([api.frotaVeiculos(), api.frotaResumo()]);
      setVeiculos(lista);
      setMeuVeiculo(resumo.veiculo);
      if (resumo.veiculo) {
        const docs = await api.frotaDocumentos(resumo.veiculo.id_veiculo);
        setDocumentos(docs);
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void carregar();
  }, []);

  async function assumir() {
    if (!idVeiculoAssumir) {
      setErro('Selecione o veículo');
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      const r = await api.frotaAssumirVeiculo({
        id_veiculo: Number(idVeiculoAssumir),
        km_atual: kmAssumir ? Number(kmAssumir.replace(/\D/g, '')) : undefined,
      });
      setMeuVeiculo(r.veiculo);
      setOk('Controle do veículo assumido hoje.');
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao assumir');
    } finally {
      setSalvando(false);
    }
  }

  async function enviarDocumento(e: React.FormEvent) {
    e.preventDefault();
    if (!meuVeiculo) {
      setErro('Assuma um veículo primeiro');
      return;
    }
    if (!tituloDoc.trim()) {
      setErro('Informe o título');
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      const fd = new FormData();
      fd.append('tipo', tipoDoc);
      fd.append('titulo', tituloDoc.trim());
      if (fotosDoc[0]) {
        fd.append('arquivo', dataUrlToBlob(fotosDoc[0]), `doc.${extensaoMidia('image/jpeg')}`);
      }
      await api.frotaEnviarDocumento(meuVeiculo.id_veiculo, fd);
      setTituloDoc('');
      setFotosDoc([]);
      setOk('Documento enviado');
      const docs = await api.frotaDocumentos(meuVeiculo.id_veiculo);
      setDocumentos(docs);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro');
    } finally {
      setSalvando(false);
    }
  }

  async function enviarManutencao(e: React.FormEvent) {
    e.preventDefault();
    if (!meuVeiculo || !descManut.trim()) {
      setErro('Informe a descrição da manutenção');
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      const fd = new FormData();
      fd.append('descricao', descManut.trim());
      await api.frotaEnviarManutencaoVeiculo(meuVeiculo.id_veiculo, fd);
      setDescManut('');
      setOk('Manutenção registrada');
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro');
    } finally {
      setSalvando(false);
    }
  }

  if (loading) return <LinearProgress sx={{ mt: 1 }} />;

  return (
    <Box sx={{ px: 2, py: 1, pb: 4 }}>
      {erro && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErro('')}>{erro}</Alert>}
      {ok && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setOk('')}>{ok}</Alert>}

      <Paper sx={{ p: 2, mb: 2, borderRadius: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
          Assumir controle do carro
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Ao assumir, você declara responsabilidade pelo veículo a partir de hoje.
        </Typography>
        {meuVeiculo ? (
          <Alert severity="info" sx={{ mb: 2 }}>
            Veículo atual: <strong>{meuVeiculo.placa}</strong>
          </Alert>
        ) : null}
        <TextField
          select
          fullWidth
          label="Veículo"
          value={idVeiculoAssumir}
          onChange={(e) => setIdVeiculoAssumir(Number(e.target.value) || '')}
          sx={{ mb: 2 }}
          slotProps={{ select: selectMenuScrollProps }}
        >
          {veiculos.map((v) => (
            <MenuItem key={v.id_veiculo} value={v.id_veiculo}>
              {v.placa}
              {v.modelo ? ` — ${v.marca || ''} ${v.modelo}`.trim() : ''}
              {v.nome_responsavel && v.id_usuario_responsavel ? ` (${v.nome_responsavel})` : ''}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          fullWidth
          label="KM atual (opcional)"
          value={kmAssumir}
          onChange={(e) => setKmAssumir(e.target.value.replace(/[^\d]/g, ''))}
          inputMode="numeric"
          sx={{ mb: 2 }}
        />
        <Button fullWidth variant="contained" onClick={assumir} disabled={salvando}>
          Assumir controle hoje
        </Button>
      </Paper>

      {meuVeiculo && (
        <>
          <Paper component="form" onSubmit={enviarDocumento} sx={{ p: 2, mb: 2, borderRadius: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              Documentos / multas / fotos
            </Typography>
            <TextField
              select
              fullWidth
              label="Tipo"
              value={tipoDoc}
              onChange={(e) => setTipoDoc(e.target.value)}
              sx={{ mb: 2 }}
              slotProps={{ select: selectMenuScrollProps }}
            >
              {TIPOS_DOC.map((t) => (
                <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
              ))}
            </TextField>
            <TextField
              fullWidth
              label="Título / descrição"
              value={tituloDoc}
              onChange={(e) => setTituloDoc(e.target.value)}
              sx={{ mb: 2 }}
            />
            <PhotoCaptureMulti fotos={fotosDoc} onChange={setFotosDoc} max={1} />
            <Button fullWidth type="submit" variant="outlined" sx={{ mt: 2 }} disabled={salvando}>
              Enviar documento
            </Button>
          </Paper>

          <Paper component="form" onSubmit={enviarManutencao} sx={{ p: 2, mb: 2, borderRadius: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              Registrar manutenção
            </Typography>
            <TextField
              fullWidth
              multiline
              minRows={2}
              label="O que foi feito"
              value={descManut}
              onChange={(e) => setDescManut(e.target.value)}
              sx={{ mb: 2 }}
            />
            <Button fullWidth type="submit" variant="outlined" disabled={salvando}>
              Salvar manutenção
            </Button>
          </Paper>

          {documentos.length > 0 && (
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                Documentos enviados
              </Typography>
              {documentos.map((d) => (
                <Typography key={d.id_documento} variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                  {d.titulo} ({d.tipo})
                </Typography>
              ))}
            </Box>
          )}
        </>
      )}

      <Button fullWidth sx={{ mt: 2 }} onClick={() => navigate('/frota/mobile')}>
        Voltar ao início da frota
      </Button>
    </Box>
  );
}
