import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import LinearProgress from '@mui/material/LinearProgress';
import PhotoCaptureMulti from '../../components/checklist/PhotoCaptureMulti';
import CampoDataFrota, { dataHojeIso } from '../../components/frota/CampoDataFrota';
import { api, type Loja } from '../../api/client';
import { getUsuario, podeAbrirEnergia } from '../../lib/auth';
import { extensaoMidia } from '../../utils/mediaFile';
import { selectMenuScrollProps } from '../../utils/selectMenuScroll';
import { showToast } from '../../utils/toast';
import { colors } from '../../theme/tokens';
import { useAppTheme } from '../../context/ThemeContext';
import {
  CONCESSIONARIAS,
  TIPOS_OCORRENCIA,
  agoraDatetimeLocal,
  datetimeLocalParaIso,
  dataUrlToBlob,
} from './energiaConstants';

type Props = {
  onCancel: () => void;
  onSuccess: (idChamado: number) => void;
};

function partesAgora() {
  const agora = agoraDatetimeLocal();
  return { data: agora.slice(0, 10), hora: agora.slice(11, 16) };
}

/** Digita só números; insere `:` após 2 dígitos → HH:mm */
function formatarHoraDigitada(raw: string): string {
  const digitos = raw.replace(/\D/g, '').slice(0, 4);
  if (digitos.length <= 2) return digitos;
  return `${digitos.slice(0, 2)}:${digitos.slice(2)}`;
}

function horaValida(hhmm: string): boolean {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m) return false;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h >= 0 && h <= 23 && min >= 0 && min <= 59;
}

export default function EnergiaNovoForm({ onCancel, onSuccess }: Props) {
  const { mode } = useAppTheme();
  const escuro = mode === 'dark';
  const acento = escuro ? '#E8520A' : colors.navy;
  const acentoHover = escuro ? '#c94508' : colors.navyDark;
  const user = getUsuario();
  const inicial = partesAgora();
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [idLoja, setIdLoja] = useState<number | ''>('');
  const [protocolo, setProtocolo] = useState('');
  const [concessionaria, setConcessionaria] = useState('Concessionária de energia');
  const [concessionariaOutra, setConcessionariaOutra] = useState('');
  const [tipo, setTipo] = useState('falta_energia');
  const [dataOcorrido, setDataOcorrido] = useState(inicial.data);
  const [horaOcorrido, setHoraOcorrido] = useState(inicial.hora);
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
    if (!horaValida(horaOcorrido)) {
      setErr('Informe a hora no formato HH:MM (ex.: 14:30).');
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
        ocorrido_em: datetimeLocalParaIso(`${dataOcorrido}T${horaOcorrido}`),
      });
      const fd = new FormData();
      fotos.forEach((url, i) => {
        const blob = dataUrlToBlob(url);
        fd.append('fotos', blob, `foto-${i + 1}${extensaoMidia(blob)}`);
      });
      await api.energiaEnviarFotos(criado.id_chamado, fd);
      showToast('Ocorrência registrada com o protocolo.');
      onSuccess(criado.id_chamado);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {salvando && <LinearProgress />}
      {err && <Alert severity="error">{err}</Alert>}

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
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1.4fr 1fr' }, gap: 2 }}>
        <CampoDataFrota
          label="Data"
          value={dataOcorrido}
          onChange={setDataOcorrido}
          max={dataHojeIso()}
        />
        <TextField
          required
          label="Hora"
          value={horaOcorrido}
          onChange={(e) => setHoraOcorrido(formatarHoraDigitada(e.target.value))}
          placeholder="14:30"
          slotProps={{
            inputLabel: { shrink: true },
            htmlInput: { inputMode: 'numeric', maxLength: 5, autoComplete: 'off' },
          }}
        />
      </Box>
      <TextField
        multiline
        minRows={3}
        label="O que aconteceu"
        placeholder="Ex.: queda de energia, oscilação, equipamento queimou…"
        value={descricao}
        onChange={(e) => setDescricao(e.target.value)}
      />
      <PhotoCaptureMulti fotos={fotos} onChange={setFotos} max={10} obrigatoria inlineActions />
      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', pt: 0.5 }}>
        <Button
          variant="outlined"
          onClick={onCancel}
          disabled={salvando}
          sx={{
            textTransform: 'none',
            fontWeight: 600,
            color: colors.textSecondary,
            borderColor: colors.borderStrong,
            '&:hover': { bgcolor: colors.canvasAlt, color: colors.textPrimary },
          }}
        >
          Cancelar
        </Button>
        <Button
          variant="contained"
          onClick={() => void salvar()}
          disabled={salvando}
          sx={{
            textTransform: 'none',
            fontWeight: 700,
            bgcolor: acento,
            '&:hover': { bgcolor: acentoHover },
          }}
        >
          {salvando ? 'Salvando…' : 'Registrar'}
        </Button>
      </Box>
    </Box>
  );
}
