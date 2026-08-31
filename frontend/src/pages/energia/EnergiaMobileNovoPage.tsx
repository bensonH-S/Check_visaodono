import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import LinearProgress from '@mui/material/LinearProgress';
import PhotoCaptureMulti from '../../components/checklist/PhotoCaptureMulti';
import CkMarkLogoMenu from '../../components/CkMarkLogoMenu';
import { api, type Loja } from '../../api/client';
import { getUsuario, podeAbrirEnergia } from '../../lib/auth';
import { useChamadosMobileLoja } from '../../context/ChamadosMobileLojaContext';
import { extensaoMidia } from '../../utils/mediaFile';
import { selectMenuScrollProps } from '../../utils/selectMenuScroll';
import { showToast } from '../../utils/toast';
import {
  CONCESSIONARIAS,
  TIPOS_OCORRENCIA,
  agoraDatetimeLocal,
  datetimeLocalParaIso,
  dataUrlToBlob,
} from './energiaConstants';
import '../../components/visitas/visitas-mobile.css';
import '../../components/nc/nc-mobile.css';

const campoSx = {
  '& .MuiInputBase-input': { fontSize: 16 },
};

export default function EnergiaMobileNovoPage() {
  const navigate = useNavigate();
  const user = getUsuario();
  const { idLoja: idLojaCtx } = useChamadosMobileLoja();
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
        if (idLojaCtx) setIdLoja(idLojaCtx);
        else if (lista.length === 1) setIdLoja(lista[0].id_loja);
        else if (user?.lojas?.length === 1) setIdLoja(user.lojas[0].id_loja);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : 'Erro ao carregar lojas'));
  }, [idLojaCtx, user?.lojas]);

  async function salvar() {
    setErr('');
    if (!podeAbrirEnergia(user)) {
      setErr('Sem permissão para registrar.');
      return;
    }
    if (!idLoja) {
      setErr('Selecione a loja.');
      return;
    }
    if (!protocolo.trim()) {
      setErr('Informe o protocolo da ligação.');
      return;
    }
    if (!fotos.length) {
      setErr('Tire ao menos uma foto da ocorrência.');
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
      showToast('Protocolo registrado.');
      navigate(`/energia/mobile/${criado.id_chamado}`, { replace: true });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="ck-visitas ck-nc ck-nc--page">
      <div className="ck-visitas__stage" style={{ minHeight: 160 }}>
        <div className="ck-visitas__glow ck-visitas__glow--a" aria-hidden />
        <div className="ck-visitas__stage-inner">
          <div className="ck-visitas__hero-row">
            <div>
              <p className="ck-visitas__mark-text">Grupo Alvim</p>
              <h1 className="ck-visitas__title" style={{ fontSize: '1.55rem' }}>
                Novo protocolo
              </h1>
            </div>
            <CkMarkLogoMenu size={56} className="ck-visitas__mark-icon" />
          </div>
        </div>
      </div>

      <div className="ck-visitas__sheet">
        {salvando && <LinearProgress sx={{ mb: 1 }} />}
        {err && (
          <Alert severity="error" sx={{ mb: 1.5 }}>
            {err}
          </Alert>
        )}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pb: 2 }}>
          <TextField
            select
            required
            size="small"
            label="Loja"
            value={idLoja}
            onChange={(e) => setIdLoja(Number(e.target.value))}
            slotProps={{ select: selectMenuScrollProps }}
            sx={campoSx}
          >
            {lojas.map((l) => (
              <MenuItem key={l.id_loja} value={l.id_loja}>
                {l.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            required
            size="small"
            label="Protocolo da ligação"
            placeholder="Número gerado pela concessionária"
            value={protocolo}
            onChange={(e) => setProtocolo(e.target.value)}
            sx={campoSx}
          />
          <TextField
            select
            size="small"
            label="Concessionária"
            value={concessionaria}
            onChange={(e) => setConcessionaria(e.target.value)}
            helperText="Neoenergia ou genérico, se não souber o nome."
            slotProps={{ select: selectMenuScrollProps }}
            sx={campoSx}
          >
            {CONCESSIONARIAS.map((c) => (
              <MenuItem key={c.value} value={c.value}>
                {c.label}
              </MenuItem>
            ))}
          </TextField>
          {concessionaria === 'Outra' && (
            <TextField
              size="small"
              label="Nome da concessionária"
              value={concessionariaOutra}
              onChange={(e) => setConcessionariaOutra(e.target.value)}
              sx={campoSx}
            />
          )}
          <TextField
            select
            size="small"
            label="O que aconteceu"
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            slotProps={{ select: selectMenuScrollProps }}
            sx={campoSx}
          >
            {TIPOS_OCORRENCIA.map((t) => (
              <MenuItem key={t.value} value={t.value}>
                {t.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            required
            size="small"
            type="datetime-local"
            label="Data e hora"
            value={ocorrido}
            onChange={(e) => setOcorrido(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={campoSx}
          />
          <TextField
            size="small"
            multiline
            minRows={2}
            label="Detalhes (opcional)"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            sx={campoSx}
          />
          <PhotoCaptureMulti fotos={fotos} onChange={setFotos} max={10} obrigatoria inlineActions hideCaption />
          <Button variant="contained" onClick={() => void salvar()} disabled={salvando} sx={{ py: 1.2 }}>
            {salvando ? 'Salvando…' : 'Registrar protocolo'}
          </Button>
        </Box>
      </div>
    </div>
  );
}
