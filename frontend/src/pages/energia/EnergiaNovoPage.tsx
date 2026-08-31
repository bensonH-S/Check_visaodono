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
import PhotoCaptureMulti from '../../components/checklist/PhotoCaptureMulti';
import { api, type Loja } from '../../api/client';
import { getUsuario, podeAbrirEnergia } from '../../lib/auth';
import { extensaoMidia } from '../../utils/mediaFile';
import { selectMenuScrollProps } from '../../utils/selectMenuScroll';
import { showToast } from '../../utils/toast';
import { colors } from '../../theme/tokens';
import {
  CONCESSIONARIAS,
  TIPOS_OCORRENCIA,
  agoraDatetimeLocal,
  datetimeLocalParaIso,
  dataUrlToBlob,
} from './energiaConstants';

export default function EnergiaNovoPage() {
  const navigate = useNavigate();
  const user = getUsuario();
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [idLoja, setIdLoja] = useState<number | ''>('');
  const [protocolo, setProtocolo] = useState('');
  const [concessionaria, setConcessionaria] = useState('Concessionária de energia');
  const [concessionariaOutra, setConcessionariaOutra] = useState('');
  const [tipo, setTipo] = useState('falta_energia');
  const [ocorrido, setOcorrido] = useState(agoraDatetimeLocal);
  const [descricao, setDescricao] = useState('');
  const [fotos, setFotos] = useState<string[]>([]);
  const [err, setErr] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    api
      .lojas({ ativas: true, operacionais: true })
      .then((lista) => {
        setLojas(lista);
        if (lista.length === 1) setIdLoja(lista[0].id_loja);
        else if (user?.lojas?.length === 1) setIdLoja(user.lojas[0].id_loja);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : 'Erro ao carregar lojas'));
  }, [user?.lojas]);

  async function salvar() {
    setErr('');
    if (!podeAbrirEnergia(user)) {
      setErr('Sem permissão para registrar ocorrência.');
      return;
    }
    if (!idLoja) {
      setErr('Selecione a loja.');
      return;
    }
    if (!protocolo.trim()) {
      setErr('Informe o protocolo gerado na ligação.');
      return;
    }
    if (!fotos.length) {
      setErr('Anexe ao menos uma foto da ocorrência.');
      return;
    }
    const nomeConcessionaria =
      concessionaria === 'Outra' ? concessionariaOutra.trim() || 'Concessionária de energia' : concessionaria;

    setSalvando(true);
    try {
      const criado = await api.energiaCriar({
        id_loja: Number(idLoja),
        protocolo: protocolo.trim(),
        concessionaria: nomeConcessionaria,
        tipo_ocorrencia: tipo,
        descricao: descricao.trim(),
        ocorrido_em: datetimeLocalParaIso(ocorrido),
      });
      const fd = new FormData();
      fotos.forEach((url, i) => {
        const blob = dataUrlToBlob(url);
        fd.append('fotos', blob, `foto-${i + 1}${extensaoMidia(blob)}`);
      });
      await api.energiaEnviarFotos(criado.id_chamado, fd);
      showToast('Ocorrência registrada com o protocolo.');
      navigate(`/energia/${criado.id_chamado}`, { replace: true });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Box sx={{ maxWidth: 640, mx: 'auto', py: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 700, color: colors.navy }}>
          Registrar ocorrência de energia
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Ao ligar para a Neoenergia ou outra concessionária, anote o protocolo e registre aqui com fotos.
        </Typography>
      </Box>

      {salvando && <LinearProgress />}
      {err && <Alert severity="error">{err}</Alert>}

      <Paper variant="outlined" sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          select
          required
          label="Loja"
          value={idLoja}
          onChange={(e) => setIdLoja(Number(e.target.value))}
          slotProps={{ select: selectMenuScrollProps }}
        >
          {lojas.map((l) => (
            <MenuItem key={l.id_loja} value={l.id_loja}>
              {l.name}
              {l.bk_number ? ` · BKN ${l.bk_number}` : ''}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          required
          label="Protocolo"
          placeholder="Número gerado na ligação"
          value={protocolo}
          onChange={(e) => setProtocolo(e.target.value)}
        />
        <TextField
          select
          label="Concessionária"
          value={concessionaria}
          onChange={(e) => setConcessionaria(e.target.value)}
          helperText="Se não souber o nome da empresa, deixe a opção genérica."
          slotProps={{ select: selectMenuScrollProps }}
        >
          {CONCESSIONARIAS.map((c) => (
            <MenuItem key={c.value} value={c.value}>
              {c.label}
            </MenuItem>
          ))}
        </TextField>
        {concessionaria === 'Outra' && (
          <TextField
            label="Nome da concessionária"
            value={concessionariaOutra}
            onChange={(e) => setConcessionariaOutra(e.target.value)}
          />
        )}
        <TextField
          select
          label="Tipo de ocorrência"
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          slotProps={{ select: selectMenuScrollProps }}
        >
          {TIPOS_OCORRENCIA.map((t) => (
            <MenuItem key={t.value} value={t.value}>
              {t.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          required
          type="datetime-local"
          label="Data e hora"
          value={ocorrido}
          onChange={(e) => setOcorrido(e.target.value)}
          helperText="Preenchido automaticamente no momento do registro."
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          multiline
          minRows={3}
          label="O que aconteceu"
          placeholder="Ex.: queda de energia, oscilação, equipamento queimou…"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
        />
        <PhotoCaptureMulti fotos={fotos} onChange={setFotos} max={10} obrigatoria inlineActions />
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          <Button onClick={() => navigate('/energia')} disabled={salvando}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={() => void salvar()} disabled={salvando}>
            {salvando ? 'Salvando…' : 'Registrar'}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
